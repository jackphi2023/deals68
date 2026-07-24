#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const failures = [];
const read = (file) => fs.readFileSync(file, 'utf8');
const migrations = fs.readdirSync('supabase/migrations')
  .filter((name) => name.endsWith('_investor_premium_price_v2.sql'));
if (migrations.length !== 1) failures.push('Exactly one Investor Premium price V2 migration is required.');
const migration = migrations.length ? read(path.join('supabase/migrations', migrations[0])) : '';
const plans = read('src/lib/investorPlans.ts');
const pricing = read('src/lib/pricing.ts');
const pricingPage = read('src/pages/Pricing.tsx');
const register = read('src/pages/Register.tsx');
const billing = read('src/components/investor/InvestorBillingPanel.tsx');
const e2e = read('tests/e2e/01-pricing-valuation.spec.ts');

const requireSnippet = (label, source, snippet) => {
  if (!source.includes(snippet)) failures.push(label + ': missing ' + snippet);
};

[
  'create or replace function public.d68_get_investor_premium_price',
  'then 26000000',
  'else 1000',
  "'price_version', 'investor-premium-v2-20260724'",
  'to anon, authenticated, service_role',
].forEach((snippet) => requireSnippet('migration', migration, snippet));
requireSnippet('constants', plans, 'INVESTOR_PREMIUM_MONTHLY_VND = 26_000_000');
requireSnippet('constants', plans, 'INVESTOR_PREMIUM_MONTHLY_USD = 1_000');
requireSnippet('constants', plans, "INVESTOR_PREMIUM_PRICE_VERSION = 'investor-premium-v2-20260724'");
requireSnippet('pricing core', pricing, 'INVESTOR_PREMIUM_MONTHLY_VND');
requireSnippet('pricing page', pricingPage, '26.000.000 VNĐ/tháng');
requireSnippet('pricing page', pricingPage, '1.000 USD/tháng');
requireSnippet('pricing CTA', pricingPage, 'Đăng ký gói Nâng cao');
requireSnippet('register wording', register, 'Đăng ký gói Nhà đầu tư Nâng cao');
requireSnippet('register wording', register, 'Tạo tài khoản Nhà đầu tư miễn phí');
requireSnippet('dashboard upgrade', billing, "investorPlan: 'premium'");
requireSnippet('dashboard upgrade', billing, 'priceVersion: INVESTOR_PREMIUM_PRICE_VERSION');
requireSnippet('dashboard upgrade', billing, 'Nâng cấp gói Premium');
requireSnippet('dashboard upgrade', billing, 'Đơn giá Premium hiện tại');
requireSnippet('e2e', e2e, '26');
requireSnippet('e2e', e2e, '1,000');

for (const [label, source] of [
  ['plans', plans],
  ['pricing page', pricingPage],
  ['register', register],
  ['billing', billing],
  ['e2e', e2e],
]) {
  for (const stale of ['50_000_000', '2_500', '50.000.000 VNĐ/tháng', '2.500 USD/tháng', '50 triệu đ/tháng', 'USD 2,500/month']) {
    if (source.includes(stale)) failures.push(label + ': stale Premium price remains: ' + stale);
  }
}

if (failures.length) {
  console.error('✗ Investor Premium price V2 check failed:');
  failures.forEach((failure) => console.error('  - ' + failure));
  process.exit(1);
}
console.log('✓ Investor Premium price V2 contract: PASS');
