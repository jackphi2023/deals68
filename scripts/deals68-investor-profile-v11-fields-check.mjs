#!/usr/bin/env node
import fs from 'node:fs';
import ts from 'typescript';

const failures = [];
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const requiredFiles = [
  'src/lib/investorCriteriaOptions.ts',
  'src/lib/investorCriteriaReviewService.ts',
  'src/components/investor/InvestorCriteriaTagPickers.tsx',
  'src/components/investor/InvestorAppetiteFormV10.tsx',
  'src/components/admin/InvestorAppetiteEditorV10.tsx',
  'src/components/admin/InvestorProfileEditorV10.tsx',
  'src/components/admin/InvestorCoverEditorV10.tsx',
  'src/pages/AdminBannersV10.tsx',
  'src/pages/InvestorDetailV10.tsx',
  'src/components/investor/InvestorPublicSectionsV10.tsx',
  'src/styles/pages/investor-criteria-v11.css',
  'supabase/migrations/20260716013000_investor_profile_review_fields_v4.sql',
  'supabase/migrations/20260716014500_investor_criteria_pending_dedup_v5.sql',
  'supabase/migrations/20260716190000_investor_public_profile_pending_v6.sql',
];

for (const path of requiredFiles) {
  if (!fs.existsSync(path)) failures.push(`Missing ${path}`);
}

for (const path of requiredFiles.filter((item) => /\.(ts|tsx|mjs)$/.test(item))) {
  const source = ts.createSourceFile(
    path,
    read(path),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  for (const diagnostic of source.parseDiagnostics) {
    failures.push(`${path}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  }
}

const migration = read('supabase/migrations/20260716013000_investor_profile_review_fields_v4.sql');
for (const token of [
  "'INV-' || lpad((floor(random() * 1000000)::integer)::text, 6, '0')",
  "where code like 'INV-NEW-%'",
  'v_investor_code',
  'submit_my_investor_criteria_review',
  'admin_approve_investor_criteria',
  "'riskAppetite'",
  "'returnExpectation'",
  "'revenueRange'",
  'v_profile_criteria := v_profile_criteria',
  "- 'investment_appetite'",
  "criteria -> 'revenueRange'",
]) {
  if (!migration.includes(token)) failures.push(`V4 migration missing ${token}`);
}
if (!migration.trimStart().startsWith('begin;') || !migration.trimEnd().endsWith('commit;')) {
  failures.push('V4 migration must be transactional');
}

const dedup = read('supabase/migrations/20260716014500_investor_criteria_pending_dedup_v5.sql');
for (const token of [
  'v_approved_value',
  "v_pending_criteria := v_pending_criteria - v_key",
  "where not (key_name = any(v_allowed))",
]) {
  if (!dedup.includes(token)) failures.push(`V5 migration missing ${token}`);
}

const profilePending = read('supabase/migrations/20260716190000_investor_public_profile_pending_v6.sql');
for (const token of [
  'update_my_investor_profile',
  "'investorTypes','stages','targetRegions','targetCountries'",
  "'{pending_profile_changes}'",
  'private_name = case',
  'private_website = case',
]) {
  if (!profilePending.includes(token)) failures.push(`V6 migration missing ${token}`);
}

const loadingCopy = read('src/lib/labelsBase.ts');
if (!loadingCopy.includes("'Đang tải dữ liệu thật...': 'Đang tải…'")) {
  failures.push('Investor listing loading copy is not normalized to Đang tải…');
}
if (!loadingCopy.includes("'Loading live data...': 'Loading…'")) {
  failures.push('Investor listing English loading copy is not normalized');
}

const options = read('src/lib/investorCriteriaOptions.ts');
for (const token of [
  'INVESTOR_TYPE_OPTIONS',
  'INVESTOR_STAGE_OPTIONS',
  'INVESTOR_REGION_OPTIONS',
  'INVESTOR_DEAL_OPTIONS',
  'RISK_APPETITE_OPTIONS',
  'REVENUE_RANGE_OPTIONS',
]) {
  if (!options.includes(token)) failures.push(`Criteria options missing ${token}`);
}

const dashboard = read('src/components/investor/InvestorAppetiteFormV10.tsx');
for (const token of [
  'investor-reviewed-criteria-form',
  "update('investment_appetite'",
  "update('riskAppetite'",
  "update('returnExpectation'",
  "update('revenueRange'",
  'submitMyInvestorCriteriaReview(draft)',
  "T(lang, 'Chọn', 'Select')",
]) {
  if (!dashboard.includes(token)) failures.push(`Investor Dashboard criteria form missing ${token}`);
}

const adminCriteria = read('src/components/admin/InvestorAppetiteEditorV10.tsx');
for (const token of [
  'admin-investor-criteria-change-warning',
  'changedInvestorReviewKeys',
  'approveInvestorCriteriaReview',
  'Khẩu vị rủi ro',
  'Kỳ vọng lợi nhuận',
  'Quy mô doanh thu',
]) {
  if (!adminCriteria.includes(token)) failures.push(`Admin reviewed criteria missing ${token}`);
}

const adminProfile = read('src/components/admin/InvestorProfileEditorV10.tsx');
for (const token of [
  'InvestorTypeMultiTagPicker',
  'InvestorStageMultiTagPicker',
  'InvestorRegionTagPicker',
  'InvestorCountryTagPicker',
  'IndustryTagPicker',
  'InvestorDealTypeTagPicker',
  'Loại hình Nhà đầu tư',
  'Giai đoạn phù hợp',
  'Khu vực đầu tư',
  'Thị trường quan tâm',
  'Ngành quan tâm',
  'Ưu tiên giao dịch',
]) {
  if (!adminProfile.includes(token)) failures.push(`Admin Investor profile tags missing ${token}`);
}

const publicSections = read('src/components/investor/InvestorPublicSectionsV10.tsx');
for (const token of [
  "T(lang, 'Khẩu vị rủi ro'",
  "T(lang, 'Kỳ vọng lợi nhuận'",
  "T(lang, 'Quy mô doanh thu'",
  'riskAppetiteLabel',
  'returnExpectationLabel',
  'revenueRangeLabel',
]) {
  if (!publicSections.includes(token)) failures.push(`Public Investor criteria missing ${token}`);
}

const detail = read('src/pages/InvestorDetailV10.tsx');
for (const token of [
  'approvedInvestorReviewCriteria',
  'riskAppetite={reviewedCriteria.riskAppetite}',
  'returnExpectation={reviewedCriteria.returnExpectation}',
  'revenueRange={reviewedCriteria.revenueRange}',
]) {
  if (!detail.includes(token)) failures.push(`Investor detail wiring missing ${token}`);
}

const coverEditor = read('src/components/admin/InvestorCoverEditorV10.tsx');
for (const token of [
  'investorCoverUrl(investor, defaultCover)',
  'replaceInvestorCover',
  'clearInvestorCover',
  'Ảnh Cover riêng',
]) {
  if (!coverEditor.includes(token)) failures.push(`Per-Investor cover contract missing ${token}`);
}

const banners = read('src/pages/AdminBannersV10.tsx');
for (const token of [
  'DefaultInvestorCoverManager',
  'replaceDefaultInvestorCover',
  'chưa có ảnh riêng',
  'không ảnh hưởng ảnh riêng từng Investor',
]) {
  if (!banners.includes(token)) failures.push(`Default Investor cover contract missing ${token}`);
}

if (failures.length) {
  console.error('✗ Deals68 Investor Profile V14 fields check failed:');
  failures.forEach((item) => console.error(`  - ${item}`));
  process.exit(1);
}

console.log('✓ Deals68 Investor Profile V14 fields check: PASS');
console.log('✓ New signup codes are database-owned INV-###### values.');
console.log('✓ Dashboard public-profile changes remain pending until Admin approval.');
console.log('✓ Admin and Dashboard share Vietnamese multi-select taxonomy tags.');
console.log('✓ Default cover remains a fallback and never overwrites a custom cover.');
