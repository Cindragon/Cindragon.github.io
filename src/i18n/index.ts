import { en } from './en';
import { zh } from './zh';

export const translations = { en, zh } as const;
export type Lang = keyof typeof translations;
export type TranslationKey = keyof typeof en;

export function t(key: TranslationKey, lang: Lang = 'en'): string {
  return translations[lang][key] ?? key;
}

export function getLangFromUrl(url: URL): Lang {
  const path = url.pathname;
  if (path.startsWith('/zh/')) return 'zh';
  return 'en';
}
