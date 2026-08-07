import { supabase } from './supabase';

export type AdvisorAuthorityEvidenceType =
  | 'authorization_letter'
  | 'mandate'
  | 'ownership_proof'
  | 'identity'
  | 'other';

export type AdvisorAuthorityEvidenceValidationStatus =
  | 'unreviewed'
  | 'valid'
  | 'insufficient'
  | 'invalid';

export type AdvisorAuthorityLifecycleStatus =
  | 'initial_pending'
  | 'rereview_pending'
  | 'verified_current'
  | 'expiring_soon'
  | 'expired'
  | 'rejected'
  | string;

export type AdvisorAuthorityEvidence = {
  evidence_id: string;
  document_type: AdvisorAuthorityEvidenceType;
  original_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_bucket: string;
  storage_path: string;
  note?: string | null;
  submitted_at?: string | null;
  validation_status: AdvisorAuthorityEvidenceValidationStatus;
  validated_at?: string | null;
  replaces_evidence_id?: string | null;
  superseded_by_evidence_id?: string | null;
  superseded_at?: string | null;
};

export type AdvisorAuthorityReviewEvent = {
  event_id: string;
  event_type:
    | 'intake_created'
    | 'evidence_submitted'
    | 'evidence_requested'
    | 'evidence_validated'
    | 'evidence_replacement_requested'
    | 'authority_approved'
    | 'authority_rejected'
    | 'authority_rereview_started'
    | 'authority_rereview_approved'
    | 'authority_rereview_rejected';
  actor_role: 'advisor' | 'admin' | 'system';
  evidence_id?: string | null;
  rereview_id?: string | null;
  note?: string | null;
  created_at: string;
};

export type AdvisorAuthorityRereview = {
  rereview_id: string;
  cycle_no: number;
  status: 'pending' | 'approved' | 'rejected';
  started_at: string;
  reason: string;
  previous_expires_at?: string | null;
  decided_at?: string | null;
  new_expires_at?: string | null;
};

export type AdvisorAuthorityReview = {
  assignment_id: string;
  business_id: string;
  authority_id: string;
  assignment_status: string;
  authority_status: string;
  authority_expires_at?: string | null;
  authority_lifecycle_status: AdvisorAuthorityLifecycleStatus;
  can_upload: boolean;
  evidence: AdvisorAuthorityEvidence[];
  review_history: AdvisorAuthorityReviewEvent[];
  current_rereview?: AdvisorAuthorityRereview | null;
  access: {
    bucket: string;
    max_current_files: number;
    max_file_size_bytes: number;
    allowed_mime_types: string[];
    immutable_after_submit: boolean;
    replacement_upload_enabled: boolean;
    business_mutations_enabled: false;
  };
};

export async function getMyAuthorityReview(assignmentId: string): Promise<AdvisorAuthorityReview> {
  const { data, error } = await supabase.rpc('d68_get_my_authority_review_v2', {
    p_assignment_id: assignmentId,
  });
  if (error) throw error;
  const result = data as AdvisorAuthorityReview;
  return {
    ...result,
    evidence: Array.isArray(result?.evidence) ? result.evidence.map((item) => ({
      ...item,
      validation_status: item.validation_status || 'unreviewed',
    })) : [],
    review_history: Array.isArray(result?.review_history) ? result.review_history : [],
    current_rereview: result?.current_rereview || null,
  };
}

export async function uploadAdvisorAuthorityEvidence(input: {
  assignmentId: string;
  documentType: AdvisorAuthorityEvidenceType;
  file: File;
  note?: string | null;
  replacesEvidenceId?: string | null;
}) {
  const { data: allocation, error: allocationError } = await supabase.rpc(
    'd68_advisor_begin_authority_evidence_v2',
    {
      p_assignment_id: input.assignmentId,
      p_document_type: input.documentType,
      p_original_name: input.file.name,
      p_mime_type: input.file.type,
      p_file_size_bytes: input.file.size,
      p_note: input.note?.trim() || null,
      p_replaces_evidence_id: input.replacesEvidenceId || null,
    },
  );
  if (allocationError) throw allocationError;

  const bucket = allocation?.storage_bucket as string;
  const path = allocation?.storage_path as string;
  const evidenceId = allocation?.evidence_id as string;
  if (!bucket || !path || !evidenceId) throw new Error('Authority evidence allocation is incomplete.');

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, input.file, {
      contentType: input.file.type,
      upsert: false,
      cacheControl: '3600',
    });
  if (uploadError) throw uploadError;

  const { data: completed, error: completeError } = await supabase.rpc(
    'd68_advisor_complete_authority_evidence_v2',
    { p_evidence_id: evidenceId },
  );
  if (completeError) throw completeError;
  return completed as {
    evidence_id: string;
    status: 'submitted';
    submitted_at: string;
    authority_status: string;
    rereview_id?: string | null;
    replaces_evidence_id?: string | null;
    business_mutations_enabled: false;
    idempotent_replay: boolean;
  };
}

export async function downloadAuthorityEvidenceFile(input: {
  bucket: string;
  path: string;
  fileName: string;
}) {
  const { data, error } = await supabase.storage.from(input.bucket).download(input.path);
  if (error) throw error;
  const objectUrl = URL.createObjectURL(data);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = input.fileName || 'authority-evidence';
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
