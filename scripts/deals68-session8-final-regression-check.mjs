#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path) {
  assert.ok(fs.existsSync(path), `Missing required file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function section(source, startToken, endToken, label) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.notEqual(start, -1, `Missing ${label} start: ${startToken}`);
  assert.notEqual(end, -1, `Missing ${label} end: ${endToken}`);
  return source.slice(start, end);
}

function occurrences(source, token) {
  return source.split(token).length - 1;
}

const home = read('src/pages/Home.tsx');
const register = read('src/pages/Register.tsx');
const investorDashboard = read('src/pages/InvestorDashboard.tsx');
const investorDetailCss = read('src/styles/pages/investor-detail.css');
const businessDashboard = read('src/pages/BusinessDashboard.tsx');
const admin = read('src/pages/Admin.tsx');
const businessDetail = read('src/pages/BusinessDetail.tsx');
const businessDetailCss = read('src/styles/pages/business-detail.css');
const releaseCleanup = read('src/styles/pages/release-cleanup.css');
const migration = read(
  'supabase/migrations/20260717215300_business_public_financial_snapshot_v1.sql',
);

// Session 1 — role cards use the approved monochrome Lucide icons, not emoji.
const roleCards = section(home, 'const roleCards = [', 'const industries = [', 'Homepage role cards');
for (const token of [
  'Building2',
  'Briefcase',
  'Handshake',
  "color: '#1BADEA'",
  "color: '#F2B51D'",
  "color: '#16A34A'",
]) {
  assert.ok(roleCards.includes(token), `Missing Homepage role-card token: ${token}`);
}
for (const emoji of ['🏢', '💼', '🤝']) {
  assert.ok(!roleCards.includes(emoji), `Emoji role icon remains: ${emoji}`);
}

// Session 2 — direct Investor registration has no preselected 12-month term.
const investorTerm = section(
  register,
  'const [investorPackageSelected',
  'const [promoCode',
  'Investor registration term',
);
assert.match(investorTerm, /useState<number \| null>/);
assert.match(investorTerm, /: 0\),/);
assert.match(investorTerm, /\[4, 8, 12, 16, 24\]\.includes\(requestedMonths\)/);
assert.doesNotMatch(
  investorTerm,
  /investorMonths[\s\S]{0,400}:\s*12\)/,
  'Investor term defaults to 12 months',
);
assert.match(register, /label=\{T\(lang, 'Giới thiệu', 'Introduction'\)\}[\s\S]{0,100}\bspaced\b/);

// Session 2 — excluded physical asset value is free text and valuation/upload metadata survives.
const assetsSection = section(
  register,
  "T(lang, 'Thông tin tài sản & nguồn số liệu'",
  '{paymentSection}',
  'Business asset registration section',
);
assert.match(
  assetsSection,
  /Giá trị tài sản vật chất KHÔNG nằm trong giao dịch[\s\S]*?<textarea[\s\S]*?value=\{excludedAssetValue\}/,
);
assert.doesNotMatch(
  register,
  /excluded_physical_asset_value:\s*parseFormattedNumber/,
);
for (const token of [
  'excluded_physical_asset_value: excludedAssetValue',
  'excluded_physical_asset_value_vi:',
  'excluded_physical_asset_value_en:',
  'benchmark: benchmarkResult',
  'upload_plan: uploadPlan',
]) {
  assert.ok(register.includes(token), `Missing Register financial_input token: ${token}`);
}

// Session 3 — removed Investor Dashboard buttons do not return.
const matchCard = section(
  investorDashboard,
  'function MatchCard',
  'function InterestRows',
  'Investor criteria match cards',
);
for (const forbidden of ['Xem doanh nghiệp', 'View business']) {
  assert.ok(!matchCard.includes(forbidden), `Removed MatchCard action returned: ${forbidden}`);
}

const savedRows = section(
  investorDashboard,
  'function InterestRows',
  'function ProposalRows',
  'Investor saved rows',
);
for (const token of ['Yêu cầu tài liệu', 'Request documents', 'd68-dashboard-btn gold']) {
  assert.ok(savedRows.includes(token), `Missing Saved action: ${token}`);
}
for (const forbidden of ['Xem chi tiết', 'View details']) {
  assert.ok(!savedRows.includes(forbidden), `Removed Saved action returned: ${forbidden}`);
}

const proposalRows = section(
  investorDashboard,
  'function ProposalRows',
  'export default function InvestorDashboard',
  'Investor proposal rows',
);
for (const forbidden of ['Xem hồ sơ doanh nghiệp', 'View business profile']) {
  assert.ok(!proposalRows.includes(forbidden), `Removed Proposal action returned: ${forbidden}`);
}

// Session 4 — Investor Detail hides the public code in the cover and aligns mobile title left.
assert.match(investorDetailCss, /\.d68-id-cover__eyebrow span\{display:none\}/);
assert.match(
  investorDetailCss,
  /@media\(max-width:700px\)\{[\s\S]*?\.d68-id-cover-copy h1\{[\s\S]*?text-align:left/,
);

// Session 5 — Business edits remain pending and preserve nested financial metadata.
const saveProfile = section(
  businessDashboard,
  'async function saveProfile',
  'async function fileChange',
  'Business saveProfile',
);
for (const token of [
  'pending_changes_json: pending',
  "moderation_status: 'pending_admin_review'",
  'financial_input: financialInputOf(ownerView)',
]) {
  assert.ok(saveProfile.includes(token), `Missing Business moderation token: ${token}`);
}
for (const forbidden of ['public_snapshot_json:', 'visible: true']) {
  assert.ok(!saveProfile.includes(forbidden), `Business can self-publish through saveProfile: ${forbidden}`);
}
assert.match(
  businessDashboard,
  /function financialInputOf[\s\S]*return \{ \.\.\.direct, \.\.\.pending \};/,
);
assert.match(
  businessDashboard,
  /financial_input:\s*\{[\s\S]*\.\.\.\(b\?\.financial_input \|\| \{\}\)[\s\S]*\.\.\.\(pending\?\.financial_input \|\| \{\}\)/,
);

// Session 6 — Admin approval is the only public promotion path.
for (const token of [
  'approve_business_pending_changes',
  'admin_snapshot: adminSnapshot',
  '...approvedFinancialInput',
]) {
  assert.ok(admin.includes(token), `Missing Admin approval token: ${token}`);
}

// Session 7 — Business Detail has one BQS title and reads approved public assets.
assert.equal(
  occurrences(businessDetail, 'Business Quality Score'),
  1,
  'Business Detail must render exactly one Business Quality Score title',
);
for (const token of [
  'approvedFinancialInputOf',
  'public_snapshot_json',
  'Thông tin Tài sản & Giao dịch',
  'Assets & Transaction Information',
  'd68-detail-card d68-detail-card--bqs',
]) {
  assert.ok(businessDetail.includes(token), `Missing Business Detail token: ${token}`);
}
assert.ok(!businessDetail.includes('pending_changes_json'));
assert.match(
  businessDetailCss,
  /\.d68-detail-card--bqs \.d68-bqs-card\.is-real\{border:0;padding:0;box-shadow:none\}/,
);

// Session 8 cleanup — compatibility CSS remains a comment-only stub.
const activeReleaseCleanup = releaseCleanup
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .trim();
assert.equal(activeReleaseCleanup, '', 'release-cleanup.css contains active CSS');
assert.match(releaseCleanup, /No active CSS is allowed in this file/);

// Session 8 migration — only sanitized approved asset fields enter the public snapshot.
for (const token of [
  'next_financial_input jsonb',
  'next_public_financial_input jsonb',
  "'financial_input', next_public_financial_input",
  'financial_input = next_financial_input',
  "b.moderation_status = 'approved'",
  'b.last_approved_at is not null',
  "'financial_input', base.public_financial_input",
  "coalesce(b.public_snapshot_json->'financial_input', '{}'::jsonb) as public_financial_input",
  'alter view public.public_businesses_safe set (security_invoker = true)',
  'revoke all on function public.approve_business_pending_changes',
]) {
  assert.ok(migration.includes(token), `Missing Session 8 migration token: ${token}`);
}
for (const privateToken of [
  "'benchmark',",
  "'upload_plan',",
  "'financial_source',",
]) {
  assert.ok(
    !migration.includes(privateToken),
    `Private financial_input key exposed by public migration: ${privateToken}`,
  );
}

console.log('✓ Deals68 Session 8 final regression and cleanup check: PASS');
console.log('✓ Sessions 1–7 requested UI/business invariants remain intact.');
console.log('✓ Business edits remain pending; Admin approval owns public_snapshot_json.');
console.log('✓ Public Business financial_input is sanitized to approved asset fields only.');
console.log('✓ release-cleanup.css remains comment-only with no active CSS.');
