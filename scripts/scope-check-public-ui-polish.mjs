#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const failures = [];
const allowed = new Set([
  'src/pages/Home.tsx',
  'src/pages/Investors.tsx',
  'src/pages/InvestorDetail.tsx',
  'src/styles/pages/home.css',
  'src/styles/pages/investors.css',
  'src/styles/pages/investor-detail.css',
  'src/styles/pages/businesses.css',
  'public/assets/investor-cover-default.svg',
  'scripts/scope-check-public-ui-polish.mjs',
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
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function resolveBase() {
  const candidates = [
    process.env.D68_SCOPE_BASE_SHA,
    process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : '',
    'origin/building',
    'building',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      runGit(['rev-parse', '--verify', candidate]);
      return candidate;
    } catch {
      // Try the next explicit base. Never silently broaden the comparison.
    }
  }

  throw new Error('Không xác định được base building. Hãy fetch building hoặc đặt D68_SCOPE_BASE_SHA.');
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
    if (!source.includes(token)) failures.push(`${path}: missing contract token ${token}`);
  }
  return source;
}

let changed = [];
try {
  const base = resolveBase();
  changed = runGit(['diff', '--name-only', `${base}...HEAD`]).split('\n').map((item) => item.trim()).filter(Boolean);
  console.log(`Scope base: ${base}`);
} catch (error) {
  failures.push(error?.message || String(error));
}

for (const path of changed) {
  if (!allowed.has(path)) failures.push(`Out-of-scope changed file: ${path}`);
  if (forbiddenExact.has(path) || forbiddenPrefixes.some((prefix) => path.startsWith(prefix))) {
    failures.push(`Forbidden changed file: ${path}`);
  }
}

const home = requireTokens('src/pages/Home.tsx', [
  'HeroBannerSlider',
  'd68-home-investor-card__heading',
  'd68-home-investor-title-link',
]);
const homeCss = requireTokens('src/styles/pages/home.css', [
  '.d68-home-page .d68-home-hero',
  'Deals68 canonical Homepage Hero',
  'background:#FFFEF8!important',
  '.d68-home-investor-title-link',
  '-webkit-line-clamp:2',
]);
if (home.includes('HomepageHeroSlider')) failures.push('Home must not replace HeroBannerSlider with HomepageHeroSlider.');
if (home.includes('PUBLIC_INVESTOR_UI_CSS')) failures.push('Home must not inject route CSS at runtime.');
if (home.includes("from '../styles/index.css'")) failures.push('Home must not import the CSS entry file.');
if (homeCss.includes('.d68-home-investor-card:hover>a')) failures.push('Home card hover must not activate its CTA.');

const investors = requireTokens('src/pages/Investors.tsx', [
  'getMyBusiness',
  'listBusinessProposalStatuses',
  'proposalQuotaTotal',
  'sendBusinessProposalToInvestor',
  'quotaExceeded',
  'd68-investor-card__industries',
]);
if (investors.includes('InvestorProfileV10') || investors.includes('AdminInvestorsV10')) failures.push('Investors list contains forbidden replacement page references.');

const detail = requireTokens('src/pages/InvestorDetail.tsx', [
  'getInvestorByCode',
  'getMyBusiness',
  'get_investor_contact_if_connected',
  'get_public_investor_proposal_history',
  'sendBusinessProposalToInvestor',
  'sentProposal',
  'connected',
  'applySeo',
  'd68-id-cover-card',
  'd68-id-section--intro',
  'd68-id-section--criteria',
  'd68-id-section--markets',
  'd68-id-section--history',
  'd68-id-section--contact',
  'Gửi Hồ sơ Doanh nghiệp',
  'Ai được xem gì',
  'Khách chỉ xem được hồ sơ công khai',
  'Doanh nghiệp đã đăng nhập có thể gửi Hồ sơ DN/proposal',
  'Sau khi kết nối/duyệt: mở thông tin liên hệ',
]);
if (detail.includes('InvestorDetailV10')) failures.push('Investor Detail must remain the MAIN page, not InvestorDetailV10.');

const orderedDetailTokens = [
  'd68-id-cover-card',
  'd68-id-section--intro',
  'd68-id-section--criteria',
  'd68-id-section--markets',
  'd68-id-section--history',
  'd68-id-section--contact',
];
let previousIndex = -1;
for (const token of orderedDetailTokens) {
  const currentIndex = detail.indexOf(token);
  if (currentIndex <= previousIndex) failures.push(`Investor Detail section order is invalid at ${token}`);
  previousIndex = currentIndex;
}

const investorsCss = requireTokens('src/styles/pages/investors.css', [
  '.d68-investors-page .d68-investor-card:hover',
  '-webkit-line-clamp:3',
  '.d68-investor-card__industries',
  '-webkit-line-clamp:2',
  'background:#fffef8',
]);
const detailCss = requireTokens('src/styles/pages/investor-detail.css', [
  '.d68-id-cover-card',
  'grid-template-columns:minmax(0,1.12fr)',
  '.d68-id-cover-media img',
  '.d68-id-timeline--proposal>div:before',
  '.d68-id-section--intro{order:3}',
  '.d68-id-access{order:8}',
]);
for (const [path, css] of [['src/styles/pages/investors.css', investorsCss], ['src/styles/pages/investor-detail.css', detailCss]]) {
  if (/\n\s*(h1|h2|h3|article|section|\.card|\.row|\.col-)\b/.test(css)) failures.push(`${path}: contains an unscoped generic selector.`);
  if (css.includes('@import')) failures.push(`${path}: must not add CSS imports.`);
}

const cover = read('public/assets/investor-cover-default.svg');
if (!cover.includes('viewBox="0 0 1600 560"')) failures.push('Default Investor cover must be 1600×560 viewBox.');
if (cover.includes('<script')) failures.push('Default Investor cover must not contain scripts.');

if (!changed.length) failures.push('No changed files detected against building.');

if (failures.length) {
  console.error('✗ Public Investor UI scope check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('✓ Public Investor UI scope check: PASS');
console.log(`✓ ${changed.length} changed files are inside the release-safe whitelist.`);
console.log('✓ MAIN HeroBannerSlider, Proposal, contact unlock, history and SEO contracts remain present.');
console.log('✓ Investor Detail section order and mobile ordering contract are locked.');
