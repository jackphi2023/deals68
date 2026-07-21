import { supabase } from '../../lib/supabase';
import {
  clearSessionReportContent,
  getSessionCachedReportContent,
  reportSessionKey,
  resolveReportFreshness,
} from './reportCore';
import type {
  BusinessReportAlert,
  BusinessReportArtifact,
  BusinessReportStatus,
  ReportContent,
  ReportDownloadResponse,
  ReportFreshness,
  ReportGenerateResponse,
  ReportLang,
  ReportPreflight,
  ReportRateStatus,
} from './reportTypes';

function unwrapRpc<T>(data: unknown): T {
  if (Array.isArray(data) && data.length === 1) return data[0] as T;
  return data as T;
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

async function invokeReportWorker<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('business-ai-report', { body });
  if (!error) return (data || {}) as T;

  let workerBody: Record<string, unknown> = {};
  const context = (error as any)?.context;
  if (context instanceof Response) {
    try {
      workerBody = await context.clone().json();
    } catch {
      try {
        workerBody = { message: await context.clone().text() };
      } catch {
        workerBody = {};
      }
    }
  }

  const message = text(
    workerBody.message || workerBody.error || (error as any)?.message || 'Report worker failed.',
  );
  const enriched = new Error(message) as Error & Record<string, unknown>;
  Object.assign(enriched, workerBody);
  throw enriched;
}

export async function getBusinessReportStatus(
  businessId: string,
): Promise<BusinessReportStatus> {
  const { data, error } = await supabase.rpc('d68_get_business_report_status', {
    p_business_id: businessId,
  });
  if (error) throw error;
  return unwrapRpc<BusinessReportStatus>(data) || {};
}

export async function getBusinessReportRateStatus(
  businessId: string,
): Promise<ReportRateStatus> {
  const { data, error } = await supabase.rpc('d68_get_business_report_rate_status', {
    p_business_id: businessId,
  });
  if (error) throw error;
  return unwrapRpc<ReportRateStatus>(data) || {};
}

export async function getLatestBusinessReport(
  businessId: string,
): Promise<BusinessReportArtifact | null> {
  const { data, error } = await supabase.rpc('d68_get_latest_business_report', {
    p_business_id: businessId,
  });
  if (error) throw error;
  const row = unwrapRpc<BusinessReportArtifact | null>(data);
  return row?.id ? { ...row, audience: 'business_owner' } : null;
}

export async function getBusinessReportContent(
  businessId: string,
  reportId: string,
): Promise<ReportContent | null> {
  const { data, error } = await supabase
    .from('ai_reports')
    .select('content_json')
    .eq('id', reportId)
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .maybeSingle();
  if (error) throw error;
  if (!data?.content_json || typeof data.content_json !== 'object') return null;
  return data.content_json as ReportContent;
}

export function getCachedBusinessReportContent(
  businessId: string,
  reportId: string,
) {
  const subject = { audience: 'business_owner' as const, businessId };
  return getSessionCachedReportContent(
    reportSessionKey(subject, reportId),
    () => getBusinessReportContent(businessId, reportId),
  );
}

export function clearBusinessReportContentCache(
  businessId: string,
  reportId?: string | null,
) {
  if (!reportId) {
    clearSessionReportContent();
    return;
  }
  clearSessionReportContent(
    reportSessionKey({ audience: 'business_owner', businessId }, reportId),
  );
}

export async function getBusinessReportFreshness(params: {
  businessId: string;
  artifact: BusinessReportArtifact;
  preflight?: ReportPreflight | null;
  businessUpdatedAt?: string | null;
}): Promise<ReportFreshness> {
  const { data, error } = await supabase
    .from('business_files')
    .select('created_at,updated_at')
    .eq('business_id', params.businessId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return resolveReportFreshness({
    artifact: params.artifact,
    preflight: params.preflight,
    businessUpdatedAt: params.businessUpdatedAt,
    fileUpdatedAt: data?.updated_at || data?.created_at || null,
  });
}

export async function runBusinessReportPreflight(
  businessId: string,
): Promise<ReportPreflight> {
  const { data, error } = await supabase.rpc('d68_run_business_report_preflight', {
    p_business_id: businessId,
  });
  if (error) throw error;
  return unwrapRpc<ReportPreflight>(data) || {};
}

export async function generateBusinessReport(
  businessId: string,
  language: ReportLang,
): Promise<ReportGenerateResponse> {
  const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response = await invokeReportWorker<ReportGenerateResponse>({
    action: 'generate',
    business_id: businessId,
    language,
    request_key: `business-dashboard:${businessId}:${randomPart}`,
  });
  if (response.ok && typeof window !== 'undefined') {
    clearBusinessReportContentCache(businessId);
    window.dispatchEvent(new CustomEvent('d68:business-report-updated', {
      detail: { businessId, reportId: response.report_id || response.report?.id || null },
    }));
  }
  return response;
}

export async function requestBusinessReportDownload(
  businessId: string,
  reportId: string,
): Promise<ReportDownloadResponse> {
  return invokeReportWorker<ReportDownloadResponse>({
    action: 'download',
    business_id: businessId,
    report_id: reportId,
  });
}

export async function downloadBusinessReport(
  businessId: string,
  report: BusinessReportArtifact,
) {
  const response = await requestBusinessReportDownload(businessId, report.id);
  if (!response.ok || !response.signed_url) {
    const error = new Error(response.message || response.error || 'Không thể tải báo cáo.') as Error &
      ReportDownloadResponse;
    Object.assign(error, response);
    throw error;
  }

  const fileResponse = await fetch(response.signed_url, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
  });
  if (!fileResponse.ok) throw new Error('Không tải được file PDF báo cáo.');
  const blob = await fileResponse.blob();
  const url = URL.createObjectURL(blob);
  const fileName = text(response.file_name || report.file_name) || `Deals68_AI_Report_${report.id}.pdf`;

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

  return response;
}

export async function listBusinessReportAlerts(
  businessId: string,
): Promise<BusinessReportAlert[]> {
  const { data, error } = await supabase
    .from('ai_report_alerts')
    .select(
      'id,alert_code,severity,title_vi,title_en,report_notice_vi,report_notice_en,blocks_report,requires_admin_review,created_at',
    )
    .eq('business_id', businessId)
    .eq('visible_to_business', true)
    .in('status', ['open', 'acknowledged'])
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) throw error;
  return (data || []) as BusinessReportAlert[];
}
