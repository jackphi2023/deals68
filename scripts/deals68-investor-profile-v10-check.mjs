#!/usr/bin/env node
import fs from 'node:fs';
import ts from 'typescript';

const failures = [];
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const requiredFiles = [
  'src/lib/investorProfileService.ts',
  'src/lib/investorCriteriaReviewService.ts',
  'src/lib/investorAdminV10.ts',
  'src/pages/AdminBannersV10.tsx',
  'src/pages/AdminInvestorsV10.tsx',
  'src/pages/InvestorProfileV10.tsx',
  'src/pages/InvestorDetailV10.tsx',
  'src/components/admin/InvestorAppetiteEditorV10.tsx',
  'src/components/admin/InvestorCoverEditorV10.tsx',
  'src/components/investor/InvestorAppetiteFormV10.tsx',
  'src/components/investor/InvestorPublicHeroV10.tsx',
  'src/components/investor/InvestorPublicSectionsV10.tsx',
  'src/styles/pages/investor-profile-v10.css',
  'src/styles/pages/entity-ui-v12.css',
  'public/assets/investor-cover-default.svg',
  'supabase/migrations/20260715045336_investor_profile_cover_appetite_v1.sql',
  'supabase/migrations/20260715071812_investor_profile_cover_appetite_v2.sql',
  'supabase/migrations/20260715085429_investor_profile_cover_appetite_v3_privilege_hardening.sql',
];

for (const path of requiredFiles) {
  if (!fs.existsSync(path)) failures.push(`Missing ${path}`);
}

function sourceFile(path) {
  return ts.createSourceFile(
    path,
    read(path),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

for (const path of requiredFiles.filter((item) => /\.(ts|tsx|mjs)$/.test(item))) {
  if (!fs.existsSync(path)) continue;
  const source = sourceFile(path);
  for (const diagnostic of source.parseDiagnostics) {
    failures.push(`${path}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  }
}

function constantValue(path, name) {
  const source = sourceFile(path);
  let result;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) {
      if (ts.isStringLiteral(node.initializer) || ts.isNumericLiteral(node.initializer)) result = node.initializer.text;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
}

function functionParameterNames(path, functionName) {
  const source = sourceFile(path);
  const names = [];
  const visit = (node) => {
    if (
      (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) &&
      node.name?.text === functionName &&
      node.parameters[0]?.name &&
      ts.isObjectBindingPattern(node.parameters[0].name)
    ) {
      for (const element of node.parameters[0].name.elements) names.push(element.name.getText(source));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

const servicePath = 'src/lib/investorProfileService.ts';
if (fs.existsSync(servicePath)) {
  const expected = {
    INVESTOR_COVER_BUCKET: 'site-banners',
    INVESTOR_COVER_PLACEMENT: 'investor_cover_default',
    INVESTOR_COVER_WIDTH: '1600',
    INVESTOR_COVER_HEIGHT: '560',
    INVESTOR_APPETITE_MAX_LENGTH: '5000',
    DEFAULT_INVESTOR_COVER: '/assets/investor-cover-default.svg',
  };
  for (const [name, value] of Object.entries(expected)) {
    if (constantValue(servicePath, name) !== value) failures.push(`${name} must equal ${value}`);
  }
  const service = read(servicePath);
  for (const rpc of [
    'admin_set_default_investor_cover',
    'admin_set_investor_cover',
    'submit_my_investor_appetite',
    'admin_approve_investor_appetite',
  ]) {
    if (!service.includes(`'${rpc}'`)) failures.push(`Service missing RPC ${rpc}`);
  }
  if (service.includes('as unknown as')) failures.push('Blind double cast remains in Investor service');
}

const reviewService = read('src/lib/investorCriteriaReviewService.ts');
for (const rpc of [
  'submit_my_investor_criteria_review',
  'admin_approve_investor_criteria',
]) {
  if (!reviewService.includes(`'${rpc}'`)) failures.push(`Reviewed criteria service missing RPC ${rpc}`);
}

const app = read('src/App.tsx');
for (const token of [
  "import InvestorDetailV10 from './pages/InvestorDetailV10'",
  "import('./pages/InvestorProfileV10')",
  "import('./pages/AdminBannersV10')",
  "import('./pages/AdminInvestorsV10')",
  '<Route path="/admin/banners" element={<AdminBannersV10/>}/>',
  '<Route path="/admin/investors" element={<AdminInvestorsV10/>}/>',
]) {
  if (!app.includes(token)) failures.push(`App integration missing ${token}`);
}

const adminHelper = read('src/lib/investorAdminV10.ts');
if (!adminHelper.includes('hasPendingInvestorAppetiteV10')) failures.push('Backward-compatible pending appetite helper missing');
if (!adminHelper.includes('pendingInvestorCriteriaKeysV10')) failures.push('Expanded pending criteria helper missing');
if (!adminHelper.includes('hasOwnProperty.call')) failures.push('Pending criteria must use property presence, not truthiness');

for (const [path, requiredToken] of [
  ['src/components/admin/InvestorAppetiteEditorV10.tsx', 'pendingInvestorReviewKeys'],
  ['src/components/investor/InvestorAppetiteFormV10.tsx', 'pendingInvestorReviewKeys'],
]) {
  const source = read(path);
  if (!source.includes(requiredToken)) failures.push(`${path} does not preserve reviewed pending criteria`);
  if (!/setMessage\(''\);[\s\S]*?\}, \[investor\.id\]\);/.test(source)) {
    failures.push(`${path} must reset feedback only when Investor ID changes`);
  }
}

const heroPath = 'src/components/investor/InvestorPublicHeroV10.tsx';
const hero = read(heroPath);
const heroParameters = functionParameterNames(heroPath, 'InvestorPublicHeroV10');
if (heroParameters.includes('description')) failures.push('Public Hero must not accept description');
if (!hero.includes('investor.code')) failures.push('Public Hero must display Investor code');
if (!hero.includes('d68-id-cover__eyebrow')) failures.push('Public Hero code eyebrow is missing');
if (/<p[\s>]/.test(hero)) failures.push('Public Hero must not render a description paragraph');
if (!hero.includes('d68-id-cover__badges')) failures.push('Public Hero badges are missing');
if (!hero.includes('countryFlag(country)')) failures.push('Public Hero country badge must use an ISO country flag');
if (!hero.includes('127397 + char.charCodeAt(0)')) failures.push('Public Hero country flag must use the ISO regional-indicator conversion');
if (hero.includes('📍')) failures.push('Public Hero country badge must not use the obsolete location pin');

const detail = read('src/pages/InvestorDetailV10.tsx');
const mainIndex = detail.indexOf('<div className="d68-id-main">');
const heroIndex = detail.indexOf('<InvestorPublicHeroV10', mainIndex);
const sectionsIndex = detail.indexOf('<InvestorPublicSectionsV10', mainIndex);
const asideIndex = detail.indexOf('<aside className="d68-id-side d68-id-side--sticky">');
if (!(mainIndex >= 0 && heroIndex > mainIndex && sectionsIndex > heroIndex && asideIndex > sectionsIndex)) {
  failures.push('Public detail must order main → Hero → sections → unchanged sidebar');
}
if (/<InvestorPublicHeroV10\b[^>]*\bdescription=/.test(detail)) failures.push('Description is still passed to Public Hero');
if (detail.includes("'Tổng quan đầu tư'")) failures.push('Obsolete Investment overview card remains');
for (const sidebarToken of [
  "T(lang, 'Gửi Hồ sơ Doanh nghiệp', 'Send business profile')",
  'onClick={sendProposal}',
  "T(lang, 'Ai được xem gì', 'Who can see what')",
  "T(lang, 'Khách chỉ xem được hồ sơ công khai'",
  "T(lang, 'Doanh nghiệp đã đăng nhập có thể gửi Hồ sơ DN/Proposal'",
  "T(lang, 'Sau khi kết nối/duyệt: mở thông tin liên hệ do Nhà đầu tư cài đặt (SĐT, Email)'",
]) {
  if (!detail.includes(sidebarToken)) failures.push(`Sidebar access contract missing: ${sidebarToken}`);
}

const sections = read('src/components/investor/InvestorPublicSectionsV10.tsx');
for (const testId of [
  'investor-introduction',
  'investor-criteria',
  'investor-markets',
  'investor-proposal-history',
  'investor-contact',
]) {
  if (!sections.includes(`data-testid="${testId}"`)) failures.push(`Missing public section ${testId}`);
}
if (sections.includes('d68-v10-appetite-public')) failures.push('Investment appetite must not be a separate card');
if (/data-testid="investor-industries"/.test(sections)) failures.push('Industries must not be a separate card');
if (!sections.includes("label={T(lang, 'Khẩu vị đầu tư'")) failures.push('Appetite row is missing from Investment criteria');
if (!sections.includes('d68-id-sector-block')) failures.push('Industries are not nested in Investment criteria');
if (!sections.includes('d68-id-sector-tags')) failures.push('Sector tags are not explicitly scoped');
if (!sections.includes('countryFlag(item)')) failures.push('Market chips must include country flags');
for (const icon of ['Info', 'Target', 'Globe2', 'History', 'LockKeyhole']) {
  if (!sections.includes(`<${icon} `)) failures.push(`Line icon ${icon} is missing`);
}
for (const obsoleteIcon of ['icon="ⓘ"', 'icon="◎"', 'icon="🌐"', 'icon="◷"', 'icon="🔒"']) {
  if (sections.includes(obsoleteIcon)) failures.push(`Obsolete character icon remains: ${obsoleteIcon}`);
}

const css = read('src/styles/pages/investor-profile-v10.css');
for (const token of [
  'grid-template-columns:minmax(0,1fr) 332px',
  'height:clamp(300px,22vw,350px)',
  'max-height:350px',
  'object-position:62% center',
  '.d68-id-criteria-table',
  '.d68-id-market-tags',
]) {
  if (!css.includes(token)) failures.push(`Public CSS contract missing ${token}`);
}
if (!css.includes('@media (max-width:1050px)')) failures.push('Tablet/mobile one-column breakpoint is missing');

const entityCss = read('src/styles/pages/entity-ui-v12.css');
for (const token of [
  'background:#f8fdfa!important',
  'background:#fffef8!important',
  '-webkit-line-clamp:3',
  '.d68-id-cover__eyebrow',
  'top:26px',
  '.d68-id-section-title > span svg',
  '.d68-id-sector-tags span',
  'background:#e7f6fd!important',
  'color:#1596cc!important',
  '.d68-id-timeline--proposal > div::before',
  'left:9px',
  '.d68-dashboard-page .d68-dashboard-head h1:hover',
  '.d68-admin-page .d68-admin-business-table tbody tr:hover',
]) {
  if (!entityCss.includes(token)) failures.push(`Entity UI V12 CSS contract missing ${token}`);
}
if (!read('src/styles/index.css').includes("@import './pages/entity-ui-v12.css' layer(d68-overrides);")) {
  failures.push('Entity UI V12 stylesheet is not registered');
}

const cover = read('public/assets/investor-cover-default.svg');
if (!cover.startsWith('<svg')) failures.push('Default Investor cover is not valid SVG text');
if (!cover.includes('width="1600"') || !cover.includes('height="560"')) failures.push('Default Investor cover is not 1600x560');
if (!cover.includes('data:image/webp;base64,')) failures.push('Provided Investor cover artwork is not embedded');
if (!cover.trimEnd().endsWith('</svg>')) failures.push('Default Investor cover SVG is truncated');

for (const [path, tokens] of [
  ['supabase/migrations/20260715045336_investor_profile_cover_appetite_v1.sql', ['investor_cover_default', 'submit_my_investor_appetite', 'admin_approve_investor_appetite', 'admin_set_investor_cover']],
  ['supabase/migrations/20260715071812_investor_profile_cover_appetite_v2.sql', ['admin_set_default_investor_cover', 'investment_appetite_too_long', 'invalid_default_cover_path']],
  ['supabase/migrations/20260715085429_investor_profile_cover_appetite_v3_privilege_hardening.sql', ['from anon, public', 'to authenticated, service_role']],
]) {
  const sql = read(path).toLowerCase();
  if (!sql.trimStart().startsWith('begin;') || !sql.trimEnd().endsWith('commit;')) failures.push(`${path} must be transactional`);
  for (const token of tokens) if (!sql.includes(token.toLowerCase())) failures.push(`${path} missing ${token}`);
}

for (const obsolete of [
  'src/components/PortalSlot.tsx',
  'src/pages/AdminEnhanced.tsx',
  'src/pages/InvestorDashboardEnhanced.tsx',
]) {
  if (fs.existsSync(obsolete)) failures.push(`Obsolete duplicate-state wrapper remains: ${obsolete}`);
}

if (failures.length) {
  console.error('✗ Deals68 Investor Profile V12 check failed:');
  failures.forEach((item) => console.error(`  - ${item}`));
  process.exit(1);
}

console.log('✓ Deals68 Investor Profile V12 check: PASS');
console.log('✓ Hero remains first in the main column and its ID eyebrow is pinned near the top.');
console.log('✓ Introduction, criteria, markets, proposal history and contact keep the approved order.');
console.log('✓ Access sidebar now states guest, signed-in business and connected/approved visibility levels.');
console.log('✓ Section icons are single-stroke Lucide icons and sector tags use Deals blue.');
console.log('✓ Homepage/list/dashboard/admin entity-name hover contracts are scoped.');
console.log('✓ Cover source remains 1600x560 while desktop display is constrained to 300–350px.');
