#!/usr/bin/env node
import fs from 'node:fs';

const pricing = fs.readFileSync('src/pages/Pricing.tsx', 'utf8');
const e2e = fs.readFileSync('tests/e2e/01-pricing-valuation.spec.ts', 'utf8');
const failures = [];

function requireSnippet(label, source, snippet) {
  if (!source.includes(snippet)) failures.push(`${label}: missing ${snippet}`);
}

[
  "useState<InvestorPlan>('standard')",
  "INVESTOR_PREMIUM_MONTHLY_VND",
  "INVESTOR_PREMIUM_MONTHLY_USD",
  "Tiêu chuẩn · Miễn phí",
  "Nhà đầu tư Nâng cao",
  "Xem Báo cáo Phân tích đầu tư: 50 triệu đ/tháng.",
  "View Investment Analysis Reports: USD 2,500/month.",
  "investorPlan: role === 'investor' ? investorPlan : undefined",
  "investorStandardSelected ? T(lang, 'Miễn phí', 'Free')",
  "Tạo tài khoản miễn phí",
  "50.000.000 VNĐ/tháng",
  "2.500 USD/tháng",
].forEach((snippet) => requireSnippet('pricing', pricing, snippet));

requireSnippet(
  'e2e',
  e2e,
  'TC-PRICING-003 Standard Investor is free and Premium uses the updated monthly price',
);
requireSnippet('e2e', e2e, "toHaveURL(/register\\/investor/)");
requireSnippet('e2e', e2e, "Nhà đầu tư Nâng cao|Premium Investor");

if (pricing.includes("titleVi: 'Nhà đầu tư Nâng cao',\n      titleEn: 'Premium Investor',")) {
  failures.push('Investor summary card still presents Premium as the default plan');
}

if (failures.length) {
  console.error('✗ Investor pricing Phase 3 check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✓ Investor pricing Phase 3 check: PASS');
