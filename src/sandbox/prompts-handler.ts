import { StorageManager } from './storage-manager';
import { SavedPrompt, SavedPromptsLibrary } from '../shared/types';
import { sendToUI } from '../shared/messages';

/**
 * Обработчик команд для библиотеки сохранённых промптов
 */
export class PromptsHandler {
  constructor(private storageManager: StorageManager) {}

  /**
   * Инициализация - загрузка библиотеки промптов
   */
  async initialize(): Promise<void> {
    const library = await this.storageManager.loadSavedPrompts();
    sendToUI({
      type: 'prompts-library-loaded',
      library,
    });
  }

  /**
   * Сохранение нового промпта
   */
  async handleSavePrompt(prompt: SavedPrompt): Promise<void> {
    try {
      console.log(`[PromptsHandler] Saving prompt: ${prompt.name}`);

      // Загружаем текущую библиотеку
      const library = await this.storageManager.loadSavedPrompts();

      // Проверяем, существует ли промпт с таким ID (редактирование)
      const existingIndex = library.prompts.findIndex((p) => p.id === prompt.id);

      if (existingIndex >= 0) {
        // Обновляем существующий промпт
        library.prompts[existingIndex] = {
          ...prompt,
          updatedAt: Date.now(),
        };
        console.log(`[PromptsHandler] Updated existing prompt: ${prompt.name}`);
      } else {
        // Добавляем новый промпт
        library.prompts.push(prompt);
        console.log(`[PromptsHandler] Added new prompt: ${prompt.name}`);

        // Добавляем категорию если её ещё нет
        if (prompt.category && !library.categories.includes(prompt.category)) {
          library.categories.push(prompt.category);
          console.log(`[PromptsHandler] Added new category: ${prompt.category}`);
        }
      }

      // Сохраняем библиотеку
      await this.storageManager.saveSavedPrompts(library);

      // Отправляем обновлённую библиотеку в UI
      sendToUI({
        type: 'prompts-library-loaded',
        library,
      });

      sendToUI({
        type: 'notification',
        level: 'success',
        message: `Prompt "${prompt.name}" saved successfully`,
      });
    } catch (error) {
      console.error('[PromptsHandler] Failed to save prompt:', error);
      sendToUI({
        type: 'notification',
        level: 'error',
        message: `Failed to save prompt: ${error.message}`,
      });
    }
  }

  /**
   * Обновление счётчика использования промпта
   */
  async handleUpdateUsage(promptId: string): Promise<void> {
    try {
      const library = await this.storageManager.loadSavedPrompts();
      const prompt = library.prompts.find((p) => p.id === promptId);

      if (!prompt) {
        console.warn(`[PromptsHandler] Prompt not found: ${promptId}`);
        return;
      }

      // Увеличиваем счётчик
      prompt.usageCount++;
      prompt.updatedAt = Date.now();

      // Сохраняем
      await this.storageManager.saveSavedPrompts(library);

      console.log(`[PromptsHandler] Updated usage count for ${prompt.name}: ${prompt.usageCount}`);
    } catch (error) {
      console.error('[PromptsHandler] Failed to update usage:', error);
    }
  }

  /**
   * Удаление промпта
   */
  async handleDeletePrompt(promptId: string): Promise<void> {
    try {
      console.log(`[PromptsHandler] Deleting prompt: ${promptId}`);

      const library = await this.storageManager.loadSavedPrompts();
      const promptIndex = library.prompts.findIndex((p) => p.id === promptId);

      if (promptIndex < 0) {
        sendToUI({
          type: 'notification',
          level: 'warning',
          message: 'Prompt not found',
        });
        return;
      }

      const promptName = library.prompts[promptIndex].name;

      // Удаляем промпт
      library.prompts.splice(promptIndex, 1);

      // Сохраняем
      await this.storageManager.saveSavedPrompts(library);

      // Отправляем обновлённую библиотеку
      sendToUI({
        type: 'prompts-library-loaded',
        library,
      });

      sendToUI({
        type: 'notification',
        level: 'success',
        message: `Prompt "${promptName}" deleted`,
      });

      console.log(`[PromptsHandler] Deleted prompt: ${promptName}`);
    } catch (error) {
      console.error('[PromptsHandler] Failed to delete prompt:', error);
      sendToUI({
        type: 'notification',
        level: 'error',
        message: `Failed to delete prompt: ${error.message}`,
      });
    }
  }

  /**
   * Экспорт библиотеки промптов в JSON
   */
  async exportLibrary(): Promise<string> {
    const library = await this.storageManager.loadSavedPrompts();
    return JSON.stringify(library, null, 2);
  }

  /**
   * Импорт библиотеки промптов из JSON
   */
  async importLibrary(jsonData: string): Promise<void> {
    try {
      const importedLibrary: SavedPromptsLibrary = JSON.parse(jsonData);

      // Валидация структуры
      if (!importedLibrary.prompts || !Array.isArray(importedLibrary.prompts)) {
        throw new Error('Invalid library format');
      }

      // Загружаем текущую библиотеку
      const currentLibrary = await this.storageManager.loadSavedPrompts();

      // Объединяем промпты (избегаем дубликатов по ID)
      const existingIds = new Set(currentLibrary.prompts.map((p) => p.id));
      const newPrompts = importedLibrary.prompts.filter((p) => !existingIds.has(p.id));

      currentLibrary.prompts.push(...newPrompts);

      // Объединяем категории
      const newCategories = importedLibrary.categories.filter(
        (c) => !currentLibrary.categories.includes(c)
      );
      currentLibrary.categories.push(...newCategories);

      // Сохраняем
      await this.storageManager.saveSavedPrompts(currentLibrary);

      // Отправляем обновлённую библиотеку
      sendToUI({
        type: 'prompts-library-loaded',
        library: currentLibrary,
      });

      sendToUI({
        type: 'notification',
        level: 'success',
        message: `Imported ${newPrompts.length} new prompts`,
      });

      console.log(`[PromptsHandler] Imported ${newPrompts.length} prompts`);
    } catch (error) {
      console.error('[PromptsHandler] Failed to import library:', error);
      sendToUI({
        type: 'notification',
        level: 'error',
        message: `Failed to import library: ${error.message}`,
      });
      throw error;
    }
  }
}
