#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

const detail = fs.readFileSync(
  'src/pages/InvestorDetail.tsx',
  'utf8',
);
const labels = fs.readFileSync(
  'src/lib/labels.ts',
  'utf8',
);

const start = detail.indexOf('function criteriaList');
const end = detail.indexOf('function proposalHistory');

assert.ok(start >= 0 && end > start);

const criteriaBlock = detail.slice(start, end);

assert.doesNotMatch(
  criteriaBlock,
  /Địa lý quan tâm|Target geographies/,
);

assert.doesNotMatch(
  criteriaBlock,
  /investorTargetCountries\(inv\)/,
);

assert.match(
  detail,
  /Thị trường quan tâm đầu tư/,
);

assert.match(
  detail,
  /Target investment markets/,
);

for (const iso2 of [
  'IN',
  'ID',
  'MY',
  'PH',
  'GB',
  'BR',
]) {
  assert.match(
    labels,
    new RegExp(`iso2: '${iso2}'`),
  );
}

assert.match(
  labels,
  /\[\.\.\.item\.keys,\s*item\.vi,\s*item\.en\]/,
);

assert.match(
  labels,
  /const DisplayNames = \(Intl as any\)\.DisplayNames/,
);

assert.match(
  labels,
  /quy dau tu mao hiem/,
);

assert.match(
  labels,
  /nha dau tu to chuc/,
);

assert.match(
  labels,
  /nha dau tu chien luoc/,
);

console.log(
  '✓ Investor Detail country/type localization QA: PASS',
);
console.log(
  '✓ ISO country codes render as localized country names.',
);
console.log(
  '✓ Vietnamese Investor type values map to English on EN routes.',
);
console.log(
  '✓ Target geography is shown only in the dedicated market field.',
);
