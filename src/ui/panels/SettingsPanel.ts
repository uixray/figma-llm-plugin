import { sendToSandbox } from '../../shared/messages';
import { PluginSettings, UserProviderConfig, ProviderGroup, ModelConfig } from '../../shared/types';
import { PROVIDER_CONFIGS, ProviderConfig } from '../../shared/providers';
import { validateApiKey, validateConfigName, validatePricing, validateUrl } from '../../shared/validation';
import { generateUniqueId } from '../../shared/utils';
import {
  getActiveModels,
  getAllModels,
  findGroupById,
  createProviderGroup,
  addModelToGroup,
  removeModelFromGroup,
  modelToUserConfig,
} from '../../shared/provider-groups-utils';
import { applyTheme, watchSystemTheme, type Theme } from '../../shared/theme';

/**
 * UI панель настроек провайдеров
 */
export class SettingsPanel {
  private settings: PluginSettings | null = null;
  private editingConfigId: string | null = null;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Настройка обработчиков событий
   */
  private setupEventListeners(): void {
    // Settings Tabs
    document.querySelectorAll('.settings-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const tabName = (tab as HTMLElement).dataset.tab;
        if (tabName) this.switchSettingsTab(tabName);
      });
    });

    // Кнопка "Add Group" (V2.1)
    document.getElementById('add-group-btn')?.addEventListener('click', () => {
      this.showGroupEditor(null);
    });

    // Кнопка "Add Provider" (Legacy)
    document.getElementById('add-provider-btn')?.addEventListener('click', () => {
      this.showProviderSelector();
    });

    // Кнопка "Save Settings"
    document.getElementById('save-settings-btn')?.addEventListener('click', () => {
      this.saveSettings();
    });

    // Export Settings
    document.getElementById('export-settings-btn')?.addEventListener('click', () => {
      this.exportSettings();
    });

    // Import Settings
    document.getElementById('import-settings-btn')?.addEventListener('click', () => {
      const fileInput = document.getElementById('import-settings-input') as HTMLInputElement;
      fileInput?.click();
    });

    // Import File Selected
    const fileInput = document.getElementById('import-settings-input') as HTMLInputElement;
    fileInput?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) this.importSettings(file);
    });

    // Theme Selection
    const themeSelect = document.getElementById('settings-theme-select') as HTMLSelectElement;
    themeSelect?.addEventListener('change', (e) => {
      const theme = (e.target as HTMLSelectElement).value as Theme;
      this.handleThemeChange(theme);
    });

    // Watch for system theme changes when in auto mode
    watchSystemTheme((systemTheme) => {
      if (this.settings?.ui?.theme === 'auto') {
        applyTheme('auto');
      }
    });
  }

  /**
   * Обработчик изменения темы
   */
  private handleThemeChange(theme: Theme): void {
    if (!this.settings) return;

    // Update settings
    if (!this.settings.ui) {
      this.settings.ui = { showTokenCount: true, showCostEstimate: true };
    }
    this.settings.ui.theme = theme;

    // Apply theme
    applyTheme(theme);

    // Save to storage (auto-save)
    sendToSandbox({
      type: 'save-settings',
      settings: this.settings,
    });
  }

  /**
   * Переключение между табами настроек
   */
  private switchSettingsTab(tabName: string): void {
    // Переключаем активный таб
    document.querySelectorAll('.settings-tab').forEach((tab) => {
      tab.classList.toggle('active', (tab as HTMLElement).dataset.tab === tabName);
    });

    // Переключаем контент
    document.querySelectorAll('.settings-tab-content').forEach((content) => {
      content.classList.toggle('active', content.id === `settings-tab-${tabName}`);
    });
  }

  /**
   * Загрузка настроек
   */
  loadSettings(settings: PluginSettings): void {
    this.settings = settings;
    this.renderGroupsList(); // V2.1: Render provider groups
    this.renderProvidersList(); // Legacy: Render provider configs
    this.renderGenerationSettings();

    // Apply saved theme
    const theme = settings.ui?.theme || 'auto';
    applyTheme(theme);

    // Update theme selector
    const themeSelect = document.getElementById('settings-theme-select') as HTMLSelectElement;
    if (themeSelect) themeSelect.value = theme;
  }

  /**
   * Отрисовка списка Provider Groups (V2.1)
   */
  private renderGroupsList(): void {
    if (!this.settings) return;

    const container = document.getElementById('groups-list');
    if (!container) return;

    container.innerHTML = '';

    // Если групп нет
    if (!this.settings.providerGroups || this.settings.providerGroups.length === 0) {
      container.innerHTML = `
        <div class="groups-empty">
          <p data-i18n="settings.groups.empty">No groups yet. Create your first group!</p>
        </div>
      `;
      return;
    }

    // Создаём карточки групп
    this.settings.providerGroups.forEach((group) => {
      const card = this.createGroupCard(group);
      container.appendChild(card);
    });
  }

  /**
   * Создать карточку Provider Group
   */
  private createGroupCard(group: ProviderGroup): HTMLElement {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.dataset.groupId = group.id;

    if (!group.enabled) {
      card.classList.add('disabled');
    }

    // Иконка провайдера
    const providerIcon = this.getProviderIcon(group.baseProviderId);

    // Количество моделей
    const totalModels = group.modelConfigs.length;
    const enabledModels = group.modelConfigs.filter((m) => m.enabled).length;

    // API key (скрытый)
    const maskedApiKey = group.sharedApiKey
      ? `${group.sharedApiKey.slice(0, 8)}...${group.sharedApiKey.slice(-4)}`
      : 'Not set';

    card.innerHTML = `
      <div class="group-card-header">
        <div class="group-card-icon">${providerIcon}</div>
        <div class="group-card-info">
          <div class="group-card-name">${this.escapeHtml(group.name)}</div>
          <div class="group-card-provider">${this.getProviderLabel(group.baseProviderId)}</div>
        </div>
        <div class="group-card-badge">
          <span class="badge badge-count">${enabledModels}/${totalModels} models</span>
          ${!group.enabled ? '<span class="badge badge-disabled">Disabled</span>' : ''}
        </div>
      </div>

      <div class="group-card-details">
        <div class="group-card-api-key">
          <span class="group-card-api-key-label">API Key:</span>
          <span class="group-card-api-key-value">${maskedApiKey}</span>
        </div>
      </div>

      <div class="group-models">
        <div class="group-models-header" data-action="toggle-models">
          <span class="group-models-title">Models (${totalModels})</span>
          <span class="group-models-toggle">▼</span>
        </div>
        <div class="group-models-list" data-group-id="${group.id}">
          ${group.modelConfigs
            .map(
              (model) => `
            <div class="model-item ${!model.enabled ? 'disabled' : ''}" data-model-id="${model.id}">
              <span class="model-item-name">${this.escapeHtml(model.name)}</span>
              <div class="model-item-actions">
                <button class="model-item-btn" data-action="toggle-model" data-model-id="${model.id}">
                  ${model.enabled ? 'Disable' : 'Enable'}
                </button>
                <button class="model-item-btn" data-action="remove-model" data-model-id="${model.id}">
                  Remove
                </button>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="group-card-actions">
        <button class="btn-secondary btn-small" data-action="toggle-enabled">
          ${group.enabled ? 'Disable' : 'Enable'} Group
        </button>
        <button class="btn-secondary btn-small" data-action="add-model">Add Model</button>
        <button class="btn-secondary btn-small" data-action="edit">Edit</button>
        <button class="btn-secondary btn-small btn-danger" data-action="delete">Delete</button>
      </div>
    `;

    // Обработчик раскрытия моделей
    card.querySelector('[data-action="toggle-models"]')?.addEventListener('click', (e) => {
      const modelsList = card.querySelector('.group-models-list');
      const toggle = (e.currentTarget as HTMLElement).querySelector('.group-models-toggle');
      modelsList?.classList.toggle('expanded');
      if (toggle) toggle.textContent = modelsList?.classList.contains('expanded') ? '▲' : '▼';
    });

    // Обработчик переключения группы
    card.querySelector('[data-action="toggle-enabled"]')?.addEventListener('click', () => {
      this.toggleGroupEnabled(group.id);
    });

    // Обработчик добавления модели
    card.querySelector('[data-action="add-model"]')?.addEventListener('click', () => {
      this.showAddModelDialog(group.id);
    });

    // Обработчик редактирования
    card.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
      this.showGroupEditor(group);
    });

    // Обработчик удаления
    card.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      this.deleteGroup(group.id);
    });

    // Обработчики для моделей
    card.querySelectorAll('[data-action="toggle-model"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modelId = (btn as HTMLElement).dataset.modelId;
        if (modelId) this.toggleModelEnabled(group.id, modelId);
      });
    });

    card.querySelectorAll('[data-action="remove-model"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modelId = (btn as HTMLElement).dataset.modelId;
        if (modelId) this.removeModelFromGroupUI(group.id, modelId);
      });
    });

    return card;
  }

  /**
   * Отрисовка списка провайдеров (Legacy V2.0)
   */
  private renderProvidersList(): void {
    if (!this.settings) return;

    const container = document.getElementById('providers-list');
    if (!container) return;

    // Очищаем
    container.innerHTML = '';

    if (this.settings.providerConfigs.length === 0) {
      container.innerHTML = `
        <div class="providers-empty">
          <p>No providers configured yet.</p>
          <p class="hint">Click "Add Provider" to get started.</p>
        </div>
      `;
      return;
    }

    // Создаём карточки провайдеров
    this.settings.providerConfigs.forEach((config) => {
      const baseConfig = PROVIDER_CONFIGS.find((p) => p.id === config.baseConfigId);
      if (!baseConfig) return;

      const card = this.createProviderCard(config, baseConfig);
      container.appendChild(card);
    });
  }

  /**
   * Создать карточку провайдера
   */
  private createProviderCard(
    userConfig: UserProviderConfig,
    baseConfig: ProviderConfig
  ): HTMLElement {
    const card = document.createElement('div');
    card.className = 'provider-card';
    card.dataset.configId = userConfig.id;

    if (userConfig.id === this.settings?.activeProviderId) {
      card.classList.add('active');
    }

    if (!userConfig.enabled) {
      card.classList.add('disabled');
    }

    // Иконка провайдера (emoji или буква)
    const providerIcon = this.getProviderIcon(baseConfig.provider);

    // Ценообразование
    const pricing = userConfig.customPricing || baseConfig.pricing;
    const pricingText = `$${pricing.input.toFixed(2)}/$${pricing.output.toFixed(2)} per 1M tokens`;

    card.innerHTML = `
      <div class="provider-card-header">
        <div class="provider-card-icon">${providerIcon}</div>
        <div class="provider-card-info">
          <div class="provider-card-name">${this.escapeHtml(userConfig.name)}</div>
          <div class="provider-card-model">${baseConfig.name}</div>
        </div>
        <div class="provider-card-status">
          ${userConfig.id === this.settings?.activeProviderId ? '<span class="badge-active">Active</span>' : ''}
          ${!userConfig.enabled ? '<span class="badge-disabled">Disabled</span>' : ''}
        </div>
      </div>

      <div class="provider-card-details">
        <div class="provider-card-description">${baseConfig.description}</div>
        <div class="provider-card-pricing">${pricingText}</div>
        ${baseConfig.requiresProxy ? '<div class="provider-card-notice">⚠️ Requires CORS proxy</div>' : ''}
      </div>

      <div class="provider-card-actions">
        <button class="btn-secondary btn-small" data-action="set-active" ${userConfig.id === this.settings?.activeProviderId ? 'disabled' : ''}>
          Set Active
        </button>
        <button class="btn-secondary btn-small" data-action="toggle-enabled">
          ${userConfig.enabled ? 'Disable' : 'Enable'}
        </button>
        <button class="btn-secondary btn-small" data-action="edit">Edit</button>
        <button class="btn-secondary btn-small btn-danger" data-action="delete">Delete</button>
      </div>
    `;

    // Обработчики кнопок
    card.querySelector('[data-action="set-active"]')?.addEventListener('click', () => {
      this.setActiveProvider(userConfig.id);
    });

    card.querySelector('[data-action="toggle-enabled"]')?.addEventListener('click', () => {
      this.toggleProviderEnabled(userConfig.id);
    });

    card.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
      this.editProviderConfig(userConfig.id);
    });

    card.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      this.deleteProviderConfig(userConfig.id);
    });

    return card;
  }

  /**
   * Получить иконку провайдера
   */
  private getProviderIcon(provider: string): string {
    const icons: Record<string, string> = {
      openai: '🤖',
      yandex: '🇷🇺',
      claude: '🔮',
      gemini: '♊',
      mistral: '🌬️',
      groq: '⚡',
      cohere: '🧠',
      lmstudio: '💻',
    };

    return icons[provider] || provider.charAt(0).toUpperCase();
  }

  /**
   * Показать селектор провайдеров (показывает только типы провайдеров, не модели)
   */
  private showProviderSelector(): void {
    // Уникальные типы провайдеров с их описаниями
    const providerTypes: { provider: string; label: string; description: string; icon: string }[] = [
      { provider: 'lmstudio', label: 'LM Studio (Local)', description: 'Run models locally. Free, private, offline.', icon: '💻' },
      { provider: 'openai', label: 'OpenAI', description: 'GPT-4o and GPT-4o Mini. Industry standard.', icon: '🤖' },
      { provider: 'claude', label: 'Anthropic Claude', description: 'Claude models. Excellent for creative writing.', icon: '🔮' },
      { provider: 'gemini', label: 'Google Gemini', description: 'Gemini models. Free tier available!', icon: '♊' },
      { provider: 'groq', label: 'Groq', description: 'Ultra-fast inference. 800+ tokens/sec.', icon: '⚡' },
      { provider: 'mistral', label: 'Mistral AI', description: 'European models. EU data residency.', icon: '🌬️' },
      { provider: 'cohere', label: 'Cohere', description: 'Business-focused models. Enterprise content.', icon: '🧠' },
      { provider: 'yandex', label: 'Yandex Cloud', description: 'YandexGPT models. Best for Russian language.', icon: '🇷🇺' },
    ];

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content provider-selector">
        <div class="modal-header">
          <h3>Add Provider</h3>
          <button class="modal-close" data-action="close">×</button>
        </div>
        <div class="modal-body">
          <div class="provider-type-grid">
            ${providerTypes.map(pt => `
              <div class="provider-type-option" data-provider="${pt.provider}">
                <div class="provider-type-icon">${pt.icon}</div>
                <div class="provider-type-info">
                  <div class="provider-type-name">${pt.label}</div>
                  <div class="provider-type-description">${pt.description}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Закрытие модального окна
    modal.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // Выбор типа провайдера → открываем конфигурацию с выбором модели
    modal.querySelectorAll('.provider-type-option').forEach((option) => {
      option.addEventListener('click', () => {
        const providerType = (option as HTMLElement).dataset.provider;
        if (providerType) {
          const modelsForProvider = PROVIDER_CONFIGS.filter(c => c.provider === providerType);
          if (modelsForProvider.length > 0) {
            // Берём первую (дефолтную) модель для начала
            this.createProviderConfig(modelsForProvider[0].id);
          }
          modal.remove();
        }
      });
    });

    document.body.appendChild(modal);
  }

  /**
   * Создать новую конфигурацию провайдера
   */
  private createProviderConfig(baseConfigId: string): void {
    const baseConfig = PROVIDER_CONFIGS.find((p) => p.id === baseConfigId);
    if (!baseConfig) return;

    // Показываем форму редактирования
    this.showConfigEditor(null, baseConfig);
  }

  /**
   * Показать редактор конфигурации (с выбором модели внутри провайдера)
   */
  private showConfigEditor(userConfig: UserProviderConfig | null, baseConfig: ProviderConfig): void {
    const isNew = !userConfig;

    // Все модели этого провайдера
    const modelsForProvider = PROVIDER_CONFIGS.filter(c => c.provider === baseConfig.provider);
    const providerLabel = this.getProviderLabel(baseConfig.provider);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content config-editor">
        <div class="modal-header">
          <h3>${isNew ? 'Add' : 'Edit'} ${providerLabel}</h3>
          <button class="modal-close" data-action="close">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Configuration Name *</label>
            <input type="text" id="config-name" value="${userConfig?.name || providerLabel}" placeholder="e.g., My ${providerLabel} Production">
            <div class="hint">Give this configuration a descriptive name</div>
          </div>

          ${modelsForProvider.length > 1 ? `
          <div class="form-group">
            <label>Model *</label>
            <select id="config-model-select">
              ${modelsForProvider.map(m => `
                <option value="${m.id}" ${m.id === baseConfig.id ? 'selected' : ''}>
                  ${m.name} — $${m.pricing.input.toFixed(2)}/$${m.pricing.output.toFixed(2)} per 1M
                </option>
              `).join('')}
            </select>
            <div class="hint model-description-hint">${baseConfig.description}</div>
          </div>
          ` : ''}

          <div class="form-group">
            <label>API Key ${baseConfig.provider === 'lmstudio' ? '' : '*'}</label>
            <input type="password" id="config-api-key" value="${userConfig?.apiKey || ''}" placeholder="${baseConfig.provider === 'lmstudio' ? 'Not required for LM Studio' : 'Enter your API key'}">
            <div class="hint" id="api-key-hint"></div>
          </div>

          ${
            baseConfig.provider === 'yandex'
              ? `
          <div class="form-group">
            <label>Yandex Cloud Folder ID *</label>
            <input type="text" id="config-folder-id" value="${userConfig?.folderId || ''}" placeholder="e.g., b1g...">
            <div class="hint">Your Yandex Cloud folder ID (from cloud.yandex.ru/console)</div>
          </div>
          `
              : baseConfig.provider === 'lmstudio'
                ? `
          <div class="form-group">
            <label>Local Server URL *</label>
            <input type="text" id="config-custom-url" value="${userConfig?.customUrl || 'http://127.0.0.1:1234'}" placeholder="http://127.0.0.1:1234">
            <div class="hint">Your LM Studio local server address (default: http://127.0.0.1:1234)</div>
          </div>
          <div class="form-group">
            <label>Model Name *</label>
            <input type="text" id="config-model-name" value="${userConfig?.modelName || ''}" placeholder="e.g., llama-3.2-3b-instruct">
            <div class="hint">The model currently loaded in LM Studio (find in LM Studio UI)</div>
          </div>
          `
                : baseConfig.apiUrl.includes('{{')
                  ? `
          <div class="form-group">
            <label>Custom URL (optional)</label>
            <input type="text" id="config-custom-url" value="${userConfig?.customUrl || ''}" placeholder="${baseConfig.apiUrl}">
            <div class="hint">Leave empty to use default: ${baseConfig.apiUrl}</div>
          </div>
          `
                  : ''
          }

          <div class="form-group">
            <label>Custom Pricing (optional)</label>
            <div class="pricing-inputs">
              <div>
                <input type="number" id="config-price-input" value="${userConfig?.customPricing?.input || baseConfig.pricing.input}" step="0.01" min="0">
                <span class="hint">Input $/1M tokens</span>
              </div>
              <div>
                <input type="number" id="config-price-output" value="${userConfig?.customPricing?.output || baseConfig.pricing.output}" step="0.01" min="0">
                <span class="hint">Output $/1M tokens</span>
              </div>
            </div>
            <div class="hint">Override pricing for corporate contracts</div>
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" id="config-enabled" ${userConfig?.enabled !== false ? 'checked' : ''}>
              Enable this configuration
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" data-action="cancel">Cancel</button>
          <button class="btn-primary" data-action="save">Save</button>
        </div>
      </div>
    `;

    // Закрытие
    modal.querySelector('[data-action="close"]')?.addEventListener('click', () => modal.remove());
    modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => modal.remove());

    // Обработчик смены модели в dropdown
    const modelSelect = modal.querySelector('#config-model-select') as HTMLSelectElement;
    if (modelSelect) {
      modelSelect.addEventListener('change', () => {
        const selectedModelId = modelSelect.value;
        const selectedModel = PROVIDER_CONFIGS.find(c => c.id === selectedModelId);
        if (!selectedModel) return;

        // Обновляем описание модели
        const descHint = modal.querySelector('.model-description-hint');
        if (descHint) descHint.textContent = selectedModel.description;

        // Обновляем pricing
        const priceInput = modal.querySelector('#config-price-input') as HTMLInputElement;
        const priceOutput = modal.querySelector('#config-price-output') as HTMLInputElement;
        if (priceInput) priceInput.value = String(selectedModel.pricing.input);
        if (priceOutput) priceOutput.value = String(selectedModel.pricing.output);

        // Для Yandex: обновляем Model URI
        if (selectedModel.provider === 'yandex') {
          const folderIdInput = modal.querySelector('#config-folder-id') as HTMLInputElement;
          const customUrlInput = modal.querySelector('#config-custom-url') as HTMLInputElement;
          const modelUriHint = modal.querySelector('#model-uri-hint');
          if (modelUriHint) modelUriHint.innerHTML = `Model: <strong>${selectedModel.model}</strong> — URI will be generated from Folder ID above`;
          if (folderIdInput?.value.trim() && customUrlInput) {
            customUrlInput.value = `gpt://${folderIdInput.value.trim()}/${selectedModel.model}`;
          }
        }
      });
    }

    // Сохранение — используем актуально выбранную модель
    modal.querySelector('[data-action="save"]')?.addEventListener('click', () => {
      const selectedModelId = modelSelect?.value || baseConfig.id;
      const actualBaseConfig = PROVIDER_CONFIGS.find(c => c.id === selectedModelId) || baseConfig;
      this.saveProviderConfig(modal, userConfig, actualBaseConfig);
    });

    document.body.appendChild(modal);

    // Для Yandex: авто-формирование Model URI из Folder ID
    if (baseConfig.provider === 'yandex') {
      const folderIdInput = modal.querySelector('#config-folder-id') as HTMLInputElement;
      const customUrlInput = modal.querySelector('#config-custom-url') as HTMLInputElement;

      const updateModelUri = () => {
        const folderId = folderIdInput?.value.trim();
        const currentModelId = modelSelect?.value || baseConfig.id;
        const currentModel = PROVIDER_CONFIGS.find(c => c.id === currentModelId) || baseConfig;
        if (folderId && customUrlInput) {
          customUrlInput.value = `gpt://${folderId}/${currentModel.model}`;
        } else if (customUrlInput) {
          customUrlInput.value = '';
        }
      };

      folderIdInput?.addEventListener('input', updateModelUri);

      if (folderIdInput?.value.trim()) {
        updateModelUri();
      }
    }
  }

  /**
   * Получить человекочитаемое название провайдера
   */
  private getProviderLabel(provider: string): string {
    const labels: Record<string, string> = {
      openai: 'OpenAI',
      yandex: 'Yandex Cloud',
      claude: 'Anthropic Claude',
      gemini: 'Google Gemini',
      mistral: 'Mistral AI',
      groq: 'Groq',
      cohere: 'Cohere',
      lmstudio: 'LM Studio',
    };
    return labels[provider] || provider;
  }

  /**
   * Сохранить конфигурацию провайдера
   */
  private saveProviderConfig(
    modal: HTMLElement,
    existingConfig: UserProviderConfig | null,
    baseConfig: ProviderConfig
  ): void {
    const name = (modal.querySelector('#config-name') as HTMLInputElement)?.value.trim();
    const apiKey = (modal.querySelector('#config-api-key') as HTMLInputElement)?.value.trim();
    const customUrl = (modal.querySelector('#config-custom-url') as HTMLInputElement)?.value.trim();
    const priceInput = parseFloat(
      (modal.querySelector('#config-price-input') as HTMLInputElement)?.value
    );
    const priceOutput = parseFloat(
      (modal.querySelector('#config-price-output') as HTMLInputElement)?.value
    );
    const enabled = (modal.querySelector('#config-enabled') as HTMLInputElement)?.checked;

    // Валидация
    const nameValidation = validateConfigName(name);
    if (!nameValidation.valid) {
      this.showError(nameValidation.error!);
      return;
    }

    if (baseConfig.provider !== 'lmstudio') {
      const apiKeyValidation = validateApiKey(apiKey, baseConfig.provider);
      if (!apiKeyValidation.valid) {
        this.showError(apiKeyValidation.error!);
        return;
      }
    }

    // Для Yandex: проверяем Folder ID
    const folderId = baseConfig.provider === 'yandex'
      ? (modal.querySelector('#config-folder-id') as HTMLInputElement)?.value.trim()
      : undefined;

    if (baseConfig.provider === 'yandex' && !folderId) {
      this.showError('Yandex Cloud Folder ID is required');
      return;
    }

    // Для LM Studio: проверяем Custom URL и Model Name
    if (baseConfig.provider === 'lmstudio') {
      const modelName = (modal.querySelector('#config-model-name') as HTMLInputElement)?.value.trim();

      if (!customUrl) {
        this.showError('LM Studio requires Local Server URL');
        return;
      }

      if (!modelName) {
        this.showError('LM Studio requires Model Name');
        return;
      }

      const urlValidation = validateUrl(customUrl);
      if (!urlValidation.valid) {
        this.showError(urlValidation.error!);
        return;
      }
    }

    if (customUrl && baseConfig.provider !== 'yandex' && baseConfig.provider !== 'lmstudio') {
      const urlValidation = validateUrl(customUrl);
      if (!urlValidation.valid) {
        this.showError(urlValidation.error!);
        return;
      }
    }

    const pricingValidation = validatePricing(priceInput, priceOutput);
    if (!pricingValidation.valid) {
      this.showError(pricingValidation.error!);
      return;
    }

    // Создаём/обновляем конфигурацию
    const newConfig: UserProviderConfig = {
      id: existingConfig?.id || generateUniqueId(),
      baseConfigId: baseConfig.id,
      name,
      apiKey: baseConfig.provider === 'lmstudio' ? 'not-required' : apiKey, // Dummy value for LM Studio
      customUrl: customUrl || undefined,
      folderId: folderId || undefined,
      modelName: baseConfig.provider === 'lmstudio'
        ? (modal.querySelector('#config-model-name') as HTMLInputElement)?.value.trim()
        : undefined,
      customPricing:
        priceInput !== baseConfig.pricing.input || priceOutput !== baseConfig.pricing.output
          ? { input: priceInput, output: priceOutput }
          : undefined,
      enabled: enabled !== false,
      createdAt: existingConfig?.createdAt || Date.now(),
      lastUsed: existingConfig?.lastUsed,
    };

    if (!this.settings) return;

    if (existingConfig) {
      // Обновляем существующую
      const index = this.settings.providerConfigs.findIndex((c) => c.id === existingConfig.id);
      if (index >= 0) {
        this.settings.providerConfigs[index] = newConfig;
      }
    } else {
      // Добавляем новую
      this.settings.providerConfigs.push(newConfig);

      // Если это первая конфигурация - делаем активной
      if (this.settings.providerConfigs.length === 1) {
        this.settings.activeProviderId = newConfig.id;
      }
    }

    // Сохраняем настройки в clientStorage
    sendToSandbox({
      type: 'save-settings',
      id: generateUniqueId(),
      settings: this.settings,
    });

    // Уведомляем GeneratePanel об изменении списка провайдеров
    sendToSandbox({
      type: 'settings-updated',
      id: generateUniqueId(),
      settings: this.settings,
    });

    this.renderProvidersList();
    modal.remove();

    this.showSuccess(existingConfig ? 'Configuration updated' : 'Configuration added');
  }

  /**
   * Установить активного провайдера
   */
  private setActiveProvider(configId: string): void {
    if (!this.settings) return;
    this.settings.activeProviderId = configId;
    this.renderProvidersList();
  }

  /**
   * Переключить enabled статус
   */
  private toggleProviderEnabled(configId: string): void {
    if (!this.settings) return;

    const config = this.settings.providerConfigs.find((c) => c.id === configId);
    if (config) {
      config.enabled = !config.enabled;

      // Сохраняем и уведомляем об изменениях
      sendToSandbox({
        type: 'save-settings',
        id: generateUniqueId(),
        settings: this.settings,
      });

      sendToSandbox({
        type: 'settings-updated',
        id: generateUniqueId(),
        settings: this.settings,
      });

      this.renderProvidersList();
    }
  }

  /**
   * Редактировать конфигурацию
   */
  private editProviderConfig(configId: string): void {
    if (!this.settings) return;

    const config = this.settings.providerConfigs.find((c) => c.id === configId);
    if (!config) return;

    const baseConfig = PROVIDER_CONFIGS.find((p) => p.id === config.baseConfigId);
    if (!baseConfig) return;

    this.showConfigEditor(config, baseConfig);
  }

  /**
   * Удалить конфигурацию
   */
  private deleteProviderConfig(configId: string): void {
    if (!this.settings) return;

    const config = this.settings.providerConfigs.find((c) => c.id === configId);
    if (!config) return;

    const confirmed = confirm(`Delete "${config.name}"?`);
    if (!confirmed) return;

    this.settings.providerConfigs = this.settings.providerConfigs.filter(
      (c) => c.id !== configId
    );

    // Если удалили активного - выбираем первого доступного
    if (this.settings.activeProviderId === configId) {
      this.settings.activeProviderId =
        this.settings.providerConfigs.find((c) => c.enabled)?.id || '';
    }

    // Сохраняем и уведомляем об изменениях
    sendToSandbox({
      type: 'save-settings',
      id: generateUniqueId(),
      settings: this.settings,
    });

    sendToSandbox({
      type: 'settings-updated',
      id: generateUniqueId(),
      settings: this.settings,
    });

    this.renderProvidersList();
    this.showSuccess('Configuration deleted');
  }

  /**
   * Отрисовка настроек генерации
   */
  private renderGenerationSettings(): void {
    if (!this.settings) return;

    const tempSlider = document.getElementById('temperature-slider') as HTMLInputElement;
    const tempValue = document.getElementById('temperature-value');
    const maxTokensInput = document.getElementById('max-tokens-input') as HTMLInputElement;

    if (tempSlider && tempValue) {
      tempSlider.value = String(this.settings.generation.temperature);
      tempValue.textContent = String(this.settings.generation.temperature);
    }

    if (maxTokensInput) {
      maxTokensInput.value = String(this.settings.generation.maxTokens);
    }
  }

  /**
   * Сохранить настройки
   */
  private saveSettings(): void {
    if (!this.settings) return;

    sendToSandbox({
      type: 'save-settings',
      id: generateUniqueId(),
      settings: this.settings,
    });

    this.showSuccess('Settings saved successfully');
  }

  // ============================================================================
  // Export/Import Methods
  // ============================================================================

  /**
   * Экспортировать настройки в JSON файл
   */
  private exportSettings(): void {
    if (!this.settings) {
      this.showError('No settings to export');
      return;
    }

    try {
      // Создаем JSON с текущими настройками
      const exportData = {
        version: this.settings.version,
        exportedAt: new Date().toISOString(),
        pluginVersion: '2.0.0', // TODO: получать из manifest.json
        settings: this.settings,
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Создаем временную ссылку для скачивания
      const a = document.createElement('a');
      a.href = url;
      a.download = `figma-llm-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showSuccess('Settings exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      this.showError('Failed to export settings');
    }
  }

  /**
   * Импортировать настройки из JSON файла
   */
  private async importSettings(file: File): Promise<void> {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      // Валидация базовой структуры
      if (!importData.settings || typeof importData.settings !== 'object') {
        throw new Error('Invalid settings file structure');
      }

      // Запрос подтверждения
      if (!confirm('Import settings? This will replace all current settings.')) {
        return;
      }

      const settings = importData.settings as PluginSettings;

      // Валидация версии и миграция если нужно
      if (settings.version !== this.settings?.version) {
        console.log(`Migrating from version ${settings.version} to ${this.settings?.version}`);
        // Миграция произойдет автоматически при загрузке в sandbox
      }

      // Отправляем импортированные настройки в sandbox для сохранения
      sendToSandbox({
        type: 'save-settings',
        settings: settings,
      });

      // Обновляем локальный state
      this.settings = settings;
      this.renderGroupsList();
      this.renderProvidersList();
      this.renderGenerationSettings();

      this.showSuccess('Settings imported successfully');

      // Сброс input для возможности повторного импорта того же файла
      const fileInput = document.getElementById('import-settings-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Import error:', error);
      this.showError('Failed to import settings. Invalid file format.');
    }
  }

  // ============================================================================
  // End Export/Import Methods
  // ============================================================================

  // ============================================================================
  // Provider Groups Methods (V2.1)
  // ============================================================================

  /**
   * Показать редактор группы
   */
  private showGroupEditor(group: ProviderGroup | null): void {
    const modal = document.getElementById('group-editor-modal');
    if (!modal) return;

    // Настройка заголовка
    const title = document.getElementById('group-editor-title');
    if (title) {
      title.setAttribute('data-i18n', group ? 'settings.group.edit' : 'settings.group.create');
      title.textContent = group ? 'Edit Provider Group' : 'Create Provider Group';
    }

    // Заполнение полей
    const nameInput = document.getElementById('group-name-input') as HTMLInputElement;
    const providerSelect = document.getElementById('group-provider-select') as HTMLSelectElement;
    const apiKeyInput = document.getElementById('group-apikey-input') as HTMLInputElement;
    const folderIdInput = document.getElementById('group-folderid-input') as HTMLInputElement;

    if (group) {
      if (nameInput) nameInput.value = group.name;
      if (providerSelect) providerSelect.value = group.baseProviderId;
      if (apiKeyInput) apiKeyInput.value = group.sharedApiKey;
      if (folderIdInput) folderIdInput.value = group.folderId || '';
      this.loadModelsForProvider(group.baseProviderId, group.modelConfigs);
    } else {
      if (nameInput) nameInput.value = '';
      if (providerSelect) providerSelect.value = '';
      if (apiKeyInput) apiKeyInput.value = '';
      if (folderIdInput) folderIdInput.value = '';
      const modelsList = document.getElementById('group-models-list');
      if (modelsList) modelsList.innerHTML = '<p class="hint">Select a provider first</p>';
    }

    // Folder ID только для Yandex
    const folderIdGroup = document.getElementById('group-folderid-group');
    if (folderIdGroup) folderIdGroup.style.display = (providerSelect?.value === 'yandex') ? 'block' : 'none';

    // Обработчик изменения провайдера
    const boundProviderChange = this.handleProviderChange.bind(this);
    providerSelect?.removeEventListener('change', boundProviderChange);
    providerSelect?.addEventListener('change', boundProviderChange);

    // Обработчики кнопок
    const closeBtn = document.getElementById('group-editor-close');
    const cancelBtn = document.getElementById('group-editor-cancel');
    const saveBtn = document.getElementById('group-editor-save');

    const closeModal = () => { modal.style.display = 'none'; };

    closeBtn?.replaceWith(closeBtn.cloneNode(true));
    document.getElementById('group-editor-close')?.addEventListener('click', closeModal);

    cancelBtn?.replaceWith(cancelBtn.cloneNode(true));
    document.getElementById('group-editor-cancel')?.addEventListener('click', closeModal);

    saveBtn?.replaceWith(saveBtn.cloneNode(true));
    document.getElementById('group-editor-save')?.addEventListener('click', () => this.handleSaveGroup(group));

    // Показываем модальное окно
    modal.style.display = 'flex';
  }

  private handleProviderChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const provider = select.value;
    const folderIdGroup = document.getElementById('group-folderid-group');
    if (folderIdGroup) folderIdGroup.style.display = (provider === 'yandex') ? 'block' : 'none';
    if (provider) this.loadModelsForProvider(provider, []);
  }

  private loadModelsForProvider(providerId: string, selectedModels: ModelConfig[]): void {
    const modelsList = document.getElementById('group-models-list');
    if (!modelsList) return;

    const availableModels = PROVIDER_CONFIGS.filter(p => p.provider === providerId);
    if (availableModels.length === 0) {
      modelsList.innerHTML = '<p class="hint">No models available</p>';
      return;
    }

    modelsList.innerHTML = '';
    availableModels.forEach(model => {
      const isSelected = selectedModels.some(m => m.baseConfigId === model.id);
      const item = document.createElement('div');
      item.className = 'model-checkbox-item';
      item.innerHTML = `
        <input type="checkbox" id="model-${model.id}" value="${model.id}" ${isSelected ? 'checked' : ''}>
        <div class="model-checkbox-info">
          <div class="model-checkbox-name">${this.escapeHtml(model.name)}</div>
          <div class="model-checkbox-description">${this.escapeHtml(model.description)}</div>
          <div class="model-checkbox-pricing">$${model.pricing.input}/$${model.pricing.output} per 1M tokens</div>
        </div>
      `;
      item.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName !== 'INPUT') {
          const checkbox = item.querySelector('input') as HTMLInputElement;
          checkbox.checked = !checkbox.checked;
          this.updateModelCount();
        }
      });
      const checkbox = item.querySelector('input') as HTMLInputElement;
      checkbox.addEventListener('change', () => this.updateModelCount());
      modelsList.appendChild(item);
    });
    this.updateModelCount();
  }

  private updateModelCount(): void {
    const checkboxes = document.querySelectorAll('#group-models-list input[type="checkbox"]');
    const checked = Array.from(checkboxes).filter(cb => (cb as HTMLInputElement).checked).length;
    const countLabel = document.getElementById('group-models-count');
    if (countLabel) countLabel.textContent = `Selected: ${checked} model${checked !== 1 ? 's' : ''}`;
  }

  private handleSaveGroup(existingGroup: ProviderGroup | null): void {
    const nameInput = document.getElementById('group-name-input') as HTMLInputElement;
    const providerSelect = document.getElementById('group-provider-select') as HTMLSelectElement;
    const apiKeyInput = document.getElementById('group-apikey-input') as HTMLInputElement;
    const folderIdInput = document.getElementById('group-folderid-input') as HTMLInputElement;

    const name = nameInput?.value.trim();
    const provider = providerSelect?.value;
    const apiKey = apiKeyInput?.value.trim();
    const folderId = folderIdInput?.value.trim();

    if (!name) { this.showError('Please enter a group name'); return; }
    if (!provider) { this.showError('Please select a provider'); return; }
    if (!apiKey && provider !== 'lmstudio') { this.showError('Please enter an API key'); return; }

    const checkboxes = document.querySelectorAll('#group-models-list input[type="checkbox"]:checked');
    const selectedModelIds = Array.from(checkboxes).map(cb => (cb as HTMLInputElement).value);
    if (selectedModelIds.length === 0) { this.showError('Please select at least one model'); return; }

    const modelConfigs: ModelConfig[] = selectedModelIds.map(baseConfigId => ({
      id: generateUniqueId(),
      baseConfigId,
      name: PROVIDER_CONFIGS.find(p => p.id === baseConfigId)?.name || baseConfigId,
      enabled: true,
    }));

    if (existingGroup) {
      existingGroup.name = name;
      existingGroup.sharedApiKey = apiKey;
      existingGroup.folderId = folderId || undefined;
      existingGroup.modelConfigs = modelConfigs;
    } else {
      if (!this.settings) return;
      const newGroup: ProviderGroup = {
        id: generateUniqueId(),
        name,
        baseProviderId: provider,
        sharedApiKey: apiKey,
        folderId: folderId || undefined,
        modelConfigs,
        enabled: true,
        createdAt: Date.now(),
      };
      if (!this.settings.providerGroups) this.settings.providerGroups = [];
      this.settings.providerGroups.push(newGroup);
    }

    const modal = document.getElementById('group-editor-modal');
    if (modal) modal.style.display = 'none';
    this.renderGroupsList();
    this.showSuccess(existingGroup ? 'Group updated' : 'Group created');
  }

  /**
   * Переключить активность группы
   */
  private toggleGroupEnabled(groupId: string): void {
    if (!this.settings?.providerGroups) return;

    const group = this.settings.providerGroups.find((g) => g.id === groupId);
    if (group) {
      group.enabled = !group.enabled;
      this.renderGroupsList();
    }
  }

  /**
   * Удалить группу
   */
  private deleteGroup(groupId: string): void {
    if (!this.settings?.providerGroups) return;

    const group = this.settings.providerGroups.find((g) => g.id === groupId);
    if (!group) return;

    if (confirm(`Delete group "${group.name}"? This will remove all models in this group.`)) {
      this.settings.providerGroups = this.settings.providerGroups.filter((g) => g.id !== groupId);
      this.renderGroupsList();
    }
  }

  /**
   * Показать диалог добавления модели
   */
  private showAddModelDialog(groupId: string): void {
    if (!this.settings?.providerGroups) return;

    const group = this.settings.providerGroups.find((g) => g.id === groupId);
    if (!group) return;

    // Получаем доступные модели для этого провайдера
    const availableModels = PROVIDER_CONFIGS.filter((p) => p.provider === group.baseProviderId);

    // Фильтруем уже добавленные
    const existingConfigIds = group.modelConfigs.map((m) => m.baseConfigId);
    const newModels = availableModels.filter((p) => !existingConfigIds.includes(p.id));

    if (newModels.length === 0) {
      alert('All available models for this provider are already added to the group.');
      return;
    }

    // Простой prompt для выбора (TODO: заменить на modal UI)
    const modelNames = newModels.map((m, i) => `${i + 1}. ${m.name}`).join('\n');
    const choice = prompt(`Select model to add:\n\n${modelNames}\n\nEnter number (1-${newModels.length}):`);

    if (choice) {
      const index = parseInt(choice, 10) - 1;
      if (index >= 0 && index < newModels.length) {
        const selectedModel = newModels[index];
        this.addModelToGroupUI(groupId, selectedModel.id);
      }
    }
  }

  /**
   * Добавить модель в группу
   */
  private addModelToGroupUI(groupId: string, baseConfigId: string): void {
    if (!this.settings?.providerGroups) return;

    const groupIndex = this.settings.providerGroups.findIndex((g) => g.id === groupId);
    if (groupIndex === -1) return;

    try {
      const updatedGroup = addModelToGroup(this.settings.providerGroups[groupIndex], baseConfigId);
      this.settings.providerGroups[groupIndex] = updatedGroup;
      this.renderGroupsList();
      this.showSuccess('Model added to group');
    } catch (error) {
      this.showError((error as Error).message);
    }
  }

  /**
   * Удалить модель из группы
   */
  private removeModelFromGroupUI(groupId: string, modelId: string): void {
    if (!this.settings?.providerGroups) return;

    const groupIndex = this.settings.providerGroups.findIndex((g) => g.id === groupId);
    if (groupIndex === -1) return;

    const group = this.settings.providerGroups[groupIndex];

    if (group.modelConfigs.length === 1) {
      this.showError('Cannot remove the last model from a group. Delete the group instead.');
      return;
    }

    if (confirm('Remove this model from the group?')) {
      try {
        const updatedGroup = removeModelFromGroup(group, modelId);
        this.settings.providerGroups[groupIndex] = updatedGroup;
        this.renderGroupsList();
        this.showSuccess('Model removed from group');
      } catch (error) {
        this.showError((error as Error).message);
      }
    }
  }

  /**
   * Переключить активность модели в группе
   */
  private toggleModelEnabled(groupId: string, modelId: string): void {
    if (!this.settings?.providerGroups) return;

    const group = this.settings.providerGroups.find((g) => g.id === groupId);
    if (!group) return;

    const model = group.modelConfigs.find((m) => m.id === modelId);
    if (model) {
      model.enabled = !model.enabled;
      this.renderGroupsList();
    }
  }

  // ============================================================================
  // End Provider Groups Methods
  // ============================================================================

  /**
   * Показать ошибку
   */
  private showError(message: string): void {
    const event = new CustomEvent('show-notification', {
      detail: { message, level: 'error' },
    });
    window.dispatchEvent(event);
  }

  /**
   * Показать успех
   */
  private showSuccess(message: string): void {
    const event = new CustomEvent('show-notification', {
      detail: { message, level: 'success' },
    });
    window.dispatchEvent(event);
  }

  /**
   * Извлечь folder ID из Model URI (gpt://FOLDER_ID/model/version)
   */
  /**
   * Экранирование HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
