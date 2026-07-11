import { industryKeyFromLabel } from './industryTaxonomy';

function dealKind(value: unknown) {
  const text = String(value || '').toLowerCase();
  if (
    text.includes('loan') ||
    text.includes('debt') ||
    text.includes('lending') ||
    text.includes('vay')
  ) {
    return 'lending';
  }
  if (
    text.includes('m&a') ||
    text.includes('acquisition') ||
    text.includes('sale') ||
    text.includes('transfer') ||
    text.includes('chuyển')
  ) {
    return 'ma';
  }
  if (
    text.includes('partner') ||
    text.includes('jv') ||
    text.includes('strategic')
  ) {
    return 'partnership';
  }
  return 'investment';
}

function askUsd(business: any) {
  const amount = Number(business?.ask_amount || 0);
  const currency = String(
    business?.ask_currency ||
      business?.revenue_currency ||
      'VND',
  ).toUpperCase();
  return currency === 'USD' ? amount : amount / 26_000;
}

export function computeBusinessQuality(b: any, criteria?: any[]) {
  const defaults = [
    ['profile_completeness', 15],
    ['financials_quality', 20],
    ['data_confidence', 15],
    ['deal_terms', 10],
    ['documents', 15],
    ['valuation_reason', 10],
    ['growth_margin', 10],
    ['admin_review', 5],
  ];
  const weights = (
    criteria?.length
      ? criteria
          .filter((item) => item.active)
          .map((item) => [item.key, Number(item.weight)])
      : defaults
  ) as [string, number][];

  const signals: Record<string, number> = {
    profile_completeness:
      b.title_vi && b.industry && b.deal_type && b.highlights_vi
        ? 90
        : 55,
    financials_quality:
      Number(b.revenue_2025) > 0 && Number(b.ebitda_margin) > 0
        ? 85
        : 45,
    data_confidence: Number(b.data_confidence || 40),
    deal_terms:
      Number(b.ask_amount) > 0 && Number(b.stake_pct) > 0
        ? 82
        : 40,
    documents:
      Number(b.files_count || 0) >= 3
        ? 90
        : Number(b.files_count || 0) > 0
          ? 65
          : 35,
    valuation_reason:
      b.investment_reason_vi || b.investment_reason_en ? 78 : 38,
    growth_margin:
      Number(b.ebitda_margin) >= 15
        ? 85
        : Number(b.ebitda_margin) > 0
          ? 60
          : 30,
    admin_review: b.status === 'active' ? 80 : 45,
  };

  const totalWeight =
    weights.reduce((sum, [, weight]) => sum + weight, 0) || 1;
  const score = Math.round(
    weights.reduce(
      (sum, [key, weight]) =>
        sum + (signals[key] || 50) * weight,
      0,
    ) / totalWeight,
  );

  return Math.max(0, Math.min(100, score));
}

export function computeFitScore(business: any, investor: any) {
  let score = 20;

  const businessIndustry = industryKeyFromLabel(
    business?.industry_key || business?.industry,
  );
  const investorIndustries = [
    ...(Array.isArray(investor?.industries)
      ? investor.industries
      : []),
    ...(Array.isArray(investor?.criteria?.sectors)
      ? investor.criteria.sectors
      : []),
  ]
    .map((item) => industryKeyFromLabel(item))
    .filter(Boolean);

  if (
    businessIndustry &&
    investorIndustries.includes(businessIndustry)
  ) {
    score += 25;
  }

  const ask = askUsd(business);
  const minimum = Number(investor?.ticket_min || 0);
  const maximum = Number(investor?.ticket_max || 0);
  if (
    ask > 0 &&
    ask >= minimum &&
    (!maximum || ask <= maximum)
  ) {
    score += 25;
  }

  const businessDeal = dealKind(business?.deal_type);
  const investorDeals = (
    Array.isArray(investor?.deal_types)
      ? investor.deal_types
      : []
  ).map(dealKind);
  if (investorDeals.includes(businessDeal)) {
    score += 10;
  }

  const targetCountries = [
    ...(Array.isArray(investor?.criteria?.targetCountries)
      ? investor.criteria.targetCountries
      : []),
    ...(Array.isArray(investor?.criteria?.preferredCountries)
      ? investor.criteria.preferredCountries
      : []),
  ].map((item) => String(item || '').toUpperCase());

  if (
    targetCountries.includes(
      String(business?.country_iso2 || '').toUpperCase(),
    ) ||
    (!targetCountries.length && investor?.region === 'asia')
  ) {
    score += 10;
  }

  score += Math.min(
    10,
    Math.round(Number(business?.quality_score || 50) / 10),
  );

  return Math.min(100, score);
}
