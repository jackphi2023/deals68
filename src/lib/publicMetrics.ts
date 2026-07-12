import { supabase } from './supabase';

const FX_VND_PER_USD = 26000;

type DealValueRow = { ask_amount?: number | string | null; ask_currency?: string | null; revenue_currency?: string | null };

export type PublicDealValueSummary = {
  totalVnd: number;
  totalUsd: number;
  count: number;
  fxRate: number;
};

function normalizeCurrency(row: DealValueRow) {
  return String(row.ask_currency || row.revenue_currency || 'VND').toUpperCase();
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
