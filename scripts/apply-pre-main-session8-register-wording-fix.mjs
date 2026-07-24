#!/usr/bin/env node
import fs from 'node:fs';

const file = 'scripts/deals68-session8-final-regression-check.mjs';
const source = fs.readFileSync(file, 'utf8');
const from = 'Tài sản hữu hình thuộc sở hữu doanh nghiệp sẽ được đưa vào giao dịch';
const to = 'Mô tả giá trị của các tài sản hữu hình thuộc sở hữu của doanh nghiệp sẽ được đưa vào giao dịch';
const count = source.split(from).length - 1;
if (count !== 1) {
  throw new Error(`Session 8 Register asset wording anchor count: ${count}`);
}
fs.writeFileSync(file, source.replace(from, to));
console.log('Session 8 Register asset wording reconciled.');
