import { supabase } from './supabase';
import type { Lang } from './i18n';
import { T } from './labelsBase';
import { industryKeyFromLabel } from './industryTaxonomy';

export type Currency = 'VND' | 'USD';
export type ValuationConfig = {
  version: number;
  params: {
    version?: number;
    w_ebitda: number;
    w_revenue: number;
    ebitda_margin_floor: number;
    spread_low: number;
    spread_high: number;
    usd_vnd: number;
    growth_cap: number;
  };
  industry: Record<string, { ebitda: number; revenue: number }>;
  country: Record<string, number>;
  growth_curve: { max: number | null; factor: number }[];
  size_bands: { max_usd: number | null; factor: number }[];
};

export type ValuationInput = {
  revenueYear?: number;
  revenueMonth?: number;
  ebitdaMargin?: number;
  growthPct?: number;
  industryKey?: string;
  industry?: string;
  countryKey?: string;
  currency?: Currency;
  offerStakePct?: number;
  offerAmount?: number;
};

export type ValuationResult = {
  low: number;
  mid: number;
  high: number;
  method: 'blend' | 'revenue_only';
  currency: Currency;
  revenueYear: number;
  ebitda: number;
  adjE: number;
  adjR: number;
  evFromEbitda: number;
  evFromRevenue: number;
  self?: number;
  verdict?: 'low_of' | 'in_range' | 'above';
  pctAbove?: number;
  configVersion: number;
  industryKey: string;
  countryFactor: number;
  growthFactor: number;
  sizeFactor: number;
};

export const DEFAULT_VALUATION_CONFIG: ValuationConfig = {
  version: 1,
  params: {
    version: 1,
    w_ebitda: 0.70,
    w_revenue: 0.30,
    ebitda_margin_floor: 5,
    spread_low: 0.15,
    spread_high: 0.15,
    usd_vnd: 25000,
    growth_cap: 50
  },
  industry: {
    agriculture: { ebitda: 5.5, revenue: 0.90 },
    automobile: { ebitda: 5.5, revenue: 0.65 },
    beauty_personal_care: { ebitda: 7.5, revenue: 1.20 },
    construction_materials: { ebitda: 5.0, revenue: 0.60 },
    chemicals: { ebitda: 6.5, revenue: 1.10 },
    education_training: { ebitda: 8.0, revenue: 1.50 },
    energy_utilities: { ebitda: 7.0, revenue: 1.30 },
    entertainment_leisure: { ebitda: 6.5, revenue: 1.20 },
    finance: { ebitda: 8.0, revenue: 2.00 },
    food_beverage: { ebitda: 5.5, revenue: 0.80 },
    healthcare: { ebitda: 9.0, revenue: 2.00 },
    hotels_resorts: { ebitda: 8.0, revenue: 2.20 },
    it_software: { ebitda: 11.0, revenue: 2.80 },
    manufacturing: { ebitda: 6.0, revenue: 0.85 },
    media_advertising: { ebitda: 7.0, revenue: 1.30 },
    real_estate: { ebitda: 9.0, revenue: 3.00 },
    retail: { ebitda: 5.5, revenue: 0.60 },
    services: { ebitda: 7.0, revenue: 1.20 },
    transportation_logistics: { ebitda: 6.0, revenue: 0.85 },
    travel: { ebitda: 6.5, revenue: 1.20 },
    ecommerce: { ebitda: 8.5, revenue: 1.40 },
    textiles_apparel: { ebitda: 5.0, revenue: 0.70 },
    seafood_export: { ebitda: 5.0, revenue: 0.70 }
  },
  country: { VN: 1.00, SG: 1.25, US: 1.35, KR: 1.15, JP: 1.20, HK: 1.20, CN: 1.05, TH: 1.00, CA: 1.25, AU: 1.25, DE: 1.20, CZ: 1.05, OTHER: 1.00 },
  growth_curve: [
    { max: 0, factor: 0.85 },
    { max: 5, factor: 0.95 },
    { max: 15, factor: 1.05 },
    { max: 30, factor: 1.15 },
    { max: 50, factor: 1.25 },
    { max: null, factor: 1.35 }
  ],
  size_bands: [
    { max_usd: 400000, factor: 0.80 },
    { max_usd: 2000000, factor: 0.90 },
    { max_usd: 10000000, factor: 1.00 },
    { max_usd: 50000000, factor: 1.10 },
    { max_usd: null, factor: 1.20 }
  ]
};

function factorFromCurve(x: number, curve: { max: number | null; factor: number }[]) {
  for (const b of curve) if (b.max === null || x < b.max) return Number(b.factor || 1);
  return Number(curve[curve.length - 1]?.factor || 1);
}

function safeConfig(row: any): ValuationConfig {
  if (!row) return DEFAULT_VALUATION_CONFIG;
  return {
    version: Number(row.version || row.params?.version || DEFAULT_VALUATION_CONFIG.version),
    params: { ...DEFAULT_VALUATION_CONFIG.params, ...(row.params || {}), version: Number(row.version || row.params?.version || DEFAULT_VALUATION_CONFIG.version) },
    industry: { ...DEFAULT_VALUATION_CONFIG.industry, ...(row.industry || {}) },
    country: { ...DEFAULT_VALUATION_CONFIG.country, ...(row.country || {}) },
    growth_curve: Array.isArray(row.growth_curve) && row.growth_curve.length ? row.growth_curve : DEFAULT_VALUATION_CONFIG.growth_curve,
    size_bands: Array.isArray(row.size_bands) && row.size_bands.length ? row.size_bands : DEFAULT_VALUATION_CONFIG.size_bands
  };
}

export async function getActiveValuationConfig(): Promise<ValuationConfig> {
  try {
    const { data, error } = await supabase
      .from('valuation_config')
      .select('*')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return DEFAULT_VALUATION_CONFIG;
    return safeConfig(data);
  } catch {
    return DEFAULT_VALUATION_CONFIG;
  }
}

export function valuate(input: ValuationInput, cfg: ValuationConfig = DEFAULT_VALUATION_CONFIG): ValuationResult | null {
  const p = cfg.params;
  const industryKey = input.industryKey || industryKeyFromLabel(input.industry) || '';
  const ind = cfg.industry[industryKey];
  const revenueYear = Number(input.revenueYear || 0) || (Number(input.revenueMonth || 0) * 12);
  if (!ind || !Number.isFinite(revenueYear) || revenueYear <= 0) return null;
  const currency = String(input.currency || 'VND').toUpperCase() === 'USD' ? 'USD' : 'VND';
  const countryKey = String(input.countryKey || 'VN').toUpperCase();
  const margin = Number(input.ebitdaMargin ?? 0) || 0;
  const growth = Math.min(Number(input.growthPct ?? 0) || 0, Number(p.growth_cap || 50));
  const ebitda = revenueYear * margin / 100;
  const revUSD = currency === 'USD' ? revenueYear : revenueYear / Number(p.usd_vnd || 25000);
  const countryFactor = Number(cfg.country[countryKey] ?? cfg.country.OTHER ?? cfg.country.VN ?? 1);
  const growthFactor = factorFromCurve(growth, cfg.growth_curve);
  const sizeFactor = factorFromCurve(revUSD, cfg.size_bands.map((b) => ({ max: b.max_usd, factor: b.factor })));
  const adjE = ind.ebitda * countryFactor * growthFactor * sizeFactor;
  const adjR = ind.revenue * countryFactor * growthFactor * sizeFactor;
  const evFromEbitda = ebitda * adjE;
  const evFromRevenue = revenueYear * adjR;
  const useEbitda = margin >= Number(p.ebitda_margin_floor || 5) && ebitda > 0;
  const evMid = useEbitda ? Number(p.w_ebitda || 0.7) * evFromEbitda + Number(p.w_revenue || 0.3) * evFromRevenue : evFromRevenue;
  const mid = Math.max(0, evMid);
  const low = mid * (1 - Number(p.spread_low || 0.15));
  const high = mid * (1 + Number(p.spread_high || 0.15));
  let self: number | undefined;
  let verdict: ValuationResult['verdict'];
  let pctAbove: number | undefined;
  const stake = Number(input.offerStakePct || 0);
  const offer = Number(input.offerAmount || 0);
  if (stake > 0 && offer > 0) {
    self = offer / (stake / 100);
    if (self < low) verdict = 'low_of';
    else if (self <= high) verdict = 'in_range';
    else { verdict = 'above'; pctAbove = Math.round((self - high) / Math.max(high, 1) * 100); }
  }
  return { low, mid, high, method: useEbitda ? 'blend' : 'revenue_only', currency, revenueYear, ebitda, adjE, adjR, evFromEbitda, evFromRevenue, self, verdict, pctAbove, configVersion: cfg.version, industryKey, countryFactor, growthFactor, sizeFactor };
}

export function valuationInputFromBusiness(b: any): ValuationInput {
  const financialInput = b?.financial_input && typeof b.financial_input === 'object' ? b.financial_input : {};
  return {
    revenueYear: Number(b?.revenue_2025 || b?.revenue_year || 0),
    revenueMonth: Number(b?.revenue_month || financialInput.revenue_month || 0),
    ebitdaMargin: Number(b?.ebitda_margin || 0),
    growthPct: Number(b?.growth_pct ?? financialInput.growth_pct ?? 0),
    industryKey: b?.industry_key || industryKeyFromLabel(b?.industry),
    industry: b?.industry,
    countryKey: b?.country_iso2 || 'VN',
    currency: String(b?.revenue_currency || 'VND').toUpperCase() === 'USD' ? 'USD' : 'VND',
    offerStakePct: Number(b?.offer_stake_pct ?? b?.stake_pct ?? 0),
    offerAmount: Number(b?.offer_amount ?? b?.ask_amount ?? 0)
  };
}

export function formatValuationMoney(value: any, currency: any, lang: Lang) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return T(lang, 'Đang cập nhật', 'Pending');
  const cur = String(currency || 'VND').toUpperCase();
  const usd = cur === 'USD' ? amount : amount / DEFAULT_VALUATION_CONFIG.params.usd_vnd;
  const vnd = cur === 'VND' ? amount : amount * DEFAULT_VALUATION_CONFIG.params.usd_vnd;
  if (lang === 'en') {
    if (usd >= 1_000_000) return `US$${(usd / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`;
    if (usd >= 1_000) return `US$${(usd / 1_000).toLocaleString('en-US', { maximumFractionDigits: 0 })}K`;
    return `US$${Math.round(usd).toLocaleString('en-US')}`;
  }
  if (vnd >= 1_000_000_000) return `${(vnd / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ VNĐ`;
  if (vnd >= 1_000_000) return `${(vnd / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} triệu VNĐ`;
  return `${Math.round(vnd).toLocaleString('vi-VN')} VNĐ`;
}

export function valuationVerdictMessage(lang: Lang, r: ValuationResult | null) {
  if (!r?.self || !r.verdict) return T(lang, 'Định giá tham chiếu đã tính từ dữ liệu doanh thu, ngành, quốc gia, biên EBITDA và tăng trưởng.', 'The benchmark is calculated from revenue, industry, country, EBITDA margin and growth.');
  if (r.verdict === 'low_of') return T(lang, 'Có thể đang định giá thấp hơn tham chiếu — dễ hút nhà đầu tư nhưng có thể thiệt cho doanh nghiệp.', 'Your implied valuation may be below benchmark — attractive to investors but potentially unfavorable to the business.');
  if (r.verdict === 'in_range') return T(lang, 'Định giá đang nằm trong khoảng tham chiếu ngành/quốc gia.', 'Your implied valuation is within the industry/country benchmark range.');
  return T(lang, `Đang cao hơn tham chiếu khoảng ${r.pctAbove || 0}% — cân nhắc điều chỉnh offer hoặc bổ sung dữ liệu chứng minh.`, `Around ${r.pctAbove || 0}% above benchmark — consider adjusting the offer or adding supporting data.`);
}

export const VALUATION_DISCLAIMER_VI = 'Đây là mức định giá tham chiếu do hệ thống ước tính theo dữ liệu bạn cung cấp và mặt bằng ngành. Không phải thẩm định giá chính thức và không thay thế tư vấn tài chính, pháp lý độc lập.';
export const VALUATION_DISCLAIMER_EN = 'This is an indicative benchmark estimated from your inputs and industry averages. It is not a formal valuation and does not replace independent financial or legal advice.';
