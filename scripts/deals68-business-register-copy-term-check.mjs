#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const register = fs.readFileSync(
  path.join(root, 'src/pages/Register.tsx'),
  'utf8',
);
const failures = [];

function requireToken(token, message) {
  if (!register.includes(token)) failures.push(message);
}

function forbidToken(token, message) {
  if (register.includes(token)) failures.push(message);
}

for (const [token, message] of [
  ['Doanh thu năm gần nhất (VNĐ)', 'Vietnamese annual-revenue label lacks VNĐ'],
  ['Latest annual revenue (VND)', 'English annual-revenue label lacks VND'],
  ['Số tiền gọi vốn / giá trị giao dịch mong muốn (VNĐ)', 'Vietnamese ask label lacks VNĐ'],
  ['Capital sought / desired transaction value (VND)', 'English ask label lacks VND'],
  ['useState<number | null>', 'Business term state is not nullable'],
  ["normalized === 'business'", 'Checkout term restoration is not limited to Business'],
  ['[4, 8, 12, 16, 24].includes(requestedTerm)', 'Checkout term is not validated against visible choices'],
  [': null;', 'Direct Business registration does not start with a null term'],
  ['Boolean(plan && serviceWeeks)', 'Payment readiness does not require both package and term'],
  ["if (!serviceWeeks)", 'Business submission does not validate the term'],
  ['if (plan && serviceWeeks && !paymentAck)', 'Payment acknowledgement can be required before package and term are ready'],
  ["const currentTermDisplay = currentTermValue ?? '—'", 'Empty-term summary does not use an em dash'],
  ['Vui lòng chọn gói dịch vụ và kỳ hạn', 'Pending payment message does not ask for both package and term'],
  ["className={currentTermValue === term ? 'active' : ''}", 'Term active state is not driven solely by the selected value'],
]) {
  requireToken(token, message);
}

forbidToken(
  'Number(intent.termWeeks || intent.units || 16)',
  'Legacy 16-week default remains',
);
forbidToken(
  'useState<number>(\n    Number(intent.termWeeks',
  'Business term state still requires an initial number',
);

if (failures.length) {
  console.error('✗ Deals68 Business register copy/term check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✓ Deals68 Business register copy/term contract: PASS');
console.log('✓ Revenue and transaction-value labels include VNĐ/VND.');
console.log('✓ Direct registration starts with no active Business term.');
console.log('✓ A valid checkout intent may restore only a visible term option.');
console.log('✓ Payment remains hidden until both package and term are selected.');
console.log('✓ Submission validates term before payment acknowledgement.');
console.log('✓ Static test only; no Supabase project or data was used.');
