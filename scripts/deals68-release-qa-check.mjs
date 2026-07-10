#!/usr/bin/env node
import fs from 'node:fs';

const checks = [];
function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
}
function ok(name, pass, detail = '') {
  checks.push({ name, pass, detail });
}

const pkg = JSON.parse(read('package.json') || '{}');
const register = read('src/pages/Register.tsx');
const indexCss = read('src/styles/index.css');
const releaseCss = read('src/styles/pages/release-cleanup.css');
const homeCss = read('src/styles/pages/home.css');
const admin = read('src/pages/Admin.tsx');
const proposals = read('src/lib/proposals.ts');
const login = read('src/pages/Login.tsx');
const businessDashboard = read('src/pages/BusinessDashboard.tsx');
const dataLib = read('src/lib/data.ts');
const pendingUploads = read('src/lib/pendingBusinessUploads.ts');

ok('build script exists', !!pkg.scripts?.build, 'package.json scripts.build');
ok('test:e2e scripts exist', !!pkg.scripts?.['test:e2e'] && !!pkg.scripts?.['test:e2e:public'], 'package.json e2e scripts');
ok('release-cleanup imported after page CSS', /pages\/release-cleanup\.css/.test(indexCss), 'src/styles/index.css imports release-cleanup');
ok('home final CSS moved to home.css', /Deals68 Home RC1 final layout/.test(homeCss), 'home.css contains RC1 final layout');
ok('release-cleanup no stacked homepage v12-v14 blocks',
  !/Front-end UI polish v1[234]|Front-end homepage\/register combined final fix|Front-end homepage final clean layout/.test(releaseCss),
  'remove old homepage hotfix markers from release-cleanup.css'
);
ok('register valuation disclaimer removed', !/VALUATION_DISCLAIMER_VI|VALUATION_DISCLAIMER_EN/.test(register), 'Register.tsx should not render/import valuation disclaimer');
ok('business quota override is explicit', /Number\.isFinite\(explicit\)\s*&&\s*explicit\s*>\s*0\s*\?\s*explicit\s*:\s*base/.test(proposals), 'proposalQuotaTotal honors Admin quota_total override');
ok('admin business detail route exists', /BusinessAdminDetail/.test(admin) && /Thanh toán & Quota/.test(admin) && /Hình ảnh & Files/.test(admin), 'Admin business detail tabs');
ok('admin investor pagination exists', /INVESTOR_PAGE_SIZE\s*=\s*30/.test(admin) && /AdminPagination/.test(admin), 'Admin investor pagination 30/page');
ok('admin office country filter exists', /Quốc gia trụ sở/.test(admin) && /investorOfficeCountryFilter/.test(admin), 'Admin investor office country filter');

ok(
  'business signup assets survive OTP',
  /queuePendingBusinessSignupAssets/.test(register)
    && /resumePendingBusinessSignupUploads/.test(login)
    && /indexedDB/.test(pendingUploads),
  'Register queues File/Blob; Login resumes after verifyOtp'
);

ok(
  'signup uploads are idempotent',
  /client_upload_id/.test(dataLib)
    && /onConflict:\s*'client_upload_id'/.test(dataLib)
    && /isDuplicateStorageUploadError/.test(dataLib),
  'storage/database retries must not duplicate files'
);

ok(
  'business dashboard shows pending owner data',
  /businessOwnerView/.test(businessDashboard)
    && /b=\{ownerView\}/.test(businessDashboard)
    && /pending_submitted_at/.test(businessDashboard),
  'owner sees latest submitted values while public keeps approved snapshot'
);

ok(
  'business and admin realtime refresh exist',
  /postgres_changes/.test(businessDashboard)
    && /deals68-admin-business-flow/.test(admin)
    && /visibilitychange/.test(admin),
  'refresh after Admin approval and Business edits'
);

ok(
  'admin approves full pending transaction',
  /approve_business_pending_changes/.test(admin)
    && /BusinessPendingComparison/.test(admin)
    && /expected_pending_submitted_at/.test(admin),
  'Admin sees old/new and uses transactional RPC'
);

const failed = checks.filter((x) => !x.pass);
for (const c of checks) {
  console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
}
if (failed.length) {
  console.error(`\nRelease QA static check failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`\nRelease QA static check passed: ${checks.length}/${checks.length}`);
