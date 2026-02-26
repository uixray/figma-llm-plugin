import { en } from './en';
import { ru } from './ru';
import { ja } from './ja';
import { zh } from './zh';
import { fr } from './fr';

export type Language = 'en' | 'ru' | 'ja' | 'zh' | 'fr';

const langMaps: Record<Language, Record<string, string>> = { en, ru, ja, zh, fr };

// Build back the legacy translations format for backward compat
export const translations: Record<string, Record<Language, string>> = {};
for (const key of Object.keys(en)) {
  translations[key] = {
    en: en[key] || key,
    ru: ru[key] || en[key] || key,
    ja: ja[key] || en[key] || key,
    zh: zh[key] || en[key] || key,
    fr: fr[key] || en[key] || key,
  };
}

let currentLanguage: Language = 'en';

export function setLanguage(lang: Language): void {
  currentLanguage = lang;
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function t(key: string): string {
  const langMap = langMaps[currentLanguage] || en;
  const result = langMap[key] || en[key];
  if (result !== undefined) return result;

  // Fallback: check legacy translations object (supports runtime additions)
  const legacy = translations[key];
  if (legacy) {
    return legacy[currentLanguage] || legacy.en;
  }

  console.warn('Missing translation for key: ' + key);
  return key;
}

export function initLanguage(): void {
  // Language will be set by UI when it receives settings from sandbox
}
