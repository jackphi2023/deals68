export type ReportLang = 'vi' | 'en';
export type ReportAudience = 'business_owner' | 'investor';

export type ReportGateStatus =
  | 'not_checked'
  | 'pass'
  | 'warning'
  | 'blocked'
  | 'review_required';

export type ReportGrade = 'blocked' | 'limited' | 'full';
export type ReportGeneratorMode = 'deterministic' | 'openai_assisted';

export type ReportRateAction = {
  allowed?: boolean;
  last_at?: string | null;
  next_allowed_at?: string | null;
  retry_after_seconds?: number;
  source?: string;
};

export type ReportRateStatus = {
  business_id?: string;
  window_seconds?: number;
  generate?: ReportRateAction;
  download?: ReportRateAction;
};

export type ReportMessageItem = {
  code?: string;
  count?: number;
  message_vi?: string;
  message_en?: string;
  mandatory_report_notice?: boolean;
};

export type ReportPreflight = {
  preflight_id?: string | null;
  id?: string | null;
  business_id?: string;
  allow_report?: boolean;
  allow_valuation?: boolean;
  grade?: ReportGrade;
  report_grade?: ReportGrade;
  eligibility_status?: string;
  data_gate?: string;
  entity_gate?: string;
  authority_gate?: string;
  authority_notice_required?: boolean;
  authority_notice_vi?: string | null;
  authority_notice_en?: string | null;
  missing?: ReportMessageItem[];
  warnings?: ReportMessageItem[];
  blocking?: ReportMessageItem[] | string[];
  checked_at?: string;
  source_hash?: string | null;
  gates?: {
    data?: ReportGateStatus;
    entity?: ReportGateStatus;
    authority?: ReportGateStatus;
  };
  files?: {
    total?: number;
    usable?: number;
    pending?: number;
    unreadable?: number;
    mismatch?: number;
  };
  evidence?: {
    file_count?: number;
    candidate_file_count?: number;
    usable_file_count?: number;
    pending_file_count?: number;
    unreadable_file_count?: number;
    mismatch_file_count?: number;
    documented_fact_count?: number;
    documented_revenue?: boolean;
  };
  rate_limit?: ReportRateStatus;
};

export type BusinessReportStatus = {
  business_id?: string;
  account_enabled?: boolean;
  can_request?: boolean;
  reason?: string;
  rate_limit_minutes?: number;
  active_request_id?: string | null;
  active_request_until?: string | null;
  last_completed_at?: string | null;
  next_allowed_at?: string | null;
  latest_preflight?: ReportPreflight | null;
};

export type BusinessReportArtifact = {
  id: string;
  request_id?: string;
  business_id: string;
  audience?: ReportAudience;
  language?: ReportLang;
  report_grade?: Exclude<ReportGrade, 'blocked'>;
  generator_mode?: ReportGeneratorMode;
  source_label?: 'Deals68 AI Report' | string;
  source_hash?: string | null;
  file_name?: string;
  mime_type?: 'application/pdf' | string;
  size_bytes?: number;
  sha256?: string;
  generated_at?: string;
  download_available?: boolean;
};

export type ReportNarrative = {
  executive_summary?: string;
  strengths?: string[];
  risks?: string[];
  recommendations?: string[];
};

export type ReportFact = {
  id?: string;
  business_file_id?: string | null;
  fact_kind?: 'document_backed' | 'derived' | string;
  field_key?: string;
  period_key?: string | null;
  value_json?: unknown;
  normalized_value?: number | null;
  unit?: string | null;
  currency?: string | null;
  confidence?: number;
  validation_status?: string;
  page_number?: number | null;
  sheet_name?: string | null;
  cell_range?: string | null;
  source_excerpt?: string | null;
  citation?: string;
  file_name?: string;
};

export type ReportSourceFile = {
  id?: string;
  name?: string;
  category?: string;
  status?: string;
  reason?: string;
};

export type ReportContent = {
  source_label?: 'Deals68 AI Report' | string;
  audience?: ReportAudience;
  language?: ReportLang;
  report_grade?: Exclude<ReportGrade, 'blocked'>;
  generator_mode?: ReportGeneratorMode;
  generated_at?: string;
  business?: Record<string, unknown>;
  preflight?: ReportPreflight;
  authority?: Record<string, unknown> | null;
  ai_narrative?: ReportNarrative;
  facts?: ReportFact[];
  usable_files?: ReportSourceFile[];
  excluded_files?: ReportSourceFile[];
  warnings?: string[];
  missing?: string[];
  disclaimer?: string;
};

export type ReportArtifactPayload = {
  artifact: BusinessReportArtifact;
  content: ReportContent;
  source_manifest: unknown[];
};

export type ReportFreshness = {
  stale: boolean;
  source_updated_at?: string | null;
  reason?: 'source_hash_changed' | 'business_updated' | 'file_updated' | null;
};

export type ReportGenerateResponse = {
  ok?: boolean;
  existing?: boolean;
  error?: string;
  message?: string;
  request_id?: string;
  report_id?: string;
  file_name?: string;
  generated_at?: string;
  report_grade?: Exclude<ReportGrade, 'blocked'>;
  generator_mode?: ReportGeneratorMode;
  source_label?: string;
  size_bytes?: number;
  sha256?: string;
  retry_after_seconds?: number;
  next_allowed_at?: string | null;
  preflight?: ReportPreflight | null;
  report?: BusinessReportArtifact | null;
};

export type ReportDownloadResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  report_id?: string;
  source_label?: string;
  file_name?: string;
  signed_url?: string;
  expires_in_seconds?: number;
  retry_after_seconds?: number;
  next_allowed_at?: string | null;
};

export type BusinessReportAlert = {
  id: string;
  alert_code?: string;
  severity?: 'info' | 'warning' | 'high' | 'critical';
  title_vi?: string;
  title_en?: string;
  report_notice_vi?: string | null;
  report_notice_en?: string | null;
  blocks_report?: boolean;
  requires_admin_review?: boolean;
  created_at?: string;
};
