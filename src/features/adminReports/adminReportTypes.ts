export type AdminReportRequestStatus = 'reserved' | 'completed' | 'failed' | 'cancelled';
export type AdminAlertStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed';
export type AdminAlertSeverity = 'info' | 'warning' | 'high' | 'critical';

export type AdminReportRequest = {
  id: string;
  business_id: string;
  actor_profile_id?: string | null;
  request_key?: string | null;
  status: AdminReportRequestStatus;
  report_id?: string | null;
  reserved_at?: string | null;
  reserved_until?: string | null;
  completed_at?: string | null;
  failed_at?: string | null;
  error_code?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminReportAlert = {
  id: string;
  business_id: string;
  report_job_id?: string | null;
  business_file_id?: string | null;
  preflight_check_id?: string | null;
  alert_code: string;
  severity: AdminAlertSeverity;
  status: AdminAlertStatus;
  title_vi: string;
  title_en: string;
  detail_json?: Record<string, unknown> | null;
  blocks_report: boolean;
  requires_admin_review: boolean;
  visible_to_business: boolean;
  requires_report_notice?: boolean | null;
  report_notice_vi?: string | null;
  report_notice_en?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminListingAuthority = {
  id: string;
  business_id: string;
  listing_party_type: string;
  declared_owner_name?: string | null;
  declared_principal_name?: string | null;
  declared_agent_name?: string | null;
  declared_asset_name?: string | null;
  declared_asset_address?: string | null;
  verification_status: string;
  verification_reasons?: unknown[] | null;
  authority_document_ids?: string[] | null;
  verified_by?: string | null;
  verified_at?: string | null;
  expires_at?: string | null;
  report_policy?: string | null;
  report_notice_vi?: string | null;
  report_notice_en?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminReportBusiness = {
  id: string;
  owner_id?: string | null;
  public_code?: string | null;
  slug?: string | null;
  company_name_private?: string | null;
  title_vi?: string | null;
  title_en?: string | null;
  industry?: string | null;
  status?: string | null;
  visible?: boolean | null;
};

export type AdminReportProfile = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
};

export type AdminReportBusinessFile = {
  id: string;
  business_id: string;
  owner_id?: string | null;
  file_name?: string | null;
  display_name?: string | null;
  file_path?: string | null;
  file_type?: string | null;
  category?: string | null;
  review_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminReportData = {
  requests: AdminReportRequest[];
  alerts: AdminReportAlert[];
  authorities: AdminListingAuthority[];
  businesses: AdminReportBusiness[];
  profiles: AdminReportProfile[];
  files: AdminReportBusinessFile[];
};

export type ReportArtifact = {
  bucket: string;
  path: string;
  fileName: string;
};
