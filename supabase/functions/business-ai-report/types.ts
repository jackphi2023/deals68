export type ReportLanguage = 'vi' | 'en';
export type ReportGrade = 'limited' | 'full';
export type GeneratorMode = 'deterministic' | 'openai_assisted';

export type SourceFact = {
  id: string;
  business_file_id: string | null;
  fact_kind: 'document_backed' | 'derived';
  field_key: string;
  period_key: string | null;
  value_json: unknown;
  normalized_value: number | null;
  unit: string | null;
  currency: string | null;
  confidence: number;
  validation_status: string;
  page_number: number | null;
  sheet_name: string | null;
  cell_range: string | null;
  source_excerpt: string | null;
};

export type SourceFile = {
  id: string;
  display_name?: string | null;
  file_name?: string | null;
  category?: string | null;
  review_status?: string | null;
  processing?: {
    parse_status?: string;
    ocr_status?: string;
    entity_match_status?: string;
    entity_match_score?: number | null;
    relevance_score?: number | null;
    detected_document_type?: string | null;
    mismatch_reasons?: unknown[];
  } | null;
};

export type ReportSourceSnapshot = {
  snapshot_version?: string;
  generated_at?: string;
  business: Record<string, unknown>;
  authority?: Record<string, unknown> | null;
  files?: SourceFile[];
};

export type ReportPreflight = {
  id?: string | null;
  allow_report?: boolean;
  allow_valuation?: boolean;
  grade?: string;
  data_gate?: string;
  entity_gate?: string;
  authority_gate?: string;
  authority_notice_required?: boolean;
  authority_notice_vi?: string | null;
  authority_notice_en?: string | null;
  missing?: unknown[];
  warnings?: unknown[];
  blocking?: unknown[];
  source_hash?: string | null;
  checked_at?: string;
};

export type AiNarrative = {
  executive_summary: string;
  strengths: string[];
  risks: string[];
  recommendations: string[];
};

export type ReportContent = {
  source_label: 'Deals68 AI Report';
  language: ReportLanguage;
  report_grade: ReportGrade;
  generator_mode: GeneratorMode;
  generated_at: string;
  business: Record<string, unknown>;
  preflight: ReportPreflight;
  authority: Record<string, unknown> | null;
  ai_narrative: AiNarrative;
  facts: Array<SourceFact & { citation: string; file_name: string }>;
  usable_files: Array<{ id: string; name: string; category: string; status: string }>;
  excluded_files: Array<{ id: string; name: string; reason: string }>;
  warnings: string[];
  missing: string[];
  disclaimer: string;
};

export type ReportArtifact = {
  reportId: string;
  requestId: string;
  businessId: string;
  fileName: string;
  storagePath: string;
  sourceHash: string | null;
  reportGrade: ReportGrade;
  generatorMode: GeneratorMode;
  content: ReportContent;
  manifest: unknown[];
  pdfBytes: Uint8Array;
  sha256: string;
};
