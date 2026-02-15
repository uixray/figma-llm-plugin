import { GenerationSettings, TextNodeInfo } from '../shared/types';
import { BaseProvider, ProviderResponse } from './providers/BaseProvider';
import { sendToUI } from '../shared/messages';

/**
 * Информация о прогрессе batch обработки
 */
export interface BatchProgress {
  current: number; // Текущий индекс (0-based)
  total: number; // Общее количество
  currentNodeName: string; // Имя текущего узла
  percentage: number; // Процент выполнения (0-100)
}

/**
 * Результат batch обработки
 */
export interface BatchResult {
  successful: number; // Количество успешно обработанных
  failed: number; // Количество ошибок
  totalTokens: number; // Всего токенов использовано
  totalCost: number; // Общая стоимость
  duration: number; // Время выполнения (ms)
}

/**
 * Процессор для последовательной обработки множества текстовых узлов
 */
export class BatchProcessor {
  private isCancelled = false;

  /**
   * Обработка списка текстовых узлов
   */
  async processBatch(
    textNodes: TextNodeInfo[],
    provider: BaseProvider,
    prompt: string,
    settings: GenerationSettings
  ): Promise<BatchResult> {
    const startTime = Date.now();
    let successful = 0;
    let failed = 0;
    let totalTokens = 0;
    let totalCost = 0;

    this.isCancelled = false;

    console.log(`[BatchProcessor] Starting batch processing of ${textNodes.length} nodes`);

    for (let i = 0; i < textNodes.length; i++) {
      // Проверяем отмену
      if (this.isCancelled) {
        console.log('[BatchProcessor] Batch processing cancelled');
        break;
      }

      const node = textNodes[i];

      // Отправляем прогресс
      this.sendProgress({
        current: i,
        total: textNodes.length,
        currentNodeName: node.name,
        percentage: Math.round((i / textNodes.length) * 100),
      });

      try {
        // Формируем промпт с учётом контекста узла
        const contextualPrompt = this.buildContextualPrompt(prompt, node);

        // Генерируем текст
        const response = await provider.generateText(contextualPrompt, settings);

        // Применяем текст к узлу
        this.applyTextToNode(node.id, response.text);

        // Обновляем статистику
        totalTokens += response.tokens.input + response.tokens.output;
        totalCost += response.cost;
        successful++;

        console.log(`[BatchProcessor] Processed node ${i + 1}/${textNodes.length}: ${node.name}`);
      } catch (error) {
        console.error(`[BatchProcessor] Failed to process node ${node.name}:`, error);
        failed++;

        // Отправляем уведомление об ошибке
        sendToUI({
          type: 'notification',
          level: 'warning',
          message: `Failed to process "${node.name}": ${error.message}`,
        });
      }

      // Небольшая задержка между запросами (чтобы не превысить rate limits)
      if (i < textNodes.length - 1) {
        await this.delay(500); // 500ms задержка
      }
    }

    const duration = Date.now() - startTime;

    // Отправляем финальный прогресс (100%)
    this.sendProgress({
      current: textNodes.length,
      total: textNodes.length,
      currentNodeName: 'Completed',
      percentage: 100,
    });

    console.log(
      `[BatchProcessor] Batch processing completed: ${successful} successful, ${failed} failed`
    );

    return {
      successful,
      failed,
      totalTokens,
      totalCost,
      duration,
    };
  }

  /**
   * Отменить batch обработку
   */
  cancel(): void {
    this.isCancelled = true;
    console.log('[BatchProcessor] Cancellation requested');
  }

  /**
   * Построить промпт с учётом контекста узла
   */
  private buildContextualPrompt(basePrompt: string, node: TextNodeInfo): string {
    // Если в базовом промпте есть плейсхолдеры - заменяем их
    let contextualPrompt = basePrompt;

    // Заменяем {{name}} на имя узла
    contextualPrompt = contextualPrompt.replace(/\{\{name\}\}/g, node.name);

    // Заменяем {{content}} на текущее содержимое узла
    contextualPrompt = contextualPrompt.replace(/\{\{content\}\}/g, node.characters);

    return contextualPrompt;
  }

  /**
   * Применить сгенерированный текст к узлу
   */
  private applyTextToNode(nodeId: string, text: string): void {
    const node = figma.getNodeById(nodeId);

    if (!node || node.type !== 'TEXT') {
      throw new Error(`Node ${nodeId} is not a text node`);
    }

    const textNode = node as TextNode;

    // Загружаем шрифты
    this.loadFontsForNode(textNode).then(() => {
      textNode.characters = text;
    });
  }

  /**
   * Загрузить шрифты для текстового узла
   */
  private async loadFontsForNode(node: TextNode): Promise<void> {
    const fontNames: FontName[] = [];

    // Собираем все уникальные шрифты
    const len = node.characters.length;
    for (let i = 0; i < len; i++) {
      const fontName = node.getRangeFontName(i, i + 1) as FontName;
      if (fontName && fontName.family && fontName.style) {
        // Проверяем что ещё не добавили этот шрифт
        const exists = fontNames.some(
          (f) => f.family === fontName.family && f.style === fontName.style
        );
        if (!exists) {
          fontNames.push(fontName);
        }
      }
    }

    // Загружаем все шрифты
    await Promise.all(fontNames.map((fontName) => figma.loadFontAsync(fontName)));
  }

  /**
   * Отправить прогресс в UI
   */
  private sendProgress(progress: BatchProgress): void {
    sendToUI({
      type: 'batch-progress',
      progress,
    });
  }

  /**
   * Задержка
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
