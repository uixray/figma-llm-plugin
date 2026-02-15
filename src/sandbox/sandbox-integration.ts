/**
 * Sandbox Integration for V2 Features
 * Add these handlers to code.ts handleUIMessage switch statement
 */

import { RenameHandler } from './rename-handler';
import { PromptsHandler } from './prompts-handler';
import { BatchProcessor } from './batch-processor';
import { StorageManager } from './storage-manager';
import { ProviderFactory } from './providers/ProviderFactory';
import { PROVIDER_CONFIGS } from '../shared/providers';
import { sendToUI } from '../shared/messages';

/**
 * Integration Guide:
 *
 * 1. Add class properties to PluginSandbox:
 *    private renameHandler: RenameHandler;
 *    private promptsHandler: PromptsHandler;
 *    private batchProcessor: BatchProcessor;
 *
 * 2. Initialize in constructor:
 *    this.renameHandler = new RenameHandler(this.storageManager);
 *    this.promptsHandler = new PromptsHandler(this.storageManager);
 *    this.batchProcessor = new BatchProcessor();
 *
 * 3. Initialize handlers:
 *    async initialize() {
 *      await this.renameHandler.initialize();
 *      await this.promptsHandler.initialize();
 *    }
 *
 * 4. Add to handleUIMessage switch statement:
 */

// Rename message handlers
export async function handleRenameMessages(this: any, message: any): Promise<void> {
  switch (message.type) {
    case 'load-rename-settings':
      await this.renameHandler.initialize();
      break;

    case 'rename-preview':
      await this.renameHandler.handlePreview(message.presetId);
      break;

    case 'rename-apply':
      await this.renameHandler.handleApply(message.preview, message.presetId);
      break;

    case 'save-rename-preset':
      await this.renameHandler.handleSavePreset(message.preset);
      break;

    case 'delete-rename-preset':
      await this.renameHandler.handleDeletePreset(message.presetId);
      break;
  }
}

// Prompts message handlers
export async function handlePromptsMessages(this: any, message: any): Promise<void> {
  switch (message.type) {
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

    case 'search-prompts':
      await this.promptsHandler.handleSearchPrompts(message.query, message.category);
      break;
  }
}

// Batch processing message handlers
export async function handleBatchMessages(this: any, message: any): Promise<void> {
  switch (message.type) {
    case 'generate-batch':
      await this.handleGenerateBatch(message);
      break;
  }
}

/**
 * Example integration in code.ts:
 *
 * private async handleUIMessage(message: any): Promise<void> {
 *   try {
 *     switch (message.type) {
 *       // ... existing cases ...
 *
 *       // Rename messages
 *       case 'load-rename-settings':
 *       case 'rename-preview':
 *       case 'rename-apply':
 *       case 'save-rename-preset':
 *       case 'delete-rename-preset':
 *         await handleRenameMessages.call(this, message);
 *         break;
 *
 *       // Prompts messages
 *       case 'load-prompts-library':
 *       case 'save-prompt':
 *       case 'update-prompt-usage':
 *       case 'delete-prompt':
 *       case 'search-prompts':
 *         await handlePromptsMessages.call(this, message);
 *         break;
 *
 *       // Batch processing
 *       case 'generate-batch':
 *         await handleBatchMessages.call(this, message);
 *         break;
 *     }
 *   } catch (error) {
 *     console.error('Error handling message:', error);
 *     sendToUI({
 *       type: 'notification',
 *       level: 'error',
 *       message: error.message || 'Unknown error',
 *     });
 *   }
 * }
 *
 * // Batch generation handler
 * private async handleGenerateBatch(message: any): Promise<void> {
 *   try {
 *     const settings = await this.storageManager.loadSettings();
 *     const config = settings.providerConfigs.find(c => c.id === message.providerConfigId);
 *
 *     if (!config || !config.enabled) {
 *       throw new Error('No active provider configuration');
 *     }
 *
 *     const baseConfig = PROVIDER_CONFIGS.find(p => p.id === config.baseConfigId);
 *     if (!baseConfig) {
 *       throw new Error('Provider configuration not found');
 *     }
 *
 *     const provider = ProviderFactory.createProvider(config, baseConfig);
 *
 *     const result = await this.batchProcessor.processBatch(
 *       message.textNodes,
 *       provider,
 *       message.prompt,
 *       settings.generation,
 *       (progress) => {
 *         sendToUI({
 *           type: 'batch-progress',
 *           id: message.id,
 *           progress,
 *         });
 *       }
 *     );
 *
 *     sendToUI({
 *       type: 'generate-batch-complete',
 *       id: message.id,
 *       success: true,
 *       processed: result.successful,
 *       failed: result.failed,
 *       totalTokens: result.totalTokens,
 *       totalCost: result.totalCost,
 *     });
 *
 *     sendToUI({
 *       type: 'notification',
 *       level: 'success',
 *       message: `Batch completed: ${result.successful} successful, ${result.failed} failed`,
 *     });
 *   } catch (error) {
 *     console.error('Batch generation error:', error);
 *     sendToUI({
 *       type: 'generate-batch-complete',
 *       id: message.id,
 *       success: false,
 *       processed: 0,
 *       failed: 0,
 *       totalTokens: 0,
 *       totalCost: 0,
 *     });
 *   }
 * }
 */
