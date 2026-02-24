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
 * Default concurrency limit for parallel batch processing.
 * Conservative default to avoid rate limits.
 */
const DEFAULT_CONCURRENCY = 3;

/**
 * Процессор для параллельной обработки множества текстовых узлов.
 *
 * V2.2: Supports parallel processing with configurable concurrency (default: 3).
 * Uses Promise pool pattern to limit concurrent API requests.
 */
export class BatchProcessor {
  private isCancelled = false;
  private completedCount = 0;

  /**
   * Обработка списка текстовых узлов (параллельно, с ограничением concurrency)
   */
  async processBatch(
    textNodes: TextNodeInfo[],
    provider: BaseProvider,
    prompt: string,
    settings: GenerationSettings,
    concurrency: number = DEFAULT_CONCURRENCY,
  ): Promise<BatchResult> {
    const startTime = Date.now();
    let successful = 0;
    let failed = 0;
    let totalTokens = 0;
    let totalCost = 0;

    this.isCancelled = false;
    this.completedCount = 0;

    const total = textNodes.length;
    console.log(`[BatchProcessor] Starting parallel batch processing: ${total} nodes, concurrency=${concurrency}`);

    // Process nodes using a concurrent pool
    const results = await this.runPool(
      textNodes,
      async (node, index) => {
        if (this.isCancelled) return null;

        // Отправляем прогресс
        this.sendProgress({
          current: this.completedCount,
          total,
          currentNodeName: node.name,
          percentage: Math.round((this.completedCount / total) * 100),
        });

        try {
          const contextualPrompt = this.buildContextualPrompt(prompt, node);
          const response = await provider.generateText(contextualPrompt, settings);

          // Применяем текст к узлу
          await this.applyTextToNodeAsync(node.id, response.text);

          this.completedCount++;
          console.log(`[BatchProcessor] Processed node ${this.completedCount}/${total}: ${node.name}`);

          return { success: true as const, response };
        } catch (error: any) {
          this.completedCount++;
          console.error(`[BatchProcessor] Failed to process node ${node.name}:`, error);

          sendToUI({
            type: 'notification',
            level: 'warning',
            message: `Failed to process "${node.name}": ${error.message}`,
          });

          return { success: false as const, error: error.message };
        }
      },
      concurrency,
    );

    // Aggregate results
    for (const result of results) {
      if (!result) continue; // Cancelled
      if (result.success) {
        successful++;
        totalTokens += result.response.tokens.input + result.response.tokens.output;
        totalCost += result.response.cost;
      } else {
        failed++;
      }
    }

    const duration = Date.now() - startTime;

    // Отправляем финальный прогресс (100%)
    this.sendProgress({
      current: total,
      total,
      currentNodeName: 'Completed',
      percentage: 100,
    });

    console.log(
      `[BatchProcessor] Batch processing completed: ${successful} successful, ${failed} failed, ${duration}ms`
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
   * Concurrency-limited promise pool.
   * Executes tasks in parallel with at most `limit` concurrent operations.
   */
  private async runPool<T, R>(
    items: T[],
    handler: (item: T, index: number) => Promise<R>,
    limit: number,
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < items.length && !this.isCancelled) {
        const idx = nextIndex++;
        results[idx] = await handler(items[idx], idx);

        // Small delay between requests to respect rate limits
        if (!this.isCancelled) {
          await this.delay(200);
        }
      }
    };

    // Start `limit` concurrent workers
    const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
    await Promise.allSettled(workers);

    return results;
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
   * Применить сгенерированный текст к узлу (async version)
   */
  private async applyTextToNodeAsync(nodeId: string, text: string): Promise<void> {
    const node = await figma.getNodeByIdAsync(nodeId);

    if (!node || node.type !== 'TEXT') {
      throw new Error(`Node ${nodeId} is not a text node`);
    }

    const textNode = node as TextNode;
    await this.loadFontsForNode(textNode);
    textNode.characters = text;
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
