#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const app = fs.readFileSync('src/App.tsx', 'utf8');
const wrapper = fs.readFileSync('src/pages/BusinessDashboardWithReports.tsx', 'utf8');
const panel = fs.readFileSync(
  'src/features/businessReports/BusinessReportPanelPortal.tsx',
  'utf8',
);
const api = fs.readFileSync('src/features/businessReports/reportApi.ts', 'utf8');
const css = fs.readFileSync(
  'src/features/businessReports/business-report-panel.css',
  'utf8',
);
const dashboard = fs.readFileSync('src/pages/BusinessDashboard.tsx', 'utf8');

check(
  app.includes("const loadBusinessDashboard = () => import('./pages/BusinessDashboardWithReports');"),
  'Business routes must lazy-load the report wrapper.',
);
check(
  wrapper.includes("import BusinessDashboard from './BusinessDashboard';") &&
    wrapper.includes('<BusinessDashboard />') &&
    wrapper.includes('<BusinessReportPanelPortal />'),
  'Wrapper must preserve the original Business Dashboard and add only the report portal.',
);
check(
  dashboard.includes('d68-business-overview-metrics'),
  'Original Business Dashboard overview anchor is missing.',
);
check(
  panel.includes("route === '/dashboard/business'") &&
    panel.includes("route === '/dashboard/business/files'") &&
    panel.includes("route === '/dashboard/business/documents'"),
  'Panel must be limited to Overview and Dataroom Documents routes.',
);
check(
  panel.includes("section.insertBefore(node, metrics)") &&
    panel.includes('section.insertBefore(node, section.firstChild)'),
  'Panel placement anchors are missing.',
);
check(
  panel.includes('Xem Báo cáo Tối ưu Hồ sơ DN') &&
    panel.includes('Bạn chưa sử dụng được do chưa được kích hoạt hồ sơ.') &&
    panel.includes('Đang tạo báo cáo...'),
  'Required Vietnamese report wording is missing.',
);
check(
  panel.includes('Bạn có thể tạo tối đa 01 báo cáo và tải tối đa 01 lần trong mỗi 60 phút.'),
  'Hourly Business report limit wording is missing.',
);
check(
  panel.includes('authority_notice_required') &&
    panel.includes('d68-business-report-panel__authority-notice'),
  'Mandatory broker authorization notice is not rendered.',
);
check(
  api.includes("supabase.rpc('d68_get_business_report_status'") &&
    api.includes("supabase.rpc('d68_get_business_report_rate_status'") &&
    api.includes("supabase.rpc('d68_run_business_report_preflight'"),
  'Phase 3 must use the existing report status, rate and preflight RPCs.',
);
check(
  !panel.includes('d68_reserve_business_report_request') &&
    !panel.includes('d68_claim_business_report_download'),
  'Phase 3 must not reserve jobs or consume download quota before the PDF worker exists.',
);
check(
  css.includes('background: #e7f6fd;') &&
    css.includes('background: #f2b51d;') &&
    css.includes('color: #fff;'),
  'Required light-blue panel and yellow/white action styling is missing.',
);
check(
  css.includes('@media (max-width: 760px)') &&
    css.includes('.d68-business-report-panel__button {\n    min-width: 0;'),
  'Responsive full-width mobile action contract is missing.',
);

if (failures.length) {
  console.error('✗ Deals68 Business Report Phase 3 UI contract failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✓ Deals68 Business Report Phase 3 UI contract: PASS');
