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
  [
    "for (const token of ['Yêu cầu tài liệu', 'Request documents', 'd68-dashboard-btn gold']) {",
    "for (const token of ['Yêu cầu xem số liệu', 'Request financial access', 'd68-dashboard-btn gold']) {",
    'saved financial-access action',
  ],
  [
    '`Missing Saved action: ${token}`',
    '`Missing Saved financial-access action: ${token}`',
    'saved action failure label',
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
console.log('Session 8 Register, benchmark and saved financial-access contracts reconciled.');
