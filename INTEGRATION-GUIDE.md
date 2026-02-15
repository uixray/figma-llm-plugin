# Integration Guide - V2 Features

Это руководство описывает как подключить все новые фичи к основному плагину.

## 📋 Чеклист интеграции

### 1. Sandbox Integration (sandbox.ts / index.ts)

**Импорты:**
```typescript
import { RenameHandler } from './rename-handler';
import { PromptsHandler } from './prompts-handler';
import { BatchProcessor } from './batch-processor';
import { ProviderFactory } from './providers/ProviderFactory';
import { PROVIDER_CONFIGS } from '../shared/providers';
```

**Инициализация handlers:**
```typescript
class SandboxController {
  private renameHandler: RenameHandler;
  private promptsHandler: PromptsHandler;
  private batchProcessor: BatchProcessor;

  constructor() {
    this.renameHandler = new RenameHandler(storageManager);
    this.promptsHandler = new PromptsHandler(storageManager);
    this.batchProcessor = new BatchProcessor();
  }

  async initialize() {
    await this.renameHandler.initialize();
    await this.promptsHandler.initialize();
  }
}
```

**Message handlers:**
```typescript
async handleMessage(message: UIToSandboxMessage) {
  switch (message.type) {
    // Rename messages
    case 'rename-preview':
      await this.renameHandler.handlePreview(message.presetId);
      break;

    case 'rename-apply':
      await this.renameHandler.handleApply(message.preview, message.presetId);
      break;

    case 'load-rename-settings':
      await this.renameHandler.initialize();
      break;

    // Prompts messages
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
  }
}
```

### 2. UI Integration (main.ts)

**Импорты:**
```typescript
import { RenamePanel } from './panels/RenamePanel';
import { PromptsPanel } from './panels/PromptsPanel';
```

**Инициализация панелей:**
```typescript
class PluginUI {
  private renamePanel: RenamePanel;
  private promptsPanel: PromptsPanel;

  constructor() {
    this.renamePanel = new RenamePanel();
    this.promptsPanel = new PromptsPanel();

    this.setupMessageListener();
    this.setupEventListeners();
    this.loadSettings();
    this.loadDataPresets();

    // Загружаем настройки для новых фич
    this.loadRenameSettings();
    this.loadPromptsLibrary();
  }

  private loadRenameSettings() {
    sendToSandbox({ type: 'load-rename-settings' });
  }

  private loadPromptsLibrary() {
    sendToSandbox({ type: 'load-prompts-library' });
  }
}
```

**Message handlers:**
```typescript
private handleSandboxMessage(message: SandboxToUIMessage): void {
  switch (message.type) {
    // Existing handlers...

    // Rename handlers
    case 'rename-settings-loaded':
      this.renamePanel.loadSettings(message.settings);
      break;

    case 'rename-preview-result':
      this.renamePanel.handlePreviewResult(message.preview);
      break;

    case 'rename-apply-result':
      this.renamePanel.handleApplyResult(message.renamedCount);
      break;

    // Prompts handlers
    case 'prompts-library-loaded':
      this.promptsPanel.loadLibrary(message.library);
      break;

    // Batch progress
    case 'batch-progress':
      this.handleBatchProgress(message.progress);
      break;
  }
}
```

**Batch progress UI (добавить в Generate panel):**
```typescript
private handleBatchProgress(progress: BatchProgress): void {
  const progressBar = document.getElementById('batch-progress-bar');
  const progressText = document.getElementById('batch-progress-text');

  if (progressBar && progressText) {
    progressBar.style.width = `${progress.percentage}%`;
    progressText.textContent = `Processing ${progress.current}/${progress.total}: ${progress.currentNodeName}`;
  }
}
```

### 3. HTML Updates (index.html)

**Добавить в Generate panel (для batch progress):**
```html
<div id="batch-progress-container" class="batch-progress" style="display: none;">
  <div class="batch-progress-text" id="batch-progress-text"></div>
  <div class="batch-progress-bar-bg">
    <div class="batch-progress-bar" id="batch-progress-bar"></div>
  </div>
</div>
```

### 4. CSS Updates (styles.css)

**Добавить стили для batch progress:**
```css
.batch-progress {
  margin: 12px 0;
}

.batch-progress-text {
  font-size: 11px;
  color: var(--figma-color-text-secondary);
  margin-bottom: 4px;
}

.batch-progress-bar-bg {
  height: 4px;
  background: var(--figma-color-bg-secondary);
  border-radius: 2px;
  overflow: hidden;
}

.batch-progress-bar {
  height: 100%;
  background: var(--figma-color-bg-brand);
  transition: width 0.3s ease;
  width: 0%;
}
```

### 5. Provider System Integration

**Обновить генерацию текста для использования новой системы провайдеров:**

```typescript
async handleGenerate() {
  const settings = await this.loadSettings();

  // Получаем активную конфигурацию
  const activeConfig = settings.providerConfigs.find(
    c => c.id === settings.activeProviderId
  );

  if (!activeConfig || !activeConfig.enabled) {
    this.showError('No active provider configured');
    return;
  }

  // Получаем базовую конфигурацию провайдера
  const baseConfig = PROVIDER_CONFIGS.find(
    p => p.id === activeConfig.baseConfigId
  );

  if (!baseConfig) {
    this.showError('Provider configuration not found');
    return;
  }

  // Создаём экземпляр провайдера
  const provider = ProviderFactory.createProvider(activeConfig, baseConfig);

  // Генерируем текст
  try {
    const response = await provider.generateText(prompt, settings.generation);

    // Обработка результата...
    this.handleGenerationComplete(response);
  } catch (error) {
    this.handleGenerationError(error);
  }
}
```

### 6. Batch Processing Integration

**В Generate panel добавить checkbox "Batch mode":**

```typescript
async handleGenerate() {
  const batchMode = (document.getElementById('batch-mode-checkbox') as HTMLInputElement)?.checked;

  if (batchMode) {
    // Batch processing
    const textNodes = await this.getSelectedTextNodes();

    if (textNodes.length === 0) {
      this.showError('No text nodes selected');
      return;
    }

    const result = await this.batchProcessor.processBatch(
      textNodes,
      provider,
      prompt,
      settings.generation
    );

    this.showSuccess(`Batch completed: ${result.successful} successful, ${result.failed} failed`);
  } else {
    // Single generation (existing logic)
    // ...
  }
}
```

## 🔧 Testing Checklist

После интеграции протестируйте:

### Rename Feature
- [ ] Выбрать фреймы и применить BEM пресет
- [ ] Проверить preview перед применением
- [ ] Убедиться что компоненты пропущены
- [ ] Убедиться что векторные элементы пропущены
- [ ] Проверить camelCase, snakeCase, kebabCase

### Prompts Library
- [ ] Сохранить новый промпт
- [ ] Использовать сохранённый промпт (должен вставиться в Generate)
- [ ] Поиск по промптам
- [ ] Фильтр по категориям
- [ ] Удалить промпт

### Batch Processing
- [ ] Выбрать несколько TEXT узлов
- [ ] Включить batch mode
- [ ] Проверить progress bar
- [ ] Проверить что все узлы обработаны
- [ ] Проверить счётчик токенов

### Provider System
- [ ] Создать конфигурацию для OpenAI
- [ ] Создать конфигурацию для Yandex
- [ ] Переключиться между конфигурациями
- [ ] Проверить что API ключи валидируются
- [ ] Проверить кастомные цены (если заданы)

## 📝 Migration Notes

**Для пользователей с v1 настройками:**

При первом запуске v2 плагина:
1. Старые настройки будут автоматически мигрированы
2. LM Studio конфиг → UserProviderConfig с baseConfigId='lmstudio-custom'
3. Yandex конфиг → UserProviderConfig с baseConfigId='yandex-gpt5-lite' (или другая модель)
4. OpenAI Compatible → UserProviderConfig с baseConfigId='openai-gpt4o-mini'

**Данные НЕ будут потеряны**, миграция сохраняет:
- API ключи
- Custom URLs
- Настройки генерации
- Data presets

## 🐛 Known Issues & Workarounds

1. **YandexProvider folder ID**: Сейчас захардкоден placeholder 'b1g...'. Нужно добавить поле в UserProviderConfig.

2. **Font loading в batch**: Может быть медленно для больших batch. Рассмотреть pre-loading всех шрифтов.

3. **Rate limits**: Delay 500ms может быть недостаточен для некоторых провайдеров. Сделать настраиваемым.

## ✅ Final Steps

### 1. Replace main.ts with main-v2.ts

```bash
# Backup old main.ts
mv src/ui/main.ts src/ui/main-old.ts

# Use new modular version
mv src/ui/main-v2.ts src/ui/main.ts
```

### 2. Update manifest.json

Ensure all necessary permissions are set. No changes needed for current implementation.

### 3. Build and Test

```bash
npm run build
```

Open Figma, load the plugin, and test:
- ✅ All tabs render correctly
- ✅ Settings panel shows provider cards
- ✅ Rename panel works with preview
- ✅ Prompts panel loads library
- ✅ Generate panel creates text
- ✅ Data panel applies substitutions
- ✅ Language switcher changes UI language

### 4. Update Documentation

1. Update README.md with new features
2. Create CHANGELOG.md for v2.0.0
3. Bump version in manifest.json to 2.0.0

## 🚀 Ready to Ship!

После прохождения всех тестов плагин готов к релизу v2.0.0 с поддержкой:
- 30+ AI провайдеров
- Mass layer renaming
- Batch processing
- Saved prompts library
- Improved architecture
