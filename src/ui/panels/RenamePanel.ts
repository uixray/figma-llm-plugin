import { sendToSandbox } from '../../shared/messages';
import { RenameSettings, RenamePreview, PluginSettings } from '../../shared/types';
import { generateUniqueId } from '../../shared/utils';
import { PROVIDER_CONFIGS } from '../../shared/providers';
import { getAllProviderConfigs } from '../../shared/provider-converter';

type RenameMode = 'style' | 'ai';

/**
 * UI панель для массового переименования слоёв
 * Поддерживает два режима: Style Mode (пресеты) и AI Mode (через LLM)
 */
export class RenamePanel {
  private renameSettings: RenameSettings | null = null;
  private pluginSettings: PluginSettings | null = null;
  private currentPreview: RenamePreview[] = [];
  private selectedPresetId: string | null = null;
  private currentMode: RenameMode = 'style';

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Load plugin settings (for provider dropdown in AI mode)
   */
  loadPluginSettings(settings: PluginSettings): void {
    this.pluginSettings = settings;
    this.populateProviderDropdown();
  }

  /**
   * Populate AI provider dropdown from plugin settings
   */
  private populateProviderDropdown(): void {
    const select = document.getElementById('ai-rename-provider-select') as HTMLSelectElement;
    if (!select || !this.pluginSettings) return;

    select.innerHTML = '';

    // V2.1: Combine Legacy providers and Provider Groups
    const legacyConfigs = this.pluginSettings.providerConfigs || [];
    const groups = this.pluginSettings.providerGroups || [];
    const allConfigs = getAllProviderConfigs(legacyConfigs, groups);
    const enabledConfigs = allConfigs.filter(c => c.enabled);

    if (enabledConfigs.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No providers configured';
      select.appendChild(opt);
      return;
    }

    enabledConfigs.forEach(config => {
      const baseConfig = PROVIDER_CONFIGS.find(p => p.id === config.baseConfigId);
      const opt = document.createElement('option');
      opt.value = config.id;
      const icon = baseConfig ? this.getProviderIcon(baseConfig.provider) : '🔧';
      opt.textContent = `${icon} ${config.name}`;
      select.appendChild(opt);
    });

    // Select the active provider/model
    const activeId = this.pluginSettings.activeModelId || this.pluginSettings.activeProviderId;
    if (activeId) {
      select.value = activeId;
    }
  }

  /**
   * Get provider emoji icon
   */
  private getProviderIcon(provider: string): string {
    const icons: Record<string, string> = {
      openai: '🤖', yandex: '🇷🇺', claude: '🔮', gemini: '♊',
      mistral: '🌬️', groq: '⚡', cohere: '🧠', lmstudio: '💻', other: '🔧',
    };
    return icons[provider] || '';
  }

  /**
   * Настройка обработчиков событий
   */
  private setupEventListeners(): void {
    // Mode switcher
    document.querySelectorAll('input[name="rename-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        this.switchMode(target.value as RenameMode);
      });
    });

    // Style Mode: Выбор пресета
    const presetSelect = document.getElementById('rename-preset-select') as HTMLSelectElement;
    presetSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.selectedPresetId = target.value;
      this.updatePresetDescription();
    });

    // Style Mode: Кнопка "Preview"
    document.getElementById('rename-preview-btn')?.addEventListener('click', () => {
      this.handleStylePreview();
    });

    // Style Mode: Кнопка "Create Custom Preset"
    document.getElementById('rename-create-preset-btn')?.addEventListener('click', () => {
      this.showCustomPresetDialog();
    });

    // AI Mode: Кнопка "AI Preview"
    document.getElementById('ai-rename-preview-btn')?.addEventListener('click', () => {
      this.handleAIPreview();
    });

    // Shared: Кнопка "Apply"
    document.getElementById('rename-apply-btn')?.addEventListener('click', () => {
      this.handleApply();
    });
  }

  /**
   * Переключение между Style и AI режимами
   */
  private switchMode(mode: RenameMode): void {
    this.currentMode = mode;

    const styleSection = document.getElementById('rename-style-section');
    const aiSection = document.getElementById('rename-ai-section');

    if (mode === 'style') {
      if (styleSection) styleSection.style.display = 'block';
      if (aiSection) aiSection.style.display = 'none';
    } else {
      if (styleSection) styleSection.style.display = 'none';
      if (aiSection) aiSection.style.display = 'block';
    }

    // Очищаем preview при переключении
    this.currentPreview = [];
    this.renderPreview([]);
    const countEl = document.getElementById('rename-preview-count');
    if (countEl) countEl.textContent = '';
    const applyBtn = document.getElementById('rename-apply-btn') as HTMLButtonElement;
    if (applyBtn) applyBtn.disabled = true;
  }

  /**
   * Загрузка настроек переименования
   */
  loadSettings(settings: RenameSettings): void {
    this.renameSettings = settings;
    this.renderPresetsList();

    if (settings.lastUsedPresetId) {
      this.selectedPresetId = settings.lastUsedPresetId;
    } else if (settings.presets.length > 0) {
      this.selectedPresetId = settings.presets[0].id;
    }

    this.updatePresetSelect();
    this.updatePresetDescription();
  }

  /**
   * Отрисовка списка пресетов в select
   */
  private renderPresetsList(): void {
    if (!this.renameSettings) return;

    const select = document.getElementById('rename-preset-select') as HTMLSelectElement;
    if (!select) return;

    select.innerHTML = '';

    this.renameSettings.presets.forEach((preset) => {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.name;
      select.appendChild(option);
    });
  }

  /**
   * Обновить выбранный пресет в select
   */
  private updatePresetSelect(): void {
    const select = document.getElementById('rename-preset-select') as HTMLSelectElement;
    if (select && this.selectedPresetId) {
      select.value = this.selectedPresetId;
    }
  }

  /**
   * Обновить описание выбранного пресета
   */
  private updatePresetDescription(): void {
    if (!this.renameSettings || !this.selectedPresetId) return;

    const preset = this.renameSettings.presets.find((p) => p.id === this.selectedPresetId);
    if (!preset) return;

    const descriptionEl = document.getElementById('rename-preset-description');
    if (!descriptionEl) return;

    let description = '';
    switch (preset.type) {
      case 'bem':
        description = 'Block Element Modifier naming convention. Example: "Button Primary" → "Button__Primary"';
        break;
      case 'camelCase':
        description = 'camelCase naming. Example: "Button Primary" → "buttonPrimary"';
        break;
      case 'snakeCase':
        description = 'snake_case naming. Example: "Button Primary" → "button_primary"';
        break;
      case 'kebabCase':
        description = 'kebab-case naming. Example: "Button Primary" → "button-primary"';
        break;
      case 'custom':
        description = `Custom preset with ${preset.rules.length} rule(s)`;
        break;
      default:
        description = preset.name;
    }

    descriptionEl.textContent = description;
  }

  // ============================================================================
  // Style Mode
  // ============================================================================

  /**
   * Style Mode: Preview
   */
  private async handleStylePreview(): Promise<void> {
    if (!this.selectedPresetId) {
      this.showError('Please select a preset');
      return;
    }

    this.showLoading(true);

    sendToSandbox({
      type: 'rename-preview',
      presetId: this.selectedPresetId,
    });
  }

  // ============================================================================
  // AI Mode
  // ============================================================================

  /**
   * AI Mode: Preview — отправляет запрос AI на генерацию имён
   */
  private async handleAIPreview(): Promise<void> {
    const promptEl = document.getElementById('ai-rename-prompt') as HTMLTextAreaElement;
    const prompt = promptEl?.value?.trim();

    if (!prompt) {
      this.showError('Please enter a prompt for AI renaming');
      return;
    }

    const providerSelect = document.getElementById('ai-rename-provider-select') as HTMLSelectElement;
    const providerId = providerSelect?.value;

    if (!providerId) {
      this.showError('Please select an AI provider');
      return;
    }

    const includeHierarchy = (document.getElementById('ai-rename-hierarchy') as HTMLInputElement)?.checked ?? true;

    this.showLoading(true);

    sendToSandbox({
      type: 'ai-rename-preview',
      id: generateUniqueId(),
      prompt,
      providerId,
      includeHierarchy,
    });
  }

  // ============================================================================
  // Shared (both modes)
  // ============================================================================

  /**
   * Обработка результата превью (от Style или AI)
   */
  handlePreviewResult(preview: RenamePreview[]): void {
    this.currentPreview = preview;
    this.showLoading(false);
    this.renderPreview(preview);

    const countEl = document.getElementById('rename-preview-count');
    if (countEl) {
      countEl.textContent = `${preview.length} layer${preview.length !== 1 ? 's' : ''} will be renamed`;
    }

    const applyBtn = document.getElementById('rename-apply-btn') as HTMLButtonElement;
    if (applyBtn) {
      applyBtn.disabled = preview.length === 0;
    }
  }

  /**
   * Отрисовка превью изменений
   */
  private renderPreview(preview: RenamePreview[]): void {
    const container = document.getElementById('rename-preview-list');
    if (!container) return;

    container.innerHTML = '';

    if (preview.length === 0) {
      container.innerHTML = '<div class="preview-empty">No layers will be renamed</div>';
      return;
    }

    preview.forEach((item) => {
      const previewItem = document.createElement('div');
      previewItem.className = 'preview-item';
      previewItem.style.paddingLeft = `${item.depth * 16 + 8}px`;

      previewItem.innerHTML = `
        <div class="preview-item-type">${this.getNodeTypeIcon(item.nodeType)}</div>
        <div class="preview-item-names">
          <div class="preview-old-name">${this.escapeHtml(item.oldName)}</div>
          <div class="preview-arrow">→</div>
          <div class="preview-new-name">${this.escapeHtml(item.newName)}</div>
        </div>
      `;

      container.appendChild(previewItem);
    });
  }

  /**
   * Получить иконку для типа узла
   */
  private getNodeTypeIcon(nodeType: string): string {
    switch (nodeType) {
      case 'FRAME':
        return '🔲';
      case 'GROUP':
        return '📁';
      case 'TEXT':
        return '✏️';
      default:
        return '•';
    }
  }

  /**
   * Обработка нажатия на "Apply"
   */
  private async handleApply(): Promise<void> {
    if (this.currentPreview.length === 0) {
      this.showError('No changes to apply');
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to rename ${this.currentPreview.length} layer${this.currentPreview.length !== 1 ? 's' : ''}?`
    );

    if (!confirmed) return;

    this.showLoading(true);

    sendToSandbox({
      type: 'rename-apply',
      preview: this.currentPreview,
      presetId: this.selectedPresetId || 'ai-mode',
    });
  }

  /**
   * Обработка результата применения переименования
   */
  handleApplyResult(renamedCount: number): void {
    this.showLoading(false);

    this.showSuccess(`Successfully renamed ${renamedCount} layer${renamedCount !== 1 ? 's' : ''}`);

    this.currentPreview = [];
    this.renderPreview([]);

    const countEl = document.getElementById('rename-preview-count');
    if (countEl) countEl.textContent = '';

    const applyBtn = document.getElementById('rename-apply-btn') as HTMLButtonElement;
    if (applyBtn) applyBtn.disabled = true;
  }

  /**
   * Показать диалог создания кастомного пресета
   */
  private showCustomPresetDialog(): void {
    alert('Custom preset creation will be available in the next version');
  }

  // ============================================================================
  // UI Helpers
  // ============================================================================

  /**
   * Показать состояние загрузки
   */
  private showLoading(isLoading: boolean): void {
    const previewBtn = document.getElementById('rename-preview-btn') as HTMLButtonElement;
    const aiPreviewBtn = document.getElementById('ai-rename-preview-btn') as HTMLButtonElement;
    const applyBtn = document.getElementById('rename-apply-btn') as HTMLButtonElement;

    if (previewBtn) {
      previewBtn.disabled = isLoading;
      previewBtn.textContent = isLoading ? 'Loading...' : 'Preview Changes';
    }

    if (aiPreviewBtn) {
      aiPreviewBtn.disabled = isLoading;
      aiPreviewBtn.textContent = isLoading ? 'Generating...' : 'AI Preview';
    }

    if (applyBtn) {
      applyBtn.disabled = isLoading || this.currentPreview.length === 0;
    }
  }

  private showError(message: string): void {
    const event = new CustomEvent('show-notification', {
      detail: { message, level: 'error' },
    });
    window.dispatchEvent(event);
  }

  private showSuccess(message: string): void {
    const event = new CustomEvent('show-notification', {
      detail: { message, level: 'success' },
    });
    window.dispatchEvent(event);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
