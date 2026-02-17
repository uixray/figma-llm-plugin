import { sendToSandbox } from '../../shared/messages';
import { PluginSettings, ProviderGroup, ModelConfig } from '../../shared/types';
import { PROVIDER_CONFIGS } from '../../shared/providers';
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

  // ============================================================================
  // Legacy Provider System REMOVED
  // All providers now managed via Provider Groups V2.1
  // ============================================================================

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
   * Сохранить настройки в хранилище Figma (тихо, без уведомления)
   */
  private persistSettings(): void {
    if (!this.settings) return;
    sendToSandbox({
      type: 'save-settings',
      id: generateUniqueId(),
      settings: this.settings,
    });
  }

  /**
   * Сохранить настройки (по нажатию кнопки, с уведомлением)
   */
  private saveSettings(): void {
    if (!this.settings) return;
    this.persistSettings();
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
    const customUrlInput = document.getElementById('group-customurl-input') as HTMLInputElement;

    if (group) {
      if (nameInput) nameInput.value = group.name;
      if (providerSelect) providerSelect.value = group.baseProviderId;
      // API key: show masked version initially, but allow editing (placeholder показывает что ключ задан)
      if (apiKeyInput) {
        apiKeyInput.value = '';
        apiKeyInput.placeholder = `${group.sharedApiKey.slice(0, 4)}...${group.sharedApiKey.slice(-4)} (leave empty to keep current)`;
        // Store original key as data attribute for later use
        apiKeyInput.dataset.originalKey = group.sharedApiKey;
      }
      if (folderIdInput) folderIdInput.value = group.folderId || '';
      if (customUrlInput) customUrlInput.value = group.customUrl || '';
      this.loadModelsForProvider(group.baseProviderId, group.modelConfigs);
    } else {
      if (nameInput) nameInput.value = '';
      if (providerSelect) providerSelect.value = '';
      if (apiKeyInput) {
        apiKeyInput.value = '';
        apiKeyInput.placeholder = 'sk-proj-...';
        delete apiKeyInput.dataset.originalKey;
      }
      if (folderIdInput) folderIdInput.value = '';
      if (customUrlInput) customUrlInput.value = '';
      const modelsList = document.getElementById('group-models-list');
      if (modelsList) modelsList.innerHTML = '<p class="hint">Select a provider first</p>';
    }

    // Folder ID только для Yandex
    const folderIdGroup = document.getElementById('group-folderid-group');
    if (folderIdGroup) folderIdGroup.style.display = (providerSelect?.value === 'yandex') ? 'block' : 'none';

    // Custom URL только для LM Studio
    const customUrlGroup = document.getElementById('group-customurl-group');
    if (customUrlGroup) customUrlGroup.style.display = (providerSelect?.value === 'lmstudio') ? 'block' : 'none';

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
    const customUrlGroup = document.getElementById('group-customurl-group');
    if (folderIdGroup) folderIdGroup.style.display = (provider === 'yandex') ? 'block' : 'none';
    if (customUrlGroup) customUrlGroup.style.display = (provider === 'lmstudio') ? 'block' : 'none';
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
    const customUrlInput = document.getElementById('group-customurl-input') as HTMLInputElement;

    const name = nameInput?.value.trim();
    const provider = providerSelect?.value;
    // If editing and apiKey is empty, use original key
    const apiKeyValue = apiKeyInput?.value.trim();
    const apiKey = apiKeyValue || apiKeyInput?.dataset.originalKey || '';
    const folderId = folderIdInput?.value.trim();
    const customUrl = customUrlInput?.value.trim();

    if (!name) { this.showError('Please enter a group name'); return; }
    if (!provider) { this.showError('Please select a provider'); return; }
    if (!apiKey && provider !== 'lmstudio') { this.showError('Please enter an API key'); return; }
    if (!customUrl && provider === 'lmstudio') { this.showError('LM Studio requires Local Server URL'); return; }

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
      existingGroup.customUrl = customUrl || undefined;
      existingGroup.modelConfigs = modelConfigs;
    } else {
      if (!this.settings) return;
      const newGroup: ProviderGroup = {
        id: generateUniqueId(),
        name,
        baseProviderId: provider,
        sharedApiKey: apiKey,
        folderId: folderId || undefined,
        customUrl: customUrl || undefined,
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
    this.persistSettings();
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
      this.persistSettings();
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
      this.persistSettings();
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
      this.persistSettings();
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
        this.persistSettings();
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
      this.persistSettings();
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
   * Иконка провайдера
   */
  private getProviderIcon(providerId: string): string {
    const icons: Record<string, string> = {
      lmstudio: '🖥️', openai: '🤖', claude: '🧠', gemini: '✨',
      yandex: '🇷🇺', mistral: '🌊', groq: '⚡', cohere: '🔮',
    };
    return icons[providerId] || '🔌';
  }

  /**
   * Человеко-читаемое название провайдера
   */
  private getProviderLabel(providerId: string): string {
    const labels: Record<string, string> = {
      lmstudio: 'LM Studio (Local)', openai: 'OpenAI', claude: 'Claude (Anthropic)',
      gemini: 'Google Gemini', yandex: 'Yandex GPT', mistral: 'Mistral AI',
      groq: 'Groq', cohere: 'Cohere',
    };
    return labels[providerId] || providerId;
  }

  /**
   * Экранирование HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
