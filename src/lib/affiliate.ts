import { supabase } from './supabase';

const REFERRAL_STORAGE_KEY = 'd68_affiliate_ref_v1';
const VISITOR_STORAGE_KEY = 'd68_affiliate_visitor_v1';
const REFERRAL_COOKIE = 'd68_affiliate_ref';
const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type StoredAffiliateReferral = {
  code: string;
  clickId: string;
  capturedAt: string;
  expiresAt: string;
};

export type AffiliateCheckoutQuoteInput = {
  role: 'business' | 'investor';
  countryIso2: string;
  businessPlan?: 'standard' | 'featured';
  termUnits: number;
  investorPlan?: 'standard' | 'premium';
};

export type AffiliateCheckoutQuote = {
  valid: boolean;
  payable?: boolean;
  reason?: string;
  affiliate?: {
    partner_id: string;
    affiliate_code: string;
    click_id: string;
    customer_discount_pct: number;
    discount_amount: number;
    eligible_amount: number;
    net_paid_amount: number;
    currency: string;
    commission_policy: Record<string, unknown>;
    policy_version: string;
  };
  price?: Record<string, any>;
};

let capturePromise: Promise<StoredAffiliateReferral | null> | null = null;

function normalizeCode(value: unknown) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '')
    .slice(0, 32);
  return /^[A-Z0-9][A-Z0-9_-]{3,31}$/.test(normalized) ? normalized : '';
}

function normalizeClickId(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : '';
}

function storageGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Cookie fallback remains available when localStorage is blocked.
  }
}

function randomVisitorToken() {
  const existing = storageGet(VISITOR_STORAGE_KEY);
  if (existing && existing.length >= 16 && existing.length <= 200) return existing;
  const token = typeof globalThis.crypto?.randomUUID === 'function'
    ? `${globalThis.crypto.randomUUID()}-${globalThis.crypto.randomUUID()}`
    : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  storageSet(VISITOR_STORAGE_KEY, token);
  return token;
}

function cookieReferral(): Pick<StoredAffiliateReferral, 'code' | 'clickId'> | null {
  if (typeof document === 'undefined') return null;
  const value = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${REFERRAL_COOKIE}=`));
  if (!value) return null;
  const [rawCode, rawClickId] = decodeURIComponent(
    value.slice(REFERRAL_COOKIE.length + 1),
  ).split('|');
  const code = normalizeCode(rawCode);
  const clickId = normalizeClickId(rawClickId);
  return code && clickId ? { code, clickId } : null;
}

function writeReferralCookie(record: StoredAffiliateReferral) {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const value = encodeURIComponent(`${record.code}|${record.clickId}`);
  document.cookie = `${REFERRAL_COOKIE}=${value}; Max-Age=${Math.floor(
    ATTRIBUTION_TTL_MS / 1000,
  )}; Path=/; SameSite=Lax${secure}`;
}

function publicReferralPath(pathname: string) {
  const privatePrefixes = [
    '/admin',
    '/dashboard',
    '/market-partner/dashboard',
    '/checkout',
    '/payment',
    '/data-room',
    '/messages',
    '/notifications',
    '/support',
  ];
  return !privatePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function referrerHost() {
  try {
    return document.referrer ? new URL(document.referrer).hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

function removeRefFromAddressBar(url: URL) {
  url.searchParams.delete('ref');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function storeReferral(code: string, clickId: string) {
  const capturedAt = new Date().toISOString();
  const record: StoredAffiliateReferral = {
    code,
    clickId,
    capturedAt,
    expiresAt: new Date(Date.now() + ATTRIBUTION_TTL_MS).toISOString(),
  };
  storageSet(REFERRAL_STORAGE_KEY, JSON.stringify(record));
  writeReferralCookie(record);
  return record;
}

async function recordAffiliateClick(code: string, source: 'ref_link' | 'manual_code') {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) return null;

  const { data, error } = await supabase.rpc('d68_record_affiliate_click', {
    p_affiliate_code: normalizedCode,
    p_landing_path: url.pathname || '/',
    p_referrer_host: referrerHost(),
    p_utm_source: url.searchParams.get('utm_source') || (source === 'manual_code' ? 'registration' : null),
    p_utm_medium: url.searchParams.get('utm_medium') || source,
    p_utm_campaign: url.searchParams.get('utm_campaign'),
    p_visitor_token: randomVisitorToken(),
  });

  const clickId = normalizeClickId(data);
  if (error || !clickId) return null;
  return storeReferral(normalizedCode, clickId);
}

export function getStoredAffiliateReferral(): StoredAffiliateReferral | null {
  if (typeof window === 'undefined') return null;
  const raw = storageGet(REFERRAL_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StoredAffiliateReferral;
      const code = normalizeCode(parsed.code);
      const clickId = normalizeClickId(parsed.clickId);
      const expiresAt = Date.parse(String(parsed.expiresAt || ''));
      if (code && clickId && Number.isFinite(expiresAt) && expiresAt > Date.now()) {
        return {
          code,
          clickId,
          capturedAt: parsed.capturedAt,
          expiresAt: parsed.expiresAt,
        };
      }
    } catch {
      // Fall through to the cookie record.
    }
  }

  const cookie = cookieReferral();
  if (!cookie) return null;
  const capturedAt = new Date().toISOString();
  return {
    ...cookie,
    capturedAt,
    expiresAt: new Date(Date.now() + ATTRIBUTION_TTL_MS).toISOString(),
  };
}

export async function captureAffiliateReferralFromCurrentPage(): Promise<StoredAffiliateReferral | null> {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  if (!publicReferralPath(url.pathname)) return getStoredAffiliateReferral();

  const code = normalizeCode(url.searchParams.get('ref'));
  if (!code) return getStoredAffiliateReferral();
  if (capturePromise) return capturePromise;

  capturePromise = recordAffiliateClick(code, 'ref_link')
    .then((record) => {
      removeRefFromAddressBar(url);
      return record || getStoredAffiliateReferral();
    })
    .finally(() => {
      capturePromise = null;
    });

  return capturePromise;
}

export async function applyAffiliateCodeForCheckout(code: string) {
  if (capturePromise) await capturePromise.catch(() => null);
  capturePromise = recordAffiliateClick(code, 'manual_code').finally(() => {
    capturePromise = null;
  });
  return capturePromise;
}

export async function getAffiliateCheckoutQuote(
  referral: StoredAffiliateReferral,
  input: AffiliateCheckoutQuoteInput,
): Promise<AffiliateCheckoutQuote> {
  const { data, error } = await supabase.rpc('d68_get_affiliate_checkout_quote', {
    p_affiliate_code: referral.code,
    p_click_id: referral.clickId,
    p_role: input.role,
    p_country_iso2: input.countryIso2,
    p_business_plan: input.businessPlan || null,
    p_term_units: input.termUnits,
    p_investor_plan: input.investorPlan || null,
  });
  if (error) throw new Error(error.message || 'Could not load affiliate quote.');
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, reason: 'invalid_quote' };
  }
  return data as AffiliateCheckoutQuote;
}

export async function getAffiliateReferralForSignup() {
  if (capturePromise) await capturePromise.catch(() => null);
  const current = getStoredAffiliateReferral();
  if (current) return current;
  return captureAffiliateReferralFromCurrentPage().catch(() => null);
}
