import {
  PluginSettings,
  DEFAULT_SETTINGS,
  ProviderType,
  ProviderConfig,
  GenerationSettings,
  AllUsageStats,
  UsageStats,
  DataPresetSettings,
  DEFAULT_DATA_PRESETS,
  DataPreset,
  SavedPromptsLibrary,
  SavedPrompt,
  RenameSettings,
  RenamePreset,
} from '../shared/types';
import { migrateSettings } from '../shared/settings-migration';
import {
  STORAGE_KEY_SETTINGS,
  STORAGE_KEY_USAGE_STATS,
  STORAGE_KEY_DATA_PRESETS,
  STORAGE_KEY_SAVED_PROMPTS,
  STORAGE_KEY_RENAME_SETTINGS,
  DEFAULT_RENAME_PRESETS,
} from '../shared/constants';

/**
 * Менеджер для работы с figma.clientStorage
 */
export class StorageManager {
  private cache: PluginSettings | null = null;
  private presetsCache: DataPresetSettings | null = null;
  private savedPromptsCache: SavedPromptsLibrary | null = null;
  private renameSettingsCache: RenameSettings | null = null;

  /**
   * Загрузка настроек из clientStorage
   */
  async loadSettings(): Promise<PluginSettings> {
    // Возвращаем из кеша если есть
    if (this.cache) {
      console.log('[StorageManager] Returning cached settings');
      return this.cache;
    }

    try {
      console.log('[StorageManager] Loading settings from clientStorage');
      const stored = await figma.clientStorage.getAsync(STORAGE_KEY_SETTINGS);

      if (!stored) {
        // Настроек нет - создаём дефолтные
        console.log('[StorageManager] No settings found, creating defaults');
        this.cache = { ...DEFAULT_SETTINGS };
        await this.saveSettings(this.cache);
        return this.cache;
      }

      console.log('[StorageManager] Settings loaded from storage:', JSON.stringify(stored, null, 2));

      // Мигрируем настройки если нужно
      this.cache = migrateSettings(stored);

      // Если произошла миграция, сохраняем обновлённые настройки
      if (this.cache.version !== stored.version) {
        console.log('[StorageManager] Settings migrated, saving updated version');
        await this.saveSettings(this.cache);
      }

      return this.cache;
    } catch (error) {
      console.error('[StorageManager] Failed to load settings:', error);
      this.cache = { ...DEFAULT_SETTINGS };
      return this.cache;
    }
  }

  /**
   * Сохранение настроек в clientStorage
   */
  async saveSettings(settings: PluginSettings): Promise<void> {
    try {
      console.log('[StorageManager] Saving settings to clientStorage');
      console.log('[StorageManager] Settings object:', JSON.stringify(settings, null, 2));

      settings.lastUpdated = Date.now();
      await figma.clientStorage.setAsync(STORAGE_KEY_SETTINGS, settings);
      this.cache = settings;

      console.log('[StorageManager] Settings saved successfully to clientStorage');
    } catch (error) {
      console.error('[StorageManager] Failed to save settings:', error);
      throw new Error('Failed to save settings');
    }
  }

  /**
   * Обновление настроек провайдера
   */
  async updateProviderSettings(
    providerType: ProviderType,
    config: Partial<ProviderConfig>
  ): Promise<void> {
    const settings = await this.loadSettings();

    settings.providers[providerType] = {
      ...settings.providers[providerType],
      ...config,
    } as any;

    await this.saveSettings(settings);
  }

  /**
   * Установка активного провайдера
   */
  async setActiveProvider(provider: ProviderType | null): Promise<void> {
    const settings = await this.loadSettings();
    settings.activeProvider = provider;
    await this.saveSettings(settings);
  }

  /**
   * Обновление настроек генерации
   */
  async updateGenerationSettings(updates: Partial<GenerationSettings>): Promise<void> {
    const settings = await this.loadSettings();
    settings.generation = {
      ...settings.generation,
      ...updates,
    };
    await this.saveSettings(settings);
  }

  /**
   * Трекинг использования токенов
   */
  async trackTokenUsage(providerId: string, tokens: number, cost: number): Promise<void> {
    try {
      const stats: AllUsageStats = (await figma.clientStorage.getAsync(STORAGE_KEY_USAGE_STATS)) || {};

      if (!stats[providerId]) {
        stats[providerId] = { totalTokens: 0, totalCost: 0, requestCount: 0, lastUsed: 0 };
      }

      const providerStats = stats[providerId]!;
      providerStats.totalTokens += tokens;
      providerStats.totalCost += cost;
      providerStats.requestCount += 1;
      providerStats.lastUsed = Date.now();

      await figma.clientStorage.setAsync(STORAGE_KEY_USAGE_STATS, stats);
    } catch (error) {
      console.error('Failed to track usage:', error);
    }
  }

  /**
   * Получение статистики использования
   */
  async getUsageStats(): Promise<AllUsageStats> {
    try {
      return (await figma.clientStorage.getAsync(STORAGE_KEY_USAGE_STATS)) || {};
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return {};
    }
  }

  /**
   * Очистка кеша (для тестирования)
   */
  clearCache(): void {
    this.cache = null;
  }

  // ============================================================================
  // Data Presets Methods
  // ============================================================================

  /**
   * Миграция пресета из старого формата (v0) в новый (v1)
   */
  private migratePreset(preset: any): DataPreset {
    // Если уже версия 1 с fieldNames - пропускаем
    if (preset.version === 1 && preset.fieldNames) {
      return preset as DataPreset;
    }

    // Собираем все уникальные ключи из всех групп для создания схемы
    const fieldNamesSet = new Set<string>();

    if (preset.version === 1 && preset.groups) {
      // Уже есть группы, нужно только добавить fieldNames
      for (const group of preset.groups) {
        if (group.values) {
          Object.keys(group.values).forEach((key) => fieldNamesSet.add(key));
        }
      }

      return {
        id: preset.id,
        name: preset.name,
        version: 1,
        fieldNames: Array.from(fieldNamesSet),
        multiValueSeparator: preset.multiValueSeparator || ', ',
        groups: preset.groups.map((g: any) => ({
          id: g.id,
          name: g.name,
          values: g.values || {},
        })),
        createdAt: preset.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
    }

    // Конвертируем старый формат (плоский values) в новый (groups)
    const values = preset.values || {};
    const fieldNames = Object.keys(values);

    const migratedPreset: DataPreset = {
      id: preset.id,
      name: preset.name,
      version: 1,
      fieldNames: fieldNames,
      multiValueSeparator: ', ',
      groups: [
        {
          id: 'default-group',
          name: 'Default Values',
          values: values,
        },
      ],
      createdAt: preset.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    console.log('[StorageManager] Migrated preset from v0 to v1:', preset.name);
    return migratedPreset;
  }

  /**
   * Загрузка пресетов данных из clientStorage
   */
  async loadDataPresets(): Promise<DataPresetSettings> {
    // Возвращаем из кеша если есть
    if (this.presetsCache) {
      return this.presetsCache;
    }

    try {
      const stored = await figma.clientStorage.getAsync(STORAGE_KEY_DATA_PRESETS);

      if (!stored) {
        // Пресетов нет - создаём дефолтные
        this.presetsCache = Object.assign({}, DEFAULT_DATA_PRESETS);
        await this.saveDataPresets(this.presetsCache);
        return this.presetsCache;
      }

      // Мигрируем все пресеты в новый формат
      const migratedPresets = stored.presets.map((preset: any) => this.migratePreset(preset));
      const settings: DataPresetSettings = {
        presets: migratedPresets,
        selectedPresetId: stored.selectedPresetId,
        lastUpdated: stored.lastUpdated,
      };

      this.presetsCache = settings;

      // Сохраняем мигрированные данные
      if (stored.presets.some((p: any) => !p.version || p.version < 1)) {
        console.log('[StorageManager] Saving migrated presets...');
        await this.saveDataPresets(this.presetsCache);
      }

      return this.presetsCache;
    } catch (error) {
      console.error('Failed to load data presets:', error);
      this.presetsCache = Object.assign({}, DEFAULT_DATA_PRESETS);
      return this.presetsCache;
    }
  }

  /**
   * Сохранение пресетов данных в clientStorage
   */
  async saveDataPresets(settings: DataPresetSettings): Promise<void> {
    try {
      settings.lastUpdated = Date.now();
      await figma.clientStorage.setAsync(STORAGE_KEY_DATA_PRESETS, settings);
      this.presetsCache = settings;
    } catch (error) {
      console.error('Failed to save data presets:', error);
      throw new Error('Failed to save data presets');
    }
  }

  /**
   * Очистка кеша пресетов
   */
  clearPresetsCache(): void {
    this.presetsCache = null;
  }

  // ============================================================================
  // Saved Prompts Library Methods
  // ============================================================================

  /**
   * Загрузка библиотеки сохранённых промптов
   */
  async loadSavedPrompts(): Promise<SavedPromptsLibrary> {
    if (this.savedPromptsCache) {
      return this.savedPromptsCache;
    }

    try {
      const stored = await figma.clientStorage.getAsync(STORAGE_KEY_SAVED_PROMPTS);

      if (!stored) {
        // Создаём дефолтную библиотеку
        this.savedPromptsCache = {
          prompts: [],
          categories: ['Marketing', 'Technical', 'Creative', 'General'],
          lastUpdated: Date.now(),
        };
        await this.saveSavedPrompts(this.savedPromptsCache);
        return this.savedPromptsCache;
      }

      this.savedPromptsCache = stored;
      return this.savedPromptsCache;
    } catch (error) {
      console.error('Failed to load saved prompts:', error);
      this.savedPromptsCache = {
        prompts: [],
        categories: ['Marketing', 'Technical', 'Creative', 'General'],
        lastUpdated: Date.now(),
      };
      return this.savedPromptsCache;
    }
  }

  /**
   * Сохранение библиотеки промптов
   */
  async saveSavedPrompts(library: SavedPromptsLibrary): Promise<void> {
    try {
      library.lastUpdated = Date.now();
      await figma.clientStorage.setAsync(STORAGE_KEY_SAVED_PROMPTS, library);
      this.savedPromptsCache = library;
    } catch (error) {
      console.error('Failed to save prompts library:', error);
      throw new Error('Failed to save prompts library');
    }
  }

  /**
   * Очистка кеша промптов
   */
  clearPromptsCache(): void {
    this.savedPromptsCache = null;
  }

  // ============================================================================
  // Rename Settings Methods
  // ============================================================================

  /**
   * Загрузка настроек переименования
   */
  async loadRenameSettings(): Promise<RenameSettings> {
    if (this.renameSettingsCache) {
      return this.renameSettingsCache;
    }

    try {
      const stored = await figma.clientStorage.getAsync(STORAGE_KEY_RENAME_SETTINGS);

      if (!stored) {
        // Создаём дефолтные настройки с предустановленными пресетами
        this.renameSettingsCache = {
          presets: DEFAULT_RENAME_PRESETS,
          lastUpdated: Date.now(),
        };
        await this.saveRenameSettings(this.renameSettingsCache);
        return this.renameSettingsCache;
      }

      this.renameSettingsCache = stored;
      return this.renameSettingsCache;
    } catch (error) {
      console.error('Failed to load rename settings:', error);
      this.renameSettingsCache = {
        presets: DEFAULT_RENAME_PRESETS,
        lastUpdated: Date.now(),
      };
      return this.renameSettingsCache;
    }
  }

  /**
   * Сохранение настроек переименования
   */
  async saveRenameSettings(settings: RenameSettings): Promise<void> {
    try {
      settings.lastUpdated = Date.now();
      await figma.clientStorage.setAsync(STORAGE_KEY_RENAME_SETTINGS, settings);
      this.renameSettingsCache = settings;
    } catch (error) {
      console.error('Failed to save rename settings:', error);
      throw new Error('Failed to save rename settings');
    }
  }

  /**
   * Очистка кеша настроек переименования
   */
  clearRenameCache(): void {
    this.renameSettingsCache = null;
  }
}
