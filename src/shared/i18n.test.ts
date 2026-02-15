/**
 * Tests for i18n.ts
 */

import { setLanguage, getLanguage, t, translations, Language } from './i18n';

describe('i18n', () => {
  // Reset language to default before each test
  beforeEach(() => {
    setLanguage('en');
  });

  describe('setLanguage / getLanguage', () => {
    it('should set and get language', () => {
      setLanguage('ru');
      expect(getLanguage()).toBe('ru');
    });

    it('should default to English', () => {
      expect(getLanguage()).toBe('en');
    });

    it('should support all defined languages', () => {
      const languages: Language[] = ['en', 'ru', 'ja', 'zh', 'fr'];

      languages.forEach((lang) => {
        setLanguage(lang);
        expect(getLanguage()).toBe(lang);
      });
    });
  });

  describe('t (translate)', () => {
    it('should translate key to current language', () => {
      setLanguage('en');
      expect(t('tab.generate')).toBe('Generate');

      setLanguage('ru');
      expect(t('tab.generate')).toBe('Генерация');

      setLanguage('ja');
      expect(t('tab.generate')).toBe('生成');
    });

    it('should fallback to English if translation missing', () => {
      setLanguage('ru');

      // Add a mock key that only has English
      const key = 'test.key';
      (translations as any)[key] = { en: 'Test' };

      expect(t(key)).toBe('Test');

      // Clean up mock key
      delete (translations as any)[key];
    });

    it('should return key if not found', () => {
      const result = t('non.existent.key');

      expect(result).toBe('non.existent.key');
    });

    it('should log warning for missing keys', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn');

      t('missing.key');

      expect(consoleWarnSpy).toHaveBeenCalledWith('Missing translation for key: missing.key');
    });
  });

  describe('translations coverage', () => {
    it('should have all required tab translations', () => {
      const tabKeys = [
        'tab.generate',
        'tab.settings',
        'tab.data',
        'tab.rename',
        'tab.prompts',
        'tab.help',
      ];

      tabKeys.forEach((key) => {
        expect(translations[key]).toBeDefined();
        expect(translations[key].en).toBeDefined();
        expect(translations[key].ru).toBeDefined();
      });
    });

    it('should have generate panel translations', () => {
      const generateKeys = [
        'generate.provider.label',
        'generate.provider.noProvider',
        'generate.prompt.label',
        'generate.btn',
        'generate.cancel',
      ];

      generateKeys.forEach((key) => {
        expect(translations[key]).toBeDefined();
        expect(translations[key].en).toBeDefined();
      });
    });

    it('should have settings panel translations', () => {
      const settingsKeys = [
        'settings.providers.title',
        'settings.addProvider',
        'settings.save',
      ];

      settingsKeys.forEach((key) => {
        expect(translations[key]).toBeDefined();
      });
    });

    it('should have error translations', () => {
      const errorKeys = ['error.noProvider', 'error.noSelection', 'error.emptyPrompt'];

      errorKeys.forEach((key) => {
        expect(translations[key]).toBeDefined();
      });
    });

    it('should have help panel translations', () => {
      const helpKeys = [
        'help.title',
        'help.yandex.title',
        'help.openai.title',
        'help.claude.title',
        'help.lmstudio.title',
        'help.proxy.title',
        'help.troubleshooting.title',
      ];

      helpKeys.forEach((key) => {
        expect(translations[key]).toBeDefined();
        expect(translations[key].en).toBeDefined();
        expect(translations[key].ru).toBeDefined();
      });
    });
  });

  describe('translation consistency', () => {
    it('should have EN and RU translations for all keys', () => {
      const keys = Object.keys(translations);
      const missingRu: string[] = [];

      keys.forEach((key) => {
        const translation = translations[key];

        // EN and RU are required (primary languages)
        if (!translation.en) {
          throw new Error(`Key "${key}" is missing EN translation`);
        }
        if (!translation.ru) {
          missingRu.push(key);
        }
      });

      if (missingRu.length > 0) {
        throw new Error(`Missing RU translations for keys: ${missingRu.join(', ')}`);
      }
    });

    it('should not have empty translations', () => {
      const keys = Object.keys(translations);

      keys.forEach((key) => {
        const translation = translations[key];

        Object.values(translation).forEach((value) => {
          expect(value).toBeTruthy();
          expect(value.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('language selector translations', () => {
    it('should have language name translations', () => {
      const languageKeys = ['language.en', 'language.ru', 'language.ja', 'language.zh', 'language.fr'];

      languageKeys.forEach((key) => {
        expect(translations[key]).toBeDefined();

        // Each language should know its own name
        const lang = key.split('.')[1] as Language;
        expect(translations[key][lang]).toBeTruthy();
      });
    });
  });
});
