// ============================================================================
// Default URLs для провайдеров
// ============================================================================

export const DEFAULT_LM_STUDIO_URL = 'http://localhost:1234/v1';
export const DEFAULT_LM_STUDIO_MODEL = 'local-model';
export const DEFAULT_PROXY_URL = 'http://localhost:3333';

// Yandex API через прокси (для обхода CORS в Figma плагинах)
export const YANDEX_PROXY_URL = 'https://proxy.uixray.tech/api/yandex';
export const DEFAULT_YANDEX_MODEL = 'yandexgpt/latest';

export const DEFAULT_OPENAI_URL = 'https://api.openai.com/v1';
export const DEFAULT_OPENAI_MODEL = 'gpt-3.5-turbo';

// ============================================================================
// Timeout значения (ms)
// ============================================================================

export const SETTINGS_LOAD_TIMEOUT = 5000; // 5 секунд для загрузки настроек
export const GENERATION_TIMEOUT = 60000; // 60 секунд для генерации
export const CONNECTION_TEST_TIMEOUT = 10000; // 10 секунд для теста подключения

// ============================================================================
// Retry настройки
// ============================================================================

export const MAX_RETRY_ATTEMPTS = 3;
export const INITIAL_RETRY_DELAY = 1000; // 1 секунда
export const MAX_RETRY_DELAY = 10000; // 10 секунд
export const RETRY_BACKOFF_MULTIPLIER = 2;

// ============================================================================
// Token/Cost conversion
// ============================================================================

// Примерная оценка: 1 токен ≈ 4 символа
export const CHARS_PER_TOKEN = 4;

// Цены за 1000 токенов (примерные, пользователь может настроить)
export const DEFAULT_TOKEN_PRICES = {
  lmstudio: 0, // Бесплатно (локально)
  yandex: 0.0002, // ~0.2 руб за 1000 токенов
  'openai-compatible': 0.002, // Зависит от провайдера
};

// ============================================================================
// Plugin metadata
// ============================================================================

export const PLUGIN_VERSION = '2.3.0';
export const PLUGIN_BUILD = '20260221';

// ============================================================================
// UI константы
// ============================================================================

export const PLUGIN_WIDTH = 520;
export const PLUGIN_HEIGHT = 600;

export const NOTIFICATION_AUTO_HIDE_DELAY = 3000; // 3 секунды
export const DEBOUNCE_DELAY = 500; // 500ms для debounce

// ============================================================================
// Storage ключи
// ============================================================================

export const STORAGE_KEY_SETTINGS = 'settings';
export const STORAGE_KEY_USAGE_STATS = 'usage-stats';
export const STORAGE_KEY_DATA_PRESETS = 'data-presets';
export const STORAGE_KEY_SAVED_PROMPTS = 'saved-prompts'; // НОВОЕ
export const STORAGE_KEY_RENAME_SETTINGS = 'rename-settings'; // НОВОЕ

// ============================================================================
// Error messages
// ============================================================================

export const ERROR_MESSAGES = {
  NETWORK: 'Network error. Check your connection and try again.',
  TIMEOUT: 'Request timeout. Please try again.',
  AUTH: 'Authentication failed. Check your API key.',
  RATE_LIMIT: 'Rate limit exceeded. Please wait and try again.',
  INVALID_CONFIG: 'Provider not configured. Go to Settings.',
  API_ERROR: 'API server error. Please try again later.',
  UNKNOWN: 'An unknown error occurred',
  NO_SELECTION: 'Select text layers to apply generated text',
  EMPTY_PROMPT: 'Please enter a prompt',
  PROVIDER_DISABLED: 'Provider is disabled. Enable it in Settings.',
};

// ============================================================================
// Validation
// ============================================================================

export const MIN_TEMPERATURE = 0.0;
export const MAX_TEMPERATURE = 2.0;
export const MIN_MAX_TOKENS = 1;
export const MAX_MAX_TOKENS = 100000;

// ============================================================================
// Built-in Quick Action Prompts
// ============================================================================

export interface QuickAction {
  id: string;
  icon: string;
  labelKey: string; // i18n key
  fallbackLabel: string; // fallback (English)
  prompt: string;
  systemPrompt?: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'qa-shorter',
    icon: '✂️',
    labelKey: 'quickAction.shorter',
    fallbackLabel: 'Shorter',
    prompt: 'Make this text shorter while keeping the same meaning. Return only the result.',
  },
  {
    id: 'qa-longer',
    icon: '📝',
    labelKey: 'quickAction.longer',
    fallbackLabel: 'Longer',
    prompt: 'Expand this text with more detail while keeping the same tone. Return only the result.',
  },
  {
    id: 'qa-rewrite',
    icon: '🔄',
    labelKey: 'quickAction.rewrite',
    fallbackLabel: 'Rewrite',
    prompt: 'Rewrite this text in a different way while preserving the meaning. Return only the result.',
  },
  {
    id: 'qa-fix-grammar',
    icon: '✅',
    labelKey: 'quickAction.fixGrammar',
    fallbackLabel: 'Fix Grammar',
    prompt: 'Fix any grammar, spelling, or punctuation errors in this text. Return only the corrected text.',
  },
  {
    id: 'qa-translate-en',
    icon: '🇬🇧',
    labelKey: 'quickAction.translateEn',
    fallbackLabel: 'To English',
    prompt: 'Translate this text to English. Return only the translation.',
  },
  {
    id: 'qa-translate-ru',
    icon: '🇷🇺',
    labelKey: 'quickAction.translateRu',
    fallbackLabel: 'To Russian',
    prompt: 'Translate this text to Russian. Return only the translation.',
  },
];

// ============================================================================
// Default Rename Presets
// ============================================================================

import { RenamePreset } from './types';

export const DEFAULT_RENAME_PRESETS: RenamePreset[] = [
  {
    id: 'bem',
    name: 'BEM (Block Element Modifier)',
    type: 'bem',
    rules: [
      {
        pattern: '^(.+?)\\s*[-_]\\s*(.+)$',
        replacement: '$1__$2',
        caseSensitive: false,
      },
      {
        pattern: '\\s+',
        replacement: '-',
        caseSensitive: false,
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'camelCase',
    name: 'Camel Case',
    type: 'camelCase',
    rules: [
      {
        pattern: '[\\s-_]+(.)',
        replacement: '$1',
        caseSensitive: false,
      },
      {
        pattern: '^(.)',
        replacement: '$1',
        caseSensitive: false,
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'snakeCase',
    name: 'Snake Case',
    type: 'snakeCase',
    rules: [
      {
        pattern: '[\\s-]+',
        replacement: '_',
        caseSensitive: false,
      },
      {
        pattern: '([a-z])([A-Z])',
        replacement: '$1_$2',
        caseSensitive: true,
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'kebabCase',
    name: 'Kebab Case',
    type: 'kebabCase',
    rules: [
      {
        pattern: '[\\s_]+',
        replacement: '-',
        caseSensitive: false,
      },
      {
        pattern: '([a-z])([A-Z])',
        replacement: '$1-$2',
        caseSensitive: true,
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];
