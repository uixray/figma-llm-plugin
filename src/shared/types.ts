// ============================================================================
// Provider Configuration Types (V2 - Multi-Provider Architecture)
// ============================================================================

/**
 * Пользовательская конфигурация провайдера (созданная пользователем)
 * V2.0 - Используется для обратной совместимости
 */
export interface UserProviderConfig {
  id: string; // UUID конфигурации
  baseConfigId: string; // Ссылка на PROVIDER_CONFIGS[].id из providers.ts
  name: string; // Пользовательское название, например "My GPT-4o Production"
  apiKey: string; // API ключ пользователя
  customPricing?: {
    // Переопределённые цены (для корпоративных контрактов)
    input: number; // $ за 1M токенов
    output: number;
  };
  customUrl?: string; // Переопределённый URL (для OpenAI-compatible)
  folderId?: string; // Folder ID для Yandex провайдеров (обязательно для Yandex)
  modelName?: string; // Название модели (для LM Studio и custom моделей)
  enabled: boolean; // Активна ли конфигурация
  createdAt: number; // timestamp
  lastUsed?: number; // timestamp последнего использования
}

// ============================================================================
// Provider Groups (V2.1 - Multi-Model Architecture)
// ============================================================================

/**
 * Конфигурация модели внутри группы
 * V2.1 - Позволяет иметь несколько моделей с общим API ключом
 */
export interface ModelConfig {
  id: string; // UUID конфига модели
  baseConfigId: string; // Ссылка на PROVIDER_CONFIGS[].id из providers.ts
  name: string; // Пользовательское название модели, например "GPT-4o Production"
  enabled: boolean; // Активна ли эта модель
  customPricing?: {
    // Переопределённые цены для этой модели
    input: number; // $ за 1M токенов
    output: number;
  };
  customUrl?: string; // Переопределённый URL для этой модели
  modelName?: string; // Название модели (для LM Studio)
  lastUsed?: number; // timestamp последнего использования
}

/**
 * Группа провайдеров - объединяет несколько моделей с общим API ключом
 * V2.1 - Основная структура для управления провайдерами
 */
export interface ProviderGroup {
  id: string; // UUID группы
  name: string; // Название группы, например "My OpenAI Production"
  baseProviderId: string; // ID базового провайдера: 'openai', 'claude', 'yandex', и т.д.
  sharedApiKey: string; // Общий API ключ для всех моделей в группе
  folderId?: string; // Folder ID для Yandex провайдеров (общий для группы)
  customUrl?: string; // Custom URL для LM Studio (общий для группы), например http://127.0.0.1:1234
  sharedProxy?: {
    // Общий прокси для всех моделей (опционально)
    url: string;
    enabled: boolean;
  };
  modelConfigs: ModelConfig[]; // Список моделей в группе
  enabled: boolean; // Активна ли вся группа
  createdAt: number; // timestamp создания
  lastUsed?: number; // timestamp последнего использования любой модели группы
}

/**
 * УСТАРЕВШИЕ типы (v1) - оставлены для миграции
 */
export type ProviderType = 'lmstudio' | 'yandex' | 'openai-compatible';

/**
 * Базовая конфигурация провайдера
 */
export interface BaseProviderConfig {
  type: ProviderType;
  enabled: boolean;
  name: string; // Пользовательское название
}

/**
 * Конфигурация LM Studio (локальный сервер)
 */
export interface LMStudioConfig extends BaseProviderConfig {
  type: 'lmstudio';
  baseUrl: string; // default: http://localhost:1234/v1
  model: string; // default: local-model
  useProxy: boolean; // Использовать ли CORS proxy
  proxyUrl?: string; // URL прокси-сервера
}

/**
 * Конфигурация Yandex Cloud
 */
export interface YandexConfig extends BaseProviderConfig {
  type: 'yandex';
  folderId: string;
  apiKey: string;
  model: string; // yandexgpt/latest или другие
}

/**
 * Конфигурация OpenAI-совместимых API
 */
export interface OpenAICompatibleConfig extends BaseProviderConfig {
  type: 'openai-compatible';
  baseUrl: string;
  apiKey: string;
  model: string;
  organization?: string;
}

/**
 * Union type для всех типов конфигураций провайдеров
 */
export type ProviderConfig =
  | LMStudioConfig
  | YandexConfig
  | OpenAICompatibleConfig;

// ============================================================================
// Generation Settings
// ============================================================================

/**
 * Настройки генерации текста
 */
export interface GenerationSettings {
  temperature: number; // 0.0 - 2.0, default: 0.7
  maxTokens: number; // default: 2000
  systemPrompt?: string;
  streaming: boolean; // default: true
}

// ============================================================================
// Complete Plugin Settings (хранится в clientStorage)
// ============================================================================

/**
 * Полная схема настроек плагина (V2)
 */
export interface PluginSettings {
  version: number; // Версия схемы настроек (2.1 = provider groups)

  // V2.1: Группы провайдеров (НОВАЯ АРХИТЕКТУРА)
  providerGroups?: ProviderGroup[];
  activeModelId?: string; // ID активной модели (ModelConfig.id)

  // V2.0: Список пользовательских конфигураций (для обратной совместимости)
  providerConfigs?: UserProviderConfig[];
  activeProviderId?: string; // ID активной конфигурации (для обратной совместимости)

  // V1.0: УСТАРЕЛО - оставлено для миграции
  activeProvider?: ProviderType | null;
  providers?: {
    lmstudio?: LMStudioConfig;
    yandex?: YandexConfig;
    openaiCompatible?: OpenAICompatibleConfig;
  };

  // Настройки генерации
  generation: GenerationSettings;

  // UI настройки
  ui: UISettings;

  // Язык интерфейса
  language: 'en' | 'ru' | 'ja' | 'zh' | 'fr';

  // Глобальный CORS proxy (опционально)
  globalProxyUrl?: string;

  lastUpdated: number; // timestamp
}

/**
 * UI настройки
 */
export interface UISettings {
  showTokenCount: boolean;
  showCostEstimate: boolean;
  lastActiveTab?: string; // 'generate' | 'settings' | 'data' | 'rename'
  theme?: 'light' | 'dark' | 'auto'; // Theme preference
}

/**
 * Настройки по умолчанию (V2.1)
 */
export const DEFAULT_SETTINGS: PluginSettings = {
  version: 2.1,
  providerGroups: [],
  activeModelId: '',
  providerConfigs: [], // для обратной совместимости
  activeProviderId: '', // для обратной совместимости
  generation: {
    temperature: 0.7,
    maxTokens: 2000,
    streaming: true,
  },
  ui: {
    showTokenCount: true,
    showCostEstimate: true,
  },
  language: 'en',
  lastUpdated: Date.now(),
};

// ============================================================================
// Usage Statistics
// ============================================================================

/**
 * Статистика использования для каждого провайдера
 */
export interface UsageStats {
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  lastUsed: number; // timestamp
}

/**
 * Структура для хранения статистики всех провайдеров
 */
export type AllUsageStats = Partial<Record<ProviderType, UsageStats>>;

// ============================================================================
// Text Node Info
// ============================================================================

/**
 * Информация о текстовой ноде в Figma
 */
export interface TextNodeInfo {
  id: string;
  name: string;
  characters: string;
}

// ============================================================================
// Data Presets (Подстановка данных)
// ============================================================================

/**
 * Группа связанных значений (например, данные одного пользователя)
 */
export interface ValueGroup {
  id: string; // UUID группы
  name: string; // Название группы, например "John Smith"
  type?: string; // Тип группы (опционально), например 'user', 'product'
  values: Record<string, string>; // { "name": "John", "email": "john@..." }
}

/**
 * Группа узлов (для последовательного применения)
 */
export interface NodeGroup {
  parentId: string; // ID выделенного родительского узла
  parentName: string; // Название узла
  textNodes: TextNodeInfo[]; // TEXT узлы внутри этого родителя
}

/**
 * Пресет данных для подстановки в текстовые слои
 */
export interface DataPreset {
  id: string; // UUID
  name: string; // Название пресета, например "Team Members"
  version: number; // Версия формата (1 = с группами)
  fieldNames: string[]; // Схема полей, например ["name", "email", "phone"]
  defaultValues?: Record<string, string>; // Дефолтные значения для обратного переименования
  groups: ValueGroup[]; // Группы связанных значений
  multiValueSeparator?: string; // Разделитель для множественных значений, по умолчанию ", "
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
}

/**
 * Настройки всех пресетов данных
 */
export interface DataPresetSettings {
  presets: DataPreset[];
  selectedPresetId: string | null;
  lastUpdated: number; // timestamp
}

/**
 * Default data presets for first launch
 */
export const DEFAULT_DATA_PRESETS: DataPresetSettings = {
  presets: [
    {
      id: 'default-users',
      name: 'User Examples',
      version: 1,
      fieldNames: ['#name', '#phone', '#email', '#company'],
      groups: [
        {
          id: 'user-1',
          name: 'John Smith',
          type: 'user',
          values: {
            '#name': 'John Smith',
            '#phone': '+1 (555) 123-4567',
            '#email': 'john@example.com',
            '#company': 'Acme Corporation',
          },
        },
        {
          id: 'user-2',
          name: 'Sarah Johnson',
          type: 'user',
          values: {
            '#name': 'Sarah Johnson',
            '#phone': '+1 (555) 987-6543',
            '#email': 'sarah@example.com',
            '#company': 'Johnson Design Studio',
          },
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'default-products',
      name: 'Product Examples',
      version: 1,
      fieldNames: ['#product', '#price', '#description', '#sku'],
      groups: [
        {
          id: 'product-1',
          name: 'iPhone 15 Pro',
          type: 'product',
          values: {
            '#product': 'iPhone 15 Pro',
            '#price': '$1,199',
            '#description': 'Latest flagship by Apple',
            '#sku': 'IPHONE15PRO-256-BLK',
          },
        },
        {
          id: 'product-2',
          name: 'Samsung Galaxy S24',
          type: 'product',
          values: {
            '#product': 'Samsung Galaxy S24',
            '#price': '$899',
            '#description': 'Flagship by Samsung',
            '#sku': 'GALAXY-S24-128-WHT',
          },
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
  selectedPresetId: null,
  lastUpdated: Date.now(),
};

// ============================================================================
// Saved Prompts Library
// ============================================================================

/**
 * Сохранённый промпт
 */
export interface SavedPrompt {
  id: string; // UUID
  name: string; // Название промпта
  content: string; // Текст промпта
  systemPrompt?: string; // Системный промпт (optional)
  category?: string; // Категория: 'marketing', 'technical', 'creative', 'general'
  tags?: string[]; // Теги для поиска
  preferredProviderId?: string; // Preferred provider config ID for this prompt
  isBuiltIn?: boolean; // Whether this is a built-in prompt (not editable)
  usageCount: number; // Счётчик использований
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
}

/**
 * Библиотека сохранённых промптов
 */
export interface SavedPromptsLibrary {
  prompts: SavedPrompt[];
  categories: string[]; // Список всех категорий
  lastUpdated: number; // timestamp
}

// ============================================================================
// Layer Renaming Presets
// ============================================================================

/**
 * Типы пресетов переименования
 */
export type RenamePresetType =
  | 'bem' // Block Element Modifier
  | 'camelCase'
  | 'snakeCase'
  | 'kebabCase'
  | 'custom'; // Пользовательские правила

/**
 * Правило переименования
 */
export interface RenameRule {
  pattern: string; // Regex pattern для поиска
  replacement: string; // Замена (может содержать $1, $2 для групп)
  nodeTypes?: ('FRAME' | 'GROUP' | 'TEXT')[]; // К каким типам узлов применять
  caseSensitive?: boolean; // Учитывать ли регистр
}

/**
 * Пресет для массового переименования слоёв
 */
export interface RenamePreset {
  id: string; // UUID
  name: string; // Название пресета
  type: RenamePresetType;
  rules: RenameRule[]; // Список правил
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
}

/**
 * Предпросмотр изменений при переименовании
 */
export interface RenamePreview {
  nodeId: string;
  nodeName: string; // Для отображения в UI
  oldName: string;
  newName: string;
  nodeType: string; // FRAME, GROUP, TEXT
  depth: number; // Глубина вложенности (для отступов в UI)
}

/**
 * Настройки переименования
 */
export interface RenameSettings {
  presets: RenamePreset[];
  lastUsedPresetId?: string;
  lastUpdated: number; // timestamp
}
