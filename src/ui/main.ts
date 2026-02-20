import { sendToSandbox } from '../shared/messages';
import type { SandboxToUIMessage } from '../shared/messages';
import type { PluginSettings, ProviderType } from '../shared/types';
import { generateUniqueId } from '../shared/utils';
import {
  SettingsPanel,
  RenamePanel,
  PromptsPanel,
  GeneratePanel,
  DataPanel,
  HelpPanel,
} from './panels';
import { i18n } from './i18n-ui';
import type { Language } from '../shared/i18n';
import { setLanguage } from '../shared/i18n';

/**
 * Main UI Coordinator
 * Simplified main.ts that delegates work to specialized panels
 */
class PluginUI {
  private settings: PluginSettings | null = null;
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  private isFirstRun = false;
  private selectedLanguage: Language = 'en';

  // Panels
  private settingsPanel!: SettingsPanel;
  private renamePanel!: RenamePanel;
  private promptsPanel!: PromptsPanel;
  private generatePanel!: GeneratePanel;
  private dataPanel!: DataPanel;
  private helpPanel!: HelpPanel;

  constructor() {
    this.initPanels();
    this.setupMessageListener();
    this.setupGlobalEventListeners();
    this.setupLanguageSelection();
    this.loadInitialData();
  }

  /**
   * Initialize all panels
   */
  private initPanels(): void {
    this.settingsPanel = new SettingsPanel();
    this.renamePanel = new RenamePanel();
    this.promptsPanel = new PromptsPanel();
    this.generatePanel = new GeneratePanel();
    this.dataPanel = new DataPanel();
    this.helpPanel = new HelpPanel();

    // Initialize i18n
    i18n.init();
  }

  /**
   * Setup message listener from Sandbox
   */
  private setupMessageListener(): void {
    window.onmessage = (event) => {
      const message = event.data.pluginMessage as SandboxToUIMessage;
      if (!message) return;

      this.handleSandboxMessage(message);
    };
  }

  /**
   * Handle messages from Sandbox
   */
  private handleSandboxMessage(message: SandboxToUIMessage): void {
    switch (message.type) {
      // Settings
      case 'settings-loaded':
        this.handleSettingsLoaded(message);
        break;

      // Generation
      case 'generation-started':
        this.generatePanel.handleGenerationStarted(message.generationId, message.selectionContextCount);
        break;
      case 'generation-chunk':
        this.generatePanel.handleGenerationChunk(message.chunk, message.tokensGenerated);
        break;
      case 'generation-complete':
        this.generatePanel.handleGenerationComplete(message.fullText, message.tokensUsed, message.duration, message.cost, message.appliedCount);
        break;
      case 'generation-error':
        this.generatePanel.handleGenerationError(message.error);
        break;

      // Rename
      case 'rename-settings-loaded':
        this.renamePanel.loadSettings(message.settings);
        break;
      case 'rename-preview-result':
        this.renamePanel.handlePreviewResult(message.preview);
        break;
      case 'rename-apply-result':
        this.renamePanel.handleApplyResult(message.renamedCount);
        break;

      // Prompts
      case 'prompts-library-loaded':
        this.promptsPanel.loadLibrary(message.library);
        break;

      // Data Presets
      case 'data-presets-loaded':
        this.dataPanel.loadPresets(message.settings);
        break;
      case 'substitution-applied':
        this.dataPanel.handleSubstitutionApplied(
          message.success,
          message.componentsProcessed,
          message.groupsUsed,
          message.nodesProcessed,
          message.error
        );
        break;

      // Batch Progress (для будущего использования)
      case 'batch-progress':
        // TODO: показывать прогресс-бар в Generate панели
        break;

      // Selected Text
      case 'selected-text-loaded':
        this.generatePanel.handleSelectedTextLoaded(message.text);
        break;

      // Settings updated (обновление списка провайдеров в реальном времени)
      case 'settings-updated':
        if (message.settings) {
          this.settings = message.settings;
          this.generatePanel.loadSettings(message.settings);
        }
        break;

      // Notifications
      case 'notification':
        this.showNotification(message.message, message.level);
        break;

      // Generic pending requests
      case 'text-applied':
      case 'test-connection-result':
      case 'test-translation-result':
        if (message.id) {
          const pending = this.pendingRequests.get(message.id);
          if (pending) {
            pending.resolve(message);
            this.pendingRequests.delete(message.id);
          }
        }
        break;
    }
  }

  /**
   * Setup global event listeners (tabs, notifications)
   */
  private setupGlobalEventListeners(): void {
    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const tabName = target.dataset.tab;
        this.switchTab(tabName!);
      });
    });

    // Notification events from panels
    window.addEventListener('show-notification', ((e: CustomEvent) => {
      this.showNotification(e.detail.message, e.detail.level);
    }) as EventListener);

    // Collapsible sections
    document.querySelectorAll('.collapsible-header').forEach(header => {
      header.addEventListener('click', () => {
        const content = header.nextElementSibling as HTMLElement;
        if (content && content.classList.contains('collapsible-content')) {
          const isVisible = content.style.display !== 'none';
          content.style.display = isVisible ? 'none' : 'block';
          header.textContent = header.textContent?.replace(isVisible ? '▼' : '▲', isVisible ? '▲' : '▼') || '';
        }
      });
    });

    // Test connection buttons (старые, для обратной совместимости)
    document.getElementById('test-lmstudio-btn')?.addEventListener('click', () => this.testConnection('lmstudio'));
    document.getElementById('test-yandex-btn')?.addEventListener('click', () => this.testConnection('yandex'));
    document.getElementById('test-openai-btn')?.addEventListener('click', () => this.testConnection('openai-compatible'));
    document.getElementById('test-translate-btn')?.addEventListener('click', () => this.testTranslation());
  }

  /**
   * Switch tabs
   */
  private switchTab(tabName: string): void {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));

    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`${tabName}-panel`)?.classList.add('active');
  }

  /**
   * Load initial data
   */
  private async loadInitialData(): Promise<void> {
    await this.loadSettings();
    this.loadRenameSettings();
    this.loadPromptsLibrary();
    this.loadDataPresets();
  }

  /**
   * Load plugin settings
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
   * Handle settings loaded
   */
  private handleSettingsLoaded(message: any): void {
    this.settings = message.settings;
    this.settingsPanel.loadSettings(message.settings);
    this.generatePanel.loadSettings(message.settings);
    this.promptsPanel.loadSettings(message.settings);
    this.renamePanel.loadPluginSettings(message.settings);

    const settings = message.settings as PluginSettings;

    // Apply saved language
    if (settings.language) {
      setLanguage(settings.language);
      i18n.updateAll();

      // Update the help language dropdown
      const helpLangSelect = document.getElementById('help-language-select') as HTMLSelectElement;
      if (helpLangSelect) {
        helpLangSelect.value = settings.language;
      }
    }

    // Show first-run screen only if no language is set (genuine first launch)
    const hasLanguage = !!settings.language;
    if (!hasLanguage) {
      this.showFirstRunScreen();
    }

    const pending = this.pendingRequests.get(message.id);
    if (pending) {
      pending.resolve(message.settings);
      this.pendingRequests.delete(message.id);
    }
  }

  /**
   * Load rename settings
   */
  private loadRenameSettings(): void {
    sendToSandbox({ type: 'load-rename-settings', id: generateUniqueId() });
  }

  /**
   * Load prompts library
   */
  private loadPromptsLibrary(): void {
    sendToSandbox({ type: 'load-prompts-library', id: generateUniqueId() });
  }

  /**
   * Load data presets
   */
  private loadDataPresets(): void {
    sendToSandbox({ type: 'load-data-presets', id: generateUniqueId() });
  }

  /**
   * Test connection (legacy support)
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
   * Test translation (legacy support)
   */
  private testTranslation(): void {
    const id = generateUniqueId();
    sendToSandbox({
      type: 'test-translation',
      id,
    });

    this.showNotification('Sending translation request...', 'info');

    const resultDiv = document.getElementById('translation-result');
    if (resultDiv) {
      resultDiv.style.display = 'block';
      resultDiv.textContent = 'Waiting for response...';
    }
  }

  /**
   * Setup first-run language selection screen
   */
  private setupLanguageSelection(): void {
    // Language buttons on first-run screen
    document.querySelectorAll('.language-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Deselect all buttons
        document.querySelectorAll('.language-btn').forEach(b => b.classList.remove('selected'));
        // Select this button
        btn.classList.add('selected');
        // Store selected language
        this.selectedLanguage = (btn as HTMLElement).dataset.lang as Language;
        // Enable continue button
        const continueBtn = document.getElementById('language-continue-btn') as HTMLButtonElement;
        if (continueBtn) {
          continueBtn.disabled = false;
        }
      });
    });

    // Continue button on first-run screen
    document.getElementById('language-continue-btn')?.addEventListener('click', () => {
      this.handleFirstRunLanguageSelected();
    });

    // Settings page language dropdown
    document.getElementById('settings-language-select')?.addEventListener('change', (e) => {
      const newLang = (e.target as HTMLSelectElement).value as Language;
      this.changeLanguage(newLang);
    });

    // NOTE: Help page language/theme dropdowns are handled by HelpPanel.ts
    // Do not add duplicate listeners here - it creates conflicts
  }

  /**
   * Show first-run language selection screen
   */
  private showFirstRunScreen(): void {
    this.isFirstRun = true;
    const screen = document.getElementById('language-select-screen');
    const app = document.getElementById('app');
    if (screen) screen.style.display = 'flex';
    if (app) app.style.display = 'none';
  }

  /**
   * Handle language selected on first-run screen
   */
  private handleFirstRunLanguageSelected(): void {
    this.isFirstRun = false;

    // Hide first-run screen, show app
    const screen = document.getElementById('language-select-screen');
    const app = document.getElementById('app');
    if (screen) screen.style.display = 'none';
    if (app) app.style.display = 'flex';

    // Apply selected language
    this.changeLanguage(this.selectedLanguage);
  }

  /**
   * Change language and persist to settings
   */
  private changeLanguage(lang: Language): void {
    // Apply language to i18n system
    i18n.changeLanguage(lang);

    // Re-render help panel to update all template-based translations
    this.helpPanel.rerender();

    // Persist language in settings
    if (this.settings) {
      this.settings.language = lang;
      sendToSandbox({
        type: 'save-settings',
        id: generateUniqueId(),
        settings: this.settings,
      });
    }
  }

  /**
   * Show notification
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
}

// Initialize UI
new PluginUI();
