import { supabase } from './supabase';
import { cachedPublicQuery, invalidatePublicQueryCache } from './publicQueryCache';

const FX_VND_PER_USD = 26000;
const PUBLIC_DEAL_VALUE_CACHE_KEY = 'public:metrics:deal-value';
const PUBLIC_DEAL_VALUE_CACHE_TTL_MS = 30_000;

type DealValueRow = {
  ask_amount?: number | string | null;
  ask_currency?: string | null;
  revenue_currency?: string | null;
};

export type PublicDealValueSummary = {
  totalVnd: number;
  totalUsd: number;
  count: number;
  fxRate: number;
};

function normalizeCurrency(row: DealValueRow) {
  return String(row.ask_currency || row.revenue_currency || 'VND').toUpperCase();
}

async function fetchPublicDealValueSummary(): Promise<PublicDealValueSummary> {
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

  return {
    totalVnd,
    totalUsd,
    count: (data || []).length,
    fxRate: FX_VND_PER_USD,
  };
}

export function invalidatePublicDealValueSummary() {
  invalidatePublicQueryCache(PUBLIC_DEAL_VALUE_CACHE_KEY);
}

export function getPublicDealValueSummary(): Promise<PublicDealValueSummary> {
  return cachedPublicQuery(
    PUBLIC_DEAL_VALUE_CACHE_KEY,
    fetchPublicDealValueSummary,
    PUBLIC_DEAL_VALUE_CACHE_TTL_MS,
  );
}
