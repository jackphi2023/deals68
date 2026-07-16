#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const failures = [];
const allowed = new Set([
  'src/lib/investorCriteria.ts',
  'src/lib/investorListing.ts',
  'src/lib/investorDisplay.ts',
  'src/components/investor/InvestorCriteriaTagPickers.tsx',
  'src/components/investor/IndustryTagPicker.tsx',
  'src/pages/Register.tsx',
  'src/pages/InvestorDashboard.tsx',
  'src/pages/Admin.tsx',
  'src/pages/InvestorDetail.tsx',
  'src/pages/Investors.tsx',
  'src/styles/pages/investor-workflow.css',
  'src/styles/pages/dashboard.css',
  'src/styles/pages/admin.css',
  'src/styles/pages/investor-detail.css',
  'src/styles/pages/investors.css',
  'supabase/migrations/20260716124500_investor_criteria_review_v1.sql',
  'docs/INVESTOR_CRITERIA_REVIEW_V1.md',
  'scripts/scope-check-investor-criteria-review-v1.mjs',
]);

const forbiddenExact = new Set([
  'src/App.tsx',
  'src/lib/supabase.ts',
  'src/styles/index.css',
  'src/styles/pages/release-cleanup.css',
  'netlify.toml',
  'package.json',
  'package-lock.json',
]);

const forbiddenPrefixes = [
  '.github/workflows/',
  'src/contexts/',
  'src/lib/proposals',
  'src/lib/payment',
  'src/pages/InvestorDetailV10',
  'src/pages/InvestorProfileV10',
  'src/pages/AdminInvestorsV10',
  'src/pages/InvestorRegisterV14',
];

function git(args) {
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
    'origin/release-safe/investor-cover-admin-v1',
    'release-safe/investor-cover-admin-v1',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      git(['rev-parse', '--verify', candidate]);
      return candidate;
    } catch {
      // Continue to the next explicit stacked base.
    }
  }

  throw new Error(
    'Không xác định được stacked base PR 2. Fetch ' +
      'release-safe/investor-cover-admin-v1 hoặc đặt D68_SCOPE_BASE_SHA.',
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
  changed = git(['diff', '--name-only', `${base}...HEAD`])
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);
  console.log(`Scope base: ${base}`);
} catch (error) {
  failures.push(error?.message || String(error));
}

for (const path of changed) {
  if (!allowed.has(path)) failures.push(`Out-of-scope changed file: ${path}`);
  if (
    forbiddenExact.has(path) ||
    forbiddenPrefixes.some((prefix) => path.startsWith(prefix))
  ) {
    failures.push(`Forbidden changed file: ${path}`);
  }
}

const model = requireTokens('src/lib/investorCriteria.ts', [
  'INVESTOR_TYPE_VALUES',
  'INVESTOR_STAGE_VALUES',
  'investorTypes',
  'stages',
  'sectors',
  'dealTypes',
  'targetCountries',
  'investment_appetite_vi',
  'investment_appetite_en',
  'normalizeInvestorTypes',
  'normalizeInvestorStages',
  'approvedInvestorAppetite',
]);
if (model.includes('pending_profile_changes')) {
  failures.push('Public criteria model must not read pending_profile_changes.');
}

requireTokens('src/components/investor/InvestorCriteriaTagPickers.tsx', [
  'CriteriaTagPicker',
  'InvestorTypeTagPicker',
  'InvestorStageTagPicker',
  'InvestorMarketTagPicker',
  'type="hidden"',
  'aria-pressed',
]);

const listing = requireTokens('src/lib/investorListing.ts', [
  'approvedInvestorTypes',
  'approvedInvestorStages',
  'approvedInvestorSectors',
  'approvedInvestorDealTypes',
  'approvedInvestorCountries',
  'matchesCanonicalInvestorFilters',
]);
if (listing.includes('pending_profile_changes')) {
  failures.push('Public listing must not inspect pending_profile_changes.');
}

const detail = requireTokens('src/pages/InvestorDetail.tsx', [
  'getInvestorByCode',
  'getMyBusiness',
  'get_investor_contact_if_connected',
  'get_public_investor_proposal_history',
  'sendBusinessProposalToInvestor',
  'investorPublicTypeLabels',
  'investorPublicStageLabels',
  'approvedInvestorAppetite',
  'data-cover-source={resolvedCover.source}',
  'Ai được xem gì',
]);
if (detail.includes('pending_profile_changes')) {
  failures.push('Investor Detail must not read pending changes.');
}

const investors = requireTokens('src/pages/Investors.tsx', [
  'listCanonicalInvestors',
  'approvedInvestorTypes',
  'approvedInvestorStages',
  'approvedInvestorSectors',
  'approvedInvestorDealTypes',
  'd68-investor-card__industries',
  'sendBusinessProposalToInvestor',
  'proposalQuotaTotal',
]);
if (investors.includes('pending_profile_changes')) {
  failures.push('Investor List must not read pending changes.');
}

const migration = requireTokens(
  'supabase/migrations/20260716124500_investor_criteria_review_v1.sql',
  [
    'generate_investor_public_code',
    "'INV-' || lpad",
    'trg_ensure_investor_public_code',
    "code ilike 'INV-NEW-%'",
    'update_my_investor_profile',
    'pending_profile_changes',
    'admin_approve_investor_profile_changes',
    'public.is_admin_user()',
    "'{investorTypes}'",
    "'{stages}'",
    "'{sectors}'",
    "'{dealTypes}'",
    "'{targetCountries}'",
  ],
);

if (/where\s+code\s+!~/i.test(migration)) {
  failures.push('Migration must not rewrite every legacy Investor code.');
}
if (!migration.includes("or code ilike 'INV-NEW-%'")) {
  failures.push('Migration must restrict code backfill to placeholders.');
}
if (migration.includes('drop table public.investors')) {
  failures.push('Migration must not replace the investors table.');
}

const register = read('src/pages/Register.tsx');
if (changed.includes('src/pages/Register.tsx')) {
  for (const token of [
    'InvestorTypeTagPicker',
    'InvestorStageTagPicker',
    'InvestorMarketTagPicker',
    'investment_appetite_vi',
    'investorTypes',
    'stages',
    'createSignupBundle',
  ]) {
    if (!register.includes(token)) {
      failures.push(`Register missing ${token}`);
    }
  }
}

const dashboard = read('src/pages/InvestorDashboard.tsx');
if (changed.includes('src/pages/InvestorDashboard.tsx')) {
  for (const token of [
    'InvestorTypeTagPicker',
    'InvestorStageTagPicker',
    'InvestorMarketTagPicker',
    'update_my_investor_profile',
    'investment_appetite_vi',
    'pending_profile_changes',
    'd68-dashboard-nav-icon',
  ]) {
    if (!dashboard.includes(token)) {
      failures.push(`Investor Dashboard missing ${token}`);
    }
  }
}

const admin = read('src/pages/Admin.tsx');
if (changed.includes('src/pages/Admin.tsx')) {
  for (const token of [
    'admin_approve_investor_profile_changes',
    'pending_profile_changes',
    'Quản trị Nhà đầu tư',
    'investorNeedsReview',
  ]) {
    if (!admin.includes(token)) failures.push(`Admin missing ${token}`);
  }
}

for (const required of [
  'src/pages/Register.tsx',
  'src/pages/InvestorDashboard.tsx',
  'src/pages/Admin.tsx',
]) {
  if (changed.includes(required)) continue;
  console.log(`Pending UI wiring: ${required}`);
}

if (!changed.length) failures.push('No PR 3 changed files detected.');

if (failures.length) {
  console.error('✗ Investor Criteria Review V1 scope check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✓ Investor Criteria Review V1 scope check: PASS');
console.log(`✓ ${changed.length} changed files are inside the stacked whitelist.`);
console.log('✓ Public pages use approved canonical criteria only.');
console.log('✓ Proposal, Payment, Auth route and Netlify files remain out of scope.');
console.log('✓ Migration preserves valid legacy codes and moderates public edits.');
