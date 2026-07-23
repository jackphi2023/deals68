#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const register = fs.readFileSync('src/pages/Register.tsx', 'utf8');
const e2e = fs.readFileSync('tests/e2e/03-register-investor.spec.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260723134524_investor_standard_premium_registration_v1.sql', 'utf8');

function requireSnippet(label, source, snippet) {
  if (!source.includes(snippet)) failures.push(label + ': missing ' + snippet);
}

[
  "useState<InvestorPlan>",
  "intent.investorPlan === 'premium'",
  "? 'premium'\n      : 'standard'",
  "Nhà đầu tư Tiêu chuẩn",
  "Nhà đầu tư Nâng cao",
  "Được sử dụng tính năng Báo cáo Phân tích cơ hội đầu tư",
  "investorPremiumSelected",
  "skipPayment: isInvestor && investorPlan === 'standard'",
  "termMonths: investorPremiumSelected ? investorMonths : undefined",
  "Nhà đầu tư Tiêu chuẩn không cần thanh toán khi đăng ký.",
].forEach((snippet) => requireSnippet('register', register, snippet));

requireSnippet('e2e', e2e, 'Standard is default and Premium reveals payment UI');
requireSnippet('e2e', e2e, "not.toContainText(/Chuyển khoản QR|QR bank transfer/i)");
requireSnippet('e2e', e2e, "premium.click()");

[
  "payment_payload->>'skipPayment'",
  "requested_investor_plan = 'standard'",
  "Payment may only be skipped for Standard Investor registration",
  "delete from public.payment_orders",
  "'payment_skipped', true",
  "to anon, authenticated, service_role",
].forEach((snippet) => requireSnippet('migration', migration, snippet));

if (register.includes("if (!investorMonths) {\n        missing.push(T(lang, 'Kỳ hạn', 'Term'));")) {
  failures.push('Standard Investor still requires a paid term');
}

if (failures.length) {
  console.error('✗ Investor registration Phase 2 check failed:');
  failures.forEach((failure) => console.error('  - ' + failure));
  process.exit(1);
}

console.log('✓ Investor registration Phase 2 check: PASS');
