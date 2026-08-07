import { supabase } from './supabase';

export type AdvisorAuthorityEvidenceType =
  | 'authorization_letter'
  | 'mandate'
  | 'ownership_proof'
  | 'identity'
  | 'other';

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
};

export type AdvisorAuthorityReviewEvent = {
  event_id: string;
  event_type: 'intake_created' | 'evidence_submitted' | 'evidence_requested' | 'authority_approved' | 'authority_rejected';
  actor_role: 'advisor' | 'admin' | 'system';
  evidence_id?: string | null;
  note?: string | null;
  created_at: string;
};

export type AdvisorAuthorityReview = {
  assignment_id: string;
  business_id: string;
  authority_id: string;
  assignment_status: string;
  authority_status: string;
  can_upload: boolean;
  evidence: AdvisorAuthorityEvidence[];
  review_history: AdvisorAuthorityReviewEvent[];
  access: {
    bucket: string;
    max_files: number;
    max_file_size_bytes: number;
    allowed_mime_types: string[];
    immutable_after_submit: boolean;
    business_mutations_enabled: false;
  };
};

export async function getMyAuthorityReview(assignmentId: string): Promise<AdvisorAuthorityReview> {
  const { data, error } = await supabase.rpc('d68_get_my_authority_review_v1', {
    p_assignment_id: assignmentId,
  });
  if (error) throw error;
  const result = data as AdvisorAuthorityReview;
  return {
    ...result,
    evidence: Array.isArray(result?.evidence) ? result.evidence : [],
    review_history: Array.isArray(result?.review_history) ? result.review_history : [],
  };
}

export async function uploadAdvisorAuthorityEvidence(input: {
  assignmentId: string;
  documentType: AdvisorAuthorityEvidenceType;
  file: File;
  note?: string | null;
}) {
  const { data: allocation, error: allocationError } = await supabase.rpc(
    'd68_advisor_begin_authority_evidence_v1',
    {
      p_assignment_id: input.assignmentId,
      p_document_type: input.documentType,
      p_original_name: input.file.name,
      p_mime_type: input.file.type,
      p_file_size_bytes: input.file.size,
      p_note: input.note?.trim() || null,
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
    'd68_advisor_complete_authority_evidence_v1',
    { p_evidence_id: evidenceId },
  );
  if (completeError) throw completeError;
  return completed as {
    evidence_id: string;
    status: 'submitted';
    submitted_at: string;
    authority_status: string;
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
