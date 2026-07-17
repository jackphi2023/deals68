#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const failures = [];
const allowed = new Set([
  'src/lib/investorCriteria.ts',
  'src/lib/investorListing.ts',
  'src/lib/investorDisplay.ts',
  'src/lib/banners.ts',
  'src/components/HomepageHeroSlider.tsx',
  'src/components/investor/InvestorCriteriaTagPickers.tsx',
  'src/components/investor/IndustryTagPicker.tsx',
  'src/components/admin/InvestorAdminReviewPanel.tsx',
  'src/pages/Register.tsx',
  'src/pages/Home.tsx',
  'src/pages/InvestorDashboard.tsx',
  'src/pages/Admin.tsx',
  'src/pages/InvestorDetail.tsx',
  'src/pages/Investors.tsx',
  'src/styles/pages/investor-workflow.css',
  'src/styles/pages/dashboard.css',
  'src/styles/pages/admin.css',
  'src/styles/pages/investor-detail.css',
  'src/styles/pages/investors.css',
  'src/styles/final/release-foundation.css',
  'supabase/migrations/20260717073001_investor_criteria_review_v1.sql',
  'supabase/migrations/20260717073045_investor_profile_contract_ui_v2.sql',
  'docs/INVESTOR_CRITERIA_REVIEW_V1.md',
  'scripts/deals68-investor-profile-contract-v2-check.mjs',
  'scripts/deals68-investor-profile-postgres-v2-test.mjs',
  'scripts/deals68-migration-state-check.mjs',
  'scripts/deals68-package-checks.mjs',
  'scripts/scope-check-investor-criteria-review-v1.mjs',
  'package.json',
  'package-lock.json',
]);

const forbiddenExact = new Set([
  'src/App.tsx',
  'src/lib/supabase.ts',
  'src/styles/index.css',
  'src/styles/pages/release-cleanup.css',
  'netlify.toml',
]);
const forbiddenPrefixes = [
  '.github/workflows/',
  'src/contexts/',
  'src/lib/proposals',
  'src/lib/payment',
  'src/pages/InvestorDetailV10',
  'src/pages/InvestorProfileV10',
  'src/pages/AdminInvestorsV10',
  'src/pages/AdminBannersV10',
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
      // Try the next explicit stacked base.
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
  'labelInvestorRiskAppetite',
  'formatInvestorReturnExpectation',
]);
if (model.includes('pending_profile_changes')) {
  failures.push('Public criteria model must not read pending_profile_changes.');
}
if (model.includes('criteria.investment_appetite ||')) {
  failures.push('Public appetite must fall back only between the VI/EN fields.');
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
  'labelInvestorRiskAppetite',
  'formatInvestorReturnExpectation',
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

const register = requireTokens('src/pages/Register.tsx', [
  'InvestorTypeTagPicker',
  'InvestorStageTagPicker',
  'InvestorMarketTagPicker',
  'InvestorDealTypeTagPicker',
  'investment_appetite_vi',
  'investment_appetite_en',
  "desc_vi: lang === 'vi' ? generalDesc : ''",
  "desc_en: lang === 'en' ? generalDesc : ''",
  "investment_appetite_vi: lang === 'vi' ? appetiteDesc : ''",
  "investment_appetite_en: lang === 'en' ? appetiteDesc : ''",
  "'Public introduction; do not include email or phone.'",
  'investorTypes',
  'stages: investorStages',
  'createSignupBundle',
]);
if (register.includes('INV-NEW-')) {
  failures.push('Register must not generate temporary Investor public codes.');
}
if (register.includes('investment_appetite: appetiteDesc')) {
  failures.push('Register must not copy the route-language appetite into the legacy shared field.');
}

const dashboard = requireTokens('src/pages/InvestorDashboard.tsx', [
  'InvestorTypeTagPicker',
  'InvestorStageTagPicker',
  'InvestorMarketTagPicker',
  'InvestorDealTypeTagPicker',
  'update_my_investor_profile',
  'investment_appetite_vi',
  'investment_appetite_en',
  'Giới thiệu (VN)',
  'Giới thiệu (EN)',
  'Khẩu vị đầu tư (VN)',
  'Khẩu vị đầu tư (EN)',
  'pending_profile_changes',
  'd68-dashboard-nav-icon',
  'InvestorBillingPanel',
  'updateProposalStatus',
  "<option value=\"\">{T(lang, 'Chưa chọn', 'Not selected')}</option>",
]);
if (dashboard.includes("form.get('riskAppetite') || 'balanced'")) {
  failures.push('Dashboard must not manufacture a default risk appetite.');
}

const adminPage = requireTokens('src/pages/Admin.tsx', [
  'InvestorAdminReviewPanel',
  "tab === 'investors'",
  'AdminBannerManager',
  'AdminOperationsOverview',
  'updateProposalStatus',
  'adminSetPaymentOrderStatus',
  'd68-admin-side',
]);
for (const forbidden of [
  'InvestorDetailV10',
  'InvestorProfileV10',
  'AdminInvestorsV10',
  'AdminBannersV10',
]) {
  if (adminPage.includes(forbidden)) {
    failures.push(`Admin shell must not reference ${forbidden}.`);
  }
}

const adminInvestor = requireTokens(
  'src/components/admin/InvestorAdminReviewPanel.tsx',
  [
    'pending_profile_changes',
    'admin_update_investor_profile',
    'approve_introduction: approveIntroduction',
    'InvestorTypeTagPicker',
    'InvestorStageTagPicker',
    'InvestorMarketTagPicker',
    'InvestorDealTypeTagPicker',
    'Giới thiệu (VN)',
    'Giới thiệu (EN)',
    'Khẩu vị đầu tư (VN)',
    'Khẩu vị đầu tư (EN)',
    'investment_appetite_vi',
    'investment_appetite_en',
    'Lưu thông tin Investor',
    'Lưu & duyệt Giới thiệu',
    'uploadInvestorCoverImage',
    'cover_image_url',
    'visible',
  ],
);
if (adminInvestor.includes("approvedCriteria.riskAppetite || 'balanced'")) {
  failures.push('Admin must not manufacture a default risk appetite.');
}
if (adminInvestor.includes("supabase.rpc('admin_approve_investor_profile_changes'")) {
  failures.push('Admin UI must use the direct-save V2 RPC.');
}

requireTokens('src/lib/banners.ts', [
  'uploadInvestorCoverImage',
  'investor-covers/',
  "from('site-banners')",
  'getPublicUrl(path)',
]);

requireTokens('src/components/HomepageHeroSlider.tsx', [
  'HomepageHeroMedia',
  'data-hero-variant',
  'mobileUrl',
  'desktopUrl',
  'prefers-reduced-motion: reduce',
]);

requireTokens('src/pages/Home.tsx', [
  'HomepageHeroSlider',
  'd68-home-hero-media--mobile',
  'box-shadow:0 2px 8px',
]);

requireTokens('src/styles/final/release-foundation.css', [
  'Card interaction contract',
  '.d68-investors-page .d68-investor-card:hover',
  'box-shadow:0 2px 8px',
  'border-color:#E7EDF3!important',
]);

const migration = requireTokens(
  'supabase/migrations/20260717073001_investor_criteria_review_v1.sql',
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
    'investment_appetite_vi',
    'investment_appetite_en',
    'create or replace view public.public_investors_safe',
    "'investorTypes', coalesce(",
    "'stages', coalesce(",
    "'investment_appetite_vi', criteria -> 'investment_appetite_vi'",
    "'investment_appetite_en', criteria -> 'investment_appetite_en'",
    'with (security_barrier = true, security_invoker = true)',
    'publish_profile boolean default false',
  ],
);
if (/where\s+code\s+!~/i.test(migration)) {
  failures.push('Migration must not rewrite every legacy Investor code.');
}
if (!migration.includes("or code ilike 'INV-NEW-%'")) {
  failures.push('Migration must restrict code backfill to placeholders.');
}
if (!migration.includes("perform pg_advisory_xact_lock(hashtext('deals68.investor_public_code')::bigint)")) {
  failures.push('Investor code generation must be serialized against concurrent inserts.');
}
if (!migration.includes("revoke all on function public.ensure_investor_public_code() from public")) {
  failures.push('Investor code trigger function must not remain executable by PUBLIC.');
}
if (!migration.includes("jsonb_build_object(") || !migration.includes("when jsonb_typeof(i.criteria) = 'object' then i.criteria")) {
  failures.push('Canonical criteria backfill must preserve existing JSON object keys.');
}
if (/v_profile_criteria\s*->\s*'investment_appetite'[\s\S]{0,250}'\{investment_appetite_vi\}'/i.test(migration)) {
  failures.push('Migration must not copy the legacy appetite into the Vietnamese field.');
}
if (migration.includes('drop table public.investors')) {
  failures.push('Migration must not replace the investors table.');
}
const publicInvestorView = migration.match(
  /create or replace view public\.public_investors_safe[\s\S]*?grant select on public\.public_investors_safe to anon, authenticated;/i,
)?.[0] || '';
if (!publicInvestorView || /pending_profile_changes/i.test(publicInvestorView)) {
  failures.push('Public Investor view must never expose pending profile changes.');
}

const contractV2 = requireTokens(
  'supabase/migrations/20260717073045_investor_profile_contract_ui_v2.sql',
  [
    'admin_update_investor_profile',
    "'criteria_pending', false",
    "'profile_pending', false",
    "- 'ticket_min' - 'ticket_max' - 'criteria'",
    "'investment_appetite_vi', criteria -> 'investment_appetite_vi'",
    "'investment_appetite_en', criteria -> 'investment_appetite_en'",
    'with (security_barrier = true, security_invoker = true)',
    'revoke all on function public.admin_update_investor_profile',
  ],
);
if (/jsonb_set\(v_pending_criteria[\s\S]*riskAppetite/i.test(contractV2)) {
  failures.push('V2 must not stage Investor criteria for Admin review.');
}

if (!changed.length) failures.push('No PR 3 changed files detected.');

if (failures.length) {
  console.error('✗ Investor Criteria Review V1 scope check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✓ Investor Criteria Review V1 scope check: PASS');
console.log(`✓ ${changed.length} changed files are inside the stacked whitelist.`);
console.log('✓ Register stores Introduction/Appetite in the selected UI language only.');
console.log('✓ Dashboard/Admin expose independent VI and EN fields.');
console.log('✓ Public pages use approved canonical criteria only.');
console.log('✓ Existing Dashboard/Admin shells and Proposal/Payment flows remain mounted.');
console.log('✓ Criteria save immediately; only Introduction/assets remain moderated.');
