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
        // Создаём дефолтную библиотеку с предустановленными промптами для дизайнеров
        const now = Date.now();
        this.savedPromptsCache = {
          prompts: [
            // ── GENERAL ──────────────────────────────────────────────────────────
            {
              id: 'default-expand',
              name: 'Expand text',
              content: 'You are a professional UX writer specializing in interface copy. Your task is to expand the given text while preserving its original meaning, tone, and intent. Add helpful context, concrete details, and natural transitions to make the text feel complete and polished — as if written by an experienced content designer. Keep the writing clear, concise, and appropriate for a digital product interface. Do not add headers, bullet points, or markdown — output plain running text only.',
              category: 'General',
              tags: ['expand', 'longer', 'rewrite', 'ux writing'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'default-shorten',
              name: 'Shorten text',
              content: 'You are a professional UX writer with expertise in microcopy and interface design. Condense the given text to its essential meaning, removing redundancy and filler without losing clarity or intent. The result should be tight, scannable, and natural — suitable for buttons, labels, tooltips, or body copy in a UI. Preserve the original tone. Output only the shortened text with no explanations.',
              category: 'General',
              tags: ['shorten', 'condense', 'shorter', 'trim'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'default-translate-en',
              name: 'Translate to English',
              content: 'You are a professional translator and UX writer. Translate the given text into natural, idiomatic English suitable for a digital product interface. Preserve the original tone (formal, casual, friendly, etc.) and adapt culturally specific phrases so they feel native to English-speaking users. Output only the translated text — no notes, no alternatives.',
              category: 'General',
              tags: ['translate', 'english', 'localization', 'i18n'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'default-translate-ru',
              name: 'Translate to Russian',
              content: 'You are a professional translator and UX writer. Translate the given text into natural, idiomatic Russian suitable for a digital product interface. Preserve the original tone and adapt idioms so they feel native to Russian-speaking users. Use correct grammar and punctuation per Russian language standards. Output only the translated text — no notes, no alternatives.',
              category: 'General',
              tags: ['translate', 'russian', 'localization', 'ru'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'default-typograph',
              name: 'Typograph text',
              content: 'You are a professional typographer and editor. Apply correct typographic rules to the given text: replace straight quotes with typographic quotes appropriate for the language, replace hyphens with em dashes (—) or en dashes (–) where grammatically correct, add non-breaking spaces before short prepositions and after initials, fix spacing around punctuation, and remove double spaces. Do not change wording or structure. Output only the corrected text.',
              category: 'General',
              tags: ['typograph', 'typography', 'punctuation', 'formatting', 'dashes', 'quotes'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'default-fix-grammar',
              name: 'Fix grammar & spelling',
              content: 'You are a meticulous copy editor. Correct all grammar, spelling, and punctuation errors in the given text. Do not change the meaning, style, or structure — only fix mistakes. If the text is already correct, return it unchanged. Output only the corrected text with no comments.',
              category: 'General',
              tags: ['grammar', 'spelling', 'proofread', 'fix', 'errors'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'default-simplify',
              name: 'Simplify language',
              content: 'You are a plain-language specialist working on digital product interfaces. Rewrite the given text using simple, everyday words that anyone can understand — aim for a reading level accessible to a broad audience. Remove jargon, technical terms, and complex sentence structures. Keep the meaning and intent fully intact. Output only the simplified text.',
              category: 'General',
              tags: ['simplify', 'plain language', 'accessible', 'clear', 'readability'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            // ── CREATIVE ─────────────────────────────────────────────────────────
            {
              id: 'default-realistic-content',
              name: 'Fill with realistic content',
              content: 'You are a UI content designer creating realistic placeholder data for interface mockups. Replace or rewrite the given text with believable, contextually appropriate content that a real user would actually see in a finished product. Avoid "Lorem ipsum", generic phrases like "Text here", or obviously fake names. Infer the context from the existing text or layer name and generate content that fits naturally. Output only the realistic content.',
              category: 'Creative',
              tags: ['placeholder', 'realistic', 'mockup', 'content', 'fake data', 'lorem'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'default-tone-friendly',
              name: 'Make tone friendly & warm',
              content: 'You are a UX writer specializing in conversational product copy. Rewrite the given text to feel warm, approachable, and human — like a helpful friend rather than a corporate system. Use contractions, active voice, and empathetic language. Avoid stiff formality or cold instructions. Keep the meaning identical and the length similar. Output only the rewritten text.',
              category: 'Creative',
              tags: ['tone', 'friendly', 'warm', 'conversational', 'voice'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'default-tone-formal',
              name: 'Make tone formal & professional',
              content: 'You are a senior technical writer for enterprise software. Rewrite the given text to sound formal, authoritative, and professional — suitable for business or enterprise audiences. Use proper grammar, avoid colloquialisms and contractions, and maintain a neutral, respectful tone. Keep the meaning identical. Output only the rewritten text.',
              category: 'Creative',
              tags: ['tone', 'formal', 'professional', 'enterprise', 'voice'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'default-emoji',
              name: 'Add relevant emoji',
              content: 'You are a UX writer crafting expressive interface copy for a modern consumer app. Add one or two relevant emoji to the given text to make it more engaging and visually scannable. Place emoji at the start or end of a sentence — never mid-sentence. Choose emoji that reinforce the meaning, not just decorate. If the text is very short (button label, nav item), add a single emoji at the start. Output only the text with emoji added.',
              category: 'Creative',
              tags: ['emoji', 'expressive', 'consumer', 'mobile', 'icons'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'default-alternative-variants',
              name: 'Generate 5 text variants',
              content: 'You are a UX copywriter running an A/B test. Generate exactly 5 alternative versions of the given text, each with a distinct tone, angle, or structure — ranging from minimal to descriptive, formal to casual. Number each variant 1–5. Keep all variants at a similar length to the original. Output only the numbered list of variants, no explanations.',
              category: 'Creative',
              tags: ['variants', 'alternatives', 'ab test', 'options', 'copy'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            // ── MARKETING ────────────────────────────────────────────────────────
            {
              id: 'default-headline',
              name: 'Write a selling headline',
              content: 'You are a conversion-focused copywriter with expertise in digital product marketing. Based on the given text, write a compelling headline that grabs attention, communicates clear value, and motivates the reader to act. Use proven copywriting techniques: highlight a benefit (not a feature), speak to the user\'s goal or pain point, and create a sense of relevance. The headline should be 5–10 words. Output only the headline — no punctuation at the end, no explanations.',
              category: 'Marketing',
              tags: ['headline', 'selling', 'conversion', 'cta', 'marketing', 'copy'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'default-cta',
              name: 'Write a CTA button label',
              content: 'You are a UX writer and conversion specialist. Based on the given text or context, write a clear, action-oriented CTA button label. It must be 1–4 words, start with a strong verb (Get, Start, Try, Explore, Save, etc.), and communicate immediate value. Avoid vague labels like "Click here", "Submit", or "OK". Output only the button label — no punctuation, no explanations.',
              category: 'Marketing',
              tags: ['cta', 'button', 'label', 'action', 'conversion'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'default-description',
              name: 'Write a product description',
              content: 'You are a product copywriter for a digital marketplace. Write a concise, persuasive product description based on the given text. Lead with the primary benefit, follow with key features, and end with a subtle call to value. Use active voice, scannable language, and avoid superlatives ("best", "amazing"). Length: 2–4 sentences. Output only the description.',
              category: 'Marketing',
              tags: ['product', 'description', 'e-commerce', 'copy', 'benefits'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'default-onboarding',
              name: 'Write onboarding microcopy',
              content: 'You are a UX writer specializing in onboarding flows and empty states. Based on the given text or screen context, write concise, welcoming microcopy for an onboarding step or empty state. It should tell the user what to do next, why it matters, and make the first action feel easy and low-risk. Use a warm, encouraging tone. Max 2–3 short sentences. Output only the microcopy.',
              category: 'Marketing',
              tags: ['onboarding', 'empty state', 'microcopy', 'welcome', 'first run'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'default-push-notification',
              name: 'Write a push notification',
              content: 'You are a mobile growth specialist writing push notifications. Based on the given context or text, craft a push notification with a punchy title (max 5 words) and a body (max 15 words) that creates curiosity or urgency without being clickbait. Be specific, personal, and action-oriented. Format your output as:\nTitle: [title]\nBody: [body]',
              category: 'Marketing',
              tags: ['push', 'notification', 'mobile', 'engagement', 'alert'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            // ── TECHNICAL ────────────────────────────────────────────────────────
            {
              id: 'default-error-message',
              name: 'Write an error message',
              content: 'You are a UX writer following best practices for error messaging in digital interfaces. Based on the given context, write a clear, helpful error message that: (1) states what went wrong in plain language, (2) explains why if it helps the user, (3) tells the user exactly what to do next. Use an empathetic but neutral tone — no blame, no jargon, no technical codes. Max 2 sentences. Output only the error message.',
              category: 'Technical',
              tags: ['error', 'message', 'alert', 'validation', 'microcopy'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'default-tooltip',
              name: 'Write a tooltip',
              content: 'You are a UX writer creating tooltips for a complex digital product. Based on the given UI element name or context, write a concise tooltip that explains what the element does or why it matters — in 1 sentence, max 15 words. Start with a verb when possible. Do not repeat the element name. Output only the tooltip text.',
              category: 'Technical',
              tags: ['tooltip', 'hint', 'help text', 'label', 'ui'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'default-placeholder',
              name: 'Write input placeholder text',
              content: 'You are a UX writer designing form microcopy. Based on the given input field name or context, write a helpful placeholder text that gives users an example of what to enter — not just a label restatement. Use concrete examples (e.g. "john@company.com" not "Enter email"). Keep it under 6 words. Output only the placeholder text.',
              category: 'Technical',
              tags: ['placeholder', 'input', 'form', 'field', 'microcopy'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'default-success-message',
              name: 'Write a success message',
              content: 'You are a UX writer creating confirmation and success states for digital interfaces. Based on the given action or context, write a brief success message that confirms what just happened, reassures the user, and (when relevant) tells them what comes next. Keep it positive, specific, and under 15 words. Avoid generic phrases like "Success!" alone. Output only the success message.',
              category: 'Technical',
              tags: ['success', 'confirmation', 'feedback', 'toast', 'notification'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'default-accessibility',
              name: 'Write accessible alt text',
              content: 'You are a digital accessibility specialist. Based on the given image description or context, write concise, descriptive alt text suitable for a screen reader. Describe the content and function of the image — what it shows and why it is there. If the image is purely decorative, output exactly: alt="". Do not start with "Image of" or "Picture of". Max 125 characters. Output only the alt text value (without the attribute syntax).',
              category: 'Technical',
              tags: ['accessibility', 'alt text', 'a11y', 'screen reader', 'aria'],
              usageCount: 0,
              createdAt: now,
              updatedAt: now,
            },
          ],
          categories: ['General', 'Creative', 'Marketing', 'Technical'],
          lastUpdated: now,
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
