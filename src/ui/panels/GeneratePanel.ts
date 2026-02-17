import { sendToSandbox } from '../../shared/messages';
import type { PluginSettings, UserProviderConfig } from '../../shared/types';
import { generateUniqueId } from '../../shared/utils';
import { t } from '../../shared/i18n';
import { PROVIDER_CONFIGS } from '../../shared/providers';
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

  // DOM elements
  private promptInput!: HTMLTextAreaElement;
  private systemPromptInput!: HTMLTextAreaElement;
  private outputStatus!: HTMLSpanElement;
  private outputTokens!: HTMLSpanElement;
  private generateBtn!: HTMLButtonElement;
  private cancelBtn!: HTMLButtonElement;
  private providerSelect!: HTMLSelectElement;

  constructor() {
    this.initElements();
    this.setupEventListeners();
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
    this.providerSelect = document.getElementById('generate-provider-select') as HTMLSelectElement;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.generateBtn?.addEventListener('click', () => this.handleGenerate());
    this.cancelBtn?.addEventListener('click', () => this.handleCancel());

    // Saved Prompts modal
    document.getElementById('saved-prompts-btn')?.addEventListener('click', () => {
      this.openPromptsModal();
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
      opt.textContent = `${this.getProviderIcon(baseConfig?.provider || '')} ${config.name}`;
      this.providerSelect.appendChild(opt);
    });

    // Select the active provider/model
    const activeId = this.settings.activeModelId || this.settings.activeProviderId;
    if (activeId) {
      this.providerSelect.value = activeId;
    }
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

    const id = generateUniqueId();
    sendToSandbox({
      type: 'generate-text',
      id,
      providerId: selectedProviderId,
      prompt,
      systemPrompt: systemPrompt || undefined,
      settings: this.settings.generation,
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
