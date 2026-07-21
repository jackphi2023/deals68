import { supabase } from './supabase';

const FX_VND_PER_USD = 26000;

type DealValueRow = { ask_amount?: number | string | null; ask_currency?: string | null; revenue_currency?: string | null };

export type PublicDealValueSummary = {
  totalVnd: number;
  totalUsd: number;
  count: number;
  fxRate: number;
};

export type PublicHomepageBootstrap = {
  businessCount: number;
  investorCount: number;
  dealValue: PublicDealValueSummary;
  businesses: any[];
  investors: any[];
};

function normalizeCurrency(row: DealValueRow) {
  return String(row.ask_currency || row.revenue_currency || 'VND').toUpperCase();
}

export async function getPublicHomepageBootstrap(
  businessLimit = 6,
  investorLimit = 80,
): Promise<PublicHomepageBootstrap> {
  const { data, error } = await supabase.rpc('get_public_homepage_bootstrap', {
    max_businesses: Math.max(1, Math.min(24, Math.floor(businessLimit || 6))),
    max_investors: Math.max(1, Math.min(200, Math.floor(investorLimit || 80))),
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) || {};
  const dealValue = row.deal_value || row.dealValue || {};
  return {
    businessCount: Number(row.business_count ?? row.businessCount ?? 0),
    investorCount: Number(row.investor_count ?? row.investorCount ?? 0),
    dealValue: {
      totalVnd: Number(dealValue.total_vnd ?? dealValue.totalVnd ?? 0),
      totalUsd: Number(dealValue.total_usd ?? dealValue.totalUsd ?? 0),
      count: Number(dealValue.count ?? 0),
      fxRate: Number(dealValue.fx_rate ?? dealValue.fxRate ?? FX_VND_PER_USD),
    },
    businesses: Array.isArray(row.businesses) ? row.businesses : [],
    investors: Array.isArray(row.investors) ? row.investors : [],
  };
}

export async function getPublicDealValueSummary(): Promise<PublicDealValueSummary> {
  const { data, error } = await supabase
    .from('public_businesses_safe')
    .select('ask_amount,ask_currency,revenue_currency')
    .eq('visible', true)
    .eq('status', 'active')
    .not('public_snapshot_json', 'is', null)
    .limit(1000);

  if (error) throw error;

  let totalVnd = 0;
  let totalUsd = 0;
  for (const row of (data || []) as DealValueRow[]) {
    const amount = Number(row.ask_amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const currency = normalizeCurrency(row);
    if (currency === 'USD') {
      totalUsd += amount;
      totalVnd += amount * FX_VND_PER_USD;
    } else {
      totalVnd += amount;
      totalUsd += amount / FX_VND_PER_USD;
    }
  }

  return { totalVnd, totalUsd, count: (data || []).length, fxRate: FX_VND_PER_USD };
}
