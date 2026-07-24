#!/usr/bin/env node
import fs from 'node:fs';

const file = 'scripts/deals68-session8-final-regression-check.mjs';
let source = fs.readFileSync(file, 'utf8');

const replacements = [
  [
    'Tài sản hữu hình thuộc sở hữu doanh nghiệp sẽ được đưa vào giao dịch',
    'Mô tả giá trị của các tài sản hữu hình thuộc sở hữu của doanh nghiệp sẽ được đưa vào giao dịch',
    'Register asset wording',
  ],
  [
    "  'benchmark: benchmarkResult',",
    "  'benchmark: {',\n  'asset_inputs: benchmarkAssetInputs',",
    'nested benchmark payload',
  ],
];

for (const [from, to, label] of replacements) {
  const count = source.split(from).length - 1;
  if (count !== 1) {
    throw new Error(`Session 8 ${label} anchor count: ${count}`);
  }
  source = source.replace(from, to);
}

fs.writeFileSync(file, source);
console.log('Session 8 Register wording and benchmark contract reconciled.');
