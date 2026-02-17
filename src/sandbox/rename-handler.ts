import { StorageManager } from './storage-manager';
import {
  generateRenamePreview,
  applyRenaming,
  shouldIgnoreNode,
  shouldRenameNode,
} from './rename-helpers';
import { RenamePreview } from '../shared/types';
import { sendToUI } from '../shared/messages';
import { ApiClient } from './api-client';
import { SimpleAbortSignal } from '../shared/abort-helper';

/**
 * Обработчик команд переименования
 */
export class RenameHandler {
  private apiClient: ApiClient;

  constructor(private storageManager: StorageManager, apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Инициализация - загрузка настроек переименования
   */
  async initialize(): Promise<void> {
    const settings = await this.storageManager.loadRenameSettings();
    sendToUI({
      type: 'rename-settings-loaded',
      settings,
    });
  }

  /**
   * Генерация превью переименования
   */
  async handlePreview(presetId: string): Promise<void> {
    try {
      // Проверяем выделение
      const selection = figma.currentPage.selection;

      if (selection.length === 0) {
        sendToUI({
          type: 'notification',
          message: 'Please select at least one frame, group, or text layer',
          level: 'warning',
        });
        return;
      }

      // Загружаем настройки
      const settings = await this.storageManager.loadRenameSettings();
      const preset = settings.presets.find((p) => p.id === presetId);

      if (!preset) {
        sendToUI({
          type: 'notification',
          message: 'Preset not found',
          level: 'error',
        });
        return;
      }

      console.log(`[RenameHandler] Generating preview with preset: ${preset.name}`);

      // Генерируем превью
      const preview = generateRenamePreview(selection, preset);

      console.log(`[RenameHandler] Preview generated: ${preview.length} changes`);

      // Отправляем превью в UI
      sendToUI({
        type: 'rename-preview-result',
        preview,
      });
    } catch (error) {
      console.error('[RenameHandler] Failed to generate preview:', error);
      sendToUI({
        type: 'notification',
        message: `Failed to generate preview: ${error.message}`,
        level: 'error',
      });
    }
  }

  /**
   * Применение переименования
   */
  async handleApply(preview: RenamePreview[], presetId: string): Promise<void> {
    try {
      console.log(`[RenameHandler] Applying renaming to ${preview.length} nodes`);

      // Применяем переименование (теперь async)
      const renamedCount = await applyRenaming(preview);

      console.log(`[RenameHandler] Renamed ${renamedCount} nodes`);

      // Обновляем lastUsedPresetId
      const settings = await this.storageManager.loadRenameSettings();
      settings.lastUsedPresetId = presetId;
      await this.storageManager.saveRenameSettings(settings);

      // Отправляем результат в UI
      sendToUI({
        type: 'rename-apply-result',
        renamedCount,
      });

      sendToUI({
        type: 'notification',
        message: `Successfully renamed ${renamedCount} layer${renamedCount !== 1 ? 's' : ''}`,
        level: 'success',
      });
    } catch (error) {
      console.error('[RenameHandler] Failed to apply renaming:', error);
      sendToUI({
        type: 'notification',
        message: `Failed to apply renaming: ${error.message}`,
        level: 'error',
      });
    }
  }

  /**
   * AI Rename: генерация имён через AI провайдер
   */
  async handleAIPreview(prompt: string, includeHierarchy: boolean): Promise<void> {
    try {
      // Проверяем выделение
      const selection = figma.currentPage.selection;

      if (selection.length === 0) {
        sendToUI({
          type: 'notification',
          message: 'Please select at least one frame, group, or text layer',
          level: 'warning',
        });
        // Отправляем пустой результат чтобы UI снял loading
        sendToUI({ type: 'rename-preview-result', preview: [] });
        return;
      }

      // Собираем информацию о слоях
      const layerInfoList = this.collectLayerInfo(selection, includeHierarchy);

      if (layerInfoList.length === 0) {
        sendToUI({
          type: 'notification',
          message: 'No renamable layers found in selection (components and vectors are skipped)',
          level: 'warning',
        });
        sendToUI({ type: 'rename-preview-result', preview: [] });
        return;
      }

      // Получаем активный провайдер
      const settings = await this.storageManager.loadSettings();
      const activeProviderId = settings.activeProviderId;

      if (!activeProviderId) {
        sendToUI({
          type: 'notification',
          message: 'No AI provider configured. Go to Settings to set up a provider.',
          level: 'error',
        });
        sendToUI({ type: 'rename-preview-result', preview: [] });
        return;
      }

      // Формируем системный промпт
      const systemPrompt = `You are a Figma layer naming assistant. You receive a list of layers and must suggest new names for them based on the user's instructions.

IMPORTANT: Respond ONLY with a valid JSON array. No explanations, no markdown code blocks, no extra text.
Each element must have exactly two fields: "nodeId" (string) and "newName" (string).

Example response:
[{"nodeId":"1:23","newName":"header-title"},{"nodeId":"1:24","newName":"nav-menu"}]`;

      // Формируем пользовательский промпт с данными о слоях
      let layerData = 'Layers to rename:\n';
      layerInfoList.forEach((info, i) => {
        layerData += `${i + 1}. nodeId: "${info.nodeId}", currentName: "${info.name}", type: ${info.type}`;
        if (info.textContent) {
          layerData += `, textContent: "${info.textContent}"`;
        }
        if (includeHierarchy && info.path) {
          layerData += `, path: "${info.path}"`;
        }
        layerData += '\n';
      });

      const fullPrompt = `${prompt}\n\n${layerData}`;

      console.log(`[RenameHandler] AI Preview: sending ${layerInfoList.length} layers to AI`);

      // Вызываем AI
      let responseText = '';
      const abortSignal = new SimpleAbortSignal();

      await this.apiClient.generateText({
        providerId: activeProviderId,
        prompt: fullPrompt,
        systemPrompt,
        settings: {
          temperature: 0.3, // Низкая температура для точности
          maxTokens: Math.max(2000, layerInfoList.length * 50), // ~50 tokens per layer
        },
        signal: abortSignal,
        onChunk: (chunk: string) => {
          responseText += chunk;
        },
      });

      console.log(`[RenameHandler] AI response received (${responseText.length} chars)`);

      // Парсим ответ AI
      const preview = this.parseAIResponse(responseText, layerInfoList);

      console.log(`[RenameHandler] AI Preview: ${preview.length} rename suggestions`);

      sendToUI({
        type: 'rename-preview-result',
        preview,
      });
    } catch (error: any) {
      console.error('[RenameHandler] AI Preview failed:', error);
      sendToUI({
        type: 'notification',
        message: `AI rename failed: ${error.message}`,
        level: 'error',
      });
      // Отправляем пустой результат чтобы UI снял loading
      sendToUI({ type: 'rename-preview-result', preview: [] });
    }
  }

  /**
   * Собрать информацию о слоях для AI
   */
  private collectLayerInfo(
    nodes: readonly SceneNode[],
    includeHierarchy: boolean
  ): Array<{
    nodeId: string;
    name: string;
    type: string;
    textContent?: string;
    path?: string;
    depth: number;
  }> {
    const result: Array<{
      nodeId: string;
      name: string;
      type: string;
      textContent?: string;
      path?: string;
      depth: number;
    }> = [];

    const processNode = (node: SceneNode, depth: number, parentPath: string) => {
      if (shouldIgnoreNode(node)) return;

      if (shouldRenameNode(node)) {
        const info: typeof result[0] = {
          nodeId: node.id,
          name: node.name,
          type: node.type,
          depth,
        };

        // Для текстовых слоёв добавляем содержимое
        if (node.type === 'TEXT') {
          info.textContent = (node as TextNode).characters.slice(0, 100); // Ограничиваем 100 символов
        }

        if (includeHierarchy && parentPath) {
          info.path = parentPath + ' > ' + node.name;
        }

        result.push(info);
      }

      // Рекурсивно обрабатываем детей
      if ('children' in node && !shouldIgnoreNode(node)) {
        const parent = node as FrameNode | GroupNode;
        const currentPath = includeHierarchy
          ? (parentPath ? parentPath + ' > ' + node.name : node.name)
          : '';

        for (const child of parent.children) {
          processNode(child, depth + 1, currentPath);
        }
      }
    };

    for (const node of nodes) {
      processNode(node, 0, '');
    }

    return result;
  }

  /**
   * Парсинг ответа AI в формат RenamePreview[]
   */
  private parseAIResponse(
    responseText: string,
    layerInfoList: Array<{
      nodeId: string;
      name: string;
      type: string;
      depth: number;
    }>
  ): RenamePreview[] {
    const previews: RenamePreview[] = [];

    try {
      // Пытаемся извлечь JSON из ответа (AI может обернуть его в markdown блок)
      let jsonStr = responseText.trim();

      // Убираем markdown code block если есть
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }

      // Ищем JSON массив
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (!arrayMatch) {
        throw new Error('No JSON array found in AI response');
      }

      const parsed = JSON.parse(arrayMatch[0]) as Array<{ nodeId: string; newName: string }>;

      if (!Array.isArray(parsed)) {
        throw new Error('AI response is not an array');
      }

      // Создаём lookup для быстрого доступа к информации о слоях
      const layerMap = new Map(layerInfoList.map(info => [info.nodeId, info]));

      for (const item of parsed) {
        if (!item.nodeId || !item.newName) continue;

        const layerInfo = layerMap.get(item.nodeId);
        if (!layerInfo) continue;

        // Добавляем только если имя изменилось
        if (layerInfo.name !== item.newName) {
          previews.push({
            nodeId: item.nodeId,
            nodeName: layerInfo.name,
            oldName: layerInfo.name,
            newName: item.newName,
            nodeType: layerInfo.type,
            depth: layerInfo.depth,
          });
        }
      }
    } catch (error: any) {
      console.error('[RenameHandler] Failed to parse AI response:', error);
      console.error('[RenameHandler] Raw response:', responseText);
      sendToUI({
        type: 'notification',
        message: `Failed to parse AI response: ${error.message}. Try rephrasing the prompt.`,
        level: 'error',
      });
    }

    return previews;
  }

  /**
   * Создание кастомного пресета
   */
  async handleCreatePreset(name: string, rules: any[]): Promise<void> {
    try {
      // TODO: Реализовать создание кастомного пресета
      sendToUI({
        type: 'notification',
        message: 'Custom preset creation will be available in the next version',
        level: 'info',
      });
    } catch (error) {
      console.error('[RenameHandler] Failed to create preset:', error);
      sendToUI({
        type: 'notification',
        message: `Failed to create preset: ${error.message}`,
        level: 'error',
      });
    }
  }
}
