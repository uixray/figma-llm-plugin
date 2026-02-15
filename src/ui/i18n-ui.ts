import { Language, t, setLanguage, getLanguage, initLanguage } from '../shared/i18n';

/**
 * UI i18n helper
 * Обрабатывает переводы для UI элементов
 */
export class I18nUI {
  constructor() {
    initLanguage();
  }

  /**
   * Инициализация - применить переводы ко всем элементам с data-i18n
   */
  init(): void {
    this.updateAll();
    this.setupLanguageSelector();
  }

  /**
   * Обновить все элементы с data-i18n
   */
  updateAll(): void {
    // Обновляем все элементы с атрибутом data-i18n
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.getAttribute('data-i18n');
      if (key) {
        const translation = t(key);

        // Обновляем textContent или placeholder в зависимости от типа элемента
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          if (element.placeholder) {
            element.placeholder = translation;
          }
        } else {
          element.textContent = translation;
        }
      }
    });

    // Обновляем data-i18n-placeholder атрибуты
    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      const key = element.getAttribute('data-i18n-placeholder');
      if (key && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
        element.placeholder = t(key);
      }
    });

    // Обновляем data-i18n-html атрибуты (содержат HTML, например списки)
    document.querySelectorAll('[data-i18n-html]').forEach((element) => {
      const key = element.getAttribute('data-i18n-html');
      if (key) {
        const translation = t(key);
        element.innerHTML = translation;
      }
    });
  }

  /**
   * Настройка селектора языка
   */
  private setupLanguageSelector(): void {
    const languageSelect = document.getElementById('language-select') as HTMLSelectElement;

    if (languageSelect) {
      // Устанавливаем текущий язык
      languageSelect.value = getLanguage();

      // Обработчик изменения языка
      languageSelect.addEventListener('change', (e) => {
        const newLang = (e.target as HTMLSelectElement).value as Language;
        this.changeLanguage(newLang);
      });
    }
  }

  /**
   * Изменить язык
   */
  changeLanguage(lang: Language): void {
    setLanguage(lang);
    this.updateAll();

    // Показываем уведомление
    this.showNotification(t('notify.settingsSaved'), 'success');
  }

  /**
   * Показать уведомление
   */
  private showNotification(message: string, level: 'success' | 'error' | 'warning' | 'info'): void {
    const event = new CustomEvent('show-notification', {
      detail: { message, level },
    });
    window.dispatchEvent(event);
  }

  /**
   * Получить перевод (для использования в JS)
   */
  translate(key: string): string {
    return t(key);
  }
}

// Экспортируем singleton instance
export const i18n = new I18nUI();
