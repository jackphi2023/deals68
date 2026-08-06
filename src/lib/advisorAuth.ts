import { supabase } from './supabase';
import type { Lang } from './i18n';

export type AdvisorType = 'advisor' | 'broker' | 'advisor_broker';

export type AdvisorSignupPayload = {
  userId: string;
  email: string;
  signupNonce: string;
  profile: {
    username: string;
    display_name: string;
    country_iso2: string;
    language_code: Lang;
    timezone: string;
    phone_country_iso2: string;
    phone: string;
  };
  advisor: {
    advisor_type: AdvisorType;
    title: string;
    company_name?: string;
    website?: string;
    introduction?: string;
    expertise?: string[];
  };
};

export type AdvisorAccountRow = {
  id: string;
  profile_id: string;
  advisor_type: AdvisorType;
  title?: string | null;
  company_name?: string | null;
  website?: string | null;
  status: 'pending' | 'active' | 'suspended' | 'rejected';
  verification_status: 'pending' | 'verified' | 'rejected';
  payload?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  suspension_reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function normalizeAdvisorOtp(value: string) {
  return value.replace(/\D/g, '').slice(0, 6);
}

export function safeAdvisorUsername(email: string, displayName: string) {
  const fromEmail = email.split('@')[0] || '';
  const fromName = displayName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.');
  const normalized = (fromEmail || fromName || 'advisor')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 42);
  return normalized.length >= 3 ? normalized : `advisor.${normalized || 'user'}`.slice(0, 42);
}

export async function createAdvisorSignup(payload: AdvisorSignupPayload) {
  const { data, error } = await supabase.rpc('d68_create_advisor_signup_v1', {
    p_user_uuid: payload.userId,
    p_user_email: payload.email,
    p_signup_nonce: payload.signupNonce,
    p_profile_payload: payload.profile,
    p_advisor_payload: payload.advisor,
  });
  if (error) throw error;
  return data as {
    profile_id: string;
    advisor_profile_id: string;
    profile_status: string;
    advisor_status: string;
    verification_status: string;
  };
}

export async function completeAdvisorEmailVerification() {
  const { data, error } = await supabase.rpc('d68_mark_advisor_email_verified_v1');
  if (error) throw error;
  return data as {
    profile_id: string;
    profile_status: string;
    dashboard_login_enabled: boolean;
    advisor_status: string;
    verification_status: string;
  };
}

export async function getMyAdvisorAccount(profileId: string) {
  const { data, error } = await supabase
    .from('advisor_profiles')
    .select('id,profile_id,advisor_type,title,company_name,website,status,verification_status,payload,metadata,suspension_reason,created_at,updated_at')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) throw error;
  return data as AdvisorAccountRow | null;
}

export function safeAdvisorNext(raw: string | null, lang: Lang) {
  const fallback = lang === 'en' ? '/en/dashboard/advisor' : '/dashboard/advisor';
  if (!raw) return fallback;
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded === '/dashboard/advisor' || decoded.startsWith('/dashboard/advisor/')) return decoded;
    if (decoded === '/en/dashboard/advisor' || decoded.startsWith('/en/dashboard/advisor/')) return decoded;
  } catch {
    return fallback;
  }
  return fallback;
}
