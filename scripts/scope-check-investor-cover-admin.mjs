#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const failures = [];
const allowed = new Set([
  'src/components/SiteBanners.tsx',
  'src/lib/banners.ts',
  'src/pages/Admin.tsx',
  'src/styles/pages/admin.css',
  'src/pages/InvestorDetail.tsx',
  'src/styles/pages/investor-detail.css',
  'public/assets/investor-cover-default.svg',
  'scripts/scope-check-investor-cover-admin.mjs',
]);

const forbiddenExact = new Set([
  'src/App.tsx',
  'src/styles/index.css',
  'src/styles/pages/release-cleanup.css',
  'netlify.toml',
  'package.json',
  'package-lock.json',
  'src/lib/supabase.ts',
  'src/pages/Register.tsx',
  'src/pages/InvestorDashboard.tsx',
]);

const forbiddenPrefixes = [
  '.github/workflows/',
  'supabase/migrations/',
  'src/contexts/',
  'src/lib/proposals',
  'src/lib/payment',
  'src/pages/InvestorDetailV10',
  'src/pages/InvestorProfileV10',
  'src/pages/AdminInvestorsV10',
  'src/pages/AdminBannersV10',
  'src/pages/InvestorRegisterV14',
];

function runGit(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function resolveBase() {
  const candidates = [
    process.env.D68_SCOPE_BASE_SHA,
    process.env.GITHUB_BASE_REF
      ? `origin/${process.env.GITHUB_BASE_REF}`
      : '',
    'origin/release-safe/public-investor-ui-v1',
    'release-safe/public-investor-ui-v1',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      runGit(['rev-parse', '--verify', candidate]);
      return candidate;
    } catch {
      // Try the next explicit stacked base.
    }
  }

  throw new Error(
    'Không xác định được stacked base PR 1. Hãy fetch ' +
      'release-safe/public-investor-ui-v1 hoặc đặt D68_SCOPE_BASE_SHA.',
  );
}

function read(path) {
  if (!fs.existsSync(path)) {
    failures.push(`Missing required file: ${path}`);
    return '';
  }
  return fs.readFileSync(path, 'utf8');
}

function requireTokens(path, tokens) {
  const source = read(path);
  for (const token of tokens) {
    if (!source.includes(token)) {
      failures.push(`${path}: missing contract token ${token}`);
    }
  }
  return source;
}

let changed = [];
try {
  const base = resolveBase();
  changed = runGit([
    'diff',
    '--name-only',
    `${base}...HEAD`,
  ])
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);
  console.log(`Scope base: ${base}`);
} catch (error) {
  failures.push(error?.message || String(error));
}

for (const path of changed) {
  if (!allowed.has(path)) {
    failures.push(`Out-of-scope changed file: ${path}`);
  }
  if (
    forbiddenExact.has(path) ||
    forbiddenPrefixes.some((prefix) => path.startsWith(prefix))
  ) {
    failures.push(`Forbidden changed file: ${path}`);
  }
}

const banners = requireTokens('src/lib/banners.ts', [
  "| 'investor_cover_default'",
  'INVESTOR_COVER_FALLBACK',
  'investorApprovedCoverUrl',
  'getActiveInvestorDefaultCover',
  "listSiteBanners(\n    'investor_cover_default'",
  'resolveInvestorCover',
  "source: 'investor'",
  "source: 'site_banner'",
  "source: 'fallback'",
]);

if (banners.includes('pending_profile_changes')) {
  failures.push(
    'src/lib/banners.ts: public cover resolver must not read pending_profile_changes.',
  );
}
if (banners.includes(".from('investors')")) {
  failures.push(
    'src/lib/banners.ts: default cover helpers must never update/read investor rows directly.',
  );
}

const siteBanners = requireTokens('src/components/SiteBanners.tsx', [
  "id: 'investor_cover_default'",
  "label: 'Ảnh cover mặc định Nhà đầu tư'",
  'slotCount: 1',
  "size: '1600×560px'",
  'AdminBannerManager',
  "from('site_banners')",
  "from('site-banners')",
  'uploadSiteBannerImage',
]);

const placementOccurrences = (
  siteBanners.match(/id:\s*'investor_cover_default'/g) || []
).length;
if (placementOccurrences !== 1) {
  failures.push(
    `SiteBanners must declare exactly one investor_cover_default placement; found ${placementOccurrences}.`,
  );
}
if (/slotCount:\s*[2-9]/.test(
  siteBanners.slice(
    siteBanners.indexOf("id: 'investor_cover_default'"),
    siteBanners.indexOf("id: 'investor_cover_default'") + 700,
  ),
)) {
  failures.push('Investor default cover must have exactly one Admin slot.');
}
if (siteBanners.includes(".from('investors')")) {
  failures.push(
    'SiteBanners must not copy the default cover into investor rows.',
  );
}
if (
  siteBanners.includes('AdminBannersV10') ||
  siteBanners.includes('/admin/banners')
) {
  failures.push(
    'PR 2 must extend the existing Admin Banner component, not create a replacement route/page.',
  );
}

const detail = requireTokens('src/pages/InvestorDetail.tsx', [
  'getInvestorByCode',
  'getMyBusiness',
  'get_investor_contact_if_connected',
  'get_public_investor_proposal_history',
  'sendBusinessProposalToInvestor',
  'sentProposal',
  'connected',
  'applySeo',
  'getActiveInvestorDefaultCover',
  'resolveInvestorCover',
  'INVESTOR_COVER_FALLBACK',
  'data-cover-source={resolvedCover.source}',
  'Gửi Hồ sơ Doanh nghiệp',
  'Ai được xem gì',
  'Khách chỉ xem được hồ sơ công khai',
  'Doanh nghiệp đã đăng nhập có thể gửi Hồ sơ DN/proposal',
  'Sau khi kết nối/duyệt: mở thông tin liên hệ',
]);

if (detail.includes('InvestorDetailV10')) {
  failures.push('Investor Detail must remain the MAIN page.');
}
if (detail.includes('pending_profile_changes')) {
  failures.push(
    'Investor Detail must not read pending profile/cover changes.',
  );
}

const approvedIndex = banners.indexOf('investorApprovedCoverUrl');
const siteBannerIndex = banners.indexOf("source: 'site_banner'");
const fallbackIndex = banners.indexOf("source: 'fallback'");
if (
  approvedIndex < 0 ||
  siteBannerIndex < approvedIndex ||
  fallbackIndex < siteBannerIndex
) {
  failures.push(
    'Investor cover precedence must remain approved investor → site banner → static fallback.',
  );
}

const admin = read('src/pages/Admin.tsx');
requireTokens('src/pages/Admin.tsx', [
  "import { AdminBannerManager } from '../components/SiteBanners'",
  "tab === 'banners' && <AdminBannerManager />",
  "tab === 'investors'",
]);
if (
  admin.includes('AdminInvestorsV10') ||
  admin.includes('AdminBannersV10')
) {
  failures.push('Admin must retain the existing MAIN shell and pages.');
}

const app = read('src/App.tsx');
for (const forbiddenPage of [
  'InvestorDetailV10',
  'InvestorProfileV10',
  'AdminInvestorsV10',
  'AdminBannersV10',
  'InvestorRegisterV14',
]) {
  if (app.includes(forbiddenPage)) {
    failures.push(
      `src/App.tsx contains forbidden replacement route ${forbiddenPage}.`,
    );
  }
}

if (!changed.length) {
  failures.push('No PR 2 changed files detected against PR 1.');
}

if (failures.length) {
  console.error('✗ Investor cover Admin scope check failed:');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log('✓ Investor cover Admin scope check: PASS');
console.log(`✓ ${changed.length} PR 2 files are inside the release-safe whitelist.`);
console.log('✓ Existing Admin shell/Banner Manager remain in use.');
console.log('✓ Cover precedence is approved Investor → active default banner → SVG fallback.');
console.log('✓ Proposal, contact unlock, public history and SEO contracts remain present.');
console.log('✓ No migration, route, workflow or investor-row backfill was introduced.');
