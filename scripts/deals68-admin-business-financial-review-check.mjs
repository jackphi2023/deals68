import fs from 'node:fs';
import assert from 'node:assert/strict';

const admin = fs.readFileSync('src/pages/Admin.tsx', 'utf8');
const css = fs.readFileSync('src/styles/pages/admin.css', 'utf8');

for (const token of [
  'BUSINESS_FINANCIAL_REVIEW_FIELDS',
  "labels.push('Thông tin Tài sản & Giao dịch')",
  'const changedFinancialRows = BUSINESS_FINANCIAL_REVIEW_FIELDS.filter',
  'financial_input: {',
  '...approvedFinancialInput',
  "assets_owned_vi: text(form.get('assets_owned_vi'))",
  "assets_owned_en: text(form.get('assets_owned_en'))",
  "excluded_physical_asset_value_vi: text(form.get('excluded_physical_asset_value_vi'))",
  "excluded_physical_asset_value_en: text(form.get('excluded_physical_asset_value_en'))",
  'Thông tin Tài sản & Giao dịch',
  'Assets & transaction information',
  'Business vừa cập nhật, cần duyệt',
  'name="assets_owned_vi"',
  'name="assets_owned_en"',
  'name="excluded_physical_asset_value_vi"',
  'name="excluded_physical_asset_value_en"',
]) assert.ok(admin.includes(token), `Missing Session 6 token: ${token}`);

assert.match(admin, /const approvedFinancialInput = \{[\s\S]*business\.financial_input[\s\S]*public_snapshot_json[\s\S]*pending_changes_json[\s\S]*\};/);
assert.match(admin, /changedAny\([\s\S]*pendingFinancial,[\s\S]*approvedFinancial,[\s\S]*BUSINESS_FINANCIAL_REVIEW_KEYS/);
assert.match(admin, /approve_business_pending_changes[\s\S]*admin_snapshot: adminSnapshot/);
assert.match(css, /\.d68-admin-financial-review-box\{/);
assert.match(css, /\.d68-admin-span4\{grid-column:1 \/ -1\}/);

console.log('✓ Session 6 Admin Business financial moderation contract: PASS');
