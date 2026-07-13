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
assert.doesNotMatch(
  dashboard,
  /className="d68-dashboard-grid4" style=\{\{ marginBottom: 18 \}\}/,
);
assert.doesNotMatch(
  dashboard,
  /Hạn mức proposal','Proposal quota/,
);

assert.match(
  css,
  /\.d68-business-dashboard-page \.d68-business-overview-metrics\{[\s\S]*margin-bottom:24px!important/,
);
assert.match(
  css,
  /@media\(max-width:700px\)\{[\s\S]*margin-bottom:20px!important/,
);

console.log('✓ G11 Business Dashboard static QA: PASS');
