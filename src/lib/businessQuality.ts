import type { Lang } from './i18n';

export type BusinessQualityItem = {
  key: string;
  label_vi: string;
  label_en: string;
  score: number;
  max: number;
  public?: boolean;
  verdict?: string;
  verdict_vi?: string;
  verdict_en?: string;
};

export type BusinessQualityBreakdown = {
  version?: number;
  total: number;
  auto_total?: number;
  manual_override?: boolean;
  calculated_at?: string;
  items: BusinessQualityItem[];
  flags?: string[];
  valuation?: Record<string, any>;
  counts?: Record<string, any>;
};

export const BUSINESS_QUALITY_PUBLIC_CRITERIA = [
  { key: 'profile', vi: 'Độ đầy đủ hồ sơ', en: 'Profile completeness' },
  { key: 'financial', vi: 'Chất lượng số liệu tài chính', en: 'Financial data quality' },
  { key: 'documents', vi: 'Tài liệu chứng minh', en: 'Supporting documents' },
  { key: 'images', vi: 'Hình ảnh', en: 'Images' },
  { key: 'valuation', vi: 'Định giá & độ hợp lý đề xuất', en: 'Valuation & offer reasonableness' },
  { key: 'readiness', vi: 'Mức sẵn sàng giao dịch/kết nối', en: 'Transaction/connection readiness' },
] as const;

const DEFAULT_MAX: Record<string, number> = {
  profile: 20,
  financial: 20,
  documents: 20,
  images: 5,
  valuation: 25,
  readiness: 10,
};

export function qualityPublicCriteria(lang: Lang) {
  return BUSINESS_QUALITY_PUBLIC_CRITERIA.map((item) => (lang === 'en' ? item.en : item.vi));
}

export function qualityBand(score: number | null | undefined, lang: Lang) {
  const n = Number(score);
  if (!Number.isFinite(n)) return { label: lang === 'en' ? 'Pending' : 'Đang cập nhật', cls: 'gold' };
  if (n >= 85) return { label: lang === 'en' ? 'Excellent' : 'Xuất sắc', cls: 'green' };
  if (n >= 70) return { label: lang === 'en' ? 'Good' : 'Tốt', cls: 'blue' };
  return { label: lang === 'en' ? 'Needs data' : 'Cần bổ sung', cls: 'gold' };
}

export function normalizeQualityBreakdown(raw: any, fallbackScore: any = 0): BusinessQualityBreakdown {
  const baseTotal = Math.max(0, Math.min(100, Math.round(Number(fallbackScore || raw?.total || 0) || 0)));
  const rawItems = Array.isArray(raw?.items) ? raw.items : [];
  const items = BUSINESS_QUALITY_PUBLIC_CRITERIA.map((meta) => {
    const found = rawItems.find((x: any) => x?.key === meta.key) || {};
    const max = Number(found.max ?? DEFAULT_MAX[meta.key] ?? 0);
    const score = Math.max(0, Math.min(max || 100, Math.round(Number(found.score || 0) || 0)));
    return {
      key: meta.key,
      label_vi: found.label_vi || meta.vi,
      label_en: found.label_en || meta.en,
      score,
      max,
      public: found.public !== false,
      verdict: found.verdict,
      verdict_vi: found.verdict_vi,
      verdict_en: found.verdict_en,
    };
  });

  const totalFromItems = items.reduce((sum, item) => sum + item.score, 0);
  return {
    version: Number(raw?.version || 1),
    total: raw?.total !== undefined ? Math.max(0, Math.min(100, Math.round(Number(raw.total || 0)))) : (baseTotal || totalFromItems),
    auto_total: raw?.auto_total === undefined ? undefined : Math.max(0, Math.min(100, Math.round(Number(raw.auto_total || 0)))),
    manual_override: !!raw?.manual_override,
    calculated_at: raw?.calculated_at,
    items,
    flags: Array.isArray(raw?.flags) ? raw.flags.map(String) : [],
    valuation: raw?.valuation || {},
    counts: raw?.counts || {},
  };
}

export function qualityItemLabel(item: BusinessQualityItem, lang: Lang) {
  return lang === 'en' ? item.label_en : item.label_vi;
}

export function qualityItemNote(item: BusinessQualityItem, lang: Lang) {
  if (item.key === 'valuation' && (item.verdict_vi || item.verdict_en)) {
    return lang === 'en' ? item.verdict_en : item.verdict_vi;
  }
  const pct = item.max ? Math.round((item.score / item.max) * 100) : 0;
  if (pct >= 80) return lang === 'en' ? 'Strong' : 'Tốt';
  if (pct >= 50) return lang === 'en' ? 'Partial' : 'Đạt một phần';
  return lang === 'en' ? 'Needs data' : 'Cần bổ sung';
}

export function businessQualityPublicExplanation(lang: Lang) {
  return lang === 'en'
    ? 'Business Quality Score is assessed from profile completeness, financial data quality, supporting documents, images, valuation/offer reasonableness, and transaction readiness.'
    : 'Business Quality Score được đánh giá dựa trên độ đầy đủ hồ sơ, chất lượng số liệu tài chính, tài liệu chứng minh, hình ảnh, định giá & độ hợp lý đề xuất, và mức sẵn sàng giao dịch/kết nối.';
}
