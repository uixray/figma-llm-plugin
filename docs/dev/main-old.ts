import { sendToSandbox } from '../shared/messages';
import type { SandboxToUIMessage, PluginMessage } from '../shared/messages';
import type { PluginSettings, ProviderType, DataPresetSettings, DataPreset, ValueGroup } from '../shared/types';
import { generateUniqueId } from '../shared/utils';

/**
 * Класс для управления UI плагина
 */
class PluginUI {
  private settings: PluginSettings | null = null;
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  private currentGenerationId: string | null = null;
  private currentText = '';
  private currentTokens = 0;
  private dataPresets: DataPresetSettings | null = null;
  private currentEditingPresetId: string | null = null;

  constructor() {
    this.setupMessageListener();
    this.setupEventListeners();
    this.loadSettings();
    this.loadDataPresets();
  }

  /**
   * Настройка слушателя сообщений от Sandbox
   */
  private setupMessageListener(): void {
    window.onmessage = (event) => {
      const message = event.data.pluginMessage as SandboxToUIMessage;
      if (!message) return;

      this.handleSandboxMessage(message);
    };
  }

  /**
   * Обработка сообщений от Sandbox
   */
  private handleSandboxMessage(message: SandboxToUIMessage): void {
    switch (message.type) {
      case 'settings-loaded':
        this.handleSettingsLoaded(message);
        break;
      case 'generation-started':
        this.handleGenerationStarted(message);
        break;
      case 'generation-chunk':
        this.handleGenerationChunk(message);
        break;
      case 'generation-complete':
        this.handleGenerationComplete(message);
        break;
      case 'generation-error':
        this.handleGenerationError(message);
        break;
      case 'notification':
        this.showNotification(message.message, message.level);
        break;
      case 'text-applied':
        if (message.id) {
          const pending = this.pendingRequests.get(message.id);
          if (pending) {
            pending.resolve(message);
            this.pendingRequests.delete(message.id);
          }
        }
        break;
      case 'test-connection-result':
        this.handleTestConnectionResult(message);
        break;
      case 'test-translation-result':
        this.handleTestTranslationResult(message);
        break;
      case 'data-presets-loaded':
        this.handleDataPresetsLoaded(message);
        break;
      case 'substitution-applied':
        this.handleSubstitutionApplied(message);
        break;
    }
  }

  /**
   * Настройка обработчиков событий
   */
  private setupEventListeners(): void {
    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const tabName = target.dataset.tab;
        this.switchTab(tabName!);
      });
    });

    // Generate button
    document.getElementById('generate-btn')?.addEventListener('click', () => this.handleGenerate());

    // Cancel button
    document.getElementById('cancel-btn')?.addEventListener('click', () => this.handleCancel());

    // Apply button
    document.getElementById('apply-btn')?.addEventListener('click', () => this.handleApply());

    // Copy button
    document.getElementById('copy-btn')?.addEventListener('click', () => this.handleCopy());

    // Clear button
    document.getElementById('clear-btn')?.addEventListener('click', () => this.handleClear());

    // Save settings button
    const saveBtn = document.getElementById('save-settings-btn');
    console.log('[UI] Save settings button found:', saveBtn !== null);
    saveBtn?.addEventListener('click', () => {
      console.log('[UI] Save settings button clicked');
      this.handleSaveSettings();
    });

    // Active provider select
    document.getElementById('active-provider-select')?.addEventListener('change', (e) => {
      const select = e.target as HTMLSelectElement;
      this.showProviderSettings(select.value as ProviderType);
    });

    // Temperature slider
    document.getElementById('temperature-slider')?.addEventListener('input', (e) => {
      const slider = e.target as HTMLInputElement;
      const valueSpan = document.getElementById('temperature-value');
      if (valueSpan) valueSpan.textContent = slider.value;
    });

    // Collapsible
    document.querySelectorAll('.collapsible-header').forEach(header => {
      header.addEventListener('click', () => {
        const content = header.nextElementSibling as HTMLElement;
        const isVisible = content.style.display !== 'none';
        content.style.display = isVisible ? 'none' : 'block';
        header.textContent = header.textContent?.replace(isVisible ? '▼' : '▲', isVisible ? '▲' : '▼') || '';
      });
    });

    // Test connection buttons
    document.getElementById('test-lmstudio-btn')?.addEventListener('click', () => this.testConnection('lmstudio'));
    document.getElementById('test-yandex-btn')?.addEventListener('click', () => this.testConnection('yandex'));
    document.getElementById('test-openai-btn')?.addEventListener('click', () => this.testConnection('openai-compatible'));
    document.getElementById('test-translate-btn')?.addEventListener('click', () => this.testTranslation());

    // Data tab events
    document.getElementById('preset-select')?.addEventListener('change', () => this.handlePresetSelect());
    document.getElementById('new-preset-btn')?.addEventListener('click', () => this.handleNewPreset());
    document.getElementById('edit-preset-btn')?.addEventListener('click', () => this.handleEditPreset());
    document.getElementById('add-field-name-btn')?.addEventListener('click', () => this.addFieldNameUI(''));
    document.getElementById('add-group-btn')?.addEventListener('click', () => this.addGroupUI());
    document.getElementById('save-preset-btn')?.addEventListener('click', () => this.handleSavePreset());
    document.getElementById('delete-preset-btn')?.addEventListener('click', () => this.handleDeletePreset());
    document.getElementById('cancel-edit-btn')?.addEventListener('click', () => this.handleCancelEdit());
    document.getElementById('apply-substitution-btn')?.addEventListener('click', () => this.handleApplySubstitution());
    document.getElementById('export-preset-btn')?.addEventListener('click', () => this.handleExportPreset());
    document.getElementById('import-preset-btn')?.addEventListener('click', () => this.handleImportPreset());
    document.getElementById('import-file-input')?.addEventListener('change', (e) => this.handleFileSelected(e));
  }

  /**
   * Переключение табов
   */
  private switchTab(tabName: string): void {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));

    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`${tabName}-panel`)?.classList.add('active');
  }

  /**
   * Загрузка настроек
   */
  private async loadSettings(): Promise<void> {
    const id = generateUniqueId();

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      sendToSandbox({
        type: 'load-settings',
        id,
      });

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Settings load timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Обработка загруженных настроек
   */
  private handleSettingsLoaded(message: any): void {
    this.settings = message.settings;
    this.populateSettingsForm();

    const pending = this.pendingRequests.get(message.id);
    if (pending) {
      pending.resolve(message.settings);
      this.pendingRequests.delete(message.id);
    }
  }

  /**
   * Заполнение формы настроек
   */
  private populateSettingsForm(): void {
    if (!this.settings) return;

    // Active provider
    const activeProviderSelect = document.getElementById('active-provider-select') as HTMLSelectElement;
    if (activeProviderSelect && this.settings.activeProvider) {
      activeProviderSelect.value = this.settings.activeProvider;
      this.showProviderSettings(this.settings.activeProvider);
    }

    // LM Studio
    if (this.settings.providers.lmstudio) {
      const config = this.settings.providers.lmstudio;
      (document.getElementById('lmstudio-url') as HTMLInputElement).value = config.baseUrl || '';
      (document.getElementById('lmstudio-model') as HTMLInputElement).value = config.model || '';
      (document.getElementById('lmstudio-enabled') as HTMLInputElement).checked = config.enabled;
    }

    // Yandex
    if (this.settings.providers.yandex) {
      const config = this.settings.providers.yandex;
      (document.getElementById('yandex-folder') as HTMLInputElement).value = config.folderId || '';
      (document.getElementById('yandex-apikey') as HTMLInputElement).value = config.apiKey || '';
      (document.getElementById('yandex-model') as HTMLInputElement).value = config.model || '';
      (document.getElementById('yandex-enabled') as HTMLInputElement).checked = config.enabled;
    }

    // OpenAI
    if (this.settings.providers.openaiCompatible) {
      const config = this.settings.providers.openaiCompatible;
      (document.getElementById('openai-url') as HTMLInputElement).value = config.baseUrl || '';
      (document.getElementById('openai-apikey') as HTMLInputElement).value = config.apiKey || '';
      (document.getElementById('openai-model') as HTMLInputElement).value = config.model || '';
      (document.getElementById('openai-enabled') as HTMLInputElement).checked = config.enabled;
    }

    // Generation settings
    (document.getElementById('temperature-slider') as HTMLInputElement).value = String(this.settings.generation.temperature);
    (document.getElementById('temperature-value') as HTMLSpanElement).textContent = String(this.settings.generation.temperature);
    (document.getElementById('max-tokens-input') as HTMLInputElement).value = String(this.settings.generation.maxTokens);
  }

  /**
   * Показать настройки провайдера
   */
  private showProviderSettings(provider: string): void {
    document.querySelectorAll('.provider-settings').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });

    if (provider) {
      const settingsEl = document.getElementById(`${provider}-settings`);
      if (settingsEl) settingsEl.style.display = 'block';
    }
  }

  /**
   * Сохранение настроек
   */
  private async handleSaveSettings(): Promise<void> {
    console.log('[UI] handleSaveSettings called');

    if (!this.settings) {
      console.error('[UI] No settings object!');
      return;
    }

    // Collect form data
    const activeProvider = (document.getElementById('active-provider-select') as HTMLSelectElement).value as ProviderType | '';
    console.log('[UI] Active provider:', activeProvider);

    // Сохраняем все настройки провайдеров
    // Читаем все поля из форм независимо от видимости

    // LM Studio
    const lmstudioEnabled = (document.getElementById('lmstudio-enabled') as HTMLInputElement).checked;
    console.log('[UI] LM Studio enabled checkbox:', lmstudioEnabled);

    this.settings.providers.lmstudio = {
      type: 'lmstudio',
      name: 'LM Studio',
      enabled: lmstudioEnabled,
      baseUrl: (document.getElementById('lmstudio-url') as HTMLInputElement).value,
      model: (document.getElementById('lmstudio-model') as HTMLInputElement).value,
      useProxy: false,
    };

    // Yandex
    const yandexEnabled = (document.getElementById('yandex-enabled') as HTMLInputElement).checked;
    console.log('[UI] Yandex enabled checkbox:', yandexEnabled);

    this.settings.providers.yandex = {
      type: 'yandex',
      name: 'Yandex Cloud',
      enabled: yandexEnabled,
      folderId: (document.getElementById('yandex-folder') as HTMLInputElement).value,
      apiKey: (document.getElementById('yandex-apikey') as HTMLInputElement).value,
      model: (document.getElementById('yandex-model') as HTMLInputElement).value,
    };

    // OpenAI
    const openaiEnabled = (document.getElementById('openai-enabled') as HTMLInputElement).checked;
    console.log('[UI] OpenAI enabled checkbox:', openaiEnabled);

    this.settings.providers.openaiCompatible = {
      type: 'openai-compatible',
      name: 'OpenAI Compatible',
      enabled: openaiEnabled,
      baseUrl: (document.getElementById('openai-url') as HTMLInputElement).value,
      apiKey: (document.getElementById('openai-apikey') as HTMLInputElement).value,
      model: (document.getElementById('openai-model') as HTMLInputElement).value,
    };

    this.settings.activeProvider = activeProvider || null;
    this.settings.generation.temperature = parseFloat((document.getElementById('temperature-slider') as HTMLInputElement).value);
    this.settings.generation.maxTokens = parseInt((document.getElementById('max-tokens-input') as HTMLInputElement).value);

    console.log('[UI] Sending settings to sandbox:', JSON.stringify(this.settings, null, 2));

    const id = generateUniqueId();
    sendToSandbox({
      type: 'save-settings',
      id,
      settings: this.settings,
    });
  }

  /**
   * Генерация текста
   */
  private async handleGenerate(): Promise<void> {
    if (!this.settings || !this.settings.activeProvider) {
      this.showNotification('Please select and configure a provider', 'error');
      return;
    }

    const prompt = (document.getElementById('prompt-input') as HTMLTextAreaElement).value;
    if (!prompt.trim()) {
      this.showNotification('Please enter a prompt', 'error');
      return;
    }

    const systemPrompt = (document.getElementById('system-prompt-input') as HTMLTextAreaElement).value;

    this.currentText = '';
    this.currentTokens = 0;
    (document.getElementById('output-text') as HTMLTextAreaElement).value = '';
    (document.getElementById('output-status') as HTMLSpanElement).textContent = 'Generating...';
    (document.getElementById('output-tokens') as HTMLSpanElement).textContent = '0 tokens';

    (document.getElementById('generate-btn') as HTMLButtonElement).style.display = 'none';
    (document.getElementById('cancel-btn') as HTMLButtonElement).style.display = 'block';
    (document.getElementById('apply-btn') as HTMLButtonElement).disabled = true;

    const id = generateUniqueId();
    sendToSandbox({
      type: 'generate-text',
      id,
      provider: this.settings.activeProvider,
      prompt,
      systemPrompt: systemPrompt || undefined,
      settings: this.settings.generation,
    });
  }

  /**
   * Начало генерации
   */
  private handleGenerationStarted(message: any): void {
    this.currentGenerationId = message.generationId;
  }

  /**
   * Обработка chunk генерации
   */
  private handleGenerationChunk(message: any): void {
    this.currentText += message.chunk;
    this.currentTokens = message.tokensGenerated;

    (document.getElementById('output-text') as HTMLTextAreaElement).value = this.currentText;
    (document.getElementById('output-tokens') as HTMLSpanElement).textContent = `${this.currentTokens} tokens`;

    // Auto-scroll
    const textarea = document.getElementById('output-text') as HTMLTextAreaElement;
    textarea.scrollTop = textarea.scrollHeight;
  }

  /**
   * Завершение генерации
   */
  private handleGenerationComplete(message: any): void {
    this.currentText = message.fullText;
    this.currentTokens = message.tokensUsed;

    let statusText = 'Complete';
    if (message.duration) {
      statusText += ` (${(message.duration / 1000).toFixed(1)}s)`;
    }
    if (message.cost && message.cost > 0) {
      statusText += ` • ₽${message.cost.toFixed(4)}`;
    }

    (document.getElementById('output-status') as HTMLSpanElement).textContent = statusText;
    (document.getElementById('output-tokens') as HTMLSpanElement).textContent = `${this.currentTokens} tokens`;

    (document.getElementById('generate-btn') as HTMLButtonElement).style.display = 'block';
    (document.getElementById('cancel-btn') as HTMLButtonElement).style.display = 'none';
    (document.getElementById('apply-btn') as HTMLButtonElement).disabled = false;

    this.currentGenerationId = null;
  }

  /**
   * Ошибка генерации
   */
  private handleGenerationError(message: any): void {
    (document.getElementById('output-status') as HTMLSpanElement).textContent = `Error: ${message.error}`;

    (document.getElementById('generate-btn') as HTMLButtonElement).style.display = 'block';
    (document.getElementById('cancel-btn') as HTMLButtonElement).style.display = 'none';

    this.showNotification(message.error, 'error');
    this.currentGenerationId = null;
  }

  /**
   * Отмена генерации
   */
  private handleCancel(): void {
    if (this.currentGenerationId) {
      sendToSandbox({
        type: 'cancel-generation',
        id: generateUniqueId(),
        generationId: this.currentGenerationId,
      });

      (document.getElementById('generate-btn') as HTMLButtonElement).style.display = 'block';
      (document.getElementById('cancel-btn') as HTMLButtonElement).style.display = 'none';
      (document.getElementById('output-status') as HTMLSpanElement).textContent = 'Cancelled';

      this.currentGenerationId = null;
    }
  }

  /**
   * Применение текста
   */
  private async handleApply(): Promise<void> {
    if (!this.currentText) return;

    // Get selected nodes
    const id = generateUniqueId();
    sendToSandbox({
      type: 'get-selected-text',
      id,
    });

    // Wait for response and then apply
    setTimeout(() => {
      // For now, just send apply request
      sendToSandbox({
        type: 'apply-text',
        id: generateUniqueId(),
        text: this.currentText,
        targetNodeIds: [], // Will be handled by sandbox
      });
    }, 100);
  }

  /**
   * Копирование текста
   */
  private handleCopy(): void {
    navigator.clipboard.writeText(this.currentText);
    this.showNotification('Copied to clipboard', 'success');
  }

  /**
   * Очистка вывода
   */
  private handleClear(): void {
    this.currentText = '';
    this.currentTokens = 0;
    (document.getElementById('output-text') as HTMLTextAreaElement).value = '';
    (document.getElementById('output-status') as HTMLSpanElement).textContent = 'Ready';
    (document.getElementById('output-tokens') as HTMLSpanElement).textContent = '0 tokens';
    (document.getElementById('apply-btn') as HTMLButtonElement).disabled = true;
  }

  /**
   * Тест подключения
   */
  private testConnection(provider: ProviderType): void {
    const id = generateUniqueId();
    sendToSandbox({
      type: 'test-connection',
      id,
      provider,
    });

    this.showNotification('Testing connection...', 'info');
  }

  /**
   * Тестовая функция перевода выделенного текста
   */
  private testTranslation(): void {
    const id = generateUniqueId();
    sendToSandbox({
      type: 'test-translation',
      id,
    });

    this.showNotification('Sending translation request...', 'info');

    // Показываем область результата
    const resultDiv = document.getElementById('translation-result');
    if (resultDiv) {
      resultDiv.style.display = 'block';
      resultDiv.textContent = 'Waiting for response...';
    }
  }

  /**
   * Обработка результата перевода
   */
  private handleTestTranslationResult(message: any): void {
    const resultDiv = document.getElementById('translation-result');
    if (!resultDiv) return;

    if (message.success) {
      resultDiv.textContent = 'Original: ' + message.original + '\n\nTranslated: ' + message.translated;
      resultDiv.style.background = '#e8f5e9';
      this.showNotification('Translation successful!', 'success');
    } else {
      resultDiv.textContent = 'Error: ' + (message.error || 'Translation failed');
      resultDiv.style.background = '#ffebee';
      this.showNotification(message.error || 'Translation failed', 'error');
    }
  }

  /**
   * Результат теста подключения
   */
  private handleTestConnectionResult(message: any): void {
    if (message.success) {
      this.showNotification('Connection successful!', 'success');
    } else {
      this.showNotification(message.error || 'Connection failed', 'error');
    }
  }

  /**
   * Показать уведомление
   */
  private showNotification(message: string, level: 'info' | 'success' | 'error' | 'warning'): void {
    const container = document.getElementById('notifications');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${level}`;
    notification.textContent = message;

    container.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  /**
   * Загрузка пресетов данных
   */
  private async loadDataPresets(): Promise<void> {
    const id = generateUniqueId();
    sendToSandbox({
      type: 'load-data-presets',
      id,
    });
  }

  /**
   * Обработка загруженных пресетов
   */
  private handleDataPresetsLoaded(message: any): void {
    this.dataPresets = message.settings;
    this.renderPresetSelect();
  }

  /**
   * Рендер списка пресетов в select
   */
  private renderPresetSelect(): void {
    if (!this.dataPresets) return;

    const select = document.getElementById('preset-select') as HTMLSelectElement;
    if (!select) return;

    select.innerHTML = '<option value="">-- Select Preset --</option>';

    for (const preset of this.dataPresets.presets) {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.name;
      if (preset.id === this.dataPresets.selectedPresetId) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    // Обновляем кнопку Apply
    const applyBtn = document.getElementById('apply-substitution-btn') as HTMLButtonElement;
    if (applyBtn) {
      applyBtn.disabled = !this.dataPresets.selectedPresetId;
    }
  }

  /**
   * Обработка выбора пресета
   */
  private handlePresetSelect(): void {
    const select = document.getElementById('preset-select') as HTMLSelectElement;
    const selectedId = select.value;

    if (!this.dataPresets) return;

    this.dataPresets.selectedPresetId = selectedId || null;

    // Если выбран пресет, показываем viewer с карточками
    if (selectedId) {
      this.showPresetViewer(selectedId);
      this.hidePresetEditor();
    } else {
      this.hidePresetViewer();
      this.hidePresetEditor();
    }

    // Показываем/скрываем кнопку Edit
    const editBtn = document.getElementById('edit-preset-btn') as HTMLButtonElement;
    if (editBtn) {
      editBtn.style.display = selectedId ? 'inline-block' : 'none';
    }

    // Обновляем кнопку Apply
    const applyBtn = document.getElementById('apply-substitution-btn') as HTMLButtonElement;
    if (applyBtn) {
      applyBtn.disabled = !selectedId;
    }

    // Обновляем кнопку Export
    const exportBtn = document.getElementById('export-preset-btn') as HTMLButtonElement;
    if (exportBtn) {
      exportBtn.disabled = !selectedId;
    }
  }

  /**
   * Создание нового пресета
   */
  private handleNewPreset(): void {
    const select = document.getElementById('preset-select') as HTMLSelectElement;
    select.value = '';
    this.dataPresets!.selectedPresetId = null;
    this.hidePresetViewer();
    this.showPresetEditor();
  }

  /**
   * Редактирование текущего пресета
   */
  private handleEditPreset(): void {
    if (!this.dataPresets || !this.dataPresets.selectedPresetId) return;
    this.hidePresetViewer();
    this.showPresetEditor(this.dataPresets.selectedPresetId);
  }

  /**
   * Показать viewer с карточками групп
   */
  private showPresetViewer(presetId: string): void {
    const viewer = document.getElementById('preset-viewer');
    if (!viewer) return;

    const preset = this.dataPresets!.presets.find(function (p) {
      return p.id === presetId;
    });

    if (!preset) return;

    viewer.style.display = 'block';
    this.renderGroupCards(preset);
  }

  /**
   * Скрыть viewer
   */
  private hidePresetViewer(): void {
    const viewer = document.getElementById('preset-viewer');
    if (viewer) {
      viewer.style.display = 'none';
    }
  }

  /**
   * Рендер карточек групп
   */
  private renderGroupCards(preset: DataPreset): void {
    const container = document.getElementById('groups-cards-container');
    if (!container) return;

    container.innerHTML = '';

    if (preset.groups.length === 0) {
      container.innerHTML = '<p style="color: #999;">No groups yet. Click Edit to add groups.</p>';
      return;
    }

    for (const group of preset.groups) {
      const card = document.createElement('div');
      card.className = 'group-card';

      const cardTitle = document.createElement('div');
      cardTitle.className = 'group-card-title';
      cardTitle.textContent = group.name;

      const cardContent = document.createElement('div');
      cardContent.className = 'group-card-content';

      // Выводим все значения
      for (const key in group.values) {
        const row = document.createElement('div');
        row.className = 'group-card-row';

        const label = document.createElement('span');
        label.className = 'group-card-label';
        label.textContent = key + ':';

        const value = document.createElement('span');
        value.className = 'group-card-value';
        value.textContent = group.values[key];

        row.appendChild(label);
        row.appendChild(value);
        cardContent.appendChild(row);
      }

      card.appendChild(cardTitle);
      card.appendChild(cardContent);
      container.appendChild(card);
    }
  }

  /**
   * Показать редактор пресета
   */
  private showPresetEditor(presetId?: string): void {
    const editor = document.getElementById('preset-editor');
    if (!editor) return;

    editor.style.display = 'block';

    if (presetId) {
      // Заполняем существующий пресет
      const preset = this.dataPresets!.presets.find(function (p) {
        return p.id === presetId;
      });

      if (preset) {
        this.currentEditingPresetId = presetId;
        const nameInput = document.getElementById('preset-name') as HTMLInputElement;
        if (nameInput) nameInput.value = preset.name;

        const separatorInput = document.getElementById('multi-value-separator') as HTMLInputElement;
        if (separatorInput) separatorInput.value = preset.multiValueSeparator || ', ';

        // Рендерим схему полей
        this.renderFieldNames(preset.fieldNames || [], preset.defaultValues);

        // Рендерим группы
        this.renderGroupsWithSchema(preset.groups, preset.fieldNames || []);
      }
    } else {
      // Новый пресет
      this.currentEditingPresetId = null;
      const nameInput = document.getElementById('preset-name') as HTMLInputElement;
      if (nameInput) nameInput.value = '';

      const separatorInput = document.getElementById('multi-value-separator') as HTMLInputElement;
      if (separatorInput) separatorInput.value = ', ';

      this.renderFieldNames(['name']); // Одно поле по умолчанию
      this.renderGroupsWithSchema([], ['name']);
    }

    // Управление видимостью кнопки Delete
    const deleteBtn = document.getElementById('delete-preset-btn');
    if (deleteBtn) {
      // Скрываем кнопку для новых пресетов или встроенных пресетов
      if (!presetId || (presetId && presetId.startsWith('built-in-'))) {
        deleteBtn.style.display = 'none';
      } else {
        deleteBtn.style.display = 'inline-block';
      }
    }
  }

  /**
   * Скрыть редактор пресета
   */
  private hidePresetEditor(): void {
    const editor = document.getElementById('preset-editor');
    if (editor) {
      editor.style.display = 'none';
    }
    this.currentEditingPresetId = null;
  }

  /**
   * Рендер схемы полей
   */
  private renderFieldNames(fieldNames: string[], defaultValues?: Record<string, string>): void {
    const container = document.getElementById('field-names-container');
    if (!container) return;

    container.innerHTML = '';

    if (fieldNames.length === 0) {
      fieldNames = ['name']; // По умолчанию одно поле
    }

    for (const fieldName of fieldNames) {
      const defaultValue = defaultValues?.[fieldName] || '';
      this.addFieldNameUI(fieldName, defaultValue);
    }
  }

  /**
   * Добавить UI для имени поля
   */
  private addFieldNameUI(fieldName: string, defaultValue: string = ''): void {
    const container = document.getElementById('field-names-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'field-name-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'field-name-input';
    nameInput.placeholder = 'Field name (e.g., name)';
    nameInput.value = fieldName;

    // При изменении поля - обновляем все группы
    nameInput.addEventListener('change', () => {
      this.updateGroupsSchema();
    });

    const defaultInput = document.createElement('input');
    defaultInput.type = 'text';
    defaultInput.className = 'field-default-input';
    defaultInput.placeholder = 'Default value (e.g., John)';
    defaultInput.value = defaultValue;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.type = 'button';
    removeBtn.addEventListener('click', () => {
      row.remove();
      this.updateGroupsSchema();
    });

    row.appendChild(nameInput);
    row.appendChild(defaultInput);
    row.appendChild(removeBtn);
    container.appendChild(row);
  }

  /**
   * Обновить схему во всех группах
   */
  private updateGroupsSchema(): void {
    const fieldNames = this.getFieldNamesFromUI();
    const groups = this.getGroupsFromUI();
    this.renderGroupsWithSchema(groups, fieldNames);
  }

  /**
   * Получить имена полей из UI
   */
  private getFieldNamesFromUI(): string[] {
    const inputs = document.querySelectorAll('.field-name-input') as NodeListOf<HTMLInputElement>;
    const names: string[] = [];

    inputs.forEach(function (input) {
      const val = input.value.trim();
      if (val) names.push(val);
    });

    return names;
  }

  /**
   * Получить группы из UI (только имена и ID)
   */
  private getGroupsFromUI(): Array<{ id?: string; name: string; values: Record<string, string> }> {
    const groups: Array<{ id?: string; name: string; values: Record<string, string> }> = [];
    const groupDivs = document.querySelectorAll('.value-group');

    groupDivs.forEach(function (groupDiv) {
      const nameInput = groupDiv.querySelector('.group-name') as HTMLInputElement;
      const groupName = nameInput ? nameInput.value.trim() : '';
      const groupId = groupDiv.getAttribute('data-group-id') || undefined;

      // Собираем значения из полей
      const values: Record<string, string> = {};
      const valueInputs = groupDiv.querySelectorAll('.group-field-input') as NodeListOf<HTMLInputElement>;

      valueInputs.forEach(function (input) {
        const fieldName = input.getAttribute('data-field-name');
        if (fieldName) {
          values[fieldName] = input.value.trim();
        }
      });

      if (groupName) {
        groups.push({ id: groupId, name: groupName, values });
      }
    });

    return groups;
  }

  /**
   * Рендер групп со схемой полей
   */
  private renderGroupsWithSchema(groups: Array<{ id?: string; name: string; values: Record<string, string> }>, fieldNames: string[]): void {
    const container = document.getElementById('preset-values-container');
    if (!container) return;

    container.innerHTML = '';

    if (groups.length === 0) {
      this.addGroupUI();
    } else {
      for (const group of groups) {
        this.addGroupUIWithSchema(group, fieldNames);
      }
    }
  }

  /**
   * Добавить UI группы со схемой
   */
  private addGroupUI(): void {
    const fieldNames = this.getFieldNamesFromUI();
    this.addGroupUIWithSchema({ name: '', values: {} }, fieldNames);
  }

  /**
   * Добавить UI группы со схемой полей
   */
  private addGroupUIWithSchema(group: { id?: string; name: string; values: Record<string, string> }, fieldNames: string[]): void {
    const container = document.getElementById('preset-values-container');
    if (!container) return;

    const groupDiv = document.createElement('div');
    groupDiv.className = 'value-group';
    if (group.id) {
      groupDiv.setAttribute('data-group-id', group.id);
    }

    // Заголовок группы
    const header = document.createElement('div');
    header.className = 'group-header';

    const groupNameInput = document.createElement('input');
    groupNameInput.type = 'text';
    groupNameInput.className = 'group-name';
    groupNameInput.placeholder = 'Group Name (e.g., John Smith)';
    groupNameInput.value = group.name;

    const deleteGroupBtn = document.createElement('button');
    deleteGroupBtn.className = 'btn-secondary';
    deleteGroupBtn.textContent = '✕ Delete';
    deleteGroupBtn.type = 'button';
    deleteGroupBtn.addEventListener('click', function () {
      groupDiv.remove();
    });

    header.appendChild(groupNameInput);
    header.appendChild(deleteGroupBtn);

    // Контейнер значений группы
    const valuesContainer = document.createElement('div');
    valuesContainer.className = 'group-values-container';

    // Создаем поля по схеме
    for (const fieldName of fieldNames) {
      const row = document.createElement('div');
      row.className = 'value-row';

      const label = document.createElement('label');
      label.className = 'field-label';
      label.textContent = fieldName + ':';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'group-field-input';
      input.setAttribute('data-field-name', fieldName);
      input.placeholder = 'Value for ' + fieldName;
      input.value = group.values[fieldName] || '';

      row.appendChild(label);
      row.appendChild(input);
      valuesContainer.appendChild(row);
    }

    groupDiv.appendChild(header);
    groupDiv.appendChild(valuesContainer);

    container.appendChild(groupDiv);
  }

  /**
   * Сохранение пресета
   */
  private async handleSavePreset(): Promise<void> {
    const nameInput = document.getElementById('preset-name') as HTMLInputElement;
    const name = nameInput.value.trim();

    if (!name) {
      this.showNotification('Preset name is required', 'error');
      return;
    }

    // Собираем схему полей
    const fieldNames = this.getFieldNamesFromUI();

    if (fieldNames.length === 0) {
      this.showNotification('Add at least one field name', 'error');
      return;
    }

    // Получаем разделитель
    const separatorInput = document.getElementById('multi-value-separator') as HTMLInputElement;
    const separator = separatorInput ? separatorInput.value : ', ';

    // Собираем дефолтные значения
    const defaultValues: Record<string, string> = {};
    const fieldRows = document.querySelectorAll('.field-name-row');
    fieldRows.forEach(function (row) {
      const nameInput = row.querySelector('.field-name-input') as HTMLInputElement;
      const defaultInput = row.querySelector('.field-default-input') as HTMLInputElement;
      if (nameInput && defaultInput) {
        const fieldName = nameInput.value.trim();
        const defaultValue = defaultInput.value.trim();
        if (fieldName && defaultValue) {
          defaultValues[fieldName] = defaultValue;
        }
      }
    });

    // Собираем группы
    const groups: ValueGroup[] = [];
    const groupDivs = document.querySelectorAll('.value-group');

    for (let i = 0; i < groupDivs.length; i++) {
      const groupDiv = groupDivs[i];
      const groupNameInput = groupDiv.querySelector('.group-name') as HTMLInputElement;
      const groupName = groupNameInput.value.trim();

      if (!groupName) {
        this.showNotification('All groups must have a name', 'error');
        return;
      }

      // Собираем значения для этой группы
      const values: Record<string, string> = {};
      const fieldInputs = groupDiv.querySelectorAll('.group-field-input') as NodeListOf<HTMLInputElement>;

      fieldInputs.forEach(function (input) {
        const fieldName = input.getAttribute('data-field-name');
        if (fieldName) {
          values[fieldName] = input.value.trim();
        }
      });

      groups.push({
        id: groupDiv.getAttribute('data-group-id') || generateUniqueId(),
        name: groupName,
        values: values,
      });
    }

    if (groups.length === 0) {
      this.showNotification('Add at least one group', 'error');
      return;
    }

    if (!this.dataPresets) return;

    if (this.currentEditingPresetId) {
      // Обновление существующего пресета
      const preset = this.dataPresets.presets.find(function (p) {
        return p.id === this.currentEditingPresetId;
      }.bind(this));

      if (preset) {
        preset.name = name;
        preset.version = 1;
        preset.fieldNames = fieldNames;
        preset.defaultValues = defaultValues;
        preset.multiValueSeparator = separator;
        preset.groups = groups;
        preset.updatedAt = Date.now();
      }
    } else {
      // Создание нового пресета
      const newPreset: DataPreset = {
        id: generateUniqueId(),
        name: name,
        version: 1,
        fieldNames: fieldNames,
        defaultValues: defaultValues,
        multiValueSeparator: separator,
        groups: groups,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.dataPresets.presets.push(newPreset);
      this.dataPresets.selectedPresetId = newPreset.id;
    }

    // Сохраняем
    this.dataPresets.lastUpdated = Date.now();
    sendToSandbox({
      type: 'save-data-presets',
      id: generateUniqueId(),
      settings: this.dataPresets,
    });

    // Обновляем UI
    this.renderPresetSelect();
    this.hidePresetEditor();

    // Показываем viewer с сохраненным пресетом
    if (this.dataPresets.selectedPresetId) {
      this.showPresetViewer(this.dataPresets.selectedPresetId);
    }

    this.showNotification('Preset saved', 'success');
  }

  /**
   * Удаление пресета
   */
  private async handleDeletePreset(): Promise<void> {
    if (!this.currentEditingPresetId) return;
    if (!this.dataPresets) return;

    // Проверяем, является ли пресет встроенным
    if (this.currentEditingPresetId.startsWith('built-in-')) {
      this.showNotification('Cannot delete built-in preset', 'error');
      return;
    }

    if (!confirm('Delete this preset?')) return;

    // Удаляем пресет
    this.dataPresets.presets = this.dataPresets.presets.filter(function (p) {
      return p.id !== this.currentEditingPresetId;
    }.bind(this));

    // Сбрасываем выбранный пресет, если он был удалён
    if (this.dataPresets.selectedPresetId === this.currentEditingPresetId) {
      this.dataPresets.selectedPresetId = null;
    }

    this.dataPresets.lastUpdated = Date.now();

    // Сохраняем
    sendToSandbox({
      type: 'save-data-presets',
      id: generateUniqueId(),
      settings: this.dataPresets,
    });

    // Обновляем UI
    this.renderPresetSelect();
    this.hidePresetEditor();
    this.showNotification('Preset deleted', 'success');
  }

  /**
   * Отмена редактирования
   */
  private handleCancelEdit(): void {
    this.hidePresetEditor();

    // Показываем viewer если пресет выбран
    if (this.dataPresets && this.dataPresets.selectedPresetId) {
      this.showPresetViewer(this.dataPresets.selectedPresetId);
    }
  }

  /**
   * Применение подстановки
   */
  private async handleApplySubstitution(): Promise<void> {
    if (!this.dataPresets || !this.dataPresets.selectedPresetId) {
      this.showNotification('Select a preset first', 'error');
      return;
    }

    sendToSandbox({
      type: 'apply-data-substitution',
      id: generateUniqueId(),
      presetId: this.dataPresets.selectedPresetId,
    });
  }

  /**
   * Экспорт текущего пресета в JSON
   */
  private handleExportPreset(): void {
    if (!this.dataPresets || !this.dataPresets.selectedPresetId) return;

    const preset = this.dataPresets.presets.find(function (p) {
      return p.id === this.dataPresets!.selectedPresetId;
    }.bind(this));

    if (!preset) return;

    const json = JSON.stringify(preset, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = preset.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_preset.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showNotification('Preset exported', 'success');
  }

  /**
   * Импорт пресета из JSON
   */
  private handleImportPreset(): void {
    const input = document.getElementById('import-file-input') as HTMLInputElement;
    if (input) {
      input.click();
    }
  }

  /**
   * Обработка выбранного файла
   */
  private handleFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const importedPreset = JSON.parse(json) as DataPreset;

        // Валидация
        if (!importedPreset.name || !importedPreset.groups || !importedPreset.fieldNames) {
          throw new Error('Invalid preset format');
        }

        // Генерируем новый ID для избежания конфликтов
        importedPreset.id = generateUniqueId();
        importedPreset.createdAt = Date.now();
        importedPreset.updatedAt = Date.now();

        // Обновляем ID групп
        importedPreset.groups = importedPreset.groups.map(function (g) {
          return {
            id: generateUniqueId(),
            name: g.name,
            values: g.values,
          };
        });

        // Добавляем в список
        if (this.dataPresets) {
          this.dataPresets.presets.push(importedPreset);
          this.dataPresets.selectedPresetId = importedPreset.id;
          this.dataPresets.lastUpdated = Date.now();

          // Сохраняем
          sendToSandbox({
            type: 'save-data-presets',
            id: generateUniqueId(),
            settings: this.dataPresets,
          });

          // Обновляем UI
          this.renderPresetSelect();
          this.showPresetViewer(importedPreset.id);
          this.showNotification('Preset imported: ' + importedPreset.name, 'success');
        }
      } catch (error) {
        this.showNotification('Failed to import preset: ' + error.message, 'error');
      }

      // Сбрасываем input
      input.value = '';
    };

    reader.readAsText(file);
  }

  /**
   * Обработка результата применения подстановки
   */
  private handleSubstitutionApplied(message: any): void {
    if (message.success) {
      // Новый формат с последовательным применением
      if (message.componentsProcessed !== undefined) {
        const text = 'Applied ' + message.groupsUsed + ' groups to ' + message.componentsProcessed + ' components';
        this.showNotification(text, 'success');
      } else {
        // Старый формат (обратная совместимость)
        this.showNotification('Updated ' + message.nodesProcessed + ' text layers', 'success');
      }
    } else {
      this.showNotification(message.error || 'Failed to apply substitution', 'error');
    }
  }
}

// Инициализация UI
new PluginUI();
