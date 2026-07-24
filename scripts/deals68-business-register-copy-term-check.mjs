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
  ['const annualRevenueLabel = T(', 'Annual-revenue label is not centralized'],
  ['const askAmountLabel = T(', 'Ask-amount label is not centralized'],
  ["currentCurrency === 'VND' ? 'VNĐ' : 'USD'", 'Vietnamese financial labels do not switch VNĐ/USD'],
  ['`Latest annual revenue (${currentCurrency})`', 'English annual-revenue label does not use current currency'],
  ['`Capital sought / desired transaction value (${currentCurrency})`', 'English ask label does not use current currency'],
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
console.log('✓ Revenue and transaction-value labels use the selected VNĐ/USD currency dynamically.');
console.log('✓ Direct registration starts with no active Business term.');
console.log('✓ A valid checkout intent may restore only a visible term option.');
console.log('✓ Payment remains hidden until both package and term are selected.');
console.log('✓ Submission validates term before payment acknowledgement.');
console.log('✓ Static test only; no Supabase project or data was used.');
