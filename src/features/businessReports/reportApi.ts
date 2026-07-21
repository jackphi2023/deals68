import { supabase } from '../../lib/supabase';
import type {
  BusinessReportAlert,
  BusinessReportStatus,
  ReportPreflight,
  ReportRateStatus,
} from './reportTypes';

function unwrapRpc<T>(data: unknown): T {
  if (Array.isArray(data) && data.length === 1) return data[0] as T;
  return data as T;
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

export async function runBusinessReportPreflight(
  businessId: string,
): Promise<ReportPreflight> {
  const { data, error } = await supabase.rpc('d68_run_business_report_preflight', {
    p_business_id: businessId,
  });
  if (error) throw error;
  return unwrapRpc<ReportPreflight>(data) || {};
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
