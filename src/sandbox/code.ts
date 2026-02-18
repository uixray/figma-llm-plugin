import { UIToSandboxMessage, sendToUI } from '../shared/messages';
import { PLUGIN_WIDTH, PLUGIN_HEIGHT, DEFAULT_TOKEN_PRICES } from '../shared/constants';
import { StorageManager } from './storage-manager';
import { ApiClient } from './api-client';
import { getSelectedTextNodes, applyTextToNodes, applyDataSubstitution, applyDataSubstitutionSequential, reverseRenameByContent } from './figma-helpers';
import { withRetry } from './retry-helper';
import { generateUniqueId } from '../shared/utils';
import { SimpleAbortSignal, createTimeoutSignal } from '../shared/abort-helper';
import type { DataPreset } from '../shared/types';
// V2 Feature Handlers
import { RenameHandler } from './rename-handler';
import { PromptsHandler } from './prompts-handler';
import { BatchProcessor } from './batch-processor';
import { ProviderFactory } from './providers/ProviderFactory';
import { PROVIDER_CONFIGS } from '../shared/providers';
import { findModelById, modelToUserConfig } from '../shared/provider-groups-utils';

// Стандартные пресеты для быстрого доступа
const BUILT_IN_PRESETS: Record<string, DataPreset> = {
  user: {
    id: 'built-in-user',
    name: 'User',
    version: 1,
    fieldNames: ['name', 'email', 'phone', 'role'],
    defaultValues: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1 234 567-8900',
      role: 'Designer',
    },
    groups: [
      {
        id: 'user-1',
        name: 'User 1',
        values: { name: 'John Doe', email: 'john@example.com', phone: '+1 234 567-8900', role: 'Designer' },
      },
      {
        id: 'user-2',
        name: 'User 2',
        values: { name: 'Jane Smith', email: 'jane@example.com', phone: '+1 234 567-8901', role: 'Developer' },
      },
      {
        id: 'user-3',
        name: 'User 3',
        values: { name: 'Mike Johnson', email: 'mike@example.com', phone: '+1 234 567-8902', role: 'Manager' },
      },
    ],
    multiValueSeparator: ', ',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  product: {
    id: 'built-in-product',
    name: 'Product',
    version: 1,
    fieldNames: ['title', 'price', 'category', 'rating'],
    defaultValues: {
      title: 'Product Name',
      price: '$99.99',
      category: 'Electronics',
      rating: '4.5',
    },
    groups: [
      {
        id: 'product-1',
        name: 'Product 1',
        values: { title: 'Wireless Headphones', price: '$149.99', category: 'Electronics', rating: '4.8' },
      },
      {
        id: 'product-2',
        name: 'Product 2',
        values: { title: 'Smart Watch', price: '$299.99', category: 'Electronics', rating: '4.6' },
      },
      {
        id: 'product-3',
        name: 'Product 3',
        values: { title: 'USB-C Cable', price: '$19.99', category: 'Accessories', rating: '4.3' },
      },
    ],
    multiValueSeparator: ', ',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  place: {
    id: 'built-in-place',
    name: 'Place',
    version: 1,
    fieldNames: ['name', 'address', 'city', 'country'],
    defaultValues: {
      name: 'Place Name',
      address: '123 Main St',
      city: 'New York',
      country: 'USA',
    },
    groups: [
      {
        id: 'place-1',
        name: 'Place 1',
        values: { name: 'Central Park', address: 'Manhattan', city: 'New York', country: 'USA' },
      },
      {
        id: 'place-2',
        name: 'Place 2',
        values: { name: 'Golden Gate Bridge', address: 'San Francisco Bay', city: 'San Francisco', country: 'USA' },
      },
      {
        id: 'place-3',
        name: 'Place 3',
        values: { name: 'Eiffel Tower', address: 'Champ de Mars', city: 'Paris', country: 'France' },
      },
    ],
    multiValueSeparator: ', ',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  other: {
    id: 'built-in-other',
    name: 'Other',
    version: 1,
    fieldNames: ['title', 'description', 'date', 'status'],
    defaultValues: {
      title: 'Item Title',
      description: 'Item description here',
      date: '2024-01-01',
      status: 'Active',
    },
    groups: [
      {
        id: 'other-1',
        name: 'Item 1',
        values: { title: 'Task 1', description: 'Complete the project', date: '2024-03-15', status: 'In Progress' },
      },
      {
        id: 'other-2',
        name: 'Item 2',
        values: { title: 'Task 2', description: 'Review documentation', date: '2024-03-20', status: 'Pending' },
      },
      {
        id: 'other-3',
        name: 'Item 3',
        values: { title: 'Task 3', description: 'Deploy to production', date: '2024-03-25', status: 'Completed' },
      },
    ],
    multiValueSeparator: ', ',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  red: {
    id: 'built-in-red',
    name: 'Red',
    version: 1,
    fieldNames: ['text', 'background', 'accent'],
    defaultValues: {
      text: 'Red Text',
      background: '#FFEBEE',
      accent: '#F44336',
    },
    groups: [
      {
        id: 'red-1',
        name: 'Red Light',
        values: { text: '#D32F2F', background: '#FFEBEE', accent: '#EF5350' },
      },
      {
        id: 'red-2',
        name: 'Red Medium',
        values: { text: '#C62828', background: '#FFCDD2', accent: '#F44336' },
      },
      {
        id: 'red-3',
        name: 'Red Dark',
        values: { text: '#B71C1C', background: '#EF9A9A', accent: '#E53935' },
      },
    ],
    multiValueSeparator: ', ',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  blue: {
    id: 'built-in-blue',
    name: 'Blue',
    version: 1,
    fieldNames: ['text', 'background', 'accent'],
    defaultValues: {
      text: 'Blue Text',
      background: '#E3F2FD',
      accent: '#2196F3',
    },
    groups: [
      {
        id: 'blue-1',
        name: 'Blue Light',
        values: { text: '#1976D2', background: '#E3F2FD', accent: '#42A5F5' },
      },
      {
        id: 'blue-2',
        name: 'Blue Medium',
        values: { text: '#1565C0', background: '#BBDEFB', accent: '#2196F3' },
      },
      {
        id: 'blue-3',
        name: 'Blue Dark',
        values: { text: '#0D47A1', background: '#90CAF9', accent: '#1E88E5' },
      },
    ],
    multiValueSeparator: ', ',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  green: {
    id: 'built-in-green',
    name: 'Green',
    version: 1,
    fieldNames: ['text', 'background', 'accent'],
    defaultValues: {
      text: 'Green Text',
      background: '#E8F5E9',
      accent: '#4CAF50',
    },
    groups: [
      {
        id: 'green-1',
        name: 'Green Light',
        values: { text: '#388E3C', background: '#E8F5E9', accent: '#66BB6A' },
      },
      {
        id: 'green-2',
        name: 'Green Medium',
        values: { text: '#2E7D32', background: '#C8E6C9', accent: '#4CAF50' },
      },
      {
        id: 'green-3',
        name: 'Green Dark',
        values: { text: '#1B5E20', background: '#A5D6A7', accent: '#43A047' },
      },
    ],
    multiValueSeparator: ', ',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  yellow: {
    id: 'built-in-yellow',
    name: 'Yellow',
    version: 1,
    fieldNames: ['text', 'background', 'accent'],
    defaultValues: {
      text: 'Yellow Text',
      background: '#FFFDE7',
      accent: '#FFEB3B',
    },
    groups: [
      {
        id: 'yellow-1',
        name: 'Yellow Light',
        values: { text: '#F9A825', background: '#FFFDE7', accent: '#FFEE58' },
      },
      {
        id: 'yellow-2',
        name: 'Yellow Medium',
        values: { text: '#F57F17', background: '#FFF9C4', accent: '#FFEB3B' },
      },
      {
        id: 'yellow-3',
        name: 'Yellow Dark',
        values: { text: '#F57C00', background: '#FFF59D', accent: '#FDD835' },
      },
    ],
    multiValueSeparator: ', ',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
};

/**
 * Главный класс плагина
 */
class PluginSandbox {
  private storageManager: StorageManager;
  private apiClient: ApiClient;
  private activeGenerations = new Map<string, SimpleAbortSignal>();
  private pendingTranslation: { textNode: TextNode; originalText: string } | null = null;

  // V2 Feature Handlers
  private renameHandler: RenameHandler;
  private promptsHandler: PromptsHandler;
  private batchProcessor: BatchProcessor;

  constructor() {
    this.storageManager = new StorageManager();
    this.apiClient = new ApiClient(this.storageManager);

    // Initialize V2 handlers
    this.renameHandler = new RenameHandler(this.storageManager, this.apiClient);
    this.promptsHandler = new PromptsHandler(this.storageManager);
    this.batchProcessor = new BatchProcessor();

    this.setupMessageListener();
    this.initializePlugin();
  }

  /**
   * Инициализация плагина
   */
  private async initializePlugin(): Promise<void> {
    // Проверяем команду
    const command = figma.command;

    if (command === 'open-plugin') {
      // Открываем полный UI плагина
      figma.showUI(__html__, {
        width: PLUGIN_WIDTH,
        height: PLUGIN_HEIGHT,
        themeColors: true,
      });
    } else if (command === 'quick-apply') {
      // Показываем компактное окно для выбора пресета
      await this.showQuickApplyUI();
    } else if (command === 'reverse-rename') {
      // Показываем окно для выбора пресета для обратного переименования
      await this.showReverseRenameUI();
    } else if (command && command.startsWith('builtin-')) {
      // Быстрое применение встроенного пресета
      const presetKey = command.replace('builtin-', '');
      const preset = BUILT_IN_PRESETS[presetKey];
      if (preset) {
        await this.quickApplyPreset(preset.id, preset);
      }
      figma.closePlugin();
    } else {
      // Дефолтное поведение - показываем полный UI
      figma.showUI(__html__, {
        width: PLUGIN_WIDTH,
        height: PLUGIN_HEIGHT,
        themeColors: true,
      });

      // Initialize V2 handlers AFTER UI is shown
      await this.renameHandler.initialize().catch(err => {
        console.error('Failed to initialize RenameHandler:', err);
      });
      await this.promptsHandler.initialize().catch(err => {
        console.error('Failed to initialize PromptsHandler:', err);
      });
    }

    console.log('Figma LLM Plugin initialized');
  }

  /**
   * Показать компактный UI для быстрого выбора пресета
   */
  private async showQuickApplyUI(): Promise<void> {
    const settings = await this.storageManager.loadDataPresets();

    if (settings.presets.length === 0) {
      figma.notify('No presets available. Create presets first.');
      figma.closePlugin();
      return;
    }

    // Создаём простой HTML для выбора
    let html = '<html><head><style>';
    html += 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 12px; margin: 0; font-size: 12px; }';
    html += '.preset-item { padding: 8px 12px; margin: 4px 0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; transition: all 0.2s; }';
    html += '.preset-item:hover { background: #f0f0f0; border-color: #18a0fb; }';
    html += '.preset-name { font-weight: 600; margin-bottom: 2px; }';
    html += '.preset-info { font-size: 10px; color: #999; }';
    html += '</style></head><body>';
    html += '<h3 style="margin: 0 0 12px 0;">Select Preset to Apply</h3>';

    for (const preset of settings.presets) {
      html += '<div class="preset-item" onclick="parent.postMessage({ pluginMessage: { type: \'quick-apply-preset\', presetId: \'' + preset.id + '\' } }, \'*\')">';
      html += '<div class="preset-name">' + preset.name + '</div>';
      html += '<div class="preset-info">' + preset.groups.length + ' groups</div>';
      html += '</div>';
    }

    html += '</body></html>';

    figma.showUI(html, {
      width: 300,
      height: Math.min(400, 100 + settings.presets.length * 60),
      themeColors: true,
    });
  }

  /**
   * Настройка слушателя сообщений от UI
   */
  private setupMessageListener(): void {
    figma.ui.onmessage = async (message: UIToSandboxMessage) => {
      await this.handleUIMessage(message);
    };
  }

  /**
   * Обработка сообщений от UI
   */
  private async handleUIMessage(message: any): Promise<void> {
    try {
      // Специальная обработка ui-ready для перевода
      if (message.type === 'ui-ready') {
        await this.executeTranslation();
        return;
      }

      switch (message.type) {
        case 'load-settings':
          await this.handleLoadSettings(message);
          break;
        case 'save-settings':
          await this.handleSaveSettings(message);
          break;
        case 'settings-updated':
          // Просто пересылаем сообщение в UI для обновления в реальном времени
          sendToUI({
            type: 'settings-updated',
            settings: message.settings,
          });
          break;
        case 'generate-text':
          await this.handleGenerateText(message);
          break;
        case 'apply-text':
          await this.handleApplyText(message);
          break;
        case 'cancel-generation':
          await this.handleCancelGeneration(message);
          break;
        case 'get-selected-text':
          await this.handleGetSelectedText(message);
          break;
        case 'test-connection':
          await this.handleTestConnection(message);
          break;
        case 'test-translation':
          await this.handleTestTranslation(message);
          break;
        case 'load-data-presets':
          await this.handleLoadDataPresets(message);
          break;
        case 'save-data-presets':
          await this.handleSaveDataPresets(message);
          break;
        case 'apply-data-substitution':
          await this.handleApplyDataSubstitution(message);
          break;
        case 'quick-apply-preset':
          await this.handleQuickApplyPreset(message);
          break;
        case 'reverse-rename':
          await this.handleReverseRename(message.presetId);
          break;

        // V2 Rename messages
        case 'load-rename-settings':
          await this.renameHandler.initialize();
          break;
        case 'rename-preview':
          await this.renameHandler.handlePreview(message.presetId);
          break;
        case 'rename-apply':
          await this.renameHandler.handleApply(message.preview, message.presetId);
          break;
        case 'ai-rename-preview':
          await this.renameHandler.handleAIPreview(message.prompt, message.providerId, message.includeHierarchy);
          break;

        // V2 Prompts messages
        case 'load-prompts-library':
          await this.promptsHandler.initialize();
          break;
        case 'save-prompt':
          await this.promptsHandler.handleSavePrompt(message.prompt);
          break;
        case 'update-prompt-usage':
          await this.promptsHandler.handleUpdateUsage(message.promptId);
          break;
        case 'delete-prompt':
          await this.promptsHandler.handleDeletePrompt(message.promptId);
          break;

        // V2 Batch processing
        case 'generate-batch':
          await this.handleGenerateBatch(message);
          break;

        // V2 Multi-field generation
        case 'get-selected-layers':
          await this.handleGetSelectedLayers(message);
          break;
        case 'generate-multi':
          await this.handleGenerateMulti(message);
          break;
        case 'cancel-multi-generation':
          this.handleCancelMultiGeneration(message);
          break;
        case 'apply-multi-results':
          await this.handleApplyMultiResults(message);
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendToUI({
        type: 'notification',
        level: 'error',
        message: error.message || 'Unknown error',
      });
    }
  }

  /**
   * Обработка загрузки настроек
   */
  private async handleLoadSettings(message: any): Promise<void> {
    try {
      const settings = await this.storageManager.loadSettings();

      sendToUI({
        type: 'settings-loaded',
        id: message.id,
        settings,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      sendToUI({
        type: 'notification',
        level: 'error',
        message: 'Failed to load settings',
      });
    }
  }

  /**
   * Обработка сохранения настроек
   */
  private async handleSaveSettings(message: any): Promise<void> {
    try {
      console.log('[Sandbox] Received save-settings message');
      console.log('[Sandbox] Settings to save:', JSON.stringify(message.settings, null, 2));

      await this.storageManager.saveSettings(message.settings);

      console.log('[Sandbox] Settings saved successfully');

      sendToUI({
        type: 'settings-saved',
        id: message.id,
        success: true,
      });

      sendToUI({
        type: 'notification',
        level: 'success',
        message: 'Settings saved',
      });
    } catch (error) {
      console.error('[Sandbox] Failed to save settings:', error);
      sendToUI({
        type: 'settings-saved',
        id: message.id,
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Обработка генерации текста
   */
  private async handleGenerateText(message: any): Promise<void> {
    const generationId = generateUniqueId();
    const abortSignal = new SimpleAbortSignal();
    this.activeGenerations.set(generationId, abortSignal);

    try {
      // V2.1: Получаем провайдер (поддержка groups и legacy configs)
      const settings = await this.storageManager.loadSettings();
      let config: any = null;

      // Пробуем найти в provider groups (V2.1)
      if (settings.providerGroups && settings.providerGroups.length > 0) {
        const modelInfo = findModelById(settings, message.providerId);
        if (modelInfo) {
          // Конвертируем ModelConfig + ProviderGroup в UserProviderConfig для совместимости
          config = modelToUserConfig(modelInfo.group, modelInfo.model);
        }
      }

      // Fallback на legacy providerConfigs (V2.0)
      if (!config && settings.providerConfigs) {
        config = settings.providerConfigs.find(c => c.id === message.providerId);
      }

      if (!config || !config.enabled) {
        throw new Error(
          '⚙️ Provider not found or disabled.\n' +
          'Go to Settings → Provider Groups → create a group with at least one model enabled.\n' +
          'Then select the model in the Generate tab dropdown.'
        );
      }

      const baseConfig = PROVIDER_CONFIGS.find(p => p.id === config.baseConfigId);
      if (!baseConfig) {
        throw new Error(
          '⚙️ Provider model configuration not found.\n' +
          `Base config "${config.baseConfigId}" does not exist in PROVIDER_CONFIGS.\n` +
          'Try deleting this provider group and creating a new one.'
        );
      }

      const provider = ProviderFactory.createProvider(config, baseConfig);

      const selectedTextNodes = await getSelectedTextNodes();

      // Системный промпт
      // Для per-layer режима: инструкция пользователя (напр. "Переведи на английский")
      // становится СИСТЕМНЫМ промптом, а текст каждого слоя — user message.
      // Это даёт модели чёткое разделение: "что делать" vs "с чем делать".
      const hasSelectedLayers = selectedTextNodes.length > 0;
      let systemPrompt: string;
      const cleanOutputSuffix = '\n\nIMPORTANT: Output ONLY the result. No explanations, labels, quotes, or extra text.';

      if (hasSelectedLayers) {
        // Per-layer режим: формируем system prompt из всех доступных инструкций
        if (message.systemPrompt && message.prompt) {
          // Есть и system prompt, и prompt — комбинируем оба
          systemPrompt = `${message.systemPrompt}\n\nUser instruction: ${message.prompt}${cleanOutputSuffix}`;
        } else if (message.systemPrompt) {
          // Только system prompt (из библиотеки промптов)
          systemPrompt = `${message.systemPrompt}${cleanOutputSuffix}`;
        } else {
          // Только prompt (пользователь ввёл в поле промпта)
          systemPrompt = `${message.prompt}${cleanOutputSuffix}`;
        }
      } else {
        // Без слоёв: стандартная схема
        systemPrompt = message.systemPrompt || 'You are a helpful assistant.';
      }

      // Уведомляем UI о начале генерации
      sendToUI({
        type: 'generation-started',
        id: message.id,
        generationId,
        selectionContextCount: selectedTextNodes.length,
      });

      const startTime = Date.now();
      let totalTokens = 0;
      let appliedCount = 0;
      let lastFullText = '';

      if (selectedTextNodes.length === 0) {
        // Нет выделенных слоёв — просто генерируем текст по промпту
        const result = await withRetry(async () => {
          return await provider.generateText(message.prompt, {
            ...message.settings,
            systemPrompt,
          });
        });

        lastFullText = result.text;
        totalTokens = result.tokens.input + result.tokens.output;

        // Отправляем результат как чанк для совместимости с UI
        sendToUI({
          type: 'generation-chunk',
          id: message.id,
          generationId,
          chunk: result.text,
          tokensGenerated: totalTokens,
        });
      } else {
        // Есть выделенные слои — обрабатываем КАЖДЫЙ ОТДЕЛЬНО
        console.log(`[PluginSandbox] Processing ${selectedTextNodes.length} layer(s) individually`);

        sendToUI({
          type: 'notification',
          level: 'info',
          message: `Processing ${selectedTextNodes.length} layer${selectedTextNodes.length !== 1 ? 's' : ''}...`,
        });

        // Few-shot: собираем успешные пары (вход → выход) для обучения модели формату
        const fewShotPairs: Array<{ role: 'user' | 'assistant'; text: string }> = [];

        for (let i = 0; i < selectedTextNodes.length; i++) {
          if (abortSignal.aborted) break;

          const node = selectedTextNodes[i];

          let layerResult = '';
          let layerTokens = 0;

          const layerResultObj = await withRetry(async () => {
            // Для per-layer: temperature 0 (детерминированный вывод)
            // и малый maxTokens чтобы модель не генерировала лишнее
            const layerSettings = {
              ...message.settings,
              systemPrompt,
              temperature: 0,
              maxTokens: Math.min(message.settings.maxTokens || 2000, 200),
            };

            // Промпт — ТОЛЬКО текст слоя. Инструкция уже в systemPrompt.
            return await provider.generateText(node.characters, layerSettings);
          });

          layerResult = layerResultObj.text;
          layerTokens = layerResultObj.tokens.input + layerResultObj.tokens.output;
          totalTokens += layerTokens;

          // Отправляем прогресс в UI
          sendToUI({
            type: 'generation-chunk',
            id: message.id,
            generationId,
            chunk: '',
            tokensGenerated: totalTokens,
          });

          // Постобработка: очистка ответа от мусора нейросети
          let cleanResult = this.cleanAIResponse(layerResult, node.characters);

          // Вставляем результат в ЭТОТ КОНКРЕТНЫЙ слой
          const applied = await applyTextToNodes(cleanResult, [node.id]);
          appliedCount += applied;

          console.log(`[PluginSandbox] Layer ${i + 1}/${selectedTextNodes.length} "${node.name}": "${node.characters}" → "${cleanResult}"`);

          // Добавляем успешную пару в few-shot (максимум 2 примера чтобы не раздувать запрос)
          if (fewShotPairs.length < 4) { // 4 = 2 пары по 2 messages
            fewShotPairs.push(
              { role: 'user', text: node.characters },
              { role: 'assistant', text: cleanResult },
            );
          }

          lastFullText = cleanResult;

          // Задержка между запросами чтобы не превысить rate limit
          if (i < selectedTextNodes.length - 1 && !abortSignal.aborted) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }

      const duration = Date.now() - startTime;
      const cost = this.calculateCost(message.providerId, totalTokens);

      // Трекаем использование
      await this.storageManager.trackTokenUsage(message.providerId, totalTokens, cost);

      // Генерация завершена
      sendToUI({
        type: 'generation-complete',
        id: message.id,
        generationId,
        fullText: lastFullText,
        tokensUsed: totalTokens,
        cost,
        duration,
        appliedCount,
      });
    } catch (error) {
      console.error('Generation error:', error);
      sendToUI({
        type: 'generation-error',
        id: message.id,
        generationId,
        error: error.message || 'Generation failed',
        retryable: error.retryable || false,
      });
    } finally {
      this.activeGenerations.delete(generationId);
    }
  }

  /**
   * Очистка ответа AI от мусора.
   * Работает корректно и для однострочных, и для многострочных текстов.
   *
   * Стратегия: сравниваем длину ответа с длиной оригинала.
   * Если ответ значительно длиннее (>3x) — значит модель нагенерировала мусор,
   * и нужно попробовать извлечь полезную часть.
   */
  private cleanAIResponse(rawResponse: string, originalText: string): string {
    let result = rawResponse.trim();

    // 1. Убираем обрамляющие кавычки
    if ((result.startsWith('"') && result.endsWith('"')) ||
        (result.startsWith('«') && result.endsWith('»'))) {
      result = result.slice(1, -1).trim();
    }

    // 2. Убираем типичные префиксы от нейросети
    result = result.replace(/^(Ответ|Answer|Result|Translation|Перевод|Output)\s*:\s*/i, '').trim();

    // 3. Если оригинал однострочный, а ответ содержит \n — вероятно мусор после первой строки
    const originalIsOneLine = !originalText.includes('\n');
    if (originalIsOneLine && result.includes('\n')) {
      // Берём только первую непустую строку
      const firstLine = result.split('\n').map(l => l.trim()).filter(l => l.length > 0)[0];
      if (firstLine) {
        result = firstLine;
      }
    }

    // 4. Если оригинал многострочный — берём столько же строк сколько в оригинале
    if (!originalIsOneLine && result.includes('\n')) {
      const originalLineCount = originalText.split('\n').filter(l => l.trim().length > 0).length;
      const resultLines = result.split('\n');
      // Если в ответе значительно больше строк — обрезаем
      if (resultLines.length > originalLineCount * 2) {
        result = resultLines.slice(0, originalLineCount).join('\n');
      }
    }

    // 5. Если результат всё ещё более чем в 3 раза длиннее оригинала — обрезаем
    if (result.length > originalText.length * 3 && originalText.length > 0) {
      // Берём только первое "предложение" или строку
      const firstSentence = result.match(/^[^\n]+/);
      if (firstSentence) {
        result = firstSentence[0].trim();
      }
    }

    // 6. Повторно убираем кавычки и префиксы после всех очисток
    result = result.replace(/^(Ответ|Answer|Result|Translation|Перевод|Output)\s*:\s*/i, '').trim();
    if ((result.startsWith('"') && result.endsWith('"')) ||
        (result.startsWith('«') && result.endsWith('»')) ||
        (result.startsWith("'") && result.endsWith("'"))) {
      result = result.slice(1, -1).trim();
    }

    return result;
  }

  /**
   * Обработка применения текста к нодам
   */
  private async handleApplyText(message: any): Promise<void> {
    try {
      const appliedCount = await applyTextToNodes(message.text, message.targetNodeIds);

      sendToUI({
        type: 'text-applied',
        id: message.id,
        success: true,
        appliedCount,
      });

      sendToUI({
        type: 'notification',
        level: 'success',
        message: `Applied to ${appliedCount} layer${appliedCount !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('Failed to apply text:', error);
      sendToUI({
        type: 'text-applied',
        id: message.id,
        success: false,
        appliedCount: 0,
        error: error.message,
      });
    }
  }

  /**
   * Обработка отмены генерации
   */
  private async handleCancelGeneration(message: any): Promise<void> {
    const abortSignal = this.activeGenerations.get(message.generationId);
    if (abortSignal) {
      abortSignal.abort();
      this.activeGenerations.delete(message.generationId);

      sendToUI({
        type: 'notification',
        level: 'info',
        message: 'Generation cancelled',
      });
    }
  }

  /**
   * Получение выбранных текстовых слоёв
   */
  private async handleGetSelectedText(message: any): Promise<void> {
    try {
      const textNodes = await getSelectedTextNodes();

      if (textNodes.length === 0) {
        sendToUI({
          type: 'notification',
          level: 'warning',
          message: 'No text layers selected',
        });
        return;
      }

      // Извлекаем текст из всех выбранных текстовых элементов
      const text = textNodes.map(node => node.characters).join('\n\n');

      sendToUI({
        type: 'selected-text-loaded',
        id: message.id,
        text,
      });
    } catch (error) {
      console.error('Failed to get selected text:', error);
      sendToUI({
        type: 'notification',
        level: 'error',
        message: 'Failed to get selected text: ' + (error as Error).message,
      });
    }
  }

  /**
   * Тест подключения к провайдеру
   */
  private async handleTestConnection(message: any): Promise<void> {
    const provider = message.provider;
    console.log('[TEST CONNECTION] Testing provider:', provider);

    try {
      const settings = await this.storageManager.loadSettings();

      let success = false;
      let errorMessage = '';

      if (provider === 'lmstudio') {
        const config = settings.providers.lmstudio;
        if (!config) {
          throw new Error('LM Studio is not configured');
        }

        const url = `${config.baseUrl}/models`;
        console.log('[TEST CONNECTION] LM Studio URL:', url);

        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        success = response.ok;
        if (!success) {
          errorMessage = `HTTP ${response.status}: ${await response.text()}`;
        } else {
          console.log('[TEST CONNECTION] LM Studio response:', await response.text());
        }

      } else if (provider === 'yandex') {
        // Yandex Cloud не поддерживает CORS с null origin (Figma плагины)
        // Тест подключения невозможен напрямую из плагина
        errorMessage = 'Yandex Cloud does not support CORS from Figma plugins. Test by generating text instead.';
        success = false;

      } else if (provider === 'openai-compatible') {
        const config = settings.providers.openaiCompatible;
        if (!config) {
          throw new Error('OpenAI Compatible provider is not configured');
        }

        const url = `${config.baseUrl}/models`;
        console.log('[TEST CONNECTION] OpenAI Compatible URL:', url);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
        });

        success = response.ok;
        if (!success) {
          errorMessage = `HTTP ${response.status}: ${await response.text()}`;
        }
      }

      sendToUI({
        type: 'test-connection-result',
        id: message.id,
        success,
        error: errorMessage || undefined,
      });

    } catch (error) {
      console.error('[TEST CONNECTION] Error:', error);
      sendToUI({
        type: 'test-connection-result',
        id: message.id,
        success: false,
        error: error.message || 'Connection test failed',
      });
    }
  }

  /**
   * Тестовая функция перевода выделенного текста
   */
  private async handleTestTranslation(message: any): Promise<void> {
    try {
      // Проверяем выделение
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        sendToUI({
          type: 'test-translation-result',
          id: message.id,
          success: false,
          error: 'Please select a text layer',
        });
        return;
      }

      // Проверяем что выделен текстовый элемент
      const node = selection[0];
      if (node.type !== 'TEXT') {
        sendToUI({
          type: 'test-translation-result',
          id: message.id,
          success: false,
          error: 'Selected element is not a text layer',
        });
        return;
      }

      const textNode = node as TextNode;
      const originalText = textNode.characters;

      if (!originalText || originalText.trim() === '') {
        sendToUI({
          type: 'test-translation-result',
          id: message.id,
          success: false,
          error: 'Selected text is empty',
        });
        return;
      }

      // Загружаем настройки LM Studio
      const settings = await this.storageManager.loadSettings();
      const lmStudioConfig = settings.providers.lmstudio;

      if (!lmStudioConfig) {
        sendToUI({
          type: 'test-translation-result',
          id: message.id,
          success: false,
          error: 'LM Studio is not configured',
        });
        return;
      }

      const lmStudioUrl = lmStudioConfig.baseUrl || 'http://localhost:1234/v1';
      const lmStudioModel = lmStudioConfig.model || 'ibm/granite-3.2-8b';

      console.log('[TEST TRANSLATION] URL:', lmStudioUrl);
      console.log('[TEST TRANSLATION] Model:', lmStudioModel);
      console.log('[TEST TRANSLATION] Original text:', originalText);

      // Отправляем запрос к LM Studio
      const response = await fetch(`${lmStudioUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: lmStudioModel,
          messages: [
            {
              role: 'user',
              content: `Переведи на английский: ${originalText}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        sendToUI({
          type: 'test-translation-result',
          id: message.id,
          success: false,
          error: `API Error ${response.status}: ${errorText}`,
        });
        return;
      }

      const data = await response.json();
      const translatedText = data.choices?.[0]?.message?.content || '';

      sendToUI({
        type: 'test-translation-result',
        id: message.id,
        success: true,
        original: originalText,
        translated: translatedText,
      });

    } catch (error) {
      console.error('[TEST TRANSLATION] Error:', error);
      sendToUI({
        type: 'test-translation-result',
        id: message.id,
        success: false,
        error: error.message || 'Translation failed',
      });
    }
  }

  /**
   * Тестовый перевод напрямую из меню (с минимальным UI для network access)
   */
  private async handleTestTranslationDirect(): Promise<void> {
    try {
      // Проверяем выделение
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        figma.notify('❌ Please select a text layer');
        figma.closePlugin();
        return;
      }

      // Проверяем что выделен текстовый элемент
      const node = selection[0];
      if (node.type !== 'TEXT') {
        figma.notify('❌ Selected element is not a text layer');
        figma.closePlugin();
        return;
      }

      const textNode = node as TextNode;
      const originalText = textNode.characters;

      if (!originalText || originalText.trim() === '') {
        figma.notify('❌ Selected text is empty');
        figma.closePlugin();
        return;
      }

      // Создаём минимальный невидимый UI для доступа к network API
      const html = `
        <html>
          <head><style>body { margin: 0; padding: 0; }</style></head>
          <body>
            <script>
              parent.postMessage({ pluginMessage: { type: 'ui-ready' } }, '*');
            </script>
          </body>
        </html>
      `;

      figma.showUI(html, { visible: false, width: 1, height: 1 });
      figma.notify('🔄 Translating...');

      // Сохраняем данные для обработки после загрузки UI
      this.pendingTranslation = {
        textNode,
        originalText,
      };

    } catch (error) {
      console.error('[TEST TRANSLATION DIRECT] Error:', error);
      figma.notify(`❌ Error: ${error.message || 'Translation failed'}`);
      figma.closePlugin();
    }
  }

  /**
   * Выполнение перевода после загрузки UI
   */
  private async executeTranslation(): Promise<void> {
    if (!this.pendingTranslation) return;

    const { textNode, originalText } = this.pendingTranslation;
    this.pendingTranslation = null;

    try {
      // Проверяем доступность fetch API
      if (typeof fetch !== 'function') {
        console.error('[TRANSLATION] fetch is not available');
        figma.notify('❌ Network API not available');
        figma.closePlugin();
        return;
      }

      // Загружаем настройки LM Studio
      const settings = await this.storageManager.loadSettings();
      const lmStudioConfig = settings.providers.lmstudio;

      if (!lmStudioConfig) {
        figma.notify('❌ LM Studio is not configured');
        figma.closePlugin();
        return;
      }

      const lmStudioUrl = lmStudioConfig.baseUrl || 'http://localhost:1234/v1';
      const lmStudioModel = lmStudioConfig.model || 'ibm/granite-3.2-8b';

      console.log('[TRANSLATION] Using URL:', lmStudioUrl);
      console.log('[TRANSLATION] Model:', lmStudioModel);
      console.log('[TRANSLATION] Original text:', originalText);
      console.log('[TRANSLATION] fetch available:', typeof fetch);

      // Отправляем запрос к LM Studio
      const response = await fetch(`${lmStudioUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: lmStudioModel,
          messages: [
            {
              role: 'user',
              content: `Переведи на английский: ${originalText}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      console.log('[TRANSLATION] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TRANSLATION] Error response:', errorText);
        figma.notify(`❌ API Error ${response.status}`);
        figma.closePlugin();
        return;
      }

      const data = await response.json();
      console.log('[TRANSLATION] Response data:', data);

      const translatedText = data.choices?.[0]?.message?.content || '';

      if (!translatedText) {
        figma.notify('❌ No translation received');
        figma.closePlugin();
        return;
      }

      console.log('[TRANSLATION] Translated text:', translatedText);

      // Обновляем текст в выделенном слое
      await figma.loadFontAsync(textNode.fontName as FontName);
      textNode.characters = translatedText;

      figma.notify('✅ Translation complete!');
      figma.closePlugin();

    } catch (error) {
      console.error('[TRANSLATION] Error:', error);
      figma.notify(`❌ Error: ${error.message || 'Translation failed'}`);
      figma.closePlugin();
    }
  }

  /**
   * Расчёт стоимости генерации (V2 - использует providerId)
   * TODO: Реализовать правильный расчёт по baseConfigId
   */
  private calculateCost(providerId: string, tokens: number): number {
    // V2: Пока возвращаем 0, позже добавим расчёт по baseConfigId из settings
    return 0;
  }

  // ============================================================================
  // Data Presets Handlers
  // ============================================================================

  /**
   * Загрузка пресетов данных
   */
  private async handleLoadDataPresets(message: any): Promise<void> {
    try {
      const settings = await this.storageManager.loadDataPresets();

      // Merge built-in presets with user presets (built-ins first, avoiding duplicates)
      const builtInPresets = Object.values(BUILT_IN_PRESETS);
      const userPresetIds = new Set(settings.presets.map(p => p.id));
      const mergedPresets = [
        ...builtInPresets.filter(bp => !userPresetIds.has(bp.id)),
        ...settings.presets,
      ];

      sendToUI({
        type: 'data-presets-loaded',
        id: message.id,
        settings: {
          ...settings,
          presets: mergedPresets,
        },
      });
    } catch (error) {
      console.error('Failed to load data presets:', error);
      sendToUI({
        type: 'notification',
        level: 'error',
        message: 'Failed to load data presets',
      });
    }
  }

  /**
   * Сохранение пресетов данных
   */
  private async handleSaveDataPresets(message: any): Promise<void> {
    try {
      await this.storageManager.saveDataPresets(message.settings);

      sendToUI({
        type: 'notification',
        level: 'success',
        message: 'Presets saved',
      });
    } catch (error) {
      console.error('Failed to save data presets:', error);
      sendToUI({
        type: 'notification',
        level: 'error',
        message: 'Failed to save presets',
      });
    }
  }

  /**
   * Применение подстановки данных (последовательное - каждая группа к своему компоненту)
   */
  private async handleApplyDataSubstitution(message: any): Promise<void> {
    try {
      // Загрузить пресеты
      const settings = await this.storageManager.loadDataPresets();
      const preset = settings.presets.find(function (p) {
        return p.id === message.presetId;
      });

      if (!preset) {
        throw new Error('Preset not found');
      }

      // Применить подстановку ПОСЛЕДОВАТЕЛЬНО (группа 1 → компонент 1, и т.д.)
      const result = await applyDataSubstitutionSequential(preset);

      sendToUI({
        type: 'substitution-applied',
        id: message.id,
        success: true,
        nodesProcessed: 0,  // Не используется в новом режиме
        componentsProcessed: result.componentsProcessed,
        groupsUsed: result.groupsUsed,
      });

      const message_text = 'Applied ' + result.groupsUsed + ' groups to ' + result.componentsProcessed + ' components';

      sendToUI({
        type: 'notification',
        level: 'success',
        message: message_text,
      });
    } catch (error) {
      console.error('Failed to apply data substitution:', error);

      sendToUI({
        type: 'substitution-applied',
        id: message.id,
        success: false,
        nodesProcessed: 0,
        componentsProcessed: 0,
        groupsUsed: 0,
        error: error.message,
      });

      sendToUI({
        type: 'notification',
        level: 'error',
        message: error.message || 'Failed to apply substitution',
      });
    }
  }

  /**
   * Быстрое применение пресета (без UI)
   */
  private async quickApplyPreset(presetId: string, builtInPreset?: DataPreset): Promise<void> {
    try {
      let preset: DataPreset | undefined = builtInPreset;

      if (!preset) {
        const settings = await this.storageManager.loadDataPresets();
        preset = settings.presets.find(function (p) {
          return p.id === presetId;
        });
      }

      if (!preset) {
        figma.notify('Preset not found');
        return;
      }

      // Применяем последовательно
      const result = await applyDataSubstitutionSequential(preset);

      if (result.componentsProcessed > 0) {
        figma.notify('Applied ' + result.groupsUsed + ' groups to ' + result.componentsProcessed + ' components');
      } else {
        figma.notify('No components processed. Select frames or components with text layers.');
      }
    } catch (error) {
      console.error('Quick apply error:', error);
      figma.notify('Error: ' + error.message);
    }
  }

  /**
   * Показать UI для обратного переименования
   */
  private async showReverseRenameUI(): Promise<void> {
    const settings = await this.storageManager.loadDataPresets();
    const allPresets = [...Object.values(BUILT_IN_PRESETS), ...settings.presets];

    // Фильтруем только те, у которых есть defaultValues
    const presetsWithDefaults = allPresets.filter(function (p) {
      return p.defaultValues && Object.keys(p.defaultValues).length > 0;
    });

    if (presetsWithDefaults.length === 0) {
      figma.notify('No presets with default values. Add default values to presets first.');
      figma.closePlugin();
      return;
    }

    let html = '<html><head><style>';
    html += 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 12px; margin: 0; font-size: 12px; }';
    html += '.preset-item { padding: 8px 12px; margin: 4px 0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; transition: all 0.2s; }';
    html += '.preset-item:hover { background: #f0f0f0; border-color: #18a0fb; }';
    html += '.preset-name { font-weight: 600; margin-bottom: 2px; }';
    html += '.preset-info { font-size: 10px; color: #999; }';
    html += '</style></head><body>';
    html += '<h3 style="margin: 0 0 12px 0;">Rename Layers by Content</h3>';

    for (const preset of presetsWithDefaults) {
      html += '<div class="preset-item" onclick="parent.postMessage({ pluginMessage: { type: \'reverse-rename\', presetId: \'' + preset.id + '\' } }, \'*\')">';
      html += '<div class="preset-name">' + preset.name + '</div>';
      html += '<div class="preset-info">' + Object.keys(preset.defaultValues!).length + ' default values</div>';
      html += '</div>';
    }

    html += '</body></html>';

    figma.showUI(html, {
      width: 300,
      height: Math.min(400, 100 + presetsWithDefaults.length * 60),
      themeColors: true,
    });
  }

  /**
   * Обработчик обратного переименования
   */
  private async handleReverseRename(presetId: string): Promise<void> {
    try {
      // Ищем в встроенных пресетах
      let preset: DataPreset | undefined = BUILT_IN_PRESETS[presetId.replace('built-in-', '')];

      // Если не нашли, ищем в пользовательских
      if (!preset) {
        const settings = await this.storageManager.loadDataPresets();
        preset = settings.presets.find(function (p) {
          return p.id === presetId;
        });
      }

      if (!preset) {
        figma.notify('Preset not found');
        return;
      }

      const result = await reverseRenameByContent(preset);

      if (result.nodesRenamed > 0) {
        figma.notify('Renamed ' + result.nodesRenamed + ' layers based on content');
      } else {
        figma.notify('No matching content found in selected layers');
      }
    } catch (error) {
      console.error('Reverse rename error:', error);
      figma.notify('Error: ' + error.message);
    }

    figma.closePlugin();
  }

  /**
   * Обработчик быстрого применения из UI (если понадобится)
   */
  private async handleQuickApplyPreset(message: any): Promise<void> {
    await this.quickApplyPreset(message.presetId);
  }

  /**
   * Handle batch generation (V2)
   */
  private async handleGenerateBatch(message: any): Promise<void> {
    try {
      const settings = await this.storageManager.loadSettings();

      // Get active provider config (v2 architecture)
      const config = settings.providerConfigs?.find(c => c.id === settings.activeProviderId);

      if (!config || !config.enabled) {
        // Fallback to legacy provider if v2 not configured
        throw new Error('No active provider configuration. Please configure a provider in Settings.');
      }

      const baseConfig = PROVIDER_CONFIGS.find(p => p.id === config.baseConfigId);
      if (!baseConfig) {
        throw new Error('Provider configuration not found');
      }

      const provider = ProviderFactory.createProvider(config, baseConfig);

      // Get selected text nodes
      const textNodes = await getSelectedTextNodes();
      if (textNodes.length === 0) {
        throw new Error('No text layers selected');
      }

      const result = await this.batchProcessor.processBatch(
        textNodes,
        provider,
        message.prompt,
        settings.generation,
        (progress) => {
          sendToUI({
            type: 'batch-progress',
            id: message.id,
            progress,
          });
        }
      );

      sendToUI({
        type: 'generate-batch-complete',
        id: message.id,
        success: true,
        processed: result.successful,
        failed: result.failed,
        totalTokens: result.totalTokens,
        totalCost: result.totalCost,
      });

      sendToUI({
        type: 'notification',
        level: 'success',
        message: `Batch completed: ${result.successful} successful, ${result.failed} failed`,
      });
    } catch (error: any) {
      console.error('Batch generation error:', error);
      sendToUI({
        type: 'generate-batch-complete',
        id: message.id,
        success: false,
        processed: 0,
        failed: 0,
        totalTokens: 0,
        totalCost: 0,
      });

      sendToUI({
        type: 'notification',
        level: 'error',
        message: error.message || 'Batch generation failed',
      });
    }
  }

  // ============================================================================
  // Multi-field Generation Handlers
  // ============================================================================

  /**
   * Get selected text layers (for multi-field UI)
   */
  private async handleGetSelectedLayers(message: any): Promise<void> {
    try {
      const textNodes = await getSelectedTextNodes();

      sendToUI({
        type: 'selected-layers-loaded',
        id: message.id,
        layers: textNodes.map(n => ({
          id: n.id,
          name: n.name,
          characters: n.characters,
        })),
      });
    } catch (error: any) {
      console.error('Failed to get selected layers:', error);
      sendToUI({
        type: 'notification',
        level: 'error',
        message: 'Failed to get selected layers: ' + error.message,
      });
    }
  }

  /**
   * Handle multi-field generation — generates text for each layer sequentially
   */
  private async handleGenerateMulti(message: any): Promise<void> {
    const abortSignal = new SimpleAbortSignal();
    this.activeGenerations.set(message.id, abortSignal);

    try {
      const startTime = Date.now();
      const results: Array<{
        layerId: string;
        layerName: string;
        originalText: string;
        generatedText: string;
        tokens: number;
        cost: number;
      }> = [];
      let totalTokens = 0;
      let totalCost = 0;

      for (let i = 0; i < message.layers.length; i++) {
        if (abortSignal.aborted) break;

        const layer = message.layers[i];

        // Build contextual prompt for this layer
        const contextPrompt = `${message.prompt}\n\nOriginal text from layer "${layer.name}":\n${layer.originalText}`;

        let layerText = '';
        let layerTokens = 0;

        await withRetry(async () => {
          await this.apiClient.generateText({
            providerId: message.providerId,
            prompt: contextPrompt,
            systemPrompt: message.systemPrompt,
            settings: message.settings,
            signal: abortSignal,
            onChunk: (chunk: string, tokens: number) => {
              layerText += chunk;
              layerTokens = tokens;

              // Send progress for this layer
              sendToUI({
                type: 'generation-multi-chunk',
                id: message.id,
                layerIndex: i,
                text: layerText,
                tokens: totalTokens + layerTokens,
              });
            },
          });
        });

        const layerCost = this.calculateCost(message.providerId, layerTokens);

        results.push({
          layerId: layer.id,
          layerName: layer.name,
          originalText: layer.originalText,
          generatedText: layerText,
          tokens: layerTokens,
          cost: layerCost,
        });

        totalTokens += layerTokens;
        totalCost += layerCost;

        // Small delay between layers to avoid rate limits
        if (i < message.layers.length - 1 && !abortSignal.aborted) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      const duration = Date.now() - startTime;

      // Track usage
      await this.storageManager.trackTokenUsage(message.providerId, totalTokens, totalCost);

      sendToUI({
        type: 'generation-multi-complete',
        id: message.id,
        results,
        totalTokens,
        totalCost,
        duration,
      });
    } catch (error: any) {
      console.error('Multi-generation error:', error);
      sendToUI({
        type: 'generation-multi-error',
        id: message.id,
        error: error.message || 'Multi-field generation failed',
      });
    } finally {
      this.activeGenerations.delete(message.id);
    }
  }

  /**
   * Cancel multi-field generation
   */
  private handleCancelMultiGeneration(message: any): void {
    const abortSignal = this.activeGenerations.get(message.id);
    if (abortSignal) {
      abortSignal.abort();
      this.activeGenerations.delete(message.id);
      sendToUI({
        type: 'notification',
        level: 'info',
        message: 'Multi-field generation cancelled',
      });
    }
  }

  /**
   * Apply multi-field results to layers
   */
  private async handleApplyMultiResults(message: any): Promise<void> {
    try {
      let appliedCount = 0;

      for (const result of message.results) {
        const node = figma.getNodeById(result.layerId);
        if (node && node.type === 'TEXT') {
          const textNode = node as TextNode;
          // Load the font before changing text
          if (textNode.fontName !== figma.mixed) {
            await figma.loadFontAsync(textNode.fontName);
          } else {
            // Mixed fonts — load all unique fonts
            const len = textNode.characters.length;
            const fontsToLoad = new Set<string>();
            for (let i = 0; i < len; i++) {
              const fontName = textNode.getRangeFontName(i, i + 1) as FontName;
              const key = `${fontName.family}-${fontName.style}`;
              if (!fontsToLoad.has(key)) {
                fontsToLoad.add(key);
                await figma.loadFontAsync(fontName);
              }
            }
          }
          textNode.characters = result.text;
          appliedCount++;
        }
      }

      sendToUI({
        type: 'multi-results-applied',
        id: message.id,
        success: true,
        appliedCount,
      });

      sendToUI({
        type: 'notification',
        level: 'success',
        message: `Applied text to ${appliedCount} layer${appliedCount !== 1 ? 's' : ''}`,
      });
    } catch (error: any) {
      console.error('Failed to apply multi results:', error);
      sendToUI({
        type: 'multi-results-applied',
        id: message.id,
        success: false,
        appliedCount: 0,
        error: error.message,
      });
    }
  }
}

// Инициализация плагина
new PluginSandbox();
