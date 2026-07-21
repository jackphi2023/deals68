#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const main = fs.readFileSync('src/main.tsx', 'utf8');
const navigation = fs.readFileSync('src/config/adminNavigation.ts', 'utf8');
const panel = fs.readFileSync('src/features/adminReports/AdminReportsPortal.tsx', 'utf8');
const api = fs.readFileSync('src/features/adminReports/adminReportApi.ts', 'utf8');
const css = fs.readFileSync('src/features/adminReports/admin-reports.css', 'utf8');
const admin = fs.readFileSync('src/pages/Admin.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

check(
  main.includes("import AdminReportsPortal from './features/adminReports/AdminReportsPortal';") &&
    main.includes('<App />') &&
    main.includes('<AdminReportsPortal />'),
  'App root must register the route-scoped Admin Reports portal inside Router/Auth.',
);
check(
  app.includes("const loadAdmin = () => import('./pages/Admin');"),
  'Existing Admin route loader must remain unchanged.',
);
check(
  navigation.includes("| 'reports'") &&
    navigation.includes("href: '/admin/reports'") &&
    navigation.includes("aliases: ['reports', 'ai-reports']"),
  'Admin Reports navigation registration is missing.',
);
check(
  panel.includes("['/admin/reports', '/admin/ai-reports']") &&
    panel.includes("document.querySelector<HTMLElement>('.d68-admin-cols > main')"),
  'Admin Reports portal must be route-scoped and mount inside the Admin shell.',
);
check(
  panel.includes("request.status === 'completed'") &&
    panel.includes('reportArtifactOf(request)') &&
    panel.includes('disabled={!artifact'),
  'Completed-report listing or safe PDF availability gate is missing.',
);
check(
  api.includes(".from('ai_report_business_requests')") &&
    api.includes(".from('ai_report_alerts')") &&
    api.includes(".from('business_listing_authority')"),
  'Phase 4 must read existing report, alert and authority tables.',
);
check(
  api.includes(".from('audit_logs').insert") &&
    api.includes('request_ai_report_supplement') &&
    api.includes('verify_business_listing_authority') &&
    api.includes('reject_business_listing_authority'),
  'Admin report operations must be audited.',
);
check(
  api.includes("verification_status: 'verified'") &&
    api.includes("report_policy: 'allow'") &&
    api.includes("verification_status: 'rejected'") &&
    api.includes("report_policy: 'block'"),
  'Authority verify/reject state transitions are missing.',
);
check(
  !api.includes('d68_claim_business_report_download') &&
    !api.includes('d68_reserve_business_report_request'),
  'Admin operations must not consume Business report generation/download quota.',
);
check(
  panel.includes('Yêu cầu bổ sung') &&
    panel.includes('Đã xác minh') &&
    panel.includes('Không hợp lệ') &&
    panel.includes('Chuyển pháp lý') &&
    panel.includes('Đã xử lý'),
  'Required Admin alert actions are missing.',
);
check(
  css.includes('.d68-admin-reports') &&
    css.includes('@media (max-width: 700px)') &&
    css.includes('background: #e7f6fd;'),
  'Route-scoped responsive Admin Reports styles are missing.',
);
check(
  admin.includes('export default function Admin()') &&
    !admin.includes('AdminReportsPortal'),
  'Existing Admin implementation must remain isolated from the Phase 4 module.',
);
check(
  !fs.existsSync('src/pages/AdminWithReports.tsx') &&
    !fs.existsSync('.github/workflows/admin-reports-phase4-apply.yml') &&
    !fs.existsSync('admin-reports-phase4-trigger.txt'),
  'Temporary Phase 4 integration artifacts must not remain.',
);

if (failures.length) {
  console.error('✗ Deals68 Admin Reports Phase 4 contract failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✓ Deals68 Admin Reports Phase 4 contract: PASS');
