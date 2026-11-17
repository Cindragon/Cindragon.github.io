import { en } from './en';
import { zh } from './zh';

/**
 * 網站介面語言。
 * - en：預設語言，網址沒有前綴（/、/blog/）
 * - zh：繁體中文，網址前綴 /zh/（/zh/、/zh/blog/）
 * 文章本身只有一種語言、只有一個網址（/blog/<slug>/），介面語言跟著文章語言走。
 */
export const translations = { en, zh } as const;
export type Lang = keyof typeof translations;
export type TranslationKey = keyof typeof en;

export const LANGS: Lang[] = ['en', 'zh'];

/** <html lang> / hreflang 用的語言代碼 */
export const HTML_LANG: Record<Lang, 'en' | 'zh-TW'> = { en: 'en', zh: 'zh-TW' };

/** 切換按鈕上顯示「要切換到的語言」 */
export const LANG_LABEL: Record<Lang, string> = { en: 'EN', zh: '中文' };

/** 回傳指定語言的翻譯函式，例：const t = useTranslations('zh'); t('nav.blog') → '文章' */
export function useTranslations(lang: Lang) {
  return (key: TranslationKey): string => translations[lang][key] ?? translations.en[key];
}

/** Astro.currentLocale（可能是 undefined）→ Lang */
export function toLang(locale: string | undefined): Lang {
  return locale === 'zh' ? 'zh' : 'en';
}

/** 文章語言（en / zh-TW）→ 介面語言 */
export function langFromContent(contentLang: 'en' | 'zh-TW'): Lang {
  return contentLang === 'zh-TW' ? 'zh' : 'en';
}

/** 把站內路徑加上語言前綴：localizePath('/blog/', 'zh') → '/zh/blog/' */
export function localizePath(path: string, lang: Lang): string {
  const clean = stripLangPrefix(path);
  return lang === 'en' ? clean : `/zh${clean}`;
}

/** 移除 /zh 前綴：'/zh/blog/' → '/blog/'、'/zh/' → '/' */
export function stripLangPrefix(path: string): string {
  if (path === '/zh' || path === '/zh/') return '/';
  return path.startsWith('/zh/') ? path.slice(3) : path;
}
