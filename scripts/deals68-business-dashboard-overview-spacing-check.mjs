import fs from 'node:fs';
import assert from 'node:assert/strict';

const dashboard = fs.readFileSync(
  'src/pages/BusinessDashboard.tsx',
  'utf8',
);

const css = fs.readFileSync(
  'src/styles/pages/business-dashboard.css',
  'utf8',
);

const proposals = fs.readFileSync(
  'src/lib/proposals.ts',
  'utf8',
);

function section(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.notEqual(start, -1, `Missing section start: ${startToken}`);
  assert.notEqual(end, -1, `Missing section end: ${endToken}`);
  return source.slice(start, end);
}

assert.match(
  dashboard,
  /className="d68-dashboard-grid4 d68-business-overview-metrics"/,
);

assert.match(
  dashboard,
  /Hạn mức Gửi Hồ sơ doanh nghiệp\/Proposal/,
);

assert.match(
  dashboard,
  /Business profile \/ Proposal sending quota/,
);

assert.match(
  dashboard,
  /Thông tin doanh nghiệp của bạn đang được duyệt trong 1-3 ngày tới/,
);

assert.doesNotMatch(
  dashboard,
  /Bạn đã cập nhật thành công, đội ngũ Deals68 sẽ duyệt/,
);

assert.doesNotMatch(
  dashboard,
  /className="d68-dashboard-grid4" style=\{\{ marginBottom: 18 \}\}/,
);

assert.match(
  css,
  /\.d68-business-dashboard-page \.d68-business-overview-metrics \{[\s\S]*padding-bottom: 24px;/,
);

assert.match(
  css,
  /\.d68-business-overview-metrics[\s\S]*> \.d68-dashboard-card \{[\s\S]*height: 100%;[\s\S]*margin-top: 0 !important;/,
);

assert.match(
  css,
  /@media \(max-width: 700px\) \{[\s\S]*padding-bottom: 20px;/,
);

// Session 5: the Admin-set quota_total is the source of truth when valid.
assert.match(
  dashboard,
  /const quotaTotal = proposalQuotaTotal\(b\);/,
);
assert.match(
  proposals,
  /const explicit = Number\(business\?\.quota_total \|\| 0\);/,
);
assert.match(
  proposals,
  /Number\.isFinite\(explicit\) && explicit > 0 \? explicit : base/,
);
assert.match(
  proposals,
  /const quotaTotal = proposalQuotaTotal\(input\.business\);/,
);

// Session 5: profile edits stay in pending moderation and do not publish directly.
const saveProfile = section(
  dashboard,
  'async function saveProfile',
  'async function fileChange',
);
assert.match(saveProfile, /pending_changes_json: pending/);
assert.match(saveProfile, /pending_submitted_at: new Date\(\)\.toISOString\(\)/);
assert.match(saveProfile, /pending_submitted_by: profile\.id/);
assert.match(saveProfile, /moderation_status: 'pending_admin_review'/);
assert.match(saveProfile, /if \(!hasPublicSnapshot\) \{ patch\.status = 'pending_admin_review'; patch\.visible = false; \}/);
assert.doesNotMatch(saveProfile, /public_snapshot_json\s*:/);
assert.doesNotMatch(saveProfile, /visible\s*:\s*true/);

// Session 5: user-facing valuation copy no longer uses “offer”.
const valuationOverview = section(
  dashboard,
  'function ValuationOverviewBox',
  'export default function BusinessDashboard',
);
const profileForm = section(
  dashboard,
  'function ProfileForm',
  'function CurrencyField',
);
assert.doesNotMatch(valuationOverview, /\boffer\b/i);
assert.doesNotMatch(profileForm, /\boffer\b/i);
assert.match(
  valuationOverview,
  /Suy từ số tiền đề xuất và tỷ lệ cổ phần\./,
);
assert.match(
  profileForm,
  /Nhu cầu vốn\/Giá chào/,
);

console.log(
  '✓ G11 / Session 5 Business Dashboard static QA: PASS',
);
console.log(
  '✓ Metric cards 2-4 no longer inherit sibling-card top margin.',
);
console.log(
  '✓ Metric grid keeps 24px spacing above Proposal quota.',
);
console.log(
  '✓ Admin quota_total override drives Dashboard and proposal enforcement.',
);
console.log(
  '✓ Business profile edits remain pending for Admin review.',
);
console.log(
  '✓ User-facing valuation copy contains no “offer” wording.',
);
console.log(
  '✓ Pending-review wording matches the 1-3 day review workflow.',
);
