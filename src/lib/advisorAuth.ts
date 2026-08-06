import { supabase } from './supabase';
import type { Lang } from './i18n';

export type AdvisorType = 'advisor' | 'broker' | 'advisor_broker';
export type AdvisorAssignmentStatus = 'pending' | 'active' | 'suspended' | 'revoked' | 'expired';

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

export type AdvisorPortfolioItem = {
  assignment_id: string;
  business_id: string;
  assignment_title?: string | null;
  status: AdvisorAssignmentStatus;
  permissions: string[];
  granted_at: string;
  accepted_at?: string | null;
  expires_at?: string | null;
  suspension_reason?: string | null;
  revoke_reason?: string | null;
  can_accept: boolean;
  can_open_context: boolean;
  authority: {
    id: string;
    party_type: string;
    verification_status: string;
    expires_at?: string | null;
  };
  business: {
    public_code?: string | null;
    slug: string;
    title_vi: string;
    title_en: string;
    company_name?: string | null;
    industry?: string | null;
    country_iso2?: string | null;
    city?: string | null;
    deal_type?: string | null;
    status?: string | null;
    moderation_status?: string | null;
    image_url?: string | null;
    hero_image_url?: string | null;
  };
};

export type AdvisorPortfolioResponse = {
  advisor_profile_id: string;
  generated_at: string;
  items: AdvisorPortfolioItem[];
};

export type AdvisorBusinessContext = {
  assignment: {
    assignment_id: string;
    business_id: string;
    assignment_title?: string | null;
    status: 'active';
    permissions: string[];
    granted_at: string;
    accepted_at: string;
    expires_at?: string | null;
    authority_id: string;
    authority_party_type: string;
    authority_verification_status: string;
    authority_expires_at?: string | null;
  };
  business: {
    id: string;
    public_code?: string | null;
    slug: string;
    company_name?: string | null;
    title_vi: string;
    title_en: string;
    industry?: string | null;
    industry_key?: string | null;
    country_iso2?: string | null;
    city?: string | null;
    city_key?: string | null;
    deal_type?: string | null;
    status?: string | null;
    moderation_status?: string | null;
    visible?: boolean | null;
    image_url?: string | null;
    hero_image_url?: string | null;
    updated_at?: string | null;
  };
  access: {
    mode: 'read_only';
    scope: 'profile';
    mutations_enabled: false;
    files_enabled: false;
    images_enabled: false;
    proposals_enabled: false;
    data_requests_enabled: false;
    payments_enabled: false;
    reports_enabled: false;
  };
};

export type AdvisorBusinessIntakePayload = {
  intakeKey: string;
  business: {
    company_name: string;
    title_vi: string;
    title_en: string;
    description_vi: string;
    description_en: string;
    country_iso2: string;
    city: string;
    city_key?: string;
    industry: string;
    industry_key?: string;
    deal_type: string;
  };
  authority: {
    declared_owner_name: string;
    declared_principal_name?: string;
    declared_agent_name?: string;
    declared_asset_name?: string;
    declared_asset_address?: string;
  };
};

export type AdvisorBusinessIntakeResult = {
  business_id: string;
  authority_id: string;
  assignment_id: string;
  business_status: 'draft';
  moderation_status: 'pending_admin_review';
  authority_status: 'pending_review';
  assignment_status: 'pending';
  idempotent_replay: boolean;
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

export async function getMyAdvisorPortfolio() {
  const { data, error } = await supabase.rpc('d68_get_my_advisor_portfolio_v1');
  if (error) throw error;
  const response = data as AdvisorPortfolioResponse | null;
  return {
    advisor_profile_id: response?.advisor_profile_id || '',
    generated_at: response?.generated_at || new Date().toISOString(),
    items: Array.isArray(response?.items) ? response.items : [],
  } as AdvisorPortfolioResponse;
}

export async function getMyAdvisorBusinessContext(businessId: string) {
  const { data, error } = await supabase.rpc('d68_get_my_advisor_business_context_v1', {
    p_business_id: businessId,
  });
  if (error) throw error;
  return data as AdvisorBusinessContext;
}

export async function acceptAdvisorAssignment(assignmentId: string) {
  const { data, error } = await supabase.rpc('d68_accept_advisor_assignment', {
    p_assignment_id: assignmentId,
  });
  if (error) throw error;
  return data as { id: string; business_id: string; status: 'active'; accepted_at: string };
}

export async function createAdvisorBusinessIntake(payload: AdvisorBusinessIntakePayload) {
  const { data, error } = await supabase.rpc('d68_create_advisor_business_intake_v1', {
    p_intake_key: payload.intakeKey,
    p_business_payload: payload.business,
    p_authority_payload: payload.authority,
  });
  if (error) throw error;
  return data as AdvisorBusinessIntakeResult;
}

export function createAdvisorIntakeKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(24);
  globalThis.crypto?.getRandomValues?.(bytes);
  const token = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return token || `advisor-intake-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
