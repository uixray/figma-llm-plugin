import { sendToSandbox } from '../../shared/messages';
import { t, setLanguage, getLanguage } from '../../shared/i18n';
import type { Language } from '../../shared/i18n';
import { applyTheme, type Theme } from '../../shared/theme';
import { i18n } from '../i18n-ui';
import { PLUGIN_VERSION, PLUGIN_BUILD } from '../../shared/constants';

/**
 * Help Panel - FAQ and instructions for users
 * Provides step-by-step guides for setting up providers and troubleshooting
 */
export class HelpPanel {
  private container: HTMLElement;
  private accordions: Map<string, boolean> = new Map(); // Track open/closed state

  constructor() {
    this.container = document.getElementById('help-panel') as HTMLElement;
    this.render();
    this.setupEventListeners();
    this.loadPreferences();
  }

  /**
   * Setup event listeners ONCE on the container using event delegation.
   * This method is only called from the constructor — never from rerender().
   */
  private setupEventListeners(): void {
    // All events delegated on the container (survives innerHTML rebuilds)
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const accordionHeader = target.closest('.accordion-header');

      if (accordionHeader) {
        const sectionId = accordionHeader.getAttribute('data-section');
        if (sectionId) {
          this.toggleAccordion(sectionId);
        }
      }
    });

    // Delegated change listener for language and theme selects
    this.container.addEventListener('change', (e) => {
      const target = e.target as HTMLElement;

      if (target.id === 'help-language-select') {
        const lang = (target as HTMLSelectElement).value as Language;
        this.handleLanguageChange(lang);
      } else if (target.id === 'help-theme-select') {
        const theme = (target as HTMLSelectElement).value as Theme;
        this.handleThemeChange(theme);
      }
    });
  }

  /**
   * Load saved preferences
   */
  private loadPreferences(): void {
    // Set language dropdown to current language
    const helpLangSelect = document.getElementById('help-language-select') as HTMLSelectElement;
    if (helpLangSelect) {
      helpLangSelect.value = getLanguage();
    }

    // Set theme dropdown to current theme (read from DOM attribute)
    const helpThemeSelect = document.getElementById('help-theme-select') as HTMLSelectElement;
    const mainThemeSelect = document.getElementById('settings-theme-select') as HTMLSelectElement;
    if (helpThemeSelect && mainThemeSelect) {
      helpThemeSelect.value = mainThemeSelect.value || 'auto';
    }
  }

  /**
   * Handle language change
   */
  private handleLanguageChange(lang: Language): void {
    setLanguage(lang);

    // Update main language select as well
    const mainLangSelect = document.getElementById('settings-language-select') as HTMLSelectElement;
    if (mainLangSelect) {
      mainLangSelect.value = lang;
    }

    // Trigger full UI update for data-i18n elements
    i18n.updateAll();

    // Re-render help panel to update all t() template strings
    this.rerender();

    // Save to settings
    sendToSandbox({
      type: 'update-language',
      language: lang,
    });
  }

  /**
   * Re-render the help panel preserving accordion states and preferences
   */
  public rerender(): void {
    const savedAccordions = new Map(this.accordions);
    this.render();
    // NOTE: setupEventListeners() is NOT called here — delegated listeners
    // on this.container survive innerHTML rebuilds.
    this.loadPreferences();

    // Restore open accordion states
    for (const [sectionId, isOpen] of savedAccordions) {
      if (isOpen) {
        this.accordions.set(sectionId, false);
        this.toggleAccordion(sectionId);
      }
    }
  }

  /**
   * Handle theme change
   */
  private handleThemeChange(theme: Theme): void {
    applyTheme(theme);

    // Update main theme select as well
    const mainThemeSelect = document.getElementById('settings-theme-select') as HTMLSelectElement;
    if (mainThemeSelect) {
      mainThemeSelect.value = theme;
    }

    // Save to settings
    sendToSandbox({
      type: 'update-theme',
      theme: theme,
    });
  }

  private toggleAccordion(sectionId: string): void {
    const isOpen = this.accordions.get(sectionId) || false;
    this.accordions.set(sectionId, !isOpen);

    const content = this.container.querySelector(`[data-content="${sectionId}"]`);
    const icon = this.container.querySelector(`[data-icon="${sectionId}"]`);

    if (content && icon) {
      if (!isOpen) {
        content.classList.add('active');
        icon.textContent = '▼';
      } else {
        content.classList.remove('active');
        icon.textContent = '▶';
      }
    }
  }

  /**
   * Scroll to specific section and open it
   */
  public scrollToSection(sectionId: string): void {
    const section = this.container.querySelector(`[data-section="${sectionId}"]`);
    if (section) {
      // Open the accordion
      this.accordions.set(sectionId, false);
      this.toggleAccordion(sectionId);

      // Scroll to section
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="help-preferences-section">
        <div class="help-preference-row">
          <div class="help-preference-item">
            <label data-i18n="language.label">Language:</label>
            <select id="help-language-select">
              <option value="en">🇬🇧 English</option>
              <option value="ru">🇷🇺 Русский</option>
              <option value="ja">🇯🇵 日本語</option>
              <option value="zh">🇨🇳 中文</option>
              <option value="fr">🇫🇷 Français</option>
            </select>
          </div>
          <div class="help-preference-item">
            <label data-i18n="settings.general.theme">Theme:</label>
            <select id="help-theme-select">
              <option value="auto" data-i18n="settings.theme.auto">Auto</option>
              <option value="light" data-i18n="settings.theme.light">Light</option>
              <option value="dark" data-i18n="settings.theme.dark">Dark</option>
            </select>
          </div>
        </div>
      </div>

      <div class="help-contact-block">
        <div class="help-contact-title">💬 Contact &amp; Support</div>
        <div class="help-contact-links">
          <a href="https://t.me/uixray" target="_blank" class="help-contact-btn help-contact-tg">
            <span>✈️</span> Telegram @uixray
          </a>
          <a href="https://boosty.to/uixray" target="_blank" class="help-contact-btn help-contact-boosty">
            <span>☕</span> Support on Boosty
          </a>
        </div>
        <p class="help-contact-note">Feedback, bug reports, and feature requests are welcome! If you find UText useful, consider supporting the project.</p>
      </div>

      <div class="help-content">
        ${this.renderAccordion('yandex-setup', t('help.yandex.title'), this.renderYandexSetup())}
        ${this.renderAccordion('openai-setup', t('help.openai.title'), this.renderOpenAISetup())}
        ${this.renderAccordion('claude-setup', t('help.claude.title'), this.renderClaudeSetup())}
        ${this.renderAccordion('lmstudio-setup', t('help.lmstudio.title'), this.renderLMStudioSetup())}
        ${this.renderAccordion('proxy-info', t('help.proxy.title'), this.renderProxyInfo())}
        ${this.renderAccordion('troubleshooting', t('help.troubleshooting.title'), this.renderTroubleshooting())}
      </div>

      <div class="help-version">
        UText v${PLUGIN_VERSION} · Build ${PLUGIN_BUILD}
      </div>
    `;
  }

  private renderAccordion(id: string, title: string, content: string): string {
    return `
      <div class="accordion-item">
        <div class="accordion-header" data-section="${id}">
          <span class="accordion-icon" data-icon="${id}">▶</span>
          <h3>${title}</h3>
        </div>
        <div class="accordion-content" data-content="${id}">
          <div class="accordion-body">
            ${content}
          </div>
        </div>
      </div>
    `;
  }

  private renderYandexSetup(): string {
    return `
      <div class="help-section">
        <h4>🇷🇺 ${t('help.yandex.subtitle')}</h4>
        <ol class="help-steps">
          <li>
            <strong>${t('help.yandex.step1.title')}</strong>
            <p>${t('help.yandex.step1.desc')}</p>
            <a href="https://cloud.yandex.ru/services/foundation-models" target="_blank" class="help-link">
              cloud.yandex.ru/services/foundation-models →
            </a>
          </li>
          <li>
            <strong>${t('help.yandex.step2.title')}</strong>
            <p>${t('help.yandex.step2.desc')}</p>
          </li>
          <li>
            <strong>${t('help.yandex.step3.title')}</strong>
            <p>${t('help.yandex.step3.desc')}</p>
            <code class="help-code">cloud.yandex.ru/folders</code>
          </li>
          <li>
            <strong>${t('help.yandex.step4.title')}</strong>
            <p>${t('help.yandex.step4.desc')}</p>
            <a href="https://cloud.yandex.ru/docs/iam/operations/api-key/create" target="_blank" class="help-link">
              ${t('help.yandex.step4.link')} →
            </a>
          </li>
          <li>
            <strong>${t('help.yandex.step5.title')}</strong>
            <p>${t('help.yandex.step5.desc')}</p>
            <ul>
              <li>Folder ID: <code>b1g...</code></li>
              <li>API Key: <code>AQVN...</code></li>
            </ul>
          </li>
        </ol>

        <div class="help-note">
          <strong>💡 ${t('help.note')}:</strong> ${t('help.yandex.note')}
        </div>
      </div>
    `;
  }

  private renderOpenAISetup(): string {
    return `
      <div class="help-section">
        <h4>${t('help.openai.subtitle')}</h4>
        <ol class="help-steps">
          <li>
            <strong>${t('help.openai.step1.title')}</strong>
            <p>${t('help.openai.step1.desc')}</p>
            <a href="https://platform.openai.com/signup" target="_blank" class="help-link">
              platform.openai.com/signup →
            </a>
          </li>
          <li>
            <strong>${t('help.openai.step2.title')}</strong>
            <p>${t('help.openai.step2.desc')}</p>
            <a href="https://platform.openai.com/account/billing" target="_blank" class="help-link">
              ${t('help.openai.step2.link')} →
            </a>
          </li>
          <li>
            <strong>${t('help.openai.step3.title')}</strong>
            <p>${t('help.openai.step3.desc')}</p>
            <a href="https://platform.openai.com/api-keys" target="_blank" class="help-link">
              platform.openai.com/api-keys →
            </a>
          </li>
          <li>
            <strong>${t('help.openai.step4.title')}</strong>
            <p>${t('help.openai.step4.desc')}</p>
            <code class="help-code">sk-proj-...</code>
          </li>
        </ol>

        <div class="help-note warning">
          <strong>⚠️ ${t('help.warning')}:</strong> ${t('help.openai.warning')}
        </div>
      </div>
    `;
  }

  private renderClaudeSetup(): string {
    return `
      <div class="help-section">
        <h4>${t('help.claude.subtitle')}</h4>
        <ol class="help-steps">
          <li>
            <strong>${t('help.claude.step1.title')}</strong>
            <p>${t('help.claude.step1.desc')}</p>
            <a href="https://console.anthropic.com" target="_blank" class="help-link">
              console.anthropic.com →
            </a>
          </li>
          <li>
            <strong>${t('help.claude.step2.title')}</strong>
            <p>${t('help.claude.step2.desc')}</p>
          </li>
          <li>
            <strong>${t('help.claude.step3.title')}</strong>
            <p>${t('help.claude.step3.desc')}</p>
            <a href="https://console.anthropic.com/settings/keys" target="_blank" class="help-link">
              console.anthropic.com/settings/keys →
            </a>
          </li>
          <li>
            <strong>${t('help.claude.step4.title')}</strong>
            <p>${t('help.claude.step4.desc')}</p>
            <code class="help-code">sk-ant-...</code>
          </li>
        </ol>
      </div>
    `;
  }

  private renderLMStudioSetup(): string {
    return `
      <div class="help-section">
        <h4>💻 ${t('help.lmstudio.subtitle')}</h4>
        <ol class="help-steps">
          <li>
            <strong>${t('help.lmstudio.step1.title')}</strong>
            <p>${t('help.lmstudio.step1.desc')}</p>
            <a href="https://lmstudio.ai" target="_blank" class="help-link">
              lmstudio.ai →
            </a>
          </li>
          <li>
            <strong>${t('help.lmstudio.step2.title')}</strong>
            <p>${t('help.lmstudio.step2.desc')}</p>
          </li>
          <li>
            <strong>${t('help.lmstudio.step3.title')}</strong>
            <p>${t('help.lmstudio.step3.desc')}</p>
            <code class="help-code">http://127.0.0.1:1234</code>
          </li>
          <li>
            <strong>${t('help.lmstudio.step4.title')}</strong>
            <p>${t('help.lmstudio.step4.desc')}</p>
            <ul>
              <li>Local Server URL: <code>http://127.0.0.1:1234</code></li>
              <li>Model Name: (as shown in LM Studio)</li>
            </ul>
          </li>
        </ol>

        <div class="help-note">
          <strong>✅ ${t('help.advantage')}:</strong> ${t('help.lmstudio.advantage')}
        </div>
      </div>
    `;
  }

  private renderProxyInfo(): string {
    return `
      <div class="help-section">
        <h4>${t('help.proxy.subtitle')}</h4>
        <p>${t('help.proxy.why')}</p>

        <div class="help-note">
          <strong>ℹ️ ${t('help.info')}:</strong> ${t('help.proxy.info')}
        </div>

        <h5>${t('help.proxy.current.title')}</h5>
        <p>${t('help.proxy.current.desc')}</p>
        <code class="help-code">proxy.uixray.tech</code>

        <h5>${t('help.proxy.custom.title')}</h5>
        <p>${t('help.proxy.custom.desc')}</p>
        <ol class="help-steps">
          <li>${t('help.proxy.custom.step1')}</li>
          <li>${t('help.proxy.custom.step2')}</li>
          <li>${t('help.proxy.custom.step3')}</li>
        </ol>
      </div>
    `;
  }

  private renderTroubleshooting(): string {
    return `
      <div class="help-section">
        <h4>🔧 ${t('help.troubleshooting.subtitle')}</h4>

        <div class="troubleshooting-item">
          <strong class="error-code">CORS error / Network error</strong>
          <p><strong>${t('help.troubleshooting.cause')}:</strong> ${t('help.troubleshooting.cors.cause')}</p>
          <p><strong>${t('help.troubleshooting.solution')}:</strong> ${t('help.troubleshooting.cors.solution')}</p>
        </div>

        <div class="troubleshooting-item">
          <strong class="error-code">401 Unauthorized / Invalid API key</strong>
          <p><strong>${t('help.troubleshooting.cause')}:</strong> ${t('help.troubleshooting.auth.cause')}</p>
          <p><strong>${t('help.troubleshooting.solution')}:</strong></p>
          <ul>
            <li>${t('help.troubleshooting.auth.solution1')}</li>
            <li>${t('help.troubleshooting.auth.solution2')}</li>
            <li>${t('help.troubleshooting.auth.solution3')}</li>
          </ul>
        </div>

        <div class="troubleshooting-item">
          <strong class="error-code">429 Rate limit exceeded</strong>
          <p><strong>${t('help.troubleshooting.cause')}:</strong> ${t('help.troubleshooting.ratelimit.cause')}</p>
          <p><strong>${t('help.troubleshooting.solution')}:</strong></p>
          <ul>
            <li>${t('help.troubleshooting.ratelimit.solution1')}</li>
            <li>${t('help.troubleshooting.ratelimit.solution2')}</li>
          </ul>
        </div>

        <div class="troubleshooting-item">
          <strong class="error-code">Yandex: Folder ID not found</strong>
          <p><strong>${t('help.troubleshooting.cause')}:</strong> ${t('help.troubleshooting.yandex.cause')}</p>
          <p><strong>${t('help.troubleshooting.solution')}:</strong></p>
          <ul>
            <li>${t('help.troubleshooting.yandex.solution1')}</li>
            <li>${t('help.troubleshooting.yandex.solution2')}</li>
          </ul>
        </div>

        <div class="troubleshooting-item">
          <strong class="error-code">LM Studio: Connection failed</strong>
          <p><strong>${t('help.troubleshooting.cause')}:</strong> ${t('help.troubleshooting.lmstudio.cause')}</p>
          <p><strong>${t('help.troubleshooting.solution')}:</strong></p>
          <ul>
            <li>${t('help.troubleshooting.lmstudio.solution1')}</li>
            <li>${t('help.troubleshooting.lmstudio.solution2')}</li>
            <li>${t('help.troubleshooting.lmstudio.solution3')}</li>
          </ul>
        </div>
      </div>
    `;
  }
}
