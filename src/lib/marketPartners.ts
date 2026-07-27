import { supabase } from './supabase';

export type MarketPartnerStatus = 'active' | 'suspended';
export type CommissionBasisCurrency = 'VND' | 'USD';

export const DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY = {
  customerDiscountPct: 40,
  commissionPct: 40,
  commissionBasisCurrency: 'VND' as CommissionBasisCurrency,
  commissionTier1Max: 20_000_000,
  commissionTier2Max: 50_000_000,
  commissionTier2Pct: 50,
  commissionTier3Pct: 60,
};

export type MarketPartnerRow = {
  id: string;
  profile_id?: string | null;
  source_lead_id?: string | null;
  display_name: string;
  contact_email: string;
  phone?: string | null;
  country?: string | null;
  country_iso2?: string | null;
  intro?: string | null;
  affiliate_code: string;
  customer_discount_pct: number;
  commission_pct: number;
  commission_basis_currency?: string;
  commission_tier_1_max?: number;
  commission_tier_2_max?: number;
  commission_tier_1_pct?: number;
  commission_tier_2_pct?: number;
  commission_tier_3_pct?: number;
  status: MarketPartnerStatus;
  bank_account_json?: Record<string, unknown>;
  activated_at?: string | null;
  suspended_at?: string | null;
  suspension_reason?: string | null;
  created_at: string;
  updated_at: string;
  click_count?: number;
  attribution_count?: number;
  commission_count?: number;
};

export type PartnerLeadRow = {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  intro?: string | null;
  source?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MarketPartnerCommercialPolicyInput = {
  customerDiscountPct: number;
  commissionPct: number;
  commissionBasisCurrency: CommissionBasisCurrency;
  commissionTier1Max: number;
  commissionTier2Max: number;
  commissionTier2Pct: number;
  commissionTier3Pct: number;
};

export type MarketPartnerInput = MarketPartnerCommercialPolicyInput & {
  displayName: string;
  contactEmail: string;
  phone?: string;
  country?: string;
  countryIso2?: string;
  intro?: string;
  status: MarketPartnerStatus;
  affiliateCode?: string;
  profileId?: string;
};

export type PartnerLeadConversionInput = MarketPartnerCommercialPolicyInput & {
  status: MarketPartnerStatus;
  affiliateCode?: string;
};

export type MarketPartnerDashboardMetrics = {
  click_count: number;
  signup_count: number;
  paid_transaction_count: number;
  recorded_commission: number;
  pending_commission: number;
  approved_commission: number;
  paid_commission: number;
  available_commission: number;
  currency: string;
};

export type MarketPartnerDashboardData = {
  partner: MarketPartnerRow;
  metrics: MarketPartnerDashboardMetrics;
};

export type MarketPartnerBankAccount = {
  bank_name: string;
  account_holder: string;
  account_number: string;
  branch?: string;
  swift_code?: string;
  currency?: string;
  country?: string;
  note?: string;
};

function normalizePercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100));
}

function normalizeAmount(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value * 100) / 100);
}

function normalizeIso2(value?: string) {
  const normalized = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function normalizeCode(value?: string) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '')
    .slice(0, 32);
  return normalized || null;
}

function normalizeBasisCurrency(value: string): CommissionBasisCurrency {
  return String(value || '').trim().toUpperCase() === 'USD' ? 'USD' : 'VND';
}

function asPartner(value: unknown): MarketPartnerRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Market Partner response is invalid.');
  }
  return value as MarketPartnerRow;
}

function asDashboard(value: unknown): MarketPartnerDashboardData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Market Partner dashboard response is invalid.');
  }
  const source = value as Record<string, unknown>;
  if (!source.partner || !source.metrics) {
    throw new Error('Market Partner dashboard response is incomplete.');
  }
  return source as MarketPartnerDashboardData;
}

function normalizePartnerList(value: unknown): MarketPartnerRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object') as MarketPartnerRow[];
}

function throwRpcError(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

function isPhaseOneRpcUnavailable(error: { code?: string; message?: string } | null) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return ['PGRST202', '42883', '42P01'].includes(code) ||
    message.includes('d68_admin_list_market_partners') &&
      (message.includes('not found') || message.includes('does not exist'));
}

async function updateCommercialPolicy(
  partnerId: string,
  input: MarketPartnerCommercialPolicyInput,
): Promise<MarketPartnerRow> {
  const tier1Max = normalizeAmount(input.commissionTier1Max);
  const tier2Max = normalizeAmount(input.commissionTier2Max);
  if (tier2Max <= tier1Max) {
    throw new Error('Mốc doanh thu thứ hai phải lớn hơn mốc thứ nhất.');
  }
  const { data, error } = await supabase.rpc(
    'd68_admin_update_market_partner_commercial_policy',
    {
      p_partner_id: partnerId,
      p_customer_discount_pct: normalizePercent(input.customerDiscountPct),
      p_commission_basis_currency: normalizeBasisCurrency(input.commissionBasisCurrency),
      p_commission_tier_1_max: tier1Max,
      p_commission_tier_2_max: tier2Max,
      p_commission_tier_1_pct: normalizePercent(input.commissionPct),
      p_commission_tier_2_pct: normalizePercent(input.commissionTier2Pct),
      p_commission_tier_3_pct: normalizePercent(input.commissionTier3Pct),
    },
  );
  if (error) throwRpcError(error, 'Could not update Market Partner commercial policy.');
  return asPartner(data);
}

export async function listAdminMarketPartners(): Promise<MarketPartnerRow[]> {
  const { data, error } = await supabase.rpc('d68_admin_list_market_partners');
  // Keep existing Admin modules usable before the additive migration is applied.
  // Mutation RPCs remain fail-closed; only the list call degrades to an empty module.
  if (error && isPhaseOneRpcUnavailable(error)) return [];
  if (error) throwRpcError(error, 'Could not load Market Partners.');
  return normalizePartnerList(data);
}

export async function createMarketPartner(input: MarketPartnerInput): Promise<MarketPartnerRow> {
  const { data, error } = await supabase.rpc('d68_admin_create_market_partner', {
    p_display_name: input.displayName.trim(),
    p_contact_email: input.contactEmail.trim().toLowerCase(),
    p_phone: input.phone?.trim() || null,
    p_country: input.country?.trim() || null,
    p_country_iso2: normalizeIso2(input.countryIso2),
    p_intro: input.intro?.trim() || null,
    p_customer_discount_pct: normalizePercent(input.customerDiscountPct),
    p_commission_pct: normalizePercent(input.commissionPct),
    p_status: input.status,
    p_profile_id: input.profileId?.trim() || null,
    p_affiliate_code: normalizeCode(input.affiliateCode),
    p_source_lead_id: null,
  });
  if (error) throwRpcError(error, 'Could not create Market Partner.');
  const partner = asPartner(data);
  return updateCommercialPolicy(partner.id, input);
}

export async function convertPartnerLead(
  leadId: string,
  input: PartnerLeadConversionInput,
): Promise<MarketPartnerRow> {
  const { data, error } = await supabase.rpc('d68_admin_convert_partner_lead', {
    p_lead_id: leadId,
    p_customer_discount_pct: normalizePercent(input.customerDiscountPct),
    p_commission_pct: normalizePercent(input.commissionPct),
    p_status: input.status,
    p_affiliate_code: normalizeCode(input.affiliateCode),
  });
  if (error) throwRpcError(error, 'Could not convert Market Partner lead.');
  const partner = asPartner(data);
  return updateCommercialPolicy(partner.id, input);
}

export async function updateMarketPartner(
  partnerId: string,
  input: MarketPartnerInput & { suspensionReason?: string },
): Promise<MarketPartnerRow> {
  const patch = {
    display_name: input.displayName.trim(),
    contact_email: input.contactEmail.trim().toLowerCase(),
    phone: input.phone?.trim() || null,
    country: input.country?.trim() || null,
    country_iso2: normalizeIso2(input.countryIso2),
    intro: input.intro?.trim() || null,
    customer_discount_pct: normalizePercent(input.customerDiscountPct),
    commission_pct: normalizePercent(input.commissionPct),
    status: input.status,
    suspension_reason: input.suspensionReason?.trim() || null,
  };
  const { error } = await supabase.rpc('d68_admin_update_market_partner', {
    p_partner_id: partnerId,
    p_patch: patch,
  });
  if (error) throwRpcError(error, 'Could not update Market Partner.');
  return updateCommercialPolicy(partnerId, input);
}

export async function regenerateMarketPartnerCode(
  partnerId: string,
  preferredCode?: string,
): Promise<MarketPartnerRow> {
  const { data, error } = await supabase.rpc('d68_admin_regenerate_market_partner_code', {
    p_partner_id: partnerId,
    p_preferred_code: normalizeCode(preferredCode),
  });
  if (error) throwRpcError(error, 'Could not generate a new affiliate code.');
  return asPartner(data);
}

export async function getMyMarketPartnerDashboard(): Promise<MarketPartnerDashboardData> {
  const { data, error } = await supabase.rpc('d68_get_my_market_partner_dashboard');
  if (error) throwRpcError(error, 'Could not load Market Partner dashboard.');
  return asDashboard(data);
}

export async function updateMyMarketPartnerBankAccount(
  input: MarketPartnerBankAccount,
): Promise<Record<string, unknown>> {
  const clean: MarketPartnerBankAccount = {
    bank_name: input.bank_name.trim(),
    account_holder: input.account_holder.trim(),
    account_number: input.account_number.trim(),
    branch: input.branch?.trim() || undefined,
    swift_code: input.swift_code?.trim().toUpperCase() || undefined,
    currency: input.currency?.trim().toUpperCase() || undefined,
    country: input.country?.trim() || undefined,
    note: input.note?.trim() || undefined,
  };
  const { data, error } = await supabase.rpc('d68_update_my_market_partner_bank_account', {
    p_bank_account: clean,
  });
  if (error) throwRpcError(error, 'Could not update bank account.');
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Bank account response is invalid.');
  }
  return data as Record<string, unknown>;
}
