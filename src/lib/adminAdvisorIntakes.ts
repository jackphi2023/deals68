import { supabase } from './supabase';
import { downloadAuthorityEvidenceFile } from './advisorAuthorityEvidence';

export type AdminAdvisorIntakeReviewStatus =
  | 'pending_review'
  | 'approved_awaiting_acceptance'
  | 'accepted'
  | 'rejected';

export type AdminEvidenceValidationStatus = 'unreviewed' | 'valid' | 'insufficient' | 'invalid';

export type AdminAuthorityEvidence = {
  evidence_id: string;
  document_type: string;
  original_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_bucket: string;
  storage_path: string;
  note?: string | null;
  submitted_at?: string | null;
  validation_status: AdminEvidenceValidationStatus;
  validation_note?: string | null;
  validated_by?: string | null;
  validated_at?: string | null;
  replaces_evidence_id?: string | null;
  superseded_by_evidence_id?: string | null;
  superseded_at?: string | null;
};

export type AdminAuthorityReviewEvent = {
  event_id: string;
  event_type: string;
  actor_role: string;
  actor_profile_id?: string | null;
  evidence_id?: string | null;
  rereview_id?: string | null;
  note?: string | null;
  note_visible_to_advisor?: boolean;
  event_data?: Record<string, unknown>;
  created_at: string;
};

export type AdminAuthorityRereview = {
  rereview_id: string;
  cycle_no: number;
  status: 'pending' | 'approved' | 'rejected';
  started_by: string;
  started_at: string;
  reason: string;
  previous_expires_at?: string | null;
  decision_by?: string | null;
  decided_at?: string | null;
  decision_note?: string | null;
  new_expires_at?: string | null;
};

export type AdminEvidenceValidationSummary = {
  unreviewed: number;
  valid: number;
  insufficient: number;
  invalid: number;
};

export type AdminAuthorityAttention = {
  code: 'rereview_pending' | 'expired' | 'expiry_7d' | 'expiry_14d' | 'expiry_30d' | 'none' | string;
  rank: number;
  severity: 'critical' | 'high' | 'medium' | 'notice' | 'none' | string;
  needs_attention: boolean;
  authority_expires_at?: string | null;
  days_remaining?: number | null;
  recommended_action?: 'review_rereview' | 'start_rereview' | 'monitor' | 'none' | string;
};

export type AdminAdvisorIntake = {
  assignment_id: string;
  business_id: string;
  authority_id: string;
  advisor_profile_id: string;
  submitted_at: string;
  review_status: AdminAdvisorIntakeReviewStatus;
  can_review: boolean;
  can_request_evidence?: boolean;
  can_validate_evidence?: boolean;
  can_start_rereview?: boolean;
  can_review_rereview?: boolean;
  evidence_count?: number;
  total_evidence_count?: number;
  evidence_validation_summary?: AdminEvidenceValidationSummary;
  evidence?: AdminAuthorityEvidence[];
  review_history?: AdminAuthorityReviewEvent[];
  current_rereview?: AdminAuthorityRereview | null;
  authority_lifecycle_status?: string;
  attention?: AdminAuthorityAttention;
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
  attention_summary?: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    notice: number;
  };
  access: {
    mode: 'admin_review';
    allowed_permissions: string[];
    business_mutations_enabled: boolean;
    publication_enabled: boolean;
    authority_evidence_enabled?: boolean;
    evidence_download_enabled?: boolean;
    evidence_request_enabled?: boolean;
    evidence_validation_enabled?: boolean;
    replacement_evidence_enabled?: boolean;
    authority_rereview_enabled?: boolean;
    admin_rereview_queue_enabled?: boolean;
    authority_expiry_alerts_enabled?: boolean;
    external_notification_delivery_enabled?: boolean;
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
  const { data, error } = await supabase.rpc('d68_admin_list_advisor_business_intakes_v4');
  if (error) throw error;
  const result = (data || {}) as Partial<AdminAdvisorIntakeQueue>;
  return {
    items: Array.isArray(result.items) ? result.items.map((item) => ({
      ...item,
      evidence: Array.isArray(item.evidence) ? item.evidence.map((evidence) => ({
        ...evidence,
        validation_status: evidence.validation_status || 'unreviewed',
      })) : [],
      review_history: Array.isArray(item.review_history) ? item.review_history : [],
      evidence_count: Number(item.evidence_count || 0),
      total_evidence_count: Number(item.total_evidence_count || item.evidence_count || 0),
      evidence_validation_summary: item.evidence_validation_summary || { unreviewed: 0, valid: 0, insufficient: 0, invalid: 0 },
      current_rereview: item.current_rereview || null,
      attention: item.attention || { code: 'none', rank: 99, severity: 'none', needs_attention: false, recommended_action: 'none' },
    })) : [],
    attention_summary: {
      total: Number(result.attention_summary?.total || 0),
      critical: Number(result.attention_summary?.critical || 0),
      high: Number(result.attention_summary?.high || 0),
      medium: Number(result.attention_summary?.medium || 0),
      notice: Number(result.attention_summary?.notice || 0),
    },
    access: {
      mode: 'admin_review',
      allowed_permissions: result.access?.allowed_permissions || ['profile'],
      business_mutations_enabled: false,
      publication_enabled: false,
      authority_evidence_enabled: true,
      evidence_download_enabled: true,
      evidence_request_enabled: true,
      evidence_validation_enabled: true,
      replacement_evidence_enabled: true,
      authority_rereview_enabled: true,
      admin_rereview_queue_enabled: true,
      authority_expiry_alerts_enabled: true,
      external_notification_delivery_enabled: false,
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

export async function requestAdminAdvisorAuthorityEvidence(input: {
  assignmentId: string;
  note: string;
}) {
  const { data, error } = await supabase.rpc('d68_admin_request_advisor_authority_evidence_v2', {
    p_assignment_id: input.assignmentId,
    p_note: input.note.trim(),
  });
  if (error) throw error;
  return data as {
    review_event_id: string;
    rereview_id?: string | null;
    assignment_id: string;
    authority_id: string;
    status: 'evidence_requested';
    business_status: string;
    business_visible: boolean;
    business_mutations_enabled: false;
  };
}

export async function validateAdminAdvisorAuthorityEvidence(input: {
  evidenceId: string;
  validationStatus: Exclude<AdminEvidenceValidationStatus, 'unreviewed'>;
  note?: string | null;
  requestReplacement?: boolean;
}) {
  const { data, error } = await supabase.rpc('d68_admin_validate_advisor_authority_evidence_v1', {
    p_evidence_id: input.evidenceId,
    p_validation_status: input.validationStatus,
    p_note: input.note?.trim() || null,
    p_request_replacement: Boolean(input.requestReplacement),
  });
  if (error) throw error;
  return data as {
    evidence_id: string;
    validation_status: Exclude<AdminEvidenceValidationStatus, 'unreviewed'>;
    validated_at: string;
    request_replacement: boolean;
    review_event_id: string;
    replacement_event_id?: string | null;
    business_status: string;
    business_visible: boolean;
    business_mutations_enabled: false;
  };
}

export async function startAdminAdvisorAuthorityRereview(input: {
  assignmentId: string;
  note: string;
}) {
  const { data, error } = await supabase.rpc('d68_admin_start_advisor_authority_rereview_v1', {
    p_assignment_id: input.assignmentId,
    p_note: input.note.trim(),
  });
  if (error) throw error;
  return data as {
    rereview_id: string;
    assignment_id: string;
    authority_id: string;
    cycle_no: number;
    authority_status: 'pending_review';
    assignment_status: string;
    can_upload_evidence: true;
    business_status: string;
    business_visible: boolean;
    business_mutations_enabled: false;
    context_access_suspended_by_authority: true;
  };
}

export async function reviewAdminAdvisorAuthorityRereview(input: {
  rereviewId: string;
  decision: AdminAdvisorIntakeDecision;
  expiresAt?: string | null;
  note?: string | null;
}) {
  const { data, error } = await supabase.rpc('d68_admin_review_advisor_authority_rereview_v1', {
    p_rereview_id: input.rereviewId,
    p_decision: input.decision,
    p_expires_at: input.decision === 'approve' ? input.expiresAt || null : null,
    p_note: input.note?.trim() || null,
  });
  if (error) throw error;
  return data as {
    rereview_id: string;
    assignment_id: string;
    authority_id: string;
    decision: AdminAdvisorIntakeDecision;
    authority_status: string;
    assignment_status: string;
    permissions: ['profile'];
    expires_at?: string | null;
    business_status: string;
    business_visible: boolean;
    business_mutations_enabled: false;
    publication_enabled: false;
  };
}

export async function downloadAdminAuthorityEvidence(item: AdminAuthorityEvidence) {
  return downloadAuthorityEvidenceFile({
    bucket: item.storage_bucket,
    path: item.storage_path,
    fileName: item.original_name,
  });
}

export const approveAdminAdvisorIntake = reviewAdminAdvisorIntake;
