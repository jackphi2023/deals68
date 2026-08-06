import { supabase } from './supabase';

export type AdminAdvisorIntakeReviewStatus =
  | 'pending_review'
  | 'approved_awaiting_acceptance'
  | 'accepted'
  | 'rejected';

export type AdminAdvisorIntake = {
  assignment_id: string;
  business_id: string;
  authority_id: string;
  advisor_profile_id: string;
  submitted_at: string;
  review_status: AdminAdvisorIntakeReviewStatus;
  can_review: boolean;
  business: {
    public_code?: string;
    company_name?: string;
    title_vi?: string;
    title_en?: string;
    description_vi?: string;
    description_en?: string;
    country_iso2?: string;
    city?: string;
    industry?: string;
    deal_type?: string;
    status?: string;
    moderation_status?: string;
    visible?: boolean;
    owner_id?: string | null;
  };
  advisor: {
    profile_id: string;
    display_name?: string;
    email?: string;
    advisor_type?: string;
    company_name?: string;
    website?: string;
    status?: string;
    verification_status?: string;
  };
  authority: {
    listing_party_type?: string;
    declared_owner_name?: string;
    declared_principal_name?: string;
    declared_agent_name?: string;
    declared_asset_name?: string;
    declared_asset_address?: string;
    verification_status?: string;
    verification_reasons?: unknown[];
    verified_by?: string;
    verified_at?: string;
    expires_at?: string;
    report_policy?: string;
  };
  assignment: {
    status?: string;
    permissions?: string[];
    granted_by?: string;
    granted_at?: string;
    accepted_at?: string;
    expires_at?: string;
    revoked_at?: string;
    revoke_reason?: string;
    metadata?: Record<string, unknown>;
  };
};

export type AdminAdvisorIntakeQueue = {
  items: AdminAdvisorIntake[];
  access: {
    mode: 'admin_review';
    allowed_permissions: string[];
    business_mutations_enabled: boolean;
    publication_enabled: boolean;
  };
};

export type AdminAdvisorIntakeDecision = 'approve' | 'reject';

export type AdminAdvisorIntakeReviewResult = {
  assignment_id: string;
  business_id: string;
  authority_id: string;
  decision: AdminAdvisorIntakeDecision;
  authority_status: string;
  assignment_status: string;
  permissions: string[];
  expires_at?: string | null;
  can_advisor_accept: boolean;
  business_status: string;
  business_visible: boolean;
};

export async function listAdminAdvisorIntakes(): Promise<AdminAdvisorIntakeQueue> {
  const { data, error } = await supabase.rpc('d68_admin_list_advisor_business_intakes_v1');
  if (error) throw error;
  const result = (data || {}) as Partial<AdminAdvisorIntakeQueue>;
  return {
    items: Array.isArray(result.items) ? result.items : [],
    access: {
      mode: 'admin_review',
      allowed_permissions: result.access?.allowed_permissions || ['profile'],
      business_mutations_enabled: false,
      publication_enabled: false,
    },
  };
}

export async function reviewAdminAdvisorIntake(input: {
  assignmentId: string;
  decision: AdminAdvisorIntakeDecision;
  expiresAt?: string | null;
  note?: string | null;
}): Promise<AdminAdvisorIntakeReviewResult> {
  const { data, error } = await supabase.rpc(
    'd68_admin_review_advisor_business_intake_v1',
    {
      p_assignment_id: input.assignmentId,
      p_decision: input.decision,
      p_expires_at: input.decision === 'approve' ? input.expiresAt || null : null,
      p_permissions: ['profile'],
      p_note: input.note?.trim() || null,
    },
  );
  if (error) throw error;
  return data as AdminAdvisorIntakeReviewResult;
}

export const approveAdminAdvisorIntake = reviewAdminAdvisorIntake;
