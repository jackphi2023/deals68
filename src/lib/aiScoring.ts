export type BusinessForScoring = {
  industry?: string;
  country_iso2?: string;
  revenue_2025?: number;
  ebitda_margin?: number;
  ask_amount?: number;
  deal_type?: string;
  data_confidence?: number;
  quality_score?: number;
};

export type InvestorForScoring = {
  industries?: string[];
  country_iso2?: string;
  ticket_min?: number;
  ticket_max?: number;
  deal_types?: string[];
  criteria?: any;
};

export function computeDealFitScore(b: BusinessForScoring, inv: InvestorForScoring) {
  let score = 0;
  if (inv.industries?.some((x) => (b.industry || '').toLowerCase().includes(String(x).toLowerCase()))) score += 25;
  if (!inv.country_iso2 || inv.country_iso2 === b.country_iso2) score += 15;
  if (!inv.deal_types?.length || inv.deal_types.includes(b.deal_type || '')) score += 15;
  const ask = Number(b.ask_amount || 0);
  if ((!inv.ticket_min || ask >= inv.ticket_min) && (!inv.ticket_max || ask <= inv.ticket_max)) score += 20;
  score += Math.min(15, Math.max(0, Number(b.data_confidence || 0) / 100 * 15));
  score += Math.min(10, Math.max(0, Number(b.quality_score || 0) / 100 * 10));
  return Math.round(Math.min(100, score));
}

export function estimateBusinessQuality(payload: any) {
  const checks = [payload.title_vi, payload.title_en, payload.industry, payload.revenue_2025, payload.ebitda_margin, payload.ask_amount, payload.stake_pct, payload.investment_reason_vi, payload.highlights_vi, payload.financial_input?.data_source];
  const completed = checks.filter(Boolean).length;
  const fileBonus = Math.min(15, Number(payload.file_count || 0) * 5);
  return Math.min(100, Math.round((completed / checks.length) * 85 + fileBonus));
}

export function valuationReasonableness(revenue: number, ebitdaMargin: number, ask: number, stakePct: number) {
  const ebitda = revenue * (ebitdaMargin / 100);
  const implied = stakePct ? ask / (stakePct / 100) : ask;
  const fair = ebitda > 0 ? ebitda * 6 : revenue * 1.1;
  const ratio = fair ? implied / fair : 1;
  if (ratio > 1.35) return 'High';
  if (ratio < 0.7) return 'Low';
  return 'Fair';
}
