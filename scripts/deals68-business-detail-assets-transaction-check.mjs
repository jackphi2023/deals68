import fs from 'node:fs';
import assert from 'node:assert/strict';

const detail = fs.readFileSync('src/pages/BusinessDetail.tsx', 'utf8');
const css = fs.readFileSync('src/styles/pages/business-detail.css', 'utf8');
const data = fs.readFileSync('src/lib/data.ts', 'utf8');

for (const token of [
  'approvedFinancialInputOf',
  'public_snapshot_json',
  'const transactionInfo = useMemo<TransactionInfoRow[]>',
  'Thông tin Tài sản & Giao dịch',
  'Assets & Transaction Information',
  'Tài sản hữu hình & vô hình DN sở hữu',
  'Tangible & intangible assets owned by the business',
  'Tài sản hữu hình thuộc sở hữu doanh nghiệp sẽ được đưa vào giao dịch',
  'Tangible assets owned by the business that will be included in the transaction',
  'included_tangible_assets_vi',
  'included_tangible_assets_en',
  'Lý do gọi vốn/chuyển nhượng',
  'Fundraising / transfer rationale',
  'd68-detail-transaction-info',
  'd68-detail-card d68-detail-card--bqs',
  "isOwnerBusiness ? T(lang, 'Bản xem của doanh nghiệp', 'Business owner view')",
  "const businessListPath = lang === 'en' ? '/en/businesses' : '/businesses'",
]) assert.ok(detail.includes(token), `Missing Session 7 token: ${token}`);

for (const forbidden of [
  '<InfoSection title="Business Quality Score">',
  "isOwnerBusiness ? `👁 ${T(lang, 'Bản xem của doanh nghiệp', 'Business owner view')}`",
  'pending_changes_json',
]) assert.ok(!detail.includes(forbidden), `Forbidden Session 7 token remains: ${forbidden}`);

assert.match(detail, /approvedFinancialInputOf\(business: any\)[\s\S]*public_snapshot_json[\s\S]*snapshot\.financial_input/);
assert.match(detail, /getBusinessBySlug\(slug\)/);
assert.match(data, /getBusinessBySlug[\s\S]*public_businesses_safe[\s\S]*getPublicBusinessView/);
assert.match(css, /\.d68-detail-card--bqs \.d68-bqs-card\.is-real\{border:0;padding:0;box-shadow:none\}/);
assert.match(css, /\.d68-detail-card--bqs \.d68-bqs-head\{justify-content:center;text-align:center\}/);
assert.match(css, /\.d68-detail-transaction-row\{display:flex;flex-direction:column/);
assert.match(css, /@media\(max-width:620px\)\{\.d68-detail-transaction-row\{gap:7px;padding:14px 0/);

console.log('✓ Session 7 Business Detail assets & transaction contract: PASS');
