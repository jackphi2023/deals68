#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const files = [
  'src/pages/Businesses.tsx',
  'src/pages/BusinessDetail.tsx',
  'src/pages/Investors.tsx',
  'src/pages/InvestorDetail.tsx',
  'src/pages/Home.tsx',
  'src/pages/Register.tsx',
  'src/pages/BusinessDashboard.tsx',
  'src/pages/Admin.tsx'
];
const forbidden = [
  'REFERENCE_DEALS', 'REFERENCE_INVESTORS', 'FALLBACK_INVESTORS', 'detailData',
  'D68-NEW', 'autoEnglishFromVietnamese(', '237 hồ sơ', 'qualityScore: 84', 'return 7.2', '|| 70'
];
let failed = false;
for (const f of files) {
  const p = path.resolve(f);
  if (!fs.existsSync(p)) continue;
  const s = fs.readFileSync(p, 'utf8');
  for (const token of forbidden) {
    if (s.includes(token)) {
      console.error(`[truth-scan] ${f}: found forbidden token ${JSON.stringify(token)}`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log('Production truth scan passed.');
