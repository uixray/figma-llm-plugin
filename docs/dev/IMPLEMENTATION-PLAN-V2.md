# План доработок Figma LLM Plugin → UText V2.0

## Контекст

Плагин "Figma LLM Text Generator" находится на завершающей стадии разработки версии 2.0. Основная архитектура готова (95%), включая:
- 30+ AI провайдеров (Yandex ×8, OpenAI, Claude, Gemini, Mistral, Groq, Cohere, LM Studio)
- Модульная UI архитектура (main.ts: 1358→220 строк)
- Система переименования слоев (BEM/camelCase/snakeCase/kebabCase + AI)
- Batch processor с прогресс-трекингом
- Библиотека сохраненных промптов
- Многоязычность (en/ru/ja/zh/fr)

**Задача:** Завершить интеграцию V2, добавить критичные функции для пользователей (настройка прокси, FAQ, улучшенный UX провайдеров), создать полное тестовое покрытие, подготовить к публикации в Figma Community и GitHub.

---

## Фазы разработки

### ФАЗА 1: Критическая интеграция и стабилизация (1-2 дня)
**Цель:** Завершить интеграцию V2 архитектуры и устранить критические пробелы

#### 1.1 Завершить интеграцию sandbox handlers
**Файл:** `src/sandbox/code.ts`

**Действия:**
1. Добавить импорты:
   ```typescript
   import { RenameHandler } from './rename-handler';
   import { PromptsHandler } from './prompts-handler';
   import { BatchProcessor } from './batch-processor';
   import { ProviderFactory } from './providers/ProviderFactory';
   ```

2. Добавить в класс `PluginSandbox`:
   ```typescript
   private renameHandler: RenameHandler;
   private promptsHandler: PromptsHandler;
   private batchProcessor: BatchProcessor;
   ```

3. Инициализировать в конструкторе:
   ```typescript
   this.renameHandler = new RenameHandler(this.storageManager);
   this.promptsHandler = new PromptsHandler(this.storageManager);
   this.batchProcessor = new BatchProcessor();
   ```

4. Добавить обработчики сообщений в `handleUIMessage()`:
   - `load-rename-settings` → `renameHandler.initialize()`
   - `rename-preview` → `renameHandler.handlePreview()`
   - `rename-apply` → `renameHandler.handleApply()`
   - `load-prompts-library` → `promptsHandler.initialize()`
   - `save-prompt` → `promptsHandler.handleSavePrompt()`
   - `update-prompt-usage` → `promptsHandler.handleUpdateUsage()`
   - `delete-prompt` → `promptsHandler.handleDeletePrompt()`
   - `generate-batch` → `handleGenerateBatch()`

5. Реализовать метод `handleGenerateBatch()` согласно `FINAL-INTEGRATION-STEPS.md:174-250`

**Файлы:**
- `src/sandbox/code.ts` (основной)
- См. `FINAL-INTEGRATION-STEPS.md` для точных строк кода

#### 1.2 Активировать модульный UI
**Действия:**
```bash
# Бэкап старого main.ts
mv src/ui/main.ts src/ui/main-legacy-backup.ts

# Активировать новую версию
mv src/ui/main-v2.ts src/ui/main.ts
```

**Проверка:** UI должен корректно загружаться со всеми 5 панелями

#### 1.3 Исправить критическую проблему YandexProvider
**Файл:** `src/sandbox/providers/YandexProvider.ts` (строка 91-96)

**Проблема:** Folder ID захардкожен как placeholder

**Решение:**
1. Добавить поле `folderId?: string` в тип `UserProviderConfig` (`src/shared/types.ts`)
2. Обновить `YandexProvider.extractFolderId()`:
   ```typescript
   private extractFolderId(): string {
     if (this.userConfig.folderId) {
       return this.userConfig.folderId;
     }
     // Если folderId не указан, вернуть пустую строку и показать предупреждение
     console.warn('Yandex folder ID not configured');
     return '';
   }
   ```
3. Обновить `SettingsPanel.ts` - добавить поле ввода Folder ID для Yandex провайдеров

**Проверка:** Yandex провайдеры должны работать с пользовательским folder ID

---

### ФАЗА 2: Пользовательские улучшения (2-3 дня)
**Цель:** Реализовать критичные функции для удобства пользователей

#### 2.1 Система настройки прокси
**Требование:** Глобальная настройка + переопределение для конкретных провайдеров

**Файлы:**
- `src/shared/types.ts` - добавить поля прокси
- `src/ui/panels/SettingsPanel.ts` - UI для настройки прокси
- `src/sandbox/providers/BaseProvider.ts` - использовать прокси в запросах

**Реализация:**

1. **Типы** (`src/shared/types.ts`):
   ```typescript
   interface ProxyConfig {
     enabled: boolean;
     url: string;  // например: https://proxy.uixray.tech
     authToken?: string;  // опциональная авторизация
   }

   interface PluginSettings {
     // ... существующие поля
     globalProxy?: ProxyConfig;  // глобальная настройка
   }

   interface UserProviderConfig {
     // ... существующие поля
     customProxy?: ProxyConfig;  // переопределение для провайдера
   }
   ```

2. **UI** (`SettingsPanel.ts`):
   - Добавить секцию "Global Proxy Settings" на вкладке Settings
   - Поля: Enable checkbox, URL input, Auth token (optional)
   - Для каждого провайдера: чекбокс "Use custom proxy" + поля
   - Показывать текущий прокси (глобальный или кастомный) для каждого провайдера

3. **Backend** (`BaseProvider.ts`):
   ```typescript
   protected getEffectiveProxy(): ProxyConfig | null {
     // 1. Приоритет: customProxy провайдера
     if (this.userConfig.customProxy?.enabled) {
       return this.userConfig.customProxy;
     }
     // 2. Затем: глобальный прокси из settings
     if (this.settings.globalProxy?.enabled) {
       return this.settings.globalProxy;
     }
     // 3. Затем: дефолтный прокси из baseConfig
     if (this.baseConfig.requiresProxy && this.baseConfig.defaultProxy) {
       return { enabled: true, url: this.baseConfig.defaultProxy };
     }
     return null;
   }

   protected async fetch(url: string, options: RequestInit) {
     const proxy = this.getEffectiveProxy();
     if (proxy) {
       // Модифицировать URL или добавить заголовки для прокси
       options.headers = {
         ...options.headers,
         'X-Proxy-Target': url,
         ...(proxy.authToken && { 'X-Proxy-Auth': proxy.authToken })
       };
       return figma.network.fetch(proxy.url, options);
     }
     return figma.network.fetch(url, options);
   }
   ```

4. **Дефолтные значения:**
   - Глобальный прокси: выключен по умолчанию
   - Yandex провайдеры: дефолтный прокси `https://proxy.uixray.tech` (из baseConfig)

**i18n ключи:**
- `settings.proxy.title` = "Proxy Settings"
- `settings.proxy.global` = "Global Proxy"
- `settings.proxy.url` = "Proxy URL"
- `settings.proxy.auth` = "Auth Token (optional)"
- `settings.proxy.custom` = "Use custom proxy for this provider"

**Проверка:** Пользователь может задать свой прокси глобально или для отдельных провайдеров

#### 2.2 FAQ секция с инструкциями
**Файл:** Создать новую панель `src/ui/panels/HelpPanel.ts`

**Структура:**
```typescript
class HelpPanel {
  private container: HTMLElement;
  private accordions: Map<string, AccordionItem>;

  render() {
    // Создать аккордеон UI с секциями:
    // 1. "Как получить API ключ Yandex?"
    // 2. "Как создать свой прокси-сервер?"
    // 3. "Как получить ключи других провайдеров?"
    // 4. "Troubleshooting: частые ошибки"
    // 5. "Как экспортировать/импортировать настройки?"
  }

  private renderYandexApiKeyInstructions() {
    // Пошаговая инструкция:
    // 1. Перейти на cloud.yandex.ru
    // 2. Создать Billing Account
    // 3. Создать Folder
    // 4. Получить Folder ID (показать где найти)
    // 5. Создать API Key в IAM
    // 6. Скопировать ключ в плагин
  }

  private renderProxyInstructions() {
    // Инструкция по созданию прокси:
    // 1. Ссылка на готовые решения (Cloudflare Workers, Vercel Edge)
    // 2. Пример кода минимального прокси на Node.js
    // 3. Безопасность: CORS, rate limiting
    // 4. Как добавить в плагин
  }

  private renderTroubleshooting() {
    // Частые проблемы:
    // - "CORS error" → использовать прокси
    // - "401 Unauthorized" → проверить API ключ
    // - "429 Rate limit" → подождать или изменить план
    // - "Folder ID not found" (Yandex) → проверить rights
  }
}
```

**Интеграция:**
- Добавить вкладку "Help" в main.ts
- Добавить кнопку "?" на SettingsPanel рядом с каждым провайдером → открыть Help панель с прокруткой к нужной секции

**i18n:** Создать секцию `help.*` с переводами для en/ru/ja

**Проверка:** Пользователь может открыть Help и найти инструкции по настройке

#### 2.3 Улучшенное управление провайдерами
**Требование:** Для одного провайдера можно добавить несколько моделей с одним API ключом

**Текущая проблема:** Пользователь должен вводить API ключ отдельно для каждой модели одного провайдера

**Решение:**

**Концепция:**
- "Provider Group" - группа конфигураций с общим API ключом
- Пример: "My OpenAI" → GPT-4o, GPT-4o-mini используют один ключ

**Реализация:**

1. **Типы** (`src/shared/types.ts`):
   ```typescript
   interface ProviderGroup {
     id: string;                    // UUID группы
     name: string;                  // "My OpenAI Production"
     baseProviderId: string;        // 'openai', 'claude', и т.д.
     sharedApiKey: string;          // Общий ключ
     sharedProxy?: ProxyConfig;     // Общий прокси
     modelConfigs: ModelConfig[];   // Список моделей
   }

   interface ModelConfig {
     id: string;                    // UUID конфига
     baseConfigId: string;          // ссылка на PROVIDER_CONFIGS[].id
     name: string;                  // "GPT-4o Production"
     enabled: boolean;
     customPricing?: { input, output };
     customUrl?: string;
   }

   interface PluginSettings {
     // V2.1: Группы провайдеров (новая архитектура)
     providerGroups?: ProviderGroup[];
     activeModelId?: string;        // активная модель

     // V2.0: Сохранить для обратной совместимости
     providerConfigs?: UserProviderConfig[];
     activeProviderId?: string;
   }
   ```

2. **UI** (`SettingsPanel.ts`):
   - **Provider Selector**: показывать провайдеры сгруппированными по baseProviderId
   - При выборе провайдера (например, OpenAI):
     - Показать форму создания группы
     - Поля: Group name, API key, Proxy (optional)
     - Выбор моделей (чекбоксы): GPT-4o, GPT-4o-mini, и т.д.
   - **Provider List**: показывать группы с количеством моделей
     - Expand/collapse для просмотра моделей внутри группы
     - Enable/disable на уровне группы и модели
     - Edit/Delete на уровне группы

3. **Backend** (`storage-manager.ts`):
   - Миграция V2.0 → V2.1:
     ```typescript
     function migrateV20ToV21(settings: PluginSettings): PluginSettings {
       if (!settings.providerGroups && settings.providerConfigs) {
         // Конвертировать UserProviderConfig[] в ProviderGroup[]
         const groups = groupConfigsByProvider(settings.providerConfigs);
         return { ...settings, providerGroups: groups };
       }
       return settings;
     }
     ```

4. **Дефолтный порядок провайдеров** (согласно требованию):
   - 1. LM Studio (локальный)
   - 2. Yandex Cloud (7 моделей)
   - 3. OpenAI
   - 4. Claude
   - 5. Gemini
   - 6. Mistral
   - 7. Groq
   - 8. Cohere

**Проверка:**
- Пользователь создает группу "My OpenAI" с одним API ключом
- Выбирает модели GPT-4o и GPT-4o-mini
- Обе модели появляются в списке активных провайдеров
- Переключение между ними не требует повторного ввода ключа

#### 2.4 Подсветка слоев с дефолтными именами
**Требование:** Визуальная подсветка + поля ввода для переименования

**Файл:** `src/ui/panels/RenamePanel.ts`

**Реализация:**

1. **Добавить секцию "Default Names Checker":**
   ```typescript
   class RenamePanel {
     private async scanDefaultNames() {
       // Отправить сообщение в sandbox
       sendToSandbox({
         type: 'scan-default-names',
         id: generateId()
       });
     }

     private renderDefaultNamesList(layers: DefaultNameLayer[]) {
       // Отрисовать список слоев:
       // [⚠️] Rectangle 12  [         New Name          ] [Rename]
       // [⚠️] Line 5        [         New Name          ] [Rename]
       // [⚠️] Ellipse 3     [         New Name          ] [Rename]

       // Кнопки:
       // [Rename All]  [Generate AI Names]  [Cancel]
     }

     private async renameLayer(layerId: string, newName: string) {
       sendToSandbox({
         type: 'rename-single-layer',
         id: generateId(),
         layerId,
         newName
       });
     }

     private async renameAll(mappings: {layerId: string, newName: string}[]) {
       sendToSandbox({
         type: 'rename-batch-layers',
         id: generateId(),
         mappings
       });
     }

     private async generateAINames(layerIds: string[]) {
       // Использовать LLM для генерации имен на основе содержимого
       sendToSandbox({
         type: 'generate-ai-names',
         id: generateId(),
         layerIds
       });
     }
   }
   ```

2. **Backend** (`src/sandbox/rename-handler.ts`):
   ```typescript
   class RenameHandler {
     async scanDefaultNames(): Promise<DefaultNameLayer[]> {
       const page = figma.currentPage;
       const defaultPatterns = [
         /^Rectangle \d+$/,
         /^Line \d+$/,
         /^Ellipse \d+$/,
         /^Frame \d+$/,
         /^Group \d+$/,
         /^Vector \d+$/,
         /^Polygon \d+$/,
         /^Star \d+$/,
         /^Text \d+$/,
       ];

       const defaultNamedLayers: DefaultNameLayer[] = [];

       function traverse(node: SceneNode) {
         const isDefault = defaultPatterns.some(pattern =>
           pattern.test(node.name)
         );
         if (isDefault) {
           defaultNamedLayers.push({
             id: node.id,
             name: node.name,
             type: node.type,
             suggestedName: generateSuggestedName(node)
           });
         }
         if ('children' in node) {
           node.children.forEach(traverse);
         }
       }

       traverse(page);
       return defaultNamedLayers;
     }

     private generateSuggestedName(node: SceneNode): string {
       // Простая логика:
       // - Для Frame/Group: "container", "wrapper"
       // - Для Text: извлечь первые 20 символов текста
       // - Для Rectangle/Ellipse: "shape", "icon"
       // - Для Line/Vector: "divider", "icon"
     }
   }
   ```

3. **Типы сообщений** (`src/shared/messages.ts`):
   ```typescript
   interface ScanDefaultNamesMessage {
     type: 'scan-default-names';
     id: string;
   }

   interface DefaultNamesScannedMessage {
     type: 'default-names-scanned';
     id: string;
     layers: DefaultNameLayer[];
   }

   interface RenameSingleLayerMessage {
     type: 'rename-single-layer';
     id: string;
     layerId: string;
     newName: string;
   }

   interface RenameBatchLayersMessage {
     type: 'rename-batch-layers';
     id: string;
     mappings: {layerId: string, newName: string}[];
   }

   interface GenerateAINamesMessage {
     type: 'generate-ai-names';
     id: string;
     layerIds: string[];
   }
   ```

**i18n:**
- `rename.defaultNames.title` = "Layers with Default Names"
- `rename.defaultNames.scan` = "Scan for Default Names"
- `rename.defaultNames.rename` = "Rename"
- `rename.defaultNames.renameAll` = "Rename All"
- `rename.defaultNames.generateAI` = "Generate AI Names"

**Проверка:**
- Нажать "Scan for Default Names"
- Увидеть список слоев типа "Rectangle 12"
- Ввести новое имя или использовать "Generate AI Names"
- Переименовать один или все слои

---

### ФАЗА 3: Тестирование (3-5 дней)
**Цель:** Достичь 80%+ покрытия кода тестами (unit + integration)

#### 3.1 Создать инфраструктуру тестирования

**1. Jest конфигурация** - создать `jest.config.ts`:
```typescript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/ui/**/*.ts',  // UI тесты отдельно
    '!src/sandbox/code.ts'  // главный файл плагина - integration тесты
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};
```

**2. Установить зависимости:**
```bash
npm install --save-dev @types/jest jest-mock-extended
```

**3. Создать mock файлы** - `tests/mocks/figma.mock.ts`:
```typescript
// Mock Figma API
const clientStorageMock = new Map<string, any>();

global.figma = {
  clientStorage: {
    getAsync: jest.fn((key: string) =>
      Promise.resolve(clientStorageMock.get(key))
    ),
    setAsync: jest.fn((key: string, value: any) => {
      clientStorageMock.set(key, value);
      return Promise.resolve();
    }),
    deleteAsync: jest.fn((key: string) => {
      clientStorageMock.delete(key);
      return Promise.resolve();
    })
  },
  network: {
    fetch: jest.fn()
  },
  getNodeById: jest.fn(),
  currentPage: {
    selection: [],
    findAll: jest.fn()
  }
} as any;
```

**4. Setup файл** - `tests/setup.ts`:
```typescript
import './mocks/figma.mock';

// Глобальные настройки для всех тестов
beforeEach(() => {
  jest.clearAllMocks();
});
```

#### 3.2 Unit тесты - Критические модули

**Приоритет 1: Validation** (`tests/validation.test.ts`)
```typescript
import {
  validatePrompt,
  validateApiKey,
  validateUrl,
  validateGenerationSettings
} from '@/shared/validation';

describe('Validation', () => {
  describe('validatePrompt', () => {
    it('should accept valid prompts', () => {
      const result = validatePrompt('Generate a user name');
      expect(result.valid).toBe(true);
    });

    it('should reject empty prompts', () => {
      const result = validatePrompt('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject prompts over 10000 characters', () => {
      const longPrompt = 'a'.repeat(10001);
      const result = validatePrompt(longPrompt);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateApiKey', () => {
    it('should validate OpenAI keys (sk-...)', () => {
      const result = validateApiKey('sk-proj-abcd1234', 'openai');
      expect(result.valid).toBe(true);
    });

    it('should validate Yandex keys (AQVN...)', () => {
      const result = validateApiKey('AQVN...', 'yandex');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid format', () => {
      const result = validateApiKey('invalid', 'openai');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should accept https URLs', () => {
      expect(validateUrl('https://api.openai.com').valid).toBe(true);
    });

    it('should accept http localhost', () => {
      expect(validateUrl('http://localhost:1234').valid).toBe(true);
    });

    it('should reject non-URLs', () => {
      expect(validateUrl('not-a-url').valid).toBe(false);
    });
  });

  describe('validateGenerationSettings', () => {
    it('should accept valid settings', () => {
      const settings = {
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: 'You are helpful'
      };
      expect(validateGenerationSettings(settings).valid).toBe(true);
    });

    it('should reject temperature out of range', () => {
      const settings = { temperature: 3.0, maxTokens: 1000 };
      expect(validateGenerationSettings(settings).valid).toBe(false);
    });
  });
});
```

**Приоритет 2: Storage Manager** (`tests/storage-manager.test.ts`)
```typescript
import { StorageManager } from '@/sandbox/storage-manager';
import { PluginSettings } from '@/shared/types';

describe('StorageManager', () => {
  let manager: StorageManager;

  beforeEach(() => {
    manager = new StorageManager();
    jest.clearAllMocks();
  });

  describe('loadSettings', () => {
    it('should load settings from clientStorage', async () => {
      const mockSettings: PluginSettings = {
        version: 2,
        providerConfigs: [],
        language: 'en'
      };
      (figma.clientStorage.getAsync as jest.Mock)
        .mockResolvedValue(mockSettings);

      const result = await manager.loadSettings();
      expect(result).toEqual(mockSettings);
    });

    it('should migrate V1 to V2 settings', async () => {
      const v1Settings = {
        activeProvider: 'openai',
        providers: {
          openai: { apiKey: 'sk-...', model: 'gpt-4o' }
        }
      };
      (figma.clientStorage.getAsync as jest.Mock)
        .mockResolvedValue(v1Settings);

      const result = await manager.loadSettings();
      expect(result.version).toBe(2);
      expect(result.providerConfigs).toBeDefined();
    });

    it('should return defaults if storage empty', async () => {
      (figma.clientStorage.getAsync as jest.Mock)
        .mockResolvedValue(null);

      const result = await manager.loadSettings();
      expect(result.version).toBe(2);
      expect(result.language).toBe('en');
    });
  });

  describe('saveSettings', () => {
    it('should save settings to clientStorage', async () => {
      const settings: PluginSettings = {
        version: 2,
        providerConfigs: [],
        language: 'ru'
      };

      await manager.saveSettings(settings);
      expect(figma.clientStorage.setAsync).toHaveBeenCalledWith(
        'plugin-settings',
        expect.objectContaining(settings)
      );
    });
  });
});
```

**Приоритет 3: Settings Migration** (`tests/settings-migration.test.ts`)
```typescript
import { migrateSettings } from '@/shared/settings-migration';

describe('Settings Migration', () => {
  it('should migrate OpenAI V1 to V2', () => {
    const v1 = {
      activeProvider: 'openai',
      providers: {
        openai: {
          apiKey: 'sk-test123',
          model: 'gpt-4o',
          baseUrl: 'https://api.openai.com/v1'
        }
      }
    };

    const v2 = migrateSettings(v1);
    expect(v2.version).toBe(2);
    expect(v2.providerConfigs).toHaveLength(1);
    expect(v2.providerConfigs[0].baseConfigId).toBe('openai-gpt4o');
    expect(v2.providerConfigs[0].apiKey).toBe('sk-test123');
  });

  it('should migrate Yandex V1 to V2', () => {
    const v1 = {
      activeProvider: 'yandex',
      providers: {
        yandex: {
          folderId: 'b1g...',
          apiKey: 'AQVN...',
          model: 'yandexgpt-lite/latest'
        }
      }
    };

    const v2 = migrateSettings(v1);
    expect(v2.providerConfigs[0].baseConfigId).toBe('yandex-gpt5-lite');
    expect(v2.providerConfigs[0].folderId).toBe('b1g...');
  });
});
```

**Приоритет 4: Providers** (`tests/providers/base-provider.test.ts`)
```typescript
import { BaseProvider } from '@/sandbox/providers/BaseProvider';
import { UserProviderConfig, ProviderConfig } from '@/shared/types';

// Создать mock реализацию для тестирования
class MockProvider extends BaseProvider {
  formatApiKey(key: string): string {
    return `Bearer ${key}`;
  }

  buildRequestBody(prompt: string, settings: any): any {
    return { prompt, ...settings };
  }

  parseResponse(data: any): string {
    return data.text;
  }
}

describe('BaseProvider', () => {
  let provider: MockProvider;
  let userConfig: UserProviderConfig;
  let baseConfig: ProviderConfig;

  beforeEach(() => {
    userConfig = {
      id: 'test-1',
      baseConfigId: 'test-provider',
      name: 'Test Provider',
      apiKey: 'test-key',
      enabled: true
    };

    baseConfig = {
      id: 'test-provider',
      name: 'Test',
      model: 'test-model',
      apiUrl: 'https://api.test.com/v1',
      pricing: { input: 1.0, output: 2.0 }
    };

    provider = new MockProvider(userConfig, baseConfig, {});
  });

  describe('getApiUrl', () => {
    it('should return baseConfig URL by default', () => {
      expect(provider['getApiUrl']()).toBe('https://api.test.com/v1');
    });

    it('should use customUrl if provided', () => {
      userConfig.customUrl = 'https://custom.test.com';
      provider = new MockProvider(userConfig, baseConfig, {});
      expect(provider['getApiUrl']()).toBe('https://custom.test.com');
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost with default pricing', () => {
      const cost = provider['calculateCost'](1000, 500);
      expect(cost).toBeCloseTo(0.0025); // (1000*1.0 + 500*2.0) / 1_000_000
    });

    it('should use custom pricing if provided', () => {
      userConfig.customPricing = { input: 5.0, output: 10.0 };
      provider = new MockProvider(userConfig, baseConfig, {});
      const cost = provider['calculateCost'](1000, 500);
      expect(cost).toBeCloseTo(0.01); // (1000*5 + 500*10) / 1M
    });
  });
});
```

#### 3.3 Integration тесты

**API Client** (`tests/api-client.integration.test.ts`)
```typescript
import { ApiClient } from '@/sandbox/api-client';
import { StorageManager } from '@/sandbox/storage-manager';

describe('ApiClient Integration', () => {
  let apiClient: ApiClient;
  let storageManager: StorageManager;

  beforeEach(() => {
    storageManager = new StorageManager();
    apiClient = new ApiClient(storageManager);

    // Mock network fetch
    (figma.network.fetch as jest.Mock).mockImplementation(
      (url: string, options: any) => {
        // Симулировать ответ API
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: 'Generated text' } }],
            usage: { prompt_tokens: 10, completion_tokens: 20 }
          })
        });
      }
    );
  });

  it('should generate text with OpenAI provider', async () => {
    const result = await apiClient.generateText(
      'Generate a name',
      { temperature: 0.7, maxTokens: 100 },
      'openai-gpt4o',
      (chunk) => {}
    );

    expect(result.text).toBe('Generated text');
    expect(result.tokensUsed?.input).toBe(10);
    expect(result.tokensUsed?.output).toBe(20);
  });

  it('should handle streaming responses', async () => {
    const chunks: string[] = [];

    (figma.network.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: jest.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n')
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":" world"}}]}\n\n')
            })
            .mockResolvedValueOnce({ done: true })
        })
      }
    });

    await apiClient.generateText(
      'Test',
      { temperature: 0.7 },
      'openai-gpt4o',
      (chunk) => chunks.push(chunk)
    );

    expect(chunks).toEqual(['Hello', ' world']);
  });
});
```

**Batch Processor** (`tests/batch-processor.integration.test.ts`)
```typescript
import { BatchProcessor } from '@/sandbox/batch-processor';
import { BaseProvider } from '@/sandbox/providers/BaseProvider';

describe('BatchProcessor Integration', () => {
  let processor: BatchProcessor;
  let mockProvider: jest.Mocked<BaseProvider>;

  beforeEach(() => {
    processor = new BatchProcessor();
    mockProvider = {
      generateText: jest.fn().mockResolvedValue({
        text: 'Generated',
        tokensUsed: { input: 10, output: 10 },
        cost: 0.001
      })
    } as any;
  });

  it('should process batch sequentially', async () => {
    const nodes = [
      { id: '1:1', type: 'TEXT' },
      { id: '1:2', type: 'TEXT' },
      { id: '1:3', type: 'TEXT' }
    ] as any[];

    const progressUpdates: any[] = [];

    const result = await processor.processBatch(
      nodes,
      mockProvider,
      'Generate',
      {},
      (progress) => progressUpdates.push(progress)
    );

    expect(result.successful).toBe(3);
    expect(result.failed).toBe(0);
    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[progressUpdates.length - 1].current).toBe(3);
  });

  it('should handle errors gracefully', async () => {
    mockProvider.generateText
      .mockResolvedValueOnce({ text: 'OK', tokensUsed: {input:10,output:10}, cost: 0.001 })
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce({ text: 'OK', tokensUsed: {input:10,output:10}, cost: 0.001 });

    const nodes = [
      { id: '1:1', type: 'TEXT' },
      { id: '1:2', type: 'TEXT' },
      { id: '1:3', type: 'TEXT' }
    ] as any[];

    const result = await processor.processBatch(
      nodes,
      mockProvider,
      'Generate',
      {},
      () => {}
    );

    expect(result.successful).toBe(2);
    expect(result.failed).toBe(1);
  });
});
```

#### 3.4 E2E тесты (опционально, если есть Figma sandbox)

**Создать** `tests/e2e/plugin.e2e.test.ts`:
```typescript
// Требует настройки Figma Plugin Test API
describe('Plugin E2E', () => {
  it('should load plugin and show UI', async () => {
    // Проверить загрузку плагина
  });

  it('should generate text for selected layer', async () => {
    // Выбрать текстовый слой
    // Сгенерировать текст
    // Проверить применение
  });
});
```

**Структура тестов:**
```
tests/
├── setup.ts                      # Общая настройка
├── mocks/
│   ├── figma.mock.ts            # Mock Figma API
│   └── providers.mock.ts        # Mock провайдеры
├── unit/
│   ├── validation.test.ts       # 8 функций
│   ├── utils.test.ts            # 5 функций
│   ├── storage-manager.test.ts  # 10 методов
│   ├── settings-migration.test.ts
│   └── providers/
│       ├── base-provider.test.ts
│       ├── openai.test.ts
│       ├── yandex.test.ts
│       └── ... (для каждого)
├── integration/
│   ├── api-client.test.ts
│   ├── batch-processor.test.ts
│   └── rename-handler.test.ts
└── e2e/
    └── plugin.e2e.test.ts
```

**Запуск тестов:**
```bash
npm run test              # Все тесты
npm run test:unit         # Только unit
npm run test:integration  # Только integration
npm run test:coverage     # С покрытием
```

**Цель покрытия:** 80%+ для critical path (validation, storage, providers, api-client)

---

### ФАЗА 4: Экспорт/импорт настроек (1 день)
**Цель:** Возможность шарить провайдеров между плагинами

**Требования:**
1. Автоматическая синхронизация через `figma.clientStorage` (уже работает)
2. Экспорт/импорт JSON файла (для расшаривания между устройствами/плагинами)

**Реализация:**

#### 4.1 UI для экспорта/импорта
**Файл:** `src/ui/panels/SettingsPanel.ts`

**Добавить кнопки:**
```typescript
class SettingsPanel {
  private renderExportImportSection() {
    return `
      <div class="export-import-section">
        <h3 data-i18n="settings.exportImport.title">Export / Import</h3>
        <p data-i18n="settings.exportImport.description">
          Share your provider configurations between devices or plugins
        </p>

        <div class="button-group">
          <button id="export-settings-btn" class="secondary">
            <span data-i18n="settings.exportImport.export">Export Settings</span>
          </button>
          <button id="import-settings-btn" class="secondary">
            <span data-i18n="settings.exportImport.import">Import Settings</span>
          </button>
        </div>

        <div class="export-options">
          <label>
            <input type="checkbox" id="export-include-keys" />
            <span data-i18n="settings.exportImport.includeKeys">
              Include API keys (sensitive!)
            </span>
          </label>
          <label>
            <input type="checkbox" id="export-include-prompts" checked />
            <span data-i18n="settings.exportImport.includePrompts">
              Include saved prompts
            </span>
          </label>
          <label>
            <input type="checkbox" id="export-include-presets" checked />
            <span data-i18n="settings.exportImport.includePresets">
              Include data presets
            </span>
          </label>
        </div>
      </div>
    `;
  }

  private setupExportImportListeners() {
    document.getElementById('export-settings-btn')?.addEventListener('click', () => {
      this.handleExport();
    });

    document.getElementById('import-settings-btn')?.addEventListener('click', () => {
      this.handleImport();
    });
  }

  private async handleExport() {
    const includeKeys = (document.getElementById('export-include-keys') as HTMLInputElement).checked;
    const includePrompts = (document.getElementById('export-include-prompts') as HTMLInputElement).checked;
    const includePresets = (document.getElementById('export-include-presets') as HTMLInputElement).checked;

    sendToSandbox({
      type: 'export-settings',
      id: generateId(),
      options: { includeKeys, includePrompts, includePresets }
    });
  }

  private async handleImport() {
    // Открыть file picker
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        try {
          const settings = JSON.parse(text);
          sendToSandbox({
            type: 'import-settings',
            id: generateId(),
            settings
          });
        } catch (error) {
          showNotification('error', 'Invalid JSON file');
        }
      }
    };
    input.click();
  }

  // Обработчик ответа от sandbox
  handleExportComplete(data: { json: string }) {
    // Создать blob и скачать
    const blob = new Blob([data.json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `utext-settings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

#### 4.2 Backend для экспорта/импорта
**Файл:** `src/sandbox/storage-manager.ts`

```typescript
class StorageManager {
  async exportSettings(options: ExportOptions): Promise<string> {
    const settings = await this.loadSettings();
    const prompts = options.includePrompts ? await this.loadSavedPrompts() : null;
    const presets = options.includePresets ? await this.loadDataPresets() : null;

    const exportData: ExportedData = {
      version: 2,
      exportedAt: Date.now(),
      settings: this.sanitizeSettings(settings, options.includeKeys),
      prompts,
      presets
    };

    return JSON.stringify(exportData, null, 2);
  }

  private sanitizeSettings(settings: PluginSettings, includeKeys: boolean): PluginSettings {
    if (includeKeys) {
      return settings;
    }

    // Удалить API ключи из экспорта
    return {
      ...settings,
      providerConfigs: settings.providerConfigs?.map(config => ({
        ...config,
        apiKey: '',  // Очистить ключ
        folderId: ''  // Очистить folder ID (Yandex)
      }))
    };
  }

  async importSettings(importedData: ExportedData, mergeMode: 'replace' | 'merge' = 'merge'): Promise<void> {
    if (importedData.version !== 2) {
      throw new Error('Unsupported export version');
    }

    const currentSettings = await this.loadSettings();

    if (mergeMode === 'replace') {
      // Полная замена
      await this.saveSettings(importedData.settings);
      if (importedData.prompts) {
        await this.saveSavedPrompts(importedData.prompts);
      }
      if (importedData.presets) {
        await this.saveDataPresets(importedData.presets);
      }
    } else {
      // Merge режим - добавить новые конфиги, не перезаписывая существующие
      const mergedSettings = this.mergeSettings(currentSettings, importedData.settings);
      await this.saveSettings(mergedSettings);

      if (importedData.prompts) {
        const currentPrompts = await this.loadSavedPrompts();
        const mergedPrompts = this.mergePrompts(currentPrompts, importedData.prompts);
        await this.saveSavedPrompts(mergedPrompts);
      }

      if (importedData.presets) {
        const currentPresets = await this.loadDataPresets();
        const mergedPresets = this.mergePresets(currentPresets, importedData.presets);
        await this.saveDataPresets(mergedPresets);
      }
    }
  }

  private mergeSettings(current: PluginSettings, imported: PluginSettings): PluginSettings {
    // Добавить импортированные конфиги, избегая дубликатов
    const existingIds = new Set(current.providerConfigs?.map(c => c.id) || []);
    const newConfigs = imported.providerConfigs?.filter(c => !existingIds.has(c.id)) || [];

    return {
      ...current,
      providerConfigs: [...(current.providerConfigs || []), ...newConfigs]
    };
  }
}

interface ExportOptions {
  includeKeys: boolean;
  includePrompts: boolean;
  includePresets: boolean;
}

interface ExportedData {
  version: number;
  exportedAt: number;
  settings: PluginSettings;
  prompts?: SavedPrompt[];
  presets?: DataPreset[];
}
```

#### 4.3 Обработчики сообщений
**Файл:** `src/sandbox/code.ts`

```typescript
// В handleUIMessage добавить:
case 'export-settings':
  await this.handleExportSettings(message);
  break;
case 'import-settings':
  await this.handleImportSettings(message);
  break;

// Методы:
private async handleExportSettings(message: any): Promise<void> {
  try {
    const json = await this.storageManager.exportSettings(message.options);
    sendToUI({
      type: 'export-complete',
      id: message.id,
      json
    });
  } catch (error: any) {
    sendToUI({
      type: 'notification',
      level: 'error',
      message: `Export failed: ${error.message}`
    });
  }
}

private async handleImportSettings(message: any): Promise<void> {
  try {
    await this.storageManager.importSettings(message.settings, 'merge');

    // Перезагрузить настройки в UI
    const settings = await this.storageManager.loadSettings();
    sendToUI({
      type: 'settings-loaded',
      id: message.id,
      settings
    });

    sendToUI({
      type: 'notification',
      level: 'success',
      message: 'Settings imported successfully'
    });
  } catch (error: any) {
    sendToUI({
      type: 'notification',
      level: 'error',
      message: `Import failed: ${error.message}`
    });
  }
}
```

**i18n ключи:**
```typescript
'settings.exportImport.title': 'Export / Import',
'settings.exportImport.description': 'Share your configurations',
'settings.exportImport.export': 'Export Settings',
'settings.exportImport.import': 'Import Settings',
'settings.exportImport.includeKeys': 'Include API keys (sensitive!)',
'settings.exportImport.includePrompts': 'Include saved prompts',
'settings.exportImport.includePresets': 'Include data presets',
```

**Проверка:**
1. Экспорт настроек без ключей → файл JSON скачан
2. Импорт файла → настройки добавлены
3. Экспорт с ключами → проверить что ключи включены в JSON

---

### ФАЗА 5: Темы, UI улучшения и Onboarding (2-3 дня)
**Цель:** Светлая и темная темы, улучшенный UX, приветственный тур для новых пользователей

#### 5.1 Система тем

**1. Добавить поле темы в настройки** (`src/shared/types.ts`):
```typescript
interface PluginSettings {
  // ... existing
  theme?: 'light' | 'dark' | 'auto';  // auto = system preference
}
```

**2. CSS переменные** (`src/ui/styles.css`):
```css
:root[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-tertiary: #e0e0e0;

  --text-primary: #000000;
  --text-secondary: #666666;
  --text-tertiary: #999999;

  --border-color: #d0d0d0;
  --accent-color: #0066ff;
  --accent-hover: #0052cc;

  --error-color: #d32f2f;
  --success-color: #388e3c;
  --warning-color: #f57c00;

  --shadow: rgba(0, 0, 0, 0.1);
}

:root[data-theme="dark"] {
  --bg-primary: #1e1e1e;
  --bg-secondary: #2d2d2d;
  --bg-tertiary: #3a3a3a;

  --text-primary: #ffffff;
  --text-secondary: #b0b0b0;
  --text-tertiary: #808080;

  --border-color: #444444;
  --accent-color: #4a9eff;
  --accent-hover: #6fb0ff;

  --error-color: #f44336;
  --success-color: #66bb6a;
  --warning-color: #ffa726;

  --shadow: rgba(0, 0, 0, 0.3);
}

/* Применить переменные ко всем элементам */
body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.panel {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
}

button {
  background-color: var(--accent-color);
  color: var(--text-primary);
}

button:hover {
  background-color: var(--accent-hover);
}

/* ... и так далее для всех компонентов */
```

**3. Переключатель темы** (`src/ui/panels/SettingsPanel.ts`):
```typescript
class SettingsPanel {
  private renderThemeSelector() {
    return `
      <div class="theme-selector">
        <h3 data-i18n="settings.theme.title">Theme</h3>
        <div class="radio-group">
          <label>
            <input type="radio" name="theme" value="light" />
            <span data-i18n="settings.theme.light">Light</span>
          </label>
          <label>
            <input type="radio" name="theme" value="dark" />
            <span data-i18n="settings.theme.dark">Dark</span>
          </label>
          <label>
            <input type="radio" name="theme" value="auto" />
            <span data-i18n="settings.theme.auto">Auto (System)</span>
          </label>
        </div>
      </div>
    `;
  }

  private setupThemeListeners() {
    document.querySelectorAll('input[name="theme"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const theme = (e.target as HTMLInputElement).value as 'light' | 'dark' | 'auto';
        this.applyTheme(theme);
        this.saveTheme(theme);
      });
    });
  }

  private applyTheme(theme: 'light' | 'dark' | 'auto') {
    let effectiveTheme = theme;

    if (theme === 'auto') {
      // Определить системную тему
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = prefersDark ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', effectiveTheme);
  }

  private saveTheme(theme: 'light' | 'dark' | 'auto') {
    sendToSandbox({
      type: 'update-theme',
      theme
    });
  }
}
```

**4. Auto theme detection:**
```typescript
// В main.ts при инициализации
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  const settings = getCurrentSettings();
  if (settings.theme === 'auto') {
    const theme = e.matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }
});
```

**i18n:**
```typescript
'settings.theme.title': 'Theme',
'settings.theme.light': 'Light',
'settings.theme.dark': 'Dark',
'settings.theme.auto': 'Auto (System)',
```

#### 5.2 UX улучшения

**1. Иконки провайдеров** - добавить SVG иконки в `SettingsPanel.ts`:
```typescript
const PROVIDER_ICONS = {
  'openai': '<svg>...</svg>',  // OpenAI logo
  'claude': '<svg>...</svg>',  // Anthropic logo
  'yandex': '<svg>...</svg>',  // Yandex logo
  // и т.д.
};

private createProviderCard(config: UserProviderConfig) {
  const icon = PROVIDER_ICONS[config.baseProviderId] || '';
  return `
    <div class="provider-card">
      <div class="provider-icon">${icon}</div>
      <div class="provider-info">
        <h4>${config.name}</h4>
        <p>${config.baseConfigId}</p>
      </div>
      ...
    </div>
  `;
}
```

**2. Skeleton loaders** - показывать при загрузке:
```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-secondary) 25%,
    var(--bg-tertiary) 50%,
    var(--bg-secondary) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**3. Transitions** - плавные анимации:
```css
* {
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.panel {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.tab.active {
  transform: scale(1.05);
}
```

#### 5.3 Onboarding Tutorial (Welcome Screen)

**Требование:** Интерактивный тур для новых пользователей

**Файл:** Создать `src/ui/panels/OnboardingPanel.ts`

**Концепция:**
- Показывать при первом запуске плагина
- 5-шаговый тур с прогресс-индикатором
- Возможность пропустить или пройти заново
- Сохранить состояние в `figma.clientStorage`

**Реализация:**

**1. Структура онбординга** (`OnboardingPanel.ts`):
```typescript
interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  illustration: string;  // SVG или emoji
  action?: {
    label: string;
    handler: () => void;
  };
}

class OnboardingPanel {
  private currentStep: number = 0;
  private steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to UText! 👋',
      description: 'Professional AI-powered text generation and layer management for Figma.',
      illustration: '🎨'
    },
    {
      id: 'providers',
      title: 'Choose Your AI Provider',
      description: 'UText supports 30+ AI models: OpenAI, Claude, Yandex Cloud, Gemini, and more. Start by adding your first provider.',
      illustration: '🤖',
      action: {
        label: 'Add Provider Now',
        handler: () => this.goToSettings()
      }
    },
    {
      id: 'yandex-highlight',
      title: '🇷🇺 Yandex Cloud Integration',
      description: '7 YandexGPT models with built-in proxy support! Perfect for Russian-speaking users. Setup guide available in Help tab.',
      illustration: '⚡'
    },
    {
      id: 'features',
      title: 'Powerful Features',
      description: 'Generate text, rename layers with AI or presets, batch process multiple layers, save prompts, and more!',
      illustration: '✨'
    },
    {
      id: 'ready',
      title: 'You\'re All Set! 🚀',
      description: 'Ready to transform your Figma workflow? Start by selecting a text layer and generating content.',
      illustration: '🎉',
      action: {
        label: 'Get Started',
        handler: () => this.completeOnboarding()
      }
    }
  ];

  render() {
    const step = this.steps[this.currentStep];
    const progress = ((this.currentStep + 1) / this.steps.length) * 100;

    return `
      <div class="onboarding-overlay">
        <div class="onboarding-modal">
          <div class="onboarding-header">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <button id="skip-onboarding" class="skip-btn">Skip Tour</button>
          </div>

          <div class="onboarding-content">
            <div class="illustration">${step.illustration}</div>
            <h2>${step.title}</h2>
            <p>${step.description}</p>

            ${this.renderSpecialContent(step)}
          </div>

          <div class="onboarding-footer">
            <div class="step-indicator">
              ${this.currentStep + 1} / ${this.steps.length}
            </div>
            <div class="navigation">
              ${this.currentStep > 0 ? `
                <button id="prev-step" class="secondary">← Back</button>
              ` : ''}
              ${this.currentStep < this.steps.length - 1 ? `
                <button id="next-step" class="primary">Next →</button>
              ` : ''}
              ${step.action ? `
                <button id="action-btn" class="primary">${step.action.label}</button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderSpecialContent(step: OnboardingStep): string {
    // Для шага "providers" показать превью карточек провайдеров
    if (step.id === 'providers') {
      return `
        <div class="preview-providers">
          <div class="provider-mini-card">🟢 OpenAI</div>
          <div class="provider-mini-card">🔵 Claude</div>
          <div class="provider-mini-card">🟡 Yandex</div>
          <div class="provider-mini-card">🔴 Gemini</div>
        </div>
      `;
    }

    // Для шага "features" показать иконки функций
    if (step.id === 'features') {
      return `
        <div class="features-grid">
          <div class="feature-item">
            <span class="icon">📝</span>
            <span>Text Generation</span>
          </div>
          <div class="feature-item">
            <span class="icon">🏷️</span>
            <span>Layer Renaming</span>
          </div>
          <div class="feature-item">
            <span class="icon">⚡</span>
            <span>Batch Processing</span>
          </div>
          <div class="feature-item">
            <span class="icon">📚</span>
            <span>Saved Prompts</span>
          </div>
        </div>
      `;
    }

    return '';
  }

  setupListeners() {
    document.getElementById('skip-onboarding')?.addEventListener('click', () => {
      this.completeOnboarding();
    });

    document.getElementById('prev-step')?.addEventListener('click', () => {
      this.prevStep();
    });

    document.getElementById('next-step')?.addEventListener('click', () => {
      this.nextStep();
    });

    document.getElementById('action-btn')?.addEventListener('click', () => {
      const step = this.steps[this.currentStep];
      step.action?.handler();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') this.nextStep();
      if (e.key === 'ArrowLeft') this.prevStep();
      if (e.key === 'Escape') this.completeOnboarding();
    });
  }

  private nextStep() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.render();
    }
  }

  private prevStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.render();
    }
  }

  private goToSettings() {
    // Переключить на вкладку Settings
    sendToSandbox({
      type: 'switch-tab',
      tab: 'settings'
    });
    this.completeOnboarding();
  }

  private completeOnboarding() {
    // Сохранить флаг что онбординг пройден
    sendToSandbox({
      type: 'complete-onboarding'
    });

    // Скрыть модалку
    document.querySelector('.onboarding-overlay')?.remove();
  }
}
```

**2. CSS для онбординга** (`styles.css`):
```css
.onboarding-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.onboarding-modal {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 32px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 8px 32px var(--shadow);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.onboarding-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  margin-right: 16px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent-color);
  transition: width 0.3s ease;
}

.skip-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
}

.skip-btn:hover {
  color: var(--text-primary);
}

.onboarding-content {
  text-align: center;
  padding: 24px 0;
}

.illustration {
  font-size: 64px;
  margin-bottom: 16px;
}

.onboarding-content h2 {
  font-size: 24px;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.onboarding-content p {
  font-size: 16px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.preview-providers {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 16px;
}

.provider-mini-card {
  background: var(--bg-secondary);
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  font-size: 14px;
}

.features-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}

.feature-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.feature-item .icon {
  font-size: 32px;
}

.feature-item span:last-child {
  font-size: 14px;
  color: var(--text-secondary);
}

.onboarding-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
}

.step-indicator {
  font-size: 14px;
  color: var(--text-secondary);
}

.navigation {
  display: flex;
  gap: 8px;
}
```

**3. Интеграция в main.ts:**
```typescript
class MainUI {
  private onboardingPanel?: OnboardingPanel;

  async init() {
    // Проверить, пройден ли онбординг
    const hasCompletedOnboarding = await this.checkOnboardingStatus();

    if (!hasCompletedOnboarding) {
      this.showOnboarding();
    } else {
      this.showMainUI();
    }
  }

  private async checkOnboardingStatus(): Promise<boolean> {
    return new Promise((resolve) => {
      sendToSandbox({
        type: 'check-onboarding-status',
        id: generateId()
      });

      // Слушать ответ от sandbox
      window.addEventListener('message', (event) => {
        if (event.data.pluginMessage?.type === 'onboarding-status') {
          resolve(event.data.pluginMessage.completed);
        }
      });
    });
  }

  private showOnboarding() {
    this.onboardingPanel = new OnboardingPanel();
    document.body.appendChild(this.onboardingPanel.render());
    this.onboardingPanel.setupListeners();
  }

  private showMainUI() {
    // Показать обычный UI плагина
    this.renderTabs();
    this.initializePanels();
  }
}
```

**4. Backend обработка** (`code.ts`):
```typescript
// В handleUIMessage добавить:
case 'check-onboarding-status':
  await this.handleCheckOnboardingStatus(message);
  break;
case 'complete-onboarding':
  await this.handleCompleteOnboarding();
  break;

// Методы:
private async handleCheckOnboardingStatus(message: any): Promise<void> {
  const completed = await figma.clientStorage.getAsync('onboarding-completed');
  sendToUI({
    type: 'onboarding-status',
    id: message.id,
    completed: completed === true
  });
}

private async handleCompleteOnboarding(): Promise<void> {
  await figma.clientStorage.setAsync('onboarding-completed', true);
  sendToUI({
    type: 'notification',
    level: 'success',
    message: 'Welcome to UText! 🎉'
  });
}
```

**5. Возможность пройти заново** - добавить в SettingsPanel:
```typescript
private renderOnboardingSection() {
  return `
    <div class="onboarding-section">
      <h3 data-i18n="settings.onboarding.title">Onboarding</h3>
      <p data-i18n="settings.onboarding.description">
        Show the welcome tour again
      </p>
      <button id="restart-onboarding" class="secondary">
        <span data-i18n="settings.onboarding.restart">Restart Tour</span>
      </button>
    </div>
  `;
}

private setupOnboardingListeners() {
  document.getElementById('restart-onboarding')?.addEventListener('click', async () => {
    // Сбросить флаг
    await figma.clientStorage.setAsync('onboarding-completed', false);
    // Перезагрузить плагин
    location.reload();
  });
}
```

**i18n ключи:**
```typescript
'onboarding.welcome.title': 'Welcome to UText! 👋',
'onboarding.welcome.description': 'Professional AI-powered text generation',
'onboarding.providers.title': 'Choose Your AI Provider',
'onboarding.providers.description': '30+ models available',
'onboarding.yandex.title': '🇷🇺 Yandex Cloud Integration',
'onboarding.yandex.description': '7 YandexGPT models with proxy',
'onboarding.features.title': 'Powerful Features',
'onboarding.features.description': 'Generate, rename, batch process',
'onboarding.ready.title': 'You\'re All Set! 🚀',
'onboarding.ready.description': 'Start by selecting a text layer',
'onboarding.skip': 'Skip Tour',
'onboarding.next': 'Next →',
'onboarding.back': '← Back',
'onboarding.getStarted': 'Get Started',
'settings.onboarding.title': 'Onboarding',
'settings.onboarding.description': 'Show the welcome tour again',
'settings.onboarding.restart': 'Restart Tour',
```

**Проверка:**
1. Первый запуск плагина → показывается онбординг
2. Можно пройти все шаги стрелками или кнопками
3. Можно пропустить в любой момент
4. После завершения онбординг больше не показывается
5. В Settings можно запустить заново

**UX детали:**
- Прогресс-бар показывает текущий шаг
- Keyboard navigation (←/→ для навигации, Esc для закрытия)
- Smooth transitions между шагами
- Специальный контент на ключевых шагах (превью провайдеров, фичи)
- Акцент на Yandex Cloud как killer feature

---

### ФАЗА 6: Публикация и документация (1-2 дня)
**Цель:** Подготовить плагин к публикации в Figma Community и GitHub

#### 6.1 Анализ готовности к публикации

**Чеклист:**

**✅ Функциональность:**
- [x] Генерация текста через LLM
- [x] 30+ AI провайдеров
- [x] Streaming вывод
- [x] Batch processing
- [x] Переименование слоев (Style + AI)
- [x] Сохраненные промпты
- [x] Data presets
- [x] Многоязычность (en/ru/ja)
- [x] Настройка прокси
- [x] FAQ и Help
- [x] Экспорт/импорт настроек
- [x] Светлая/темная тема

**✅ Качество кода:**
- [x] TypeScript strict mode
- [x] Модульная архитектура
- [x] Error handling
- [x] 80%+ test coverage
- [ ] Code review
- [ ] Performance optimization

**✅ UX:**
- [x] Интуитивный интерфейс
- [x] Прогресс индикаторы
- [x] Error messages понятные
- [x] Keyboard shortcuts (опционально)
- [x] Responsive UI

**✅ Документация:**
- [ ] README.md обновлен
- [ ] CHANGELOG.md создан
- [ ] Скриншоты для Figma Community
- [ ] Видео демонстрация (опционально)
- [ ] Лицензия (MIT)

**✅ Безопасность:**
- [x] API ключи не логируются
- [x] Secure storage (clientStorage)
- [x] Валидация всех входов
- [x] HTTPS only для API
- [ ] Security audit

#### 6.2 Создать CHANGELOG.md

**Файл:** `CHANGELOG.md`

```markdown
# Changelog

All notable changes to UText will be documented in this file.

## [2.0.0] - 2026-02-XX

### 🎉 Major Release - Complete Rewrite

#### Added
- **30+ AI Providers**: OpenAI (GPT-4o, GPT-4o Mini), Claude (Haiku, Sonnet, Opus), Yandex Cloud (7 models), Gemini, Mistral, Groq, Cohere, LM Studio
- **Provider Groups**: Add multiple models for one provider with shared API key
- **Proxy Configuration**: Global and per-provider proxy settings
- **Mass Layer Renaming**:
  - Style Mode: BEM, camelCase, snakeCase, kebabCase presets
  - AI Mode: Generate names through LLM
  - Default Names Scanner: Highlight and rename layers like "Rectangle 12"
- **Saved Prompts Library**: Save, categorize, and reuse prompts
- **Batch Processing**: Generate text for multiple layers with progress tracking
- **Data Presets**: Local data substitution (names, addresses, colors, etc.)
- **Multi-language Support**: English, Russian, Japanese, Chinese, French
- **Export/Import Settings**: Share configurations between devices and plugins
- **Dark/Light Themes**: Auto-detect system preference
- **Help & FAQ**: In-app guides for API keys and proxy setup
- **Onboarding Tutorial**: Interactive welcome screen with quick tour for new users

#### Changed
- **UI Architecture**: Refactored from 1358-line monolith to modular panels (~220 lines coordinator)
- **Provider System**: V1 → V2 migration with backward compatibility
- **Settings Storage**: Improved migration system (v1 → v2 → v2.1)
- **API Client**: Unified interface for all providers

#### Technical Improvements
- Strategy pattern for providers (BaseProvider + 8 implementations)
- Factory pattern for provider instantiation
- Comprehensive validation system
- 80%+ test coverage (unit + integration)
- TypeScript strict mode throughout
- Retry logic with exponential backoff
- Rate limiting for batch operations

#### Security
- API keys stored securely in figma.clientStorage
- Proxy auth token support
- Input validation for all user data
- HTTPS-only API communications

## [1.0.0] - 2026-01-XX

### Initial Release
- Basic text generation with LM Studio, Yandex, OpenAI
- Simple UI with settings and generation tabs
- Token counting and cost estimation

---

## Migration Guide: V1 → V2

If upgrading from v1.x:
1. Your settings will be automatically migrated on first launch
2. Old provider configurations will be converted to new format
3. API keys will be preserved
4. Backup: Export your V1 settings before updating (Settings → Export)

**Breaking Changes:**
- Provider configuration format changed (automatic migration)
- UI completely redesigned
- Some shortcuts removed

## Known Issues

- Yandex folder ID must be configured manually
- Claude providers require CORS proxy
- Large batch operations may be slow (500ms delay between requests)

## Roadmap

### V2.1
- [ ] Keyboard shortcuts customization
- [ ] History of generations
- [ ] Custom naming presets editor
- [ ] API usage analytics dashboard

### V3.0
- [ ] Local LLM support (GGUF models)
- [ ] Image generation (DALL-E, Midjourney)
- [ ] Plugin API for extensions
- [ ] Team sharing features
```

#### 6.3 Обновить README.md

**Файл:** `README.md`

```markdown
# UText - AI-Powered Text Generation for Figma

> Professional text generation and layer management plugin with 30+ AI providers

![UText Banner](docs/banner.png)

[![Figma](https://img.shields.io/badge/Figma-Community-FF7262?logo=figma)](https://figma.com/@uixray)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](CHANGELOG.md)

## ✨ Features

### 🤖 AI Text Generation
- **30+ AI Models**: GPT-4o, Claude Opus, Yandex GPT, Gemini, Mistral, Groq, and more
- **Real-time Streaming**: See text being generated as it happens
- **Batch Processing**: Generate for multiple layers simultaneously
- **Cost Tracking**: Monitor token usage and API costs

### 🏷️ Smart Layer Renaming
- **Style Presets**: BEM, camelCase, snakeCase, kebabCase
- **AI-Powered**: Generate contextual names based on layer content
- **Default Names Scanner**: Find and rename layers like "Rectangle 12"
- **Bulk Operations**: Rename hundreds of layers in seconds

### 📚 Productivity Tools
- **Saved Prompts**: Build a library of reusable prompts with categories
- **Data Presets**: Local substitution for names, addresses, colors
- **Multi-language**: Full support for EN, RU, JA, ZH, FR
- **Themes**: Light and dark modes with auto-detection

### 🔐 Enterprise-Ready
- **Proxy Support**: Global and per-provider proxy configuration
- **API Key Management**: Secure storage with provider grouping
- **Export/Import**: Share configurations across devices
- **Full Testing**: 80%+ code coverage

## 🚀 Quick Start

### Installation

1. Download from [Figma Community](https://figma.com/@uixray/utext) or install from source:

```bash
# Clone repository
git clone https://github.com/uixray/utext.git
cd utext

# Install dependencies
npm install

# Build plugin
npm run build
```

2. In Figma Desktop: **Plugins → Development → Import plugin from manifest**
3. Select `manifest.json` from the plugin folder

### First Steps

1. **Configure Provider**:
   - Open plugin: Plugins → UText
   - Go to Settings tab
   - Click "Add Provider"
   - Choose provider (e.g., OpenAI)
   - Enter API key
   - Click "Save"

2. **Generate Text**:
   - Select text layer(s)
   - Go to Generate tab
   - Enter prompt: "Generate a creative user name"
   - Click "Generate"
   - Click "Apply to Selection"

3. **Rename Layers**:
   - Select layers with default names
   - Go to Rename tab
   - Choose preset or use AI mode
   - Click "Apply"

## 📖 Documentation

### Provider Setup Guides

<details>
<summary><strong>OpenAI (GPT-4o, GPT-4o Mini)</strong></summary>

1. Go to [platform.openai.com](https://platform.openai.com)
2. Navigate to API Keys
3. Create new key
4. Copy key and paste in UText Settings

**Models**: GPT-4o ($2.50/$10 per 1M tokens), GPT-4o Mini ($0.15/$0.60)
</details>

<details>
<summary><strong>Yandex Cloud (YandexGPT)</strong></summary>

1. Create account at [cloud.yandex.ru](https://cloud.yandex.ru)
2. Create Folder and copy Folder ID
3. Create API Key in IAM
4. In UText:
   - Select Yandex provider
   - Enter Folder ID
   - Enter API Key
   - Choose model

**Models**: 7 models from $0.83 to $10 per 1M tokens
**Note**: Requires proxy (default provided) or direct access
</details>

<details>
<summary><strong>Claude (Anthropic)</strong></summary>

1. Get key from [console.anthropic.com](https://console.anthropic.com)
2. In UText: Add Claude provider
3. Enter API key

**Models**: Haiku ($0.25/$1.25), Sonnet ($3/$15), Opus ($15/$75)
**Note**: May require CORS proxy
</details>

<details>
<summary><strong>LM Studio (Local)</strong></summary>

1. Download [LM Studio](https://lmstudio.ai)
2. Load model (Llama, Mistral, etc.)
3. Start local server
4. In UText:
   - Select LM Studio
   - URL: `http://localhost:1234/v1`
   - No API key needed

**Free and private!**
</details>

### Advanced Features

#### Proxy Configuration
For providers with CORS restrictions or regional limitations:

1. Settings → Proxy Settings
2. Enable Global Proxy or per-provider
3. Enter proxy URL (e.g., `https://your-proxy.com`)
4. Optional: Add auth token

**Create Your Own Proxy** (Cloudflare Workers example):
```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = request.headers.get('X-Proxy-Target');

    return fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });
  }
}
```

Deploy to Cloudflare Workers, add URL to UText.

#### Provider Groups
Reduce API key duplication:

1. Settings → Add Provider
2. Choose provider (e.g., OpenAI)
3. Name your group: "My OpenAI Production"
4. Enter API key once
5. Select multiple models: GPT-4o ✓ GPT-4o Mini ✓
6. Save

Now both models use the same key!

#### Export/Import Settings
Share configurations between devices or team:

1. Settings → Export Settings
2. Choose what to include:
   - ✓ Provider configurations
   - ✓ Saved prompts
   - ✓ Data presets
   - ⚠️ API keys (optional, security risk)
3. Download JSON file
4. On another device: Settings → Import Settings

## 🎨 Use Cases

### 🎯 For Designers
- Generate placeholder text for mockups
- Create realistic user names, bios, addresses
- Rename layers following naming conventions
- Batch update text across multiple frames

### 💼 For Product Teams
- Localize UI text to multiple languages
- Generate A/B test variations
- Create data presets for different user personas
- Maintain consistent layer naming

### 🏢 For Agencies
- Rapidly prototype with realistic content
- Share provider configurations across team
- Maintain brand voice with saved prompts
- Generate multilingual mockups

## 🛠️ Development

```bash
# Development mode (watch)
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Test coverage
npm run test:coverage
```

### Project Structure
```
src/
├── sandbox/          # Plugin logic (Figma API)
│   ├── code.ts      # Main handler
│   ├── providers/   # LLM provider implementations
│   ├── storage-manager.ts
│   └── ...
├── ui/              # UI layer (iframe)
│   ├── main.ts      # UI coordinator
│   ├── panels/      # Modular panels
│   └── styles.css
└── shared/          # Shared types and utilities
    ├── types.ts
    ├── i18n.ts
    └── ...
```

### Architecture
- **Strategy Pattern**: Provider abstraction (BaseProvider → 8 implementations)
- **Factory Pattern**: ProviderFactory for instantiation
- **MVC**: Panels = View, StorageManager = Model, code.ts = Controller
- **Message Passing**: UI ↔ Sandbox via `postMessage`

## 🧪 Testing

- **Unit Tests**: Validation, utils, storage, providers
- **Integration Tests**: API client, batch processor
- **E2E Tests**: Full plugin workflows
- **Coverage**: 80%+ on critical paths

```bash
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:e2e          # End-to-end tests
```

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [Figma Plugin API](https://www.figma.com/plugin-docs/)
- Powered by OpenAI, Anthropic, Yandex, Google, and others
- Created with ❤️ by UIXRay

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/uixray/utext/issues)
- **Discussions**: [GitHub Discussions](https://github.com/uixray/utext/discussions)
- **Twitter**: [@uixray](https://twitter.com/uixray)

---

**⭐ Star this repo if you find it useful!**
```

#### 6.4 Подготовить материалы для Figma Community

**Создать папку** `docs/figma-community/`:

**1. Скриншоты** (8-10 изображений):
- `hero.png` - Главный скриншот с UI плагина
- `providers.png` - Список провайдеров
- `generation.png` - Генерация текста в действии
- `rename.png` - Переименование слоев
- `batch.png` - Batch processing
- `prompts.png` - Библиотека промптов
- `themes.png` - Светлая и темная темы
- `settings.png` - Настройки

**2. Cover изображение** `cover.png` (1920x960):
```
+------------------------------------------+
|                                          |
|              UText                       |
|     AI-Powered Text Generation           |
|                                          |
|  [Icon] 30+ Providers | Smart Rename     |
|  [Icon] Batch Process | Multi-language   |
|                                          |
+------------------------------------------+
```

**3. Описание для Figma Community:**

```
# UText - Professional AI Text Generation

Transform your Figma workflow with intelligent text generation and layer management.

## What it does

✨ Generate realistic content with 30+ AI models
🇷🇺 **Yandex Cloud Integration**: Full support for 7 YandexGPT models with proxy
🏷️ Smart layer renaming with AI or style presets (BEM, camelCase, etc.)
⚡ Batch processing for multiple layers
📚 Saved prompts library
🌍 Multi-language support (EN, RU, JA, ZH, FR)
🎨 Light & dark themes

## Perfect for

- Designers creating mockups with realistic content
- Teams maintaining consistent layer naming
- Agencies working on multilingual projects
- Anyone tired of "Lorem ipsum"

## Key Features

• 30+ AI Providers: OpenAI, Claude, Gemini, Mistral, Groq, Cohere, LM Studio
• 🇷🇺 **Yandex Cloud Ready**: 7 YandexGPT models with built-in proxy support
• Batch Processing: Generate for hundreds of layers in seconds
• Smart Renaming: AI-powered or preset-based layer naming
• Data Presets: Local substitution for names, addresses, etc.
• Proxy Support: Global or per-provider configuration
• Export/Import: Share settings between devices
• Secure: API keys stored locally, never shared

## Getting Started

1. Install plugin
2. Add AI provider (Settings tab)
3. Enter API key
4. Select text layers
5. Generate!

Detailed guides available in Help tab.

## Open Source

MIT licensed, fully tested, built with TypeScript.
GitHub: github.com/uixray/utext

## Support

Issues, feature requests: github.com/uixray/utext/issues
```

**4. Теги для Figma Community:**
- AI
- Text Generation
- Automation
- Productivity
- Developer Tools
- Layer Management
- GPT
- Claude
- Yandex
- YandexGPT

#### 6.5 Создать видео демонстрацию (опционально)

**Сценарий** (2-3 минуты):

1. **Intro** (10s):
   - Показать логотип UText
   - "Transform your Figma workflow with AI"

2. **Problem** (15s):
   - Показать design с "Lorem ipsum" и "Rectangle 12"
   - "Tired of placeholder text and messy layer names?"

3. **Solution - Text Generation** (30s):
   - Открыть плагин
   - Добавить провайдер (OpenAI)
   - Выбрать текстовые слои
   - Ввести prompt: "Generate creative startup names"
   - Показать streaming генерацию
   - Применить к слоям

4. **Solution - Layer Renaming** (30s):
   - Показать список слоев с default names
   - Открыть Rename tab
   - Выбрать BEM preset
   - Показать preview
   - Применить
   - Показать результат (структурированные имена)

5. **Features Montage** (30s):
   - Batch processing (прогресс бар)
   - Saved prompts library
   - Multi-language switching
   - Dark theme
   - Export/Import settings

6. **Outro** (15s):
   - "30+ AI providers"
   - "Free and open source"
   - "Download now from Figma Community"
   - GitHub logo + link

**Инструменты для записи:**
- Screen recording: OBS Studio
- Editing: DaVinci Resolve (free)
- Music: royalty-free from YouTube Audio Library

#### 6.6 Финальная проверка перед публикацией

**Чеклист:**

**Код:**
- [ ] Все TODO комментарии удалены или реализованы
- [ ] Нет console.log в production коде (только console.error)
- [ ] Все файлы отформатированы (Prettier)
- [ ] TypeScript ошибок нет (`tsc --noEmit`)
- [ ] ESLint warnings исправлены
- [ ] Bundle size оптимизирован (<1MB)

**Функциональность:**
- [ ] Все провайдеры работают (тест с каждым)
- [ ] Batch processing не зависает
- [ ] Rename работает для всех типов слоев
- [ ] Export/Import корректно мигрирует данные
- [ ] Темы переключаются плавно
- [ ] i18n работает для всех языков
- [ ] Proxy настройка применяется

**Безопасность:**
- [ ] API ключи не логируются
- [ ] Нет хардкоженных секретов в коде
- [ ] Validation работает для всех входов
- [ ] Error handling не раскрывает чувствительную информацию

**UX:**
- [ ] Error messages понятные и actionable
- [ ] Loading states показываются
- [ ] Disabled states понятны
- [ ] Все кнопки имеют tooltips
- [ ] Keyboard navigation работает

**Документация:**
- [ ] README актуален
- [ ] CHANGELOG полный
- [ ] Скриншоты высокого качества
- [ ] Все ссылки работают
- [ ] Лицензия указана

**Публикация:**
```bash
# 1. Обновить версию
npm version 2.0.0

# 2. Создать git tag
git tag -a v2.0.0 -m "UText v2.0 - Major Release"

# 3. Push с тегами
git push origin main --tags

# 4. Создать GitHub Release
# На GitHub.com создать release с CHANGELOG и скриншотами

# 5. Опубликовать в Figma Community
# Загрузить через Figma UI
```

---

## Приоритизация фаз

### Критический путь (Must Have для v2.0):
1. **ФАЗА 1** (1-2 дня) - Интеграция и стабилизация
2. **ФАЗА 2.1** (1 день) - Настройка прокси
3. **ФАЗА 2.2** (0.5 дня) - FAQ панель
4. **ФАЗА 3** (3-5 дней) - Тестирование (минимум critical path)
5. **ФАЗА 5.3** (1 день) - Onboarding Tutorial
6. **ФАЗА 6** (1-2 дня) - Документация и публикация

**Итого:** 7.5-11.5 дней

### Важные улучшения (Should Have):
7. **ФАЗА 2.3** (1 день) - Provider Groups
8. **ФАЗА 2.4** (1 день) - Default Names Scanner
9. **ФАЗА 4** (1 день) - Export/Import
10. **ФАЗА 5.1-5.2** (1-2 дня) - Темы и UX

**Итого:** +4-5 дней

### Опциональные (Nice to Have):
10. Видео демонстрация
11. E2E тесты (если есть Figma sandbox)
12. Performance optimization
13. Analytics dashboard

---

## Рекомендуемые названия плагина

Анализ текущего названия "LLM Text Generator":
- ❌ Слишком технически
- ❌ Не уникально (много "LLM" плагинов)
- ❌ Не отражает полный функционал (rename, batch, presets)

### Предложения:

**Вариант 1: UText** (User Text) ⭐ Рекомендуется
- ✅ Короткое, запоминающееся
- ✅ Легко искать
- ✅ "U" = User/You/Useful
- ✅ Хорошо для брендинга

**Вариант 2: TextCraft**
- ✅ Описательное
- ✅ Профессиональное звучание
- ❌ Может быть занято

**Вариант 3: SmartText AI**
- ✅ Понятно что AI-powered
- ✅ "Smart" отражает интеллектуальность
- ❌ Длинновато

**Вариант 4: Textify**
- ✅ Современное звучание
- ✅ Короткое
- ❌ Не уникально (есть другие "...ify")

**Вариант 5: TextFlow**
- ✅ Отражает workflow
- ✅ Легко запомнить
- ❌ Менее уникально

### Финальная рекомендация: **UText**

Tagline: "AI-Powered Text Generation & Layer Management"

---

## Сильные стороны плагина

1. **Широкий выбор провайдеров** (30+) - уникальное преимущество
2. **Комплексное решение** - не только генерация, но и rename, batch, presets
3. **Модульная архитектура** - легко расширяемая
4. **Multi-language** - международная аудитория
5. **Open Source** - прозрачность и community
6. **Professional UX** - темы, streaming, progress bars
7. **Enterprise features** - proxy, export/import, provider groups

## Слабые стороны и улучшения

1. **Обучение** - много функций, нужен onboarding tutorial
   - ✅ Решение: Добавить welcome screen с quick tour (см. ФАЗА 5.3)

2. **API ключи** - барьер входа для новых пользователей
   - Решение: Добавить free tier провайдера (Groq, Gemini free)

3. **Performance** - batch operations могут быть медленными
   - Решение: Оптимизировать delay, добавить parallel processing (с лимитами)

4. **Локализация** - только 5 языков
   - Решение: Community contributions для других языков

5. **Analytics** - нет понимания usage patterns
   - Решение: Опциональная анонимная телеметрия (opt-in)

---

## Ключевые файлы для реализации

### Критические (ФАЗА 1):
- `src/sandbox/code.ts` - добавить обработчики
- `src/sandbox/providers/YandexProvider.ts` - исправить folder ID
- `src/shared/types.ts` - добавить поле folderId
- `src/ui/main.ts` - активировать v2

### Важные (ФАЗЫ 2-4):
- `src/shared/types.ts` - ProxyConfig, ProviderGroup
- `src/ui/panels/SettingsPanel.ts` - proxy UI, provider groups UI
- `src/ui/panels/HelpPanel.ts` - новая панель FAQ
- `src/ui/panels/RenamePanel.ts` - default names scanner
- `src/sandbox/storage-manager.ts` - export/import методы
- `src/sandbox/providers/BaseProvider.ts` - proxy logic

### Тестирование (ФАЗА 3):
- `jest.config.ts` - новый файл
- `tests/setup.ts` - новый файл
- `tests/mocks/figma.mock.ts` - новый файл
- `tests/**/*.test.ts` - 15+ новых файлов

### Документация (ФАЗА 6):
- `README.md` - полное обновление
- `CHANGELOG.md` - новый файл
- `docs/figma-community/` - новая папка со скриншотами
- `manifest.json` - обновить версию, название, описание

---

## Проверка после каждой фазы

### ФАЗА 1:
```bash
npm run build
# Открыть в Figma
# Проверить:
# - UI загружается
# - Settings панель показывает провайдеры
# - Generate работает
# - Rename работает
# - Prompts загружаются
# - Yandex провайдер работает с folder ID
```

### ФАЗА 2:
```bash
# Проверить:
# - Прокси настраивается (глобально и для провайдера)
# - Help панель открывается
# - FAQ аккордеоны работают
# - Provider Group создается
# - Default Names Scanner находит слои
```

### ФАЗА 3:
```bash
npm run test:coverage
# Проверить coverage >= 80% для:
# - validation.ts
# - storage-manager.ts
# - providers/
# - settings-migration.ts
```

### ФАЗЫ 4-5:
```bash
# Проверить:
# - Export скачивает JSON
# - Import загружает настройки
# - Темы переключаются
# - Auto theme detection работает
```

### ФАЗА 6:
```bash
# Проверить:
# - README актуален
# - CHANGELOG полный
# - Все скриншоты готовы
# - manifest.json обновлен
# - GitHub release создан
```

---

## Временная оценка (полный scope)

| Фаза | Описание | Дни |
|------|----------|-----|
| 1 | Критическая интеграция | 1-2 |
| 2.1 | Прокси настройка | 1 |
| 2.2 | FAQ панель | 0.5 |
| 2.3 | Provider Groups | 1 |
| 2.4 | Default Names Scanner | 1 |
| 3 | Тестирование (80% coverage) | 3-5 |
| 4 | Export/Import | 1 |
| 5 | Темы + Onboarding | 2-3 |
| 6 | Публикация | 1-2 |
| **ИТОГО** | | **11.5-17.5 дней** |

**Минимальный viable product (MVP для v2.0):**
- ФАЗА 1 + 2.1 + 2.2 + 3 (critical только) + 6
- **Итого:** 6.5-10.5 дней

---

## Заключение

План покрывает все ваши требования:
- ✅ Настройка прокси (глобальная + per-provider)
- ✅ FAQ с инструкциями (Yandex API keys, создание прокси)
- ✅ Provider Groups (несколько моделей с одним ключом)
- ✅ Полное тестирование (80%+ coverage)
- ✅ Export/Import настроек
- ✅ Светлая/темная тема
- ✅ Анализ готовности к публикации
- ✅ Default Names Scanner с переименованием
- ✅ GitHub репозиторий

Проект находится на финишной прямой и готов к выпуску v2.0 после выполнения критических фаз 1-3!
