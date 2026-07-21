#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const migration = fs.readFileSync(
  'supabase/migrations/20260721114500_ai_report_phase5_worker_artifact_v1.sql',
  'utf8',
);
const index = fs.readFileSync('supabase/functions/business-ai-report/index.ts', 'utf8');
const report = fs.readFileSync('supabase/functions/business-ai-report/report.ts', 'utf8');
const pdf = fs.readFileSync('supabase/functions/business-ai-report/pdf.ts', 'utf8');
const openai = fs.readFileSync('supabase/functions/business-ai-report/openai.ts', 'utf8');
const api = fs.readFileSync('src/features/businessReports/reportApi.ts', 'utf8');
const panel = fs.readFileSync(
  'src/features/businessReports/BusinessReportPanelPortal.tsx',
  'utf8',
);
const css = fs.readFileSync(
  'src/features/businessReports/business-report-panel.css',
  'utf8',
);

check(
  migration.includes('create table if not exists public.ai_reports') &&
    migration.includes("source_label text not null default 'Deals68 AI Report'") &&
    migration.includes("source_label = 'Deals68 AI Report'"),
  'Phase 5 must persist and constrain the report source label.',
);
check(
  migration.includes("'business-reports-private'") &&
    migration.includes('public,') === false &&
    migration.includes('create policy business_reports_private_admin_select'),
  'Private report bucket or Admin-only Storage read policy is missing.',
);
check(
  migration.includes('create or replace function public.d68_finalize_business_report') &&
    migration.includes('create or replace function public.d68_fail_business_report_request') &&
    migration.includes('create or replace function public.d68_get_latest_business_report'),
  'Atomic finalize/fail/latest report RPCs are missing.',
);
check(
  migration.includes('grant execute on function public.d68_finalize_business_report') &&
    migration.includes('to service_role;') &&
    migration.includes('no private storage path is exposed'),
  'Phase 5 service-role ACL or safe metadata contract is missing.',
);
check(
  index.includes("action: 'generate'") &&
    index.includes("action: 'download'") &&
    index.includes("d68_reserve_business_report_request") &&
    index.includes("d68_finalize_business_report") &&
    index.includes("d68_claim_business_report_download") &&
    index.includes('createSignedUrl'),
  'End-to-end generate/download worker flow is incomplete.',
);
check(
  index.includes("const REPORT_BUCKET = 'business-reports-private'") &&
    index.includes('cacheControl: \'private, max-age=0, no-store\'') &&
    !index.includes('getPublicUrl'),
  'Worker must upload only private PDFs and never create public URLs.',
);
check(
  report.includes("const SOURCE_LABEL = 'Deals68 AI Report'") &&
    pdf.includes('Nguồn / Source: ${SOURCE_LABEL}') &&
    pdf.includes('pdf.setAuthor(SOURCE_LABEL)') &&
    panel.includes('Nguồn file: Deals68 AI Report'),
  'Deals68 AI Report source branding is missing from content, PDF metadata or UI.',
);
check(
  openai.includes("Deno.env.get('OPENAI_API_KEY')") &&
    openai.includes("Deno.env.get('OPENAI_REPORT_MODEL')") &&
    openai.includes('return null;') &&
    index.includes("generatorMode: GeneratorMode = 'deterministic'"),
  'OpenAI enrichment must be optional and have a deterministic fallback.',
);
check(
  openai.includes('Use only the supplied payload') &&
    openai.includes('Never create or infer unsupported numbers') &&
    openai.includes('Do not give an investment recommendation'),
  'Grounded AI safety instructions are missing.',
);
check(
  api.includes("supabase.functions.invoke('business-ai-report'") &&
    api.includes("action: 'generate'") &&
    api.includes("action: 'download'") &&
    api.includes("supabase.rpc('d68_get_latest_business_report'"),
  'Business frontend is not connected to the Phase 5 worker.',
);
check(
  panel.includes('Tạo báo cáo mới') &&
    panel.includes('Tải báo cáo') &&
    panel.includes('generateLimited') &&
    panel.includes('downloadLimited'),
  'Separate generate/download actions and 60-minute UI gates are missing.',
);
check(
  css.includes('.d68-business-report-panel__actions') &&
    css.includes('.d68-business-report-panel__button.secondary') &&
    css.includes('@media (max-width: 760px)'),
  'Phase 5 Business report action styles are missing or not responsive.',
);
check(
  !index.includes('service_role_key') &&
    !index.includes('OPENAI_API_KEY=') &&
    !index.includes('SUPABASE_SERVICE_ROLE_KEY='),
  'Secrets must not be hardcoded in the Edge Function source.',
);

if (failures.length) {
  console.error('✗ Deals68 Business Report Phase 5 contract failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✓ Deals68 Business Report Phase 5 contract: PASS');
