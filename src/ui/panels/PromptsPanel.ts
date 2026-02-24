import { sendToSandbox } from '../../shared/messages';
import { SavedPromptsLibrary, SavedPrompt, PluginSettings } from '../../shared/types';
import { generateUniqueId } from '../../shared/utils';
import { PROVIDER_CONFIGS } from '../../shared/providers';
import { getAllProviderConfigs } from '../../shared/provider-converter';

/**
 * UI панель для управления библиотекой сохранённых промптов.
 * Использует inline-форму вместо window.prompt() (который заблокирован в Figma iframe).
 */
export class PromptsPanel {
  private library: SavedPromptsLibrary | null = null;
  private settings: PluginSettings | null = null;
  private selectedCategory: string | null = null;
  private searchQuery: string = '';
  /** Промпт, который сейчас редактируется (null = создание нового) */
  private editingPrompt: SavedPrompt | null = null;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Настройка обработчиков событий
   */
  private setupEventListeners(): void {
    // Поиск промптов
    const searchInput = document.getElementById('prompts-search') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.searchQuery = target.value.toLowerCase();
      this.renderPromptsList();
    });

    // Фильтр по категории
    const categoryFilter = document.getElementById(
      'prompts-category-filter'
    ) as HTMLSelectElement;
    categoryFilter?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.selectedCategory = target.value === 'all' ? null : target.value;
      this.renderPromptsList();
    });

    // Кнопка "+ New"
    document.getElementById('prompts-new-btn')?.addEventListener('click', () => {
      this.showNewPromptForm();
    });

    // Кнопки формы
    document.getElementById('prompt-form-cancel')?.addEventListener('click', () => {
      this.hideForm();
    });

    document.getElementById('prompt-form-save')?.addEventListener('click', () => {
      this.saveFromForm();
    });

    // Close modal button
    document.getElementById('close-prompts-modal')?.addEventListener('click', () => {
      this.closeModal();
    });

    // Close on overlay click (click outside the container)
    const overlay = document.getElementById('prompts-panel');
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeModal();
      }
    });
  }

  /**
   * Close the prompts modal
   */
  private closeModal(): void {
    const modal = document.getElementById('prompts-panel');
    if (modal) {
      modal.style.display = 'none';
    }
    this.hideForm();
  }

  /**
   * Load plugin settings (for provider dropdown)
   */
  loadSettings(settings: PluginSettings): void {
    this.settings = settings;
    this.populateProviderDropdown();
  }

  /**
   * Populate the provider dropdown in the prompt form
   */
  private populateProviderDropdown(): void {
    const select = document.getElementById('prompt-form-provider') as HTMLSelectElement;
    if (!select || !this.settings) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">Any (use active provider)</option>';

    // V2.1: Combine Legacy providers and Provider Groups
    const legacyConfigs = this.settings.providerConfigs || [];
    const groups = this.settings.providerGroups || [];
    const allConfigs = getAllProviderConfigs(legacyConfigs, groups);
    const enabledConfigs = allConfigs.filter(c => c.enabled);

    enabledConfigs.forEach(config => {
      const baseConfig = PROVIDER_CONFIGS.find(p => p.id === config.baseConfigId);
      const opt = document.createElement('option');
      opt.value = config.id;
      const icon = this.getProviderIcon(baseConfig?.provider || '');
      opt.textContent = `${icon} ${config.name}`;
      select.appendChild(opt);
    });

    if (currentValue) select.value = currentValue;
  }

  private getProviderIcon(provider: string): string {
    const icons: Record<string, string> = {
      openai: '🤖', yandex: '🇷🇺', claude: '🔮', gemini: '♊',
      mistral: '🌬️', groq: '⚡', cohere: '🧠', lmstudio: '💻',
    };
    return icons[provider] || '';
  }

  /**
   * Загрузка библиотеки промптов
   */
  loadLibrary(library: SavedPromptsLibrary): void {
    this.library = library;
    this.renderCategoryFilter();
    this.renderPromptsList();
  }

  /**
   * Отрисовка фильтра категорий
   */
  private renderCategoryFilter(): void {
    if (!this.library) return;

    const filterSelect = document.getElementById(
      'prompts-category-filter'
    ) as HTMLSelectElement;
    if (!filterSelect) return;

    // Очищаем
    filterSelect.innerHTML = '<option value="all">All Categories</option>';

    // Добавляем категории
    this.library.categories.forEach((category) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      filterSelect.appendChild(option);
    });
  }

  /**
   * Отрисовка списка промптов
   */
  private renderPromptsList(): void {
    if (!this.library) return;

    const container = document.getElementById('prompts-list');
    if (!container) return;

    // Фильтруем промпты
    let filteredPrompts = this.library.prompts;

    // Фильтр по категории
    if (this.selectedCategory) {
      filteredPrompts = filteredPrompts.filter((p) => p.category === this.selectedCategory);
    }

    // Фильтр по поисковому запросу
    if (this.searchQuery) {
      filteredPrompts = filteredPrompts.filter(
        (p) =>
          p.name.toLowerCase().includes(this.searchQuery) ||
          p.content.toLowerCase().includes(this.searchQuery) ||
          p.tags?.some((tag) => tag.toLowerCase().includes(this.searchQuery))
      );
    }

    // Сортируем по количеству использований (популярные сначала)
    filteredPrompts.sort((a, b) => b.usageCount - a.usageCount);

    // Очищаем контейнер
    container.innerHTML = '';

    if (filteredPrompts.length === 0) {
      container.innerHTML = '<div class="prompts-empty">No prompts found</div>';
      return;
    }

    // Создаём карточки промптов
    filteredPrompts.forEach((prompt) => {
      const card = this.createPromptCard(prompt);
      container.appendChild(card);
    });
  }

  /**
   * Создать карточку промпта
   */
  private createPromptCard(prompt: SavedPrompt): HTMLElement {
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.dataset.promptId = prompt.id;

    // Заголовок
    const header = document.createElement('div');
    header.className = 'prompt-card-header';
    header.innerHTML = `
      <div class="prompt-card-title">${this.escapeHtml(prompt.name)}</div>
      <div class="prompt-card-actions">
        <button class="btn-icon" data-action="use" title="Use this prompt">✓</button>
        <button class="btn-icon" data-action="edit" title="Edit">✎</button>
        <button class="btn-icon" data-action="delete" title="Delete">×</button>
      </div>
    `;

    // Контент (preview)
    const content = document.createElement('div');
    content.className = 'prompt-card-content';
    const preview =
      prompt.content.length > 150
        ? prompt.content.substring(0, 150) + '...'
        : prompt.content;
    content.textContent = preview;

    // Метаинформация
    const meta = document.createElement('div');
    meta.className = 'prompt-card-meta';

    const categoryBadge = `<span class="badge badge-category">${prompt.category || 'General'}</span>`;
    const usageCount = `<span class="usage-count">Used ${prompt.usageCount} times</span>`;
    const tags = prompt.tags
      ? prompt.tags.map((tag) => `<span class="badge badge-tag">${tag}</span>`).join('')
      : '';

    let providerBadge = '';
    if (prompt.preferredProviderId && this.settings) {
      const allConfigs = getAllProviderConfigs(
        this.settings.providerConfigs || [],
        this.settings.providerGroups || []
      );
      const config = allConfigs.find(c => c.id === prompt.preferredProviderId);
      if (config) {
        const baseConfig = PROVIDER_CONFIGS.find(p => p.id === config.baseConfigId);
        const icon = this.getProviderIcon(baseConfig?.provider || '');
        providerBadge = `<span class="badge badge-tag">${icon} ${config.name}</span>`;
      }
    }

    meta.innerHTML = `${categoryBadge} ${providerBadge} ${tags} ${usageCount}`;

    card.appendChild(header);
    card.appendChild(content);
    card.appendChild(meta);

    // Обработчики кнопок
    card.querySelector('[data-action="use"]')?.addEventListener('click', () => {
      this.usePrompt(prompt);
    });

    card.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
      this.editPrompt(prompt);
    });

    card.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      this.deletePrompt(prompt);
    });

    return card;
  }

  /**
   * Использовать промпт (вставить в поле генерации)
   */
  private usePrompt(prompt: SavedPrompt): void {
    // Вставляем промпт в поле генерации
    const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
    if (promptInput) {
      promptInput.value = prompt.content;
      promptInput.focus();
    }

    // Вставляем системный промпт (если есть)
    const systemPromptInput = document.getElementById('system-prompt-input') as HTMLTextAreaElement;
    if (systemPromptInput && prompt.systemPrompt) {
      systemPromptInput.value = prompt.systemPrompt;
    }

    // Если у промпта есть предпочитаемый провайдер — выбираем его
    if (prompt.preferredProviderId) {
      const providerSelect = document.getElementById('generate-provider-select') as HTMLSelectElement;
      if (providerSelect) {
        providerSelect.value = prompt.preferredProviderId;
      }
    }

    // Переключаемся на вкладку Generate
    const generateTab = document.querySelector('[data-tab="generate"]') as HTMLElement;
    if (generateTab) {
      generateTab.click();
    }

    // Увеличиваем счётчик использования
    prompt.usageCount++;
    sendToSandbox({
      type: 'update-prompt-usage',
      promptId: prompt.id,
    });

    // Закрываем модал
    this.closeModal();

    this.showSuccess(`Prompt "${prompt.name}" loaded`);
  }

  // =========================================================================
  // Inline форма (вместо window.prompt() который заблокирован в Figma iframe)
  // =========================================================================

  /**
   * Показать форму для создания нового промпта
   */
  private showNewPromptForm(): void {
    this.editingPrompt = null;

    // Берём текущий промпт из поля ввода (если есть)
    const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
    const currentPrompt = promptInput?.value || '';

    // Берём текущий системный промпт
    const systemPromptInput = document.getElementById('system-prompt-input') as HTMLTextAreaElement;
    const currentSystemPrompt = systemPromptInput?.value || '';

    // Берём текущий выбранный провайдер из Generate panel
    const providerSelect = document.getElementById('generate-provider-select') as HTMLSelectElement;
    const currentProvider = providerSelect?.value || '';

    this.populateProviderDropdown();
    this.populateForm('', currentPrompt, 'General', '', currentProvider, currentSystemPrompt);
    this.showForm();
  }

  /**
   * Редактировать промпт — заполняем форму данными
   */
  private editPrompt(promptData: SavedPrompt): void {
    this.editingPrompt = promptData;
    this.populateProviderDropdown();
    this.populateForm(
      promptData.name,
      promptData.content,
      promptData.category || 'General',
      promptData.tags?.join(', ') || '',
      promptData.preferredProviderId || '',
      promptData.systemPrompt || ''
    );
    this.showForm();
  }

  /**
   * Заполнить форму значениями
   */
  private populateForm(name: string, content: string, category: string, tags: string, providerId?: string, systemPrompt?: string): void {
    const nameInput = document.getElementById('prompt-form-name') as HTMLInputElement;
    const contentInput = document.getElementById('prompt-form-content') as HTMLTextAreaElement;
    const systemPromptInput = document.getElementById('prompt-form-system-prompt') as HTMLTextAreaElement;
    const categorySelect = document.getElementById('prompt-form-category') as HTMLSelectElement;
    const tagsInput = document.getElementById('prompt-form-tags') as HTMLInputElement;
    const providerSelect = document.getElementById('prompt-form-provider') as HTMLSelectElement;

    if (nameInput) nameInput.value = name;
    if (contentInput) contentInput.value = content;
    if (systemPromptInput) systemPromptInput.value = systemPrompt || '';
    if (categorySelect) categorySelect.value = category;
    if (tagsInput) tagsInput.value = tags;
    if (providerSelect) providerSelect.value = providerId || '';

    // Фокус на имя
    setTimeout(() => nameInput?.focus(), 100);
  }

  /**
   * Показать форму
   */
  private showForm(): void {
    const form = document.getElementById('prompt-edit-form');
    if (form) {
      form.style.display = 'block';
    }

    // Обновляем текст кнопки
    const saveBtn = document.getElementById('prompt-form-save');
    if (saveBtn) {
      saveBtn.textContent = this.editingPrompt ? 'Update Prompt' : 'Save Prompt';
    }
  }

  /**
   * Скрыть форму
   */
  private hideForm(): void {
    const form = document.getElementById('prompt-edit-form');
    if (form) {
      form.style.display = 'none';
    }
    this.editingPrompt = null;
  }

  /**
   * Сохранить из формы (создание или обновление)
   */
  private saveFromForm(): void {
    const nameInput = document.getElementById('prompt-form-name') as HTMLInputElement;
    const contentInput = document.getElementById('prompt-form-content') as HTMLTextAreaElement;
    const systemPromptInput = document.getElementById('prompt-form-system-prompt') as HTMLTextAreaElement;
    const categorySelect = document.getElementById('prompt-form-category') as HTMLSelectElement;
    const tagsInput = document.getElementById('prompt-form-tags') as HTMLInputElement;
    const providerSelect = document.getElementById('prompt-form-provider') as HTMLSelectElement;

    const name = nameInput?.value.trim();
    const content = contentInput?.value.trim();
    const systemPrompt = systemPromptInput?.value.trim() || undefined;
    const category = categorySelect?.value || 'General';
    const tagsRaw = tagsInput?.value || '';
    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    const preferredProviderId = providerSelect?.value || undefined;

    // Валидация
    if (!name) {
      this.showError('Please enter a prompt name');
      nameInput?.focus();
      return;
    }
    if (!content) {
      this.showError('Please enter prompt content');
      contentInput?.focus();
      return;
    }

    if (this.editingPrompt) {
      // Обновляем существующий
      const updatedPrompt: SavedPrompt = {
        ...this.editingPrompt,
        name,
        content,
        systemPrompt,
        category,
        tags,
        preferredProviderId,
        updatedAt: Date.now(),
      };

      sendToSandbox({
        type: 'save-prompt',
        prompt: updatedPrompt,
      });

      this.showSuccess(`Prompt "${name}" updated`);
    } else {
      // Создаём новый
      const newPrompt: SavedPrompt = {
        id: generateUniqueId(),
        name,
        content,
        systemPrompt,
        category,
        tags,
        preferredProviderId,
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      sendToSandbox({
        type: 'save-prompt',
        prompt: newPrompt,
      });

      this.showSuccess(`Prompt "${name}" saved`);
    }

    this.hideForm();
  }

  /**
   * Удалить промпт
   */
  private deletePrompt(prompt: SavedPrompt): void {
    // Вместо confirm() используем простое удаление с уведомлением
    // (confirm() тоже может быть заблокирован в Figma iframe)
    sendToSandbox({
      type: 'delete-prompt',
      promptId: prompt.id,
    });

    this.showSuccess(`Prompt "${prompt.name}" deleted`);
  }

  /**
   * Обработка результата сохранения промпта
   */
  handlePromptSaved(library: SavedPromptsLibrary): void {
    this.loadLibrary(library);
  }

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
   * Показать успешное сообщение
   */
  private showSuccess(message: string): void {
    const event = new CustomEvent('show-notification', {
      detail: { message, level: 'success' },
    });
    window.dispatchEvent(event);
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
