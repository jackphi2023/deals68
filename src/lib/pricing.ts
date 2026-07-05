import { supabase } from './supabase';

export type PricingRole = 'business' | 'investor' | 'advisor' | 'affiliate';
export type BusinessPlan = 'standard' | 'featured';

export type PricingInput = {
  role: PricingRole;
  country: string;
  termWeeks: number;
  businessPlan?: BusinessPlan;
  promoCode?: string;
};

export type PricingResult = {
  role: PricingRole;
  country: string;
  currency: 'VND' | 'USD';
  baseWeekly: number;
  featuredWeekly: number;
  planWeekly: number;
  termWeeks: number;
  subtotal: number;
  termDiscountPct: number;
  termDiscount: number;
  promoCode?: string;
  promoDiscountPct: number;
  promoDiscount: number;
  total: number;
  proposalQuota: number;
  planLabel: string;
  notes: string[];
};

export function normaliseRole(role: string): PricingRole {
  if (role === 'market-partner') return 'affiliate';
  if (role === 'investor' || role === 'advisor' || role === 'affiliate') return role;
  return 'business';
}

export function roleLabel(role: PricingRole, lang: 'vi' | 'en' = 'vi') {
  if (role === 'business') return lang === 'en' ? 'Business' : 'Doanh nghiệp';
  if (role === 'investor') return lang === 'en' ? 'Investor' : 'Nhà đầu tư';
  if (role === 'advisor') return lang === 'en' ? 'Advisor' : 'Cố vấn';
  return lang === 'en' ? 'Market Partner' : 'Đối tác thị trường';
}

export function roleRoute(role: PricingRole) {
  return role === 'affiliate' ? 'market-partner' : role;
}

export function termDiscountForBusiness(termWeeks: number) {
  const weeks = Number(termWeeks || 0);
  return weeks >= 16 ? 20 : weeks >= 8 ? 15 : 0;
}

export function calculatePricing(input: PricingInput, promoDiscountPct = 0): PricingResult {
  const role = normaliseRole(input.role);
  const country = input.country || 'VN';
  const currency = country === 'VN' ? 'VND' : 'USD';
  const termWeeks = Math.max(1, Math.min(104, Number(input.termWeeks || 1)));
  const termMonths = Math.max(1, Math.round(termWeeks / 4));
  const businessPlan: BusinessPlan = input.businessPlan === 'featured' ? 'featured' : 'standard';
  const baseWeekly = role === 'business' ? (currency === 'VND' ? 500_000 : 20) : (currency === 'VND' ? 1_000_000 : 50);
  const featuredWeekly = Math.round(baseWeekly * 1.3);
  const planWeekly = role === 'business' && businessPlan === 'featured' ? featuredWeekly : baseWeekly;
  const subtotal = planWeekly * (role === 'business' ? termWeeks : termMonths);
  const termDiscountPct = role === 'business'
    ? termDiscountForBusiness(termWeeks)
    : termMonths >= 16 ? 20 : termMonths >= 8 ? 15 : 0;
  const termDiscount = Math.round(subtotal * termDiscountPct / 100);
  const afterTerm = subtotal - termDiscount;
  const safePromoPct = Math.max(0, Math.min(100, Number(promoDiscountPct || 0)));
  const promoDiscount = Math.round(afterTerm * safePromoPct / 100);
  const total = Math.max(0, afterTerm - promoDiscount);
  const proposalQuota = role === 'business' && businessPlan === 'featured' ? 200 : role === 'business' ? 100 : 0;
  return {
    role,
    country,
    currency,
    baseWeekly,
    featuredWeekly,
    planWeekly,
    termWeeks,
    subtotal,
    termDiscountPct,
    termDiscount,
    promoCode: input.promoCode?.trim().toUpperCase() || undefined,
    promoDiscountPct: safePromoPct,
    promoDiscount,
    total,
    proposalQuota,
    planLabel: role === 'business' && businessPlan === 'featured' ? 'Featured' : 'Standard',
    notes: [
      role === 'business' && businessPlan === 'featured' ? 'Featured visibility, 200 proposal quota, higher ranking.' : role === 'business' ? 'Standard visibility, 100 proposal quota.' : 'Membership access is activated after payment/admin approval.',
      'Country pricing matches Pricing page: Vietnam in VND, other countries in USD.',
      'Payment automation is in Beta; manual admin confirmation remains available.'
    ]
  };
}

export async function lookupPromo(code: string, role: PricingRole) {
  const value = code.trim().toUpperCase();
  if (!value) return { discountPct: 0, message: '' };
  const { data, error } = await supabase
    .from('promo_codes')
    .select('code,description,role,discount_pct,quota_total,quota_used,starts_at,ends_at,active')
    .eq('code', value)
    .eq('active', true)
    .maybeSingle();
  if (error || !data) return { discountPct: 0, message: 'Promo code is not valid or not active.' };
  if (data.role && data.role !== role) return { discountPct: 0, message: 'Promo code does not apply to this role.' };
  const now = Date.now();
  if (data.starts_at && new Date(data.starts_at).getTime() > now) return { discountPct: 0, message: 'Promo code is not active yet.' };
  if (data.ends_at && new Date(data.ends_at).getTime() < now) return { discountPct: 0, message: 'Promo code has expired.' };
  if (Number(data.quota_total || 0) > 0 && Number(data.quota_used || 0) >= Number(data.quota_total || 0)) return { discountPct: 0, message: 'Promo quota has been used up.' };
  return { discountPct: Number(data.discount_pct || 0), message: data.description || `Promo ${value} applied.` };
}
