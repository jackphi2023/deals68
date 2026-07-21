#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const read = (path) => fs.readFileSync(path, 'utf8');
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const types = read('src/features/businessReports/reportTypes.ts');
const core = read('src/features/businessReports/reportCore.ts');
const api = read('src/features/businessReports/reportApi.ts');
const viewer = read('src/features/businessReports/ReportViewer.tsx');
const portal = read('src/features/businessReports/BusinessReportViewerPortal.tsx');
const css = read('src/features/businessReports/report-viewer.css');
const wrapper = read('src/pages/BusinessDashboardWithReports.tsx');

check(
  types.includes("export type ReportAudience = 'business_owner' | 'investor'") &&
    types.includes('export type ReportContent') &&
    types.includes('export type ReportFreshness'),
  'Shared report contracts must support Business now and Investor later.',
);
check(
  core.includes('export type ReportRuntimeAdapter') &&
    core.includes('getSessionCachedReportContent') &&
    core.includes('resolveReportFreshness') &&
    core.includes('reportErrorText'),
  'Shared runtime adapter, cache, freshness and localized error helpers are incomplete.',
);
check(
  api.includes(".from('ai_reports')") &&
    api.includes(".select('content_json')") &&
    api.includes(".eq('status', 'completed')") &&
    api.includes('getCachedBusinessReportContent') &&
    api.includes('d68:business-report-updated'),
  'Business report content must use the existing RLS-protected artifact and refresh event.',
);
check(
  api.includes(".from('business_files')") &&
    api.includes(".select('created_at,updated_at')") &&
    api.includes('resolveReportFreshness'),
  'Stale detection must compare the artifact with current profile/file timestamps.',
);
check(
  portal.includes("lazy(() => import('./ReportViewer'))") &&
    portal.includes('getCachedBusinessReportContent') &&
    portal.includes('visibilitychange') &&
    portal.includes('audience="business_owner"'),
  'Inline viewer must be lazy-loaded, session-cached and refreshed without polling loops.',
);
check(
  viewer.includes('Dữ kiện có nguồn tài liệu') &&
    viewer.includes('Document-backed facts') &&
    viewer.includes('source_excerpt') &&
    viewer.includes('content.disclaimer') &&
    viewer.includes("audience === 'investor'"),
  'Viewer must expose citations, disclaimer and audience-specific copy.',
);
check(
  wrapper.includes('<BusinessReportPanelPortal />') &&
    wrapper.includes('<BusinessReportViewerPortal />'),
  'Phase 6 must extend, not replace, the existing Business report panel.',
);
check(
  !portal.includes('supabase.functions.invoke') &&
    !portal.includes("action: 'generate'") &&
    !portal.includes("action: 'download'") &&
    !portal.includes('document_access_grants'),
  'Viewer must not bypass the existing worker, limits or future Investor access gate.',
);
check(
  css.includes('.d68-report-viewer') &&
    css.includes('@media (max-width: 640px)') &&
    !css.includes('!important') &&
    !css.includes('body {') &&
    !css.includes(':root'),
  'Viewer CSS must stay scoped, responsive and avoid global overrides.',
);

if (failures.length) {
  console.error('✗ Deals68 Business Report Phase 6 contract failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✓ Deals68 Business Report Phase 6 contract: PASS');
console.log('✓ Inline viewer, session cache, stale detection and Investor-ready shared core verified.');
