import { sendToSandbox } from '../../shared/messages';
import type { PluginSettings, UserProviderConfig } from '../../shared/types';
import { generateUniqueId, PROMPT_VARIABLES } from '../../shared/utils';
import { t } from '../../shared/i18n';
import { PROVIDER_CONFIGS } from '../../shared/providers';
import { QUICK_ACTIONS } from '../../shared/constants';
import { getActiveModels, findModelById } from '../../shared/provider-groups-utils';
import { getAllProviderConfigs } from '../../shared/provider-converter';

/**
 * Generate Panel - handles text generation UI and logic.
 *
 * Flow:
 * 1. User selects text layers in Figma
 * 2. User writes a prompt (instruction)
 * 3. Clicks "Generate & Apply"
 * 4. Sandbox reads selected text layers, enriches prompt with their content,
 *    sends to AI, and auto-applies result back into the selected layers.
 * 5. UI shows status (tokens, duration, applied count).
 */
export class GeneratePanel {
  private settings: PluginSettings | null = null;
  private currentGenerationId: string | null = null;
  private lastGeneratedText: string | null = null;

  // DOM elements
  private promptInput!: HTMLTextAreaElement;
  private systemPromptInput!: HTMLTextAreaElement;
  private outputStatus!: HTMLSpanElement;
  private outputTokens!: HTMLSpanElement;
  private generateBtn!: HTMLButtonElement;
  private cancelBtn!: HTMLButtonElement;
  private copyBtn!: HTMLButtonElement;
  private providerSelect!: HTMLSelectElement;
  private batchProgressBar!: HTMLDivElement;
  private batchProgressFill!: HTMLDivElement;
  private batchProgressLabel!: HTMLSpanElement;

  constructor() {
    this.initElements();
    this.setupEventListeners();
    this.renderVariableChips();
    this.renderQuickActions();
  }

  /**
   * Initialize DOM elements
   */
  private initElements(): void {
    this.promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
    this.systemPromptInput = document.getElementById('system-prompt-input') as HTMLTextAreaElement;
    this.outputStatus = document.getElementById('output-status') as HTMLSpanElement;
    this.outputTokens = document.getElementById('output-tokens') as HTMLSpanElement;
    this.generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
    this.cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
    this.copyBtn = document.getElementById('copy-result-btn') as HTMLButtonElement;
    this.providerSelect = document.getElementById('generate-provider-select') as HTMLSelectElement;
    this.batchProgressBar = document.getElementById('batch-progress-bar') as HTMLDivElement;
    this.batchProgressFill = document.getElementById('batch-progress-fill') as HTMLDivElement;
    this.batchProgressLabel = document.getElementById('batch-progress-label') as HTMLSpanElement;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.generateBtn?.addEventListener('click', () => this.handleGenerate());
    this.cancelBtn?.addEventListener('click', () => this.handleCancel());
    this.copyBtn?.addEventListener('click', () => this.copyLastResultToClipboard());

    // Saved Prompts modal
    document.getElementById('saved-prompts-btn')?.addEventListener('click', () => {
      this.openPromptsModal();
    });

    // Variable autocomplete on prompt input
    this.setupVariableAutocomplete(this.promptInput);
  }

  /**
   * Render Quick Action buttons above the prompt section.
   * Clicking a quick action populates the prompt and triggers generation.
   */
  private renderQuickActions(): void {
    const container = document.getElementById('quick-actions-bar');
    if (!container) return;

    container.innerHTML = '';

    // Label
    const label = document.createElement('span');
    label.className = 'quick-actions-label';
    label.setAttribute('data-i18n', 'generate.quickActions');
    label.textContent = t('generate.quickActions') || 'Quick Actions:';
    container.appendChild(label);

    // Buttons
    for (const action of QUICK_ACTIONS) {
      const btn = document.createElement('button');
      btn.className = 'quick-action-btn';
      btn.title = action.prompt;
      btn.innerHTML = `${action.icon} <span data-i18n="${action.labelKey}">${t(action.labelKey) || action.fallbackLabel}</span>`;

      btn.addEventListener('click', () => {
        // Set prompt text
        if (this.promptInput) {
          this.promptInput.value = action.prompt;
        }
        // Set system prompt if provided
        if (this.systemPromptInput && action.systemPrompt) {
          this.systemPromptInput.value = action.systemPrompt;
        }
        // Trigger generation
        this.handleGenerate();
      });

      container.appendChild(btn);
    }
  }

  /**
   * Render clickable variable chips below the prompt textarea.
   * Clicking a chip inserts {variable_name} at the cursor position.
   */
  private renderVariableChips(): void {
    const container = document.getElementById('variable-chips');
    if (!container) return;

    container.innerHTML = '';

    for (const v of PROMPT_VARIABLES) {
      const chip = document.createElement('span');
      chip.className = 'variable-chip';
      chip.textContent = `{${v.key}}`;
      chip.title = v.description;
      chip.addEventListener('click', () => {
        this.insertTextAtCursor(this.promptInput, `{${v.key}}`);
      });
      container.appendChild(chip);
    }
  }

  /**
   * Insert text at the current cursor position in a textarea
   */
  private insertTextAtCursor(textarea: HTMLTextAreaElement, text: string): void {
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);

    textarea.value = before + text + after;
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
  }

  /**
   * Setup variable autocomplete dropdown for a textarea.
   * Shows a dropdown when user types '{' and filters as they type.
   */
  private setupVariableAutocomplete(textarea: HTMLTextAreaElement): void {
    if (!textarea) return;

    let dropdown: HTMLElement | null = null;

    const closeDropdown = () => {
      if (dropdown) {
        dropdown.remove();
        dropdown = null;
      }
    };

    const insertVariable = (key: string) => {
      const cursorPos = textarea.selectionStart;
      const textBefore = textarea.value.substring(0, cursorPos);
      const textAfter = textarea.value.substring(cursorPos);

      // Find the start of the current {... token
      const braceIdx = textBefore.lastIndexOf('{');
      if (braceIdx === -1) return;

      textarea.value = textBefore.substring(0, braceIdx) + `{${key}}` + textAfter;
      const newPos = braceIdx + key.length + 2;
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
      closeDropdown();
    };

    textarea.addEventListener('input', () => {
      const cursorPos = textarea.selectionStart;
      const textBefore = textarea.value.substring(0, cursorPos);

      // Check if we're inside an incomplete {variable
      const braceIdx = textBefore.lastIndexOf('{');
      const closeBraceIdx = textBefore.lastIndexOf('}');

      if (braceIdx === -1 || (closeBraceIdx > braceIdx)) {
        closeDropdown();
        return;
      }

      const partial = textBefore.substring(braceIdx + 1).toLowerCase();

      // Filter matching variables
      const matches = PROMPT_VARIABLES.filter(v =>
        v.key.toLowerCase().startsWith(partial) || v.description.toLowerCase().includes(partial)
      );

      if (matches.length === 0) {
        closeDropdown();
        return;
      }

      // Create or update dropdown
      if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.className = 'variable-autocomplete';
        // Insert after textarea within its parent section (which has position: relative)
        const container = textarea.closest('.section') || textarea.parentElement;
        container?.appendChild(dropdown);
      }

      dropdown.innerHTML = matches.map(v =>
        `<div class="variable-autocomplete-item" data-key="${v.key}">
          <span class="variable-key">{${v.key}}</span>
          <span class="variable-desc">${v.description}</span>
        </div>`
      ).join('');

      // Attach click handlers
      dropdown.querySelectorAll('.variable-autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
          insertVariable((item as HTMLElement).dataset.key!);
        });
      });
    });

    // Close dropdown on blur (with delay for click handling)
    textarea.addEventListener('blur', () => {
      setTimeout(closeDropdown, 200);
    });

    // Close on Escape
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dropdown) {
        e.stopPropagation();
        closeDropdown();
      }
    });
  }

  /**
   * Open the saved prompts modal
   */
  private openPromptsModal(): void {
    const modal = document.getElementById('prompts-panel');
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  /**
   * Load settings
   */
  loadSettings(settings: PluginSettings): void {
    this.settings = settings;
    this.populateProviderDropdown();
  }

  /**
   * Populate provider dropdown from settings
   * V2.1: Shows models from provider groups
   */
  private populateProviderDropdown(): void {
    if (!this.providerSelect || !this.settings) return;

    this.providerSelect.innerHTML = '';

    // V2.1: Combine Legacy providers and Provider Groups
    const legacyConfigs = this.settings.providerConfigs || [];
    const groups = this.settings.providerGroups || [];
    const allConfigs = getAllProviderConfigs(legacyConfigs, groups);
    const enabledConfigs = allConfigs.filter(c => c.enabled);

    if (enabledConfigs.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = t('generate.provider.noProvider');
      this.providerSelect.appendChild(opt);
      return;
    }

    enabledConfigs.forEach(config => {
      const baseConfig = PROVIDER_CONFIGS.find(p => p.id === config.baseConfigId);
      const opt = document.createElement('option');
      opt.value = config.id;
      // For "other" custom providers, use the model name directly
      const icon = baseConfig
        ? this.getProviderIcon(baseConfig.provider)
        : this.getProviderIcon('other');
      opt.textContent = `${icon} ${config.name}`;
      this.providerSelect.appendChild(opt);
    });

    // Select the active provider/model
    const activeId = this.settings.activeModelId || this.settings.activeProviderId;
    if (activeId) {
      this.providerSelect.value = activeId;
    }

    // Update vision checkbox visibility based on selected provider
    this.updateVisionCheckboxVisibility();

    // Listen for provider changes to update vision checkbox
    this.providerSelect.addEventListener('change', () => {
      this.updateVisionCheckboxVisibility();
    });
  }

  /**
   * Check if the currently selected provider supports vision
   * and show/hide the "Attach screenshot" checkbox accordingly
   */
  private updateVisionCheckboxVisibility(): void {
    const visionLabel = document.getElementById('vision-checkbox-label');
    if (!visionLabel) return;

    const providerId = this.getSelectedProviderId();
    if (!providerId || !this.settings) {
      visionLabel.style.display = 'none';
      return;
    }

    // Find the base config to check provider type
    const allConfigs = getAllProviderConfigs(
      this.settings.providerConfigs || [],
      this.settings.providerGroups || [],
    );
    const config = allConfigs.find(c => c.id === providerId);
    if (!config) {
      visionLabel.style.display = 'none';
      return;
    }

    const baseConfig = PROVIDER_CONFIGS.find(p => p.id === config.baseConfigId);
    const provider = baseConfig?.provider || '';

    // Vision-capable providers: OpenAI (GPT-4o), Claude, Gemini, Yandex (Gemma 3)
    const model = (baseConfig?.model || '').toLowerCase();
    const isVisionCapable =
      (provider === 'openai' && (model.includes('gpt-4o') || model.includes('gpt-4-turbo'))) ||
      provider === 'claude' ||
      provider === 'gemini' ||
      (provider === 'yandex' && model.includes('gemma-3'));

    visionLabel.style.display = isVisionCapable ? 'flex' : 'none';
  }

  /**
   * Get provider emoji icon
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
      other: '🔧',
    };
    return icons[provider] || '';
  }

  /**
   * Get currently selected provider/model ID (from dropdown)
   * V2.1: Returns model ID if groups are used, provider ID otherwise
   */
  private getSelectedProviderId(): string {
    const selectedValue = this.providerSelect?.value || '';

    if (selectedValue) {
      return selectedValue;
    }

    // Fallback to settings
    if (this.settings?.providerGroups && this.settings.providerGroups.length > 0) {
      return this.settings.activeModelId || '';
    }

    return this.settings?.activeProviderId || '';
  }

  // ============================================================================
  // Generation
  // ============================================================================

  /**
   * Generate text and auto-apply to selected layers
   */
  private async handleGenerate(): Promise<void> {
    const selectedProviderId = this.getSelectedProviderId();

    if (!this.settings || !selectedProviderId) {
      this.showNotification(t('error.noProvider'), 'error');
      return;
    }

    const prompt = this.promptInput.value;
    if (!prompt.trim()) {
      this.showNotification(t('error.emptyPrompt'), 'error');
      return;
    }

    const systemPrompt = this.systemPromptInput.value;

    // UI: switch to generating state
    this.outputStatus.textContent = 'Generating...';
    this.outputTokens.textContent = '0 tokens';
    this.generateBtn.style.display = 'none';
    this.cancelBtn.style.display = 'block';

    // Check if "Attach screenshot" checkbox is checked
    const screenshotCheckbox = document.getElementById('attach-screenshot-checkbox') as HTMLInputElement;
    const attachScreenshot = screenshotCheckbox?.checked || false;

    const id = generateUniqueId();
    sendToSandbox({
      type: 'generate-text',
      id,
      providerId: selectedProviderId,
      prompt,
      systemPrompt: systemPrompt || undefined,
      settings: this.settings.generation,
      attachScreenshot,
    });
  }

  /**
   * Handle generation started
   */
  handleGenerationStarted(generationId: string, selectionContextCount?: number): void {
    this.currentGenerationId = generationId;

    // Update the selection context badge
    this.updateContextBadge(selectionContextCount || 0);
  }

  /**
   * Update context badge showing how many layers are auto-attached
   */
  private updateContextBadge(count: number): void {
    const badge = document.getElementById('selection-context-badge');
    const countEl = document.getElementById('selection-context-count');
    if (!badge || !countEl) return;

    if (count > 0) {
      countEl.textContent = String(count);
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  /**
   * Handle generation chunk (streaming progress)
   */
  handleGenerationChunk(_chunk: string, tokensGenerated: number): void {
    this.outputTokens.textContent = `${tokensGenerated} tokens`;
    this.outputStatus.textContent = 'Generating...';
  }

  /**
   * Handle batch processing progress
   */
  handleBatchProgress(current: number, total: number, currentNodeName: string, percentage: number): void {
    this.outputStatus.textContent = `Processing ${current + 1}/${total}: ${currentNodeName}`;
    this.outputTokens.textContent = `${percentage}%`;

    // Show and update visual progress bar
    if (this.batchProgressBar) {
      this.batchProgressBar.style.display = 'flex';
      this.batchProgressBar.setAttribute('aria-valuenow', String(percentage));
    }
    if (this.batchProgressFill) {
      this.batchProgressFill.style.width = `${percentage}%`;
    }
    if (this.batchProgressLabel) {
      this.batchProgressLabel.textContent = `${current + 1}/${total}`;
    }
  }

  /**
   * Handle generation complete — text was already auto-applied by sandbox
   */
  handleGenerationComplete(fullText: string, tokensUsed: number, duration?: number, cost?: number, appliedCount?: number): void {
    let statusText = 'Done';
    if (duration) {
      statusText += ` (${(duration / 1000).toFixed(1)}s)`;
    }
    if (cost && cost > 0) {
      statusText += ` · $${cost.toFixed(4)}`;
    }
    if (appliedCount && appliedCount > 0) {
      statusText += ` · Applied to ${appliedCount} layer${appliedCount !== 1 ? 's' : ''}`;
    }

    this.outputStatus.textContent = statusText;
    this.outputTokens.textContent = `${tokensUsed} tokens`;

    this.generateBtn.style.display = 'block';
    this.cancelBtn.style.display = 'none';

    // Hide batch progress bar
    this.hideBatchProgressBar();

    // Store last result and show copy button
    this.lastGeneratedText = fullText;
    if (this.copyBtn) {
      this.copyBtn.style.display = fullText ? 'inline-flex' : 'none';
    }

    if (appliedCount && appliedCount > 0) {
      this.showNotification(`Applied to ${appliedCount} layer${appliedCount !== 1 ? 's' : ''}`, 'success');
    } else {
      this.showNotification('Generated (no layers to apply)', 'info');
    }

    this.currentGenerationId = null;
  }

  /**
   * Handle generation error
   */
  handleGenerationError(error: string): void {
    this.outputStatus.textContent = `Error: ${error}`;

    this.generateBtn.style.display = 'block';
    this.cancelBtn.style.display = 'none';

    // Hide batch progress bar
    this.hideBatchProgressBar();

    this.showNotification(error, 'error');
    this.currentGenerationId = null;
  }

  /**
   * Cancel current generation
   */
  private handleCancel(): void {
    if (this.currentGenerationId) {
      sendToSandbox({
        type: 'cancel-generation',
        id: generateUniqueId(),
        generationId: this.currentGenerationId,
      });

      this.generateBtn.style.display = 'block';
      this.cancelBtn.style.display = 'none';
      this.outputStatus.textContent = 'Cancelled';

      // Hide batch progress bar
      this.hideBatchProgressBar();

      this.currentGenerationId = null;
    }
  }

  /**
   * Handle selected text response (kept for compatibility if needed)
   */
  handleSelectedTextLoaded(text: string): void {
    const currentPrompt = this.promptInput.value;

    if (currentPrompt.trim()) {
      this.promptInput.value = `${currentPrompt}\n\n${text}`;
    } else {
      this.promptInput.value = text;
    }

    this.showNotification('Selected text added to prompt', 'success');
  }

  // ============================================================================
  // Public methods for keyboard shortcuts
  // ============================================================================

  /**
   * Trigger generation from external caller (keyboard shortcut).
   * Only triggers if the generate button is visible (not currently generating).
   */
  triggerGenerate(): void {
    if (this.generateBtn && this.generateBtn.style.display !== 'none') {
      this.handleGenerate();
    }
  }

  /**
   * Trigger cancel from external caller (keyboard shortcut).
   * Only cancels if a generation is currently in progress.
   */
  triggerCancel(): void {
    if (this.currentGenerationId) {
      this.handleCancel();
    }
  }

  /**
   * Copy last generation result to clipboard.
   * Used by both copy button click and Ctrl+Shift+C shortcut.
   */
  async copyLastResultToClipboard(): Promise<void> {
    if (!this.lastGeneratedText) {
      this.showNotification(t('generate.copy.noResult'), 'warning');
      return;
    }

    try {
      await this.copyToClipboard(this.lastGeneratedText);
      this.showNotification(t('generate.copy.success'), 'success');

      // Brief visual feedback on copy button
      if (this.copyBtn) {
        const originalText = this.copyBtn.textContent;
        this.copyBtn.textContent = '✓';
        setTimeout(() => {
          if (this.copyBtn) this.copyBtn.textContent = originalText;
        }, 1500);
      }
    } catch {
      this.showNotification(t('generate.copy.error'), 'error');
    }
  }

  /**
   * Copy text to clipboard with fallback for Figma iframe
   * (navigator.clipboard requires Secure Context + permissions)
   */
  private async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for Figma iframe where Clipboard API is unavailable
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  /**
   * Hide and reset the batch progress bar
   */
  private hideBatchProgressBar(): void {
    if (this.batchProgressBar) {
      this.batchProgressBar.style.display = 'none';
    }
    if (this.batchProgressFill) {
      this.batchProgressFill.style.width = '0%';
    }
    if (this.batchProgressLabel) {
      this.batchProgressLabel.textContent = '0%';
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Show notification (delegate to main UI)
   */
  private showNotification(message: string, level: 'info' | 'success' | 'error' | 'warning'): void {
    const event = new CustomEvent('show-notification', {
      detail: { message, level },
    });
    window.dispatchEvent(event);
  }

  /**
   * Escape HTML for safe rendering
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
