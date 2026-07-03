export function computeBusinessQuality(b: any, criteria?: any[]) {
  const defaults = [
    ['profile_completeness', 15], ['financials_quality', 20], ['data_confidence', 15], ['deal_terms', 10],
    ['documents', 15], ['valuation_reason', 10], ['growth_margin', 10], ['admin_review', 5]
  ];
  const weights = (criteria?.length ? criteria.filter(c => c.active).map(c => [c.key, Number(c.weight)]) : defaults) as [string, number][];
  const signals: Record<string, number> = {
    profile_completeness: b.title_vi && b.industry && b.deal_type && b.highlights_vi ? 90 : 55,
    financials_quality: Number(b.revenue_2025) > 0 && Number(b.ebitda_margin) > 0 ? 85 : 45,
    data_confidence: Number(b.data_confidence || 40),
    deal_terms: Number(b.ask_amount) > 0 && Number(b.stake_pct) > 0 ? 82 : 40,
    documents: Number(b.files_count || 0) >= 3 ? 90 : Number(b.files_count || 0) > 0 ? 65 : 35,
    valuation_reason: b.investment_reason_vi || b.investment_reason_en ? 78 : 38,
    growth_margin: Number(b.ebitda_margin) >= 15 ? 85 : Number(b.ebitda_margin) > 0 ? 60 : 30,
    admin_review: b.status === 'active' ? 80 : 45,
  };
  const totalWeight = weights.reduce((s, [, w]) => s + w, 0) || 1;
  const score = Math.round(weights.reduce((s, [k, w]) => s + (signals[k] || 50) * w, 0) / totalWeight);
  return Math.max(0, Math.min(100, score));
}

export function computeFitScore(b: any, inv: any) {
  let score = 20;
  const industries = Array.isArray(inv.industries) ? inv.industries : [];
  if (industries.some((i: string) => (b.industry || '').toLowerCase().includes(i.toLowerCase().split(' ')[0]))) score += 25;
  if (Number(b.ask_amount || 0) >= Number(inv.ticket_min || 0) && (!inv.ticket_max || Number(b.ask_amount || 0) <= Number(inv.ticket_max || 0))) score += 25;
  if ((inv.deal_types || []).some((d: string) => (b.deal_type || '').toLowerCase().includes(d.toLowerCase().split('/')[0]))) score += 10;
  if (b.country_iso2 === inv.country_iso2 || inv.region === 'asia') score += 10;
  score += Math.min(10, Math.round(Number(b.quality_score || 50) / 10));
  return Math.min(100, score);
}
