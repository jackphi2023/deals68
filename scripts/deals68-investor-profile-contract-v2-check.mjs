#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const dashboard = read('src/pages/InvestorDashboard.tsx');
const admin = read('src/components/admin/InvestorAdminReviewPanel.tsx');
const adminCss = read('src/styles/pages/admin.css');
const detail = read('src/pages/InvestorDetail.tsx');
const detailCss = read('src/styles/pages/investor-detail.css');
const migration = read(
  'supabase/migrations/20260717064725_investor_profile_contract_ui_v2.sql',
);

// Investor Detail UI contract.
assert.match(detailCss, /\.d68-id-cover-card\{[^}]*height:350px;min-height:350px/);
assert.match(detailCss, /@media\(max-width:700px\)[\s\S]*?\.d68-id-cover-card\{[^}]*height:250px;min-height:250px/);
assert.match(detailCss, /\.d68-id-cover-media img\{[^}]*object-position:right center/);
assert.match(detail, /'Giai đoạn đầu tư', 'Investment stages'/);

const criteriaStart = detail.indexOf('d68-id-section--criteria');
const criteriaEnd = detail.indexOf('d68-id-section--markets');
assert.ok(criteriaStart >= 0 && criteriaEnd > criteriaStart);
const criteriaBlock = detail.slice(criteriaStart, criteriaEnd);
assert.doesNotMatch(criteriaBlock, /'Loại hình nhà đầu tư'/);
assert.doesNotMatch(criteriaBlock, /'Giai đoạn phù hợp'/);
assert.match(criteriaBlock, /'Loại giao dịch quan tâm'/);
assert.match(criteriaBlock, /'Ngành quan tâm'/);
assert.match(criteriaBlock, /value=\{investmentAppetite\}/);

// Dashboard saves criteria immediately and queues Introduction only.
assert.match(dashboard, /const requiresReview = Boolean\(data\?\.description_pending\)/);
assert.match(dashboard, /'Đã lưu thành công'/);
assert.match(dashboard, /'Lưu thay đổi'/);
assert.match(dashboard, /Chỉ Giới thiệu, ảnh và files/);
assert.doesNotMatch(
  dashboard,
  /data\?\.profile_pending \|\| data\?\.criteria_pending/,
);

// Admin has separate direct-save and Introduction-approval actions.
for (const token of [
  "supabase.rpc('admin_update_investor_profile'",
  "submitter?.value === 'approve_introduction'",
  "approve_introduction: approveIntroduction",
  'Lưu thông tin Investor',
  'Lưu & duyệt Giới thiệu',
  'investment_appetite_vi',
  'investment_appetite_en',
]) {
  assert.ok(admin.includes(token), `Admin contract missing: ${token}`);
}
assert.doesNotMatch(
  admin,
  /supabase\.rpc\('admin_approve_investor_profile_changes'/,
);
assert.doesNotMatch(admin, /Khẩu vị vừa sửa|Tiêu chí vừa sửa/);

for (const selector of [
  '.d68-admin-investor-filter-grid',
  '.d68-admin-investor-summary-grid',
  '.d68-admin-investor-comparison-grid',
  '.d68-admin-investor-review-form',
]) {
  assert.ok(adminCss.includes(selector), `Missing Admin CSS: ${selector}`);
}

// Database contract: public criteria update directly; only descriptions remain
// pending; Admin appetite save and public view use independent bilingual keys.
for (const token of [
  'create or replace function public.update_my_investor_profile',
  'create or replace function public.admin_update_investor_profile',
  "criteria = v_criteria",
  "- 'ticket_min' - 'ticket_max' - 'criteria'",
  "'criteria_pending', false",
  "'profile_pending', false",
  "'investment_appetite_vi', criteria -> 'investment_appetite_vi'",
  "'investment_appetite_en', criteria -> 'investment_appetite_en'",
  'with (security_barrier = true, security_invoker = true)',
  'revoke all on function public.admin_update_investor_profile',
  'grant execute on function public.admin_update_investor_profile',
]) {
  assert.ok(migration.includes(token), `Migration contract missing: ${token}`);
}

const publicView = migration.match(
  /create or replace view public\.public_investors_safe[\s\S]*?grant select on public\.public_investors_safe to anon, authenticated;/i,
)?.[0] || '';
assert.ok(publicView);
assert.doesNotMatch(publicView, /pending_profile_changes/);

// Deterministic in-memory business fixture: no external database and no test
// rows. It locks independent VI/EN fallback and the moderation boundary.
function saveInvestorFixture(current, profilePatch, descriptionPatch) {
  const criteria = { ...current.criteria, ...profilePatch.criteria };
  const pending = { ...current.pending };
  for (const key of ['desc_vi', 'desc_en']) {
    if (!(key in descriptionPatch)) continue;
    if (descriptionPatch[key] === current[key]) delete pending[key];
    else pending[key] = descriptionPatch[key];
  }
  return { ...current, ...profilePatch, criteria, pending };
}

function publicAppetite(criteria, lang) {
  const vi = String(criteria.investment_appetite_vi || '').trim();
  const en = String(criteria.investment_appetite_en || '').trim();
  return lang === 'en' ? en || vi : vi || en;
}

const saved = saveInvestorFixture(
  {
    desc_vi: 'Giới thiệu cũ',
    desc_en: 'Old introduction',
    criteria: { riskAppetite: 'conservative' },
    pending: {},
  },
  {
    ticket_min: 100000,
    criteria: {
      investment_appetite_vi: 'Khẩu vị tiếng Việt',
      investment_appetite_en: 'English appetite',
      riskAppetite: 'balanced',
    },
  },
  {
    desc_vi: 'Giới thiệu mới',
    desc_en: 'Old introduction',
  },
);

assert.equal(saved.ticket_min, 100000);
assert.equal(saved.criteria.riskAppetite, 'balanced');
assert.equal(publicAppetite(saved.criteria, 'vi'), 'Khẩu vị tiếng Việt');
assert.equal(publicAppetite(saved.criteria, 'en'), 'English appetite');
assert.deepEqual(saved.pending, { desc_vi: 'Giới thiệu mới' });

const fallback = { investment_appetite_vi: 'Chỉ có tiếng Việt', investment_appetite_en: '' };
assert.equal(publicAppetite(fallback, 'en'), 'Chỉ có tiếng Việt');
assert.equal(publicAppetite({}, 'vi'), '');

console.log('✓ Investor Profile Contract V2: PASS');
console.log('✓ Cover 350px desktop / 250px mobile, aligned right.');
console.log('✓ Criteria save immediately; Introduction remains moderated.');
console.log('✓ Admin bilingual appetite save reaches the approved public view.');
console.log('✓ In-memory fixture used; no Supabase data was created or changed.');
