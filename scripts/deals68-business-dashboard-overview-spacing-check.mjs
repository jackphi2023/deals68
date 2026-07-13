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
  /\.d68-business-overview-metrics[\s\S]*> \.d68-dashboard-card \{[\s\S]*margin-top: 0 !important;/,
);

assert.match(
  css,
  /@media \(max-width: 700px\) \{[\s\S]*padding-bottom: 20px;/,
);

console.log(
  '✓ G11 Business Dashboard static QA: PASS',
);
console.log(
  '✓ Metric cards 2-4 no longer inherit sibling-card top margin.',
);
console.log(
  '✓ Metric grid keeps 24px spacing above Proposal quota.',
);
console.log(
  '✓ Pending-review wording matches the 1-3 day review workflow.',
);
