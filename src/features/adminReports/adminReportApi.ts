import { downloadBusinessFile } from '../../lib/data';
import { supabase } from '../../lib/supabase';
import type {
  AdminListingAuthority,
  AdminReportAlert,
  AdminReportBusinessFile,
  AdminReportData,
  AdminReportRequest,
  ReportArtifact,
} from './adminReportTypes';

const AUTHORITY_ALERT_CODES = [
  'BROKER_AUTHORITY_MISSING',
  'AUTHORITY_SCOPE_INSUFFICIENT',
  'AUTHORITY_DOCUMENT_EXPIRED',
  'OWNER_IDENTITY_MISMATCH',
  'ASSET_IDENTIFIER_MISMATCH',
  'ADMIN_REVIEW_REQUIRED',
];

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function safeFileName(value: unknown, fallback: string) {
  const name = text(value) || fallback;
  return name.replace(/[\\/:*?"<>|]+/g, '-');
}

async function ensureNoError(error: any) {
  if (error) throw error;
}

export async function loadAdminReportData(): Promise<AdminReportData> {
  const [requestsResult, alertsResult, authorityResult, businessResult, profileResult, fileResult] =
    await Promise.all([
      supabase
        .from('ai_report_business_requests')
        .select(
          'id,business_id,actor_profile_id,request_key,status,report_id,reserved_at,reserved_until,completed_at,failed_at,error_code,metadata,created_at,updated_at',
        )
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('ai_report_alerts')
        .select(
          'id,business_id,report_job_id,business_file_id,preflight_check_id,alert_code,severity,status,title_vi,title_en,detail_json,blocks_report,requires_admin_review,visible_to_business,requires_report_notice,report_notice_vi,report_notice_en,resolved_by,resolved_at,created_at,updated_at',
        )
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('business_listing_authority')
        .select(
          'id,business_id,listing_party_type,declared_owner_name,declared_principal_name,declared_agent_name,declared_asset_name,declared_asset_address,verification_status,verification_reasons,authority_document_ids,verified_by,verified_at,expires_at,report_policy,report_notice_vi,report_notice_en,created_at,updated_at',
        )
        .order('updated_at', { ascending: false })
        .limit(1000),
      supabase
        .from('businesses')
        .select(
          'id,owner_id,public_code,slug,company_name_private,title_vi,title_en,industry,status,visible',
        )
        .order('created_at', { ascending: false })
        .limit(2500),
      supabase
        .from('profiles')
        .select('id,display_name,username,email,role')
        .limit(3000),
      supabase
        .from('business_files')
        .select(
          'id,business_id,owner_id,file_name,display_name,file_path,file_type,category,review_status,created_at,updated_at',
        )
        .order('created_at', { ascending: false })
        .limit(3000),
    ]);

  const firstError =
    requestsResult.error ||
    alertsResult.error ||
    authorityResult.error ||
    businessResult.error ||
    profileResult.error ||
    fileResult.error;
  if (firstError) throw firstError;

  return {
    requests: (requestsResult.data || []) as AdminReportRequest[],
    alerts: (alertsResult.data || []) as AdminReportAlert[],
    authorities: (authorityResult.data || []) as AdminListingAuthority[],
    businesses: businessResult.data || [],
    profiles: profileResult.data || [],
    files: (fileResult.data || []) as AdminReportBusinessFile[],
  };
}

export function reportArtifactOf(request: AdminReportRequest): ReportArtifact | null {
  const metadata = objectOf(request.metadata);
  const path = text(
    metadata.pdf_path ||
      metadata.report_path ||
      metadata.storage_path ||
      metadata.output_path,
  );
  if (!path || path.includes('://')) return null;

  const bucket =
    text(metadata.pdf_bucket || metadata.report_bucket || metadata.storage_bucket) ||
    'business-reports-private';
  const fallback = request.report_id
    ? `Deals68-${request.report_id}.pdf`
    : `Deals68-${request.id}.pdf`;
  const fileName = safeFileName(
    metadata.file_name || metadata.pdf_file_name || metadata.report_file_name,
    fallback,
  );
  return { bucket, path, fileName };
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function downloadAdminReport(request: AdminReportRequest) {
  const artifact = reportArtifactOf(request);
  if (!artifact) throw new Error('Báo cáo chưa có file PDF hợp lệ để tải.');
  const { data, error } = await supabase.storage
    .from(artifact.bucket)
    .download(artifact.path);
  if (error || !data) throw error || new Error('Không tải được PDF báo cáo.');
  saveBlob(data, artifact.fileName);
}

export async function downloadAdminEvidenceFile(file: AdminReportBusinessFile) {
  await downloadBusinessFile(file);
}

export async function writeAdminReportAudit(
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  detail: Record<string, unknown> = {},
) {
  const { error } = await supabase.from('audit_logs').insert({
    actor_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    detail,
  });
  if (error) throw error;
}

export async function requestAlertSupplement(
  alert: AdminReportAlert,
  adminId: string,
) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('ai_report_alerts')
    .update({
      status: 'acknowledged',
      visible_to_business: true,
      updated_at: now,
    })
    .eq('id', alert.id);
  await ensureNoError(error);
  await writeAdminReportAudit(adminId, 'request_ai_report_supplement', 'ai_report_alert', alert.id, {
    business_id: alert.business_id,
    alert_code: alert.alert_code,
  });
}

export async function resolveAdminReportAlert(
  alert: AdminReportAlert,
  adminId: string,
) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('ai_report_alerts')
    .update({
      status: 'resolved',
      resolved_by: adminId,
      resolved_at: now,
      updated_at: now,
    })
    .eq('id', alert.id);
  await ensureNoError(error);
  await writeAdminReportAudit(adminId, 'resolve_ai_report_alert', 'ai_report_alert', alert.id, {
    business_id: alert.business_id,
    alert_code: alert.alert_code,
  });
}

export async function dismissAdminReportAlert(
  alert: AdminReportAlert,
  adminId: string,
) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('ai_report_alerts')
    .update({
      status: 'dismissed',
      resolved_by: adminId,
      resolved_at: now,
      updated_at: now,
    })
    .eq('id', alert.id);
  await ensureNoError(error);
  await writeAdminReportAudit(adminId, 'dismiss_ai_report_alert', 'ai_report_alert', alert.id, {
    business_id: alert.business_id,
    alert_code: alert.alert_code,
  });
}

export async function sendAlertToLegalReview(
  alert: AdminReportAlert,
  adminId: string,
) {
  const now = new Date().toISOString();
  const detail = {
    ...objectOf(alert.detail_json),
    workflow: 'legal_review',
    legal_review_requested_at: now,
    legal_review_requested_by: adminId,
  };
  const { error } = await supabase
    .from('ai_report_alerts')
    .update({
      status: 'acknowledged',
      requires_admin_review: true,
      detail_json: detail,
      updated_at: now,
    })
    .eq('id', alert.id);
  await ensureNoError(error);
  await writeAdminReportAudit(adminId, 'route_ai_report_alert_to_legal', 'ai_report_alert', alert.id, {
    business_id: alert.business_id,
    alert_code: alert.alert_code,
  });
}

export async function verifyListingAuthority(
  authority: AdminListingAuthority,
  alert: AdminReportAlert,
  adminId: string,
) {
  const now = new Date().toISOString();
  const { error: authorityError } = await supabase
    .from('business_listing_authority')
    .update({
      verification_status: 'verified',
      report_policy: 'allow',
      report_notice_vi: null,
      report_notice_en: null,
      verified_by: adminId,
      verified_at: now,
      updated_at: now,
    })
    .eq('id', authority.id);
  await ensureNoError(authorityError);

  const { error: alertError } = await supabase
    .from('ai_report_alerts')
    .update({
      status: 'resolved',
      resolved_by: adminId,
      resolved_at: now,
      updated_at: now,
    })
    .eq('business_id', alert.business_id)
    .in('status', ['open', 'acknowledged'])
    .in('alert_code', AUTHORITY_ALERT_CODES);
  await ensureNoError(alertError);

  await writeAdminReportAudit(adminId, 'verify_business_listing_authority', 'business_listing_authority', authority.id, {
    business_id: alert.business_id,
    source_alert_id: alert.id,
  });
}

export async function rejectListingAuthority(
  authority: AdminListingAuthority,
  alert: AdminReportAlert,
  adminId: string,
) {
  const now = new Date().toISOString();
  const reasons = Array.isArray(authority.verification_reasons)
    ? [...authority.verification_reasons]
    : [];
  reasons.push({
    code: 'ADMIN_REJECTED',
    at: now,
    by: adminId,
    source_alert_id: alert.id,
  });

  const { error: authorityError } = await supabase
    .from('business_listing_authority')
    .update({
      verification_status: 'rejected',
      report_policy: 'block',
      verification_reasons: reasons,
      verified_by: adminId,
      verified_at: now,
      updated_at: now,
    })
    .eq('id', authority.id);
  await ensureNoError(authorityError);

  const { error: alertError } = await supabase
    .from('ai_report_alerts')
    .update({
      status: 'acknowledged',
      visible_to_business: true,
      requires_admin_review: true,
      updated_at: now,
    })
    .eq('id', alert.id);
  await ensureNoError(alertError);

  await writeAdminReportAudit(adminId, 'reject_business_listing_authority', 'business_listing_authority', authority.id, {
    business_id: alert.business_id,
    source_alert_id: alert.id,
  });
}
