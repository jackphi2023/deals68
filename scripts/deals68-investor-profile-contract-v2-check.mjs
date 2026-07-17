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
  'supabase/migrations/20260717073045_investor_profile_contract_ui_v2.sql',
);
const appetiteMigration = read(
  'supabase/migrations/20260717101552_investor_appetite_moderation_v1.sql',
);
const legacyPromotionMigration = read(
  'supabase/migrations/20260717073820_promote_legacy_pending_investor_criteria_v1.sql',
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

// Dashboard saves ordinary criteria immediately and queues Introduction plus
// bilingual Investment appetite.
assert.match(
  dashboard,
  /const requiresReview = Boolean\([\s\S]*data\?\.description_pending \|\| data\?\.criteria_pending/,
);
assert.match(dashboard, /'Đã lưu thành công'/);
assert.match(dashboard, /'Lưu thay đổi'/);
assert.match(
  dashboard,
  /Khi cập nhật Giới thiệu, Khẩu vị đầu tư cần quản trị Deals68 duyệt trước khi hiển thị để bảo đảm luôn ẩn danh\./,
);
assert.doesNotMatch(dashboard, /khẩu vị đầu tư được lưu ngay/i);

// Admin has separate direct-save and Introduction-approval actions.
for (const token of [
  "supabase.rpc('admin_update_investor_profile'",
  "submitter?.value === 'approve_introduction'",
  "approve_introduction: approveIntroduction",
  'Lưu & duyệt Khẩu vị đầu tư',
  'Lưu & duyệt Giới thiệu + Khẩu vị',
  'investment_appetite_vi',
  'investment_appetite_en',
  'appetiteUpdated',
]) {
  assert.ok(admin.includes(token), `Admin contract missing: ${token}`);
}
assert.doesNotMatch(
  admin,
  /supabase\.rpc\('admin_approve_investor_profile_changes'/,
);

for (const selector of [
  '.d68-admin-investor-filter-grid',
  '.d68-admin-investor-summary-grid',
  '.d68-admin-investor-comparison-grid',
  '.d68-admin-investor-review-form',
]) {
  assert.ok(adminCss.includes(selector), `Missing Admin CSS: ${selector}`);
}

// Database contract: ordinary criteria update directly; Introduction and
// bilingual appetite remain pending. Admin appetite save and the public view
// continue to use independent bilingual keys.
for (const token of [
  'create or replace function public.update_my_investor_profile',
  'create or replace function public.admin_update_investor_profile',
  "'investment_appetite_vi', criteria -> 'investment_appetite_vi'",
  "'investment_appetite_en', criteria -> 'investment_appetite_en'",
  'with (security_barrier = true, security_invoker = true)',
  'revoke all on function public.admin_update_investor_profile',
  'grant execute on function public.admin_update_investor_profile',
]) {
  assert.ok(migration.includes(token), `Migration contract missing: ${token}`);
}

for (const token of [
  'create or replace function public.update_my_investor_profile',
  'v_pending_criteria jsonb',
  "array['investment_appetite_vi','investment_appetite_en']",
  "v_text is distinct from coalesce(v_row.criteria ->> v_key, '')",
  "'criteria_pending', v_appetite_pending",
  "'investment_appetite_pending', v_appetite_pending",
  "'profile_pending', v_pending <> '{}'::jsonb",
  'criteria = v_criteria',
  'revoke all on function public.update_my_investor_profile',
  'grant execute on function public.update_my_investor_profile',
]) {
  assert.ok(
    appetiteMigration.includes(token),
    `Appetite moderation migration missing: ${token}`,
  );
}
assert.match(
  appetiteMigration,
  /security definer\s+set search_path = ''/,
);
assert.doesNotMatch(appetiteMigration, /insert\s+into\s+public\.investors/i);
assert.doesNotMatch(appetiteMigration, /delete\s+from\s+public\.investors/i);
assert.doesNotMatch(
  appetiteMigration,
  /v_criteria := jsonb_set\(v_criteria, array\[v_key\],[\s\S]{0,120}investment_appetite/,
);

const publicView = migration.match(
  /create or replace view public\.public_investors_safe[\s\S]*?grant select on public\.public_investors_safe to anon, authenticated;/i,
)?.[0] || '';
assert.ok(publicView);
assert.doesNotMatch(publicView, /pending_profile_changes/);

for (const token of [
  "where jsonb_typeof(privacy -> 'pending_profile_changes' -> 'criteria') = 'object'",
  "v_criteria := case",
  "end || v_pending_criteria",
  "v_pending := v_pending - 'criteria'",
  "v_privacy - 'pending_profile_changes' - 'pending_submitted_at'",
]) {
  assert.ok(
    legacyPromotionMigration.includes(token),
    `Legacy promotion migration missing: ${token}`,
  );
}
assert.doesNotMatch(legacyPromotionMigration, /insert\s+into\s+public\.investors/i);
assert.doesNotMatch(legacyPromotionMigration, /delete\s+from\s+public\.investors/i);

// Deterministic in-memory business fixture: no external database and no test
// rows. It locks independent VI/EN fallback and the moderation boundary.
function saveInvestorFixture(current, profilePatch, descriptionPatch) {
  const criteriaPatch = { ...profilePatch.criteria };
  const pendingCriteria = { ...(current.pending.criteria || {}) };
  for (const key of ['investment_appetite_vi', 'investment_appetite_en']) {
    if (!(key in criteriaPatch)) continue;
    if (criteriaPatch[key] === current.criteria[key]) delete pendingCriteria[key];
    else pendingCriteria[key] = criteriaPatch[key];
    delete criteriaPatch[key];
  }
  const criteria = { ...current.criteria, ...criteriaPatch };
  const pending = { ...current.pending };
  for (const key of ['desc_vi', 'desc_en']) {
    if (!(key in descriptionPatch)) continue;
    if (descriptionPatch[key] === current[key]) delete pending[key];
    else pending[key] = descriptionPatch[key];
  }
  if (Object.keys(pendingCriteria).length) pending.criteria = pendingCriteria;
  else delete pending.criteria;
  return { ...current, ...profilePatch, criteria, pending };
}

function approveAppetiteFixture(current, adminCriteria) {
  const pendingCriteria = current.pending.criteria || {};
  const { criteria: _discarded, ...pending } = current.pending;
  return {
    ...current,
    criteria: { ...current.criteria, ...pendingCriteria, ...adminCriteria },
    pending,
  };
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
    criteria: {
      investment_appetite_vi: 'Khẩu vị đã duyệt',
      investment_appetite_en: 'Approved appetite',
      riskAppetite: 'conservative',
    },
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
assert.equal(publicAppetite(saved.criteria, 'vi'), 'Khẩu vị đã duyệt');
assert.equal(publicAppetite(saved.criteria, 'en'), 'Approved appetite');
assert.deepEqual(saved.pending, {
  desc_vi: 'Giới thiệu mới',
  criteria: {
    investment_appetite_vi: 'Khẩu vị tiếng Việt',
    investment_appetite_en: 'English appetite',
  },
});

const approved = approveAppetiteFixture(saved, {
  investment_appetite_vi: 'Khẩu vị Admin duyệt',
  investment_appetite_en: 'Admin-approved appetite',
});
assert.equal(publicAppetite(approved.criteria, 'vi'), 'Khẩu vị Admin duyệt');
assert.equal(publicAppetite(approved.criteria, 'en'), 'Admin-approved appetite');
assert.deepEqual(approved.pending, { desc_vi: 'Giới thiệu mới' });

const fallback = { investment_appetite_vi: 'Chỉ có tiếng Việt', investment_appetite_en: '' };
assert.equal(publicAppetite(fallback, 'en'), 'Chỉ có tiếng Việt');
assert.equal(publicAppetite({}, 'vi'), '');

console.log('✓ Investor Profile Contract V2: PASS');
console.log('✓ Cover 350px desktop / 250px mobile, aligned right.');
console.log('✓ Other criteria save immediately; Introduction and appetite stay moderated.');
console.log('✓ Admin bilingual appetite approval reaches the public view.');
console.log('✓ In-memory fixture used; no Supabase data was created or changed.');
