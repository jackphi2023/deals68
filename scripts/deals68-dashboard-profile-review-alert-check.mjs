#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const read = (path) => fs.readFileSync(path, 'utf8');
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const portal = read('src/features/dashboardReview/DashboardProfileReviewNoticePortal.tsx');
const css = read('src/features/dashboardReview/dashboard-profile-review-notice.css');
const main = read('src/main.tsx');

check(
  main.includes("import DashboardProfileReviewNoticePortal from './features/dashboardReview/DashboardProfileReviewNoticePortal'") &&
    main.includes('<DashboardProfileReviewNoticePortal />'),
  'The review notice portal must be mounted once inside AuthProvider.',
);
check(
  portal.includes("path === '/dashboard/business'") &&
    portal.includes("path === '/dashboard/investor'") &&
    portal.includes("path === '/dashboard/investor/profile'") &&
    !portal.includes("path.startsWith('/dashboard/business')") &&
    !portal.includes("path.startsWith('/dashboard/investor')"),
  'The notice must be limited to the Business overview and Investor first/profile tab.',
);
check(
  portal.includes('Boolean(subject?.public_snapshot_json)') &&
    portal.includes('subject?.visible === true') &&
    portal.includes("String(subject?.status || '').toLowerCase() === 'active'"),
  'The notice must hide after the corresponding public profile approval condition.',
);
check(
  portal.includes('profile.role !== kind') &&
    portal.includes('profile?.role === kind'),
  'The notice must only appear for the signed-in Business or Investor owner, not Admin.',
);
check(
  portal.includes('header.parentNode.insertBefore(node, header.nextSibling)') &&
    portal.includes('.d68-dashboard-wrap > .d68-dashboard-head'),
  'The notice must be inserted directly after the Dashboard header and before other alerts.',
);
check(
  portal.includes('Hồ sơ đang được kiểm duyệt, vui lòng đợi 1 đến 3 ngày làm việc') &&
    portal.includes('Your profile is under review. Please allow 1 to 3 business days.'),
  'The exact bilingual review copy is missing.',
);
check(
  css.includes('background: #e7f6fd') &&
    css.includes('padding: 10px') &&
    css.includes('.d68-dashboard-profile-review-alert') &&
    !css.includes('!important') &&
    !css.includes('body {') &&
    !css.includes(':root'),
  'The alert must use scoped light-blue styling with 10px padding and no global overrides.',
);
check(
  portal.includes("table = kind === 'business' ? 'businesses' : 'investors'") &&
    portal.includes("event: 'UPDATE'") &&
    portal.includes('visibilitychange'),
  'The notice must refresh safely when Admin approval changes while the Dashboard is open.',
);

if (failures.length) {
  console.error('✗ Dashboard profile review alert contract failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✓ Dashboard profile review alert contract: PASS');
console.log('✓ Scope, bilingual copy, approval hiding and isolated styling verified.');
