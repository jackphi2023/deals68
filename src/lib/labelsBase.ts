import type { Lang } from './i18n';

const EXACT_COPY_UPDATES: Record<string, string> = {
  'Đang tải dữ liệu thật...': 'Đang tải…',
  'Loading live data...': 'Loading…',
};

export function T(lang: Lang, vi: string, en: string) {
  const selected = lang === 'en' ? en : vi;
  return EXACT_COPY_UPDATES[selected] || selected;
}
