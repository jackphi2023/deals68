import type { Lang } from './i18n';
export function T(lang: Lang, vi: string, en: string) {
  return lang === 'en' ? en : vi;
}
