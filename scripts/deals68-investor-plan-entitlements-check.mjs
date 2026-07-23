#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const migrationPath = 'supabase/migrations/20260723115526_investor_plan_entitlements_v1.sql';
const migration = fs.readFileSync(migrationPath, 'utf8');
const planSource = fs.readFileSync('src/lib/investorPlans.ts', 'utf8');
const pricingSource = fs.readFileSync('src/lib/pricing.ts', 'utf8');
const pricingPage = fs.readFileSync('src/pages/Pricing.tsx', 'utf8');

function requireSnippet(label, source, snippet) {
  if (!source.includes(snippet)) failures.push(label + ': missing ' + snippet);
}

[
  "add column if not exists plan text not null default 'standard'",
  "set plan = 'standard'",
  'membership_started_at = null',
  'membership_expires_at = null',
  'constraint investors_plan_check',
  'create or replace function public.d68_guard_investor_plan_contract',
  'create or replace function public.d68_get_investor_plan_snapshot',
  'create or replace function public.d68_investor_has_entitlement',
  'create or replace function public.admin_set_investor_plan',
  'investors_plan_contract_insert',
  'investors_plan_contract_update',
  'Investor plan changes require Admin, payment confirmation or service role',
  'then 50000000 else 2500 end',
  'to authenticated, service_role',
].forEach((snippet) => requireSnippet('migration', migration, snippet));

requireSnippet('plan constants', planSource, 'INVESTOR_PREMIUM_MONTHLY_VND = 50_000_000');
requireSnippet('plan constants', planSource, 'INVESTOR_PREMIUM_MONTHLY_USD = 2_500');
requireSnippet('plan constants', planSource, "'investment_opportunity_report'");
requireSnippet('pricing core', pricingSource, 'INVESTOR_PREMIUM_MONTHLY_VND');
requireSnippet('pricing core', pricingSource, "role === 'investor'");
requireSnippet('pricing page', pricingPage, 'INVESTOR_PREMIUM_MONTHLY_VND');
requireSnippet('pricing page', pricingPage, "'Nhà đầu tư Nâng cao'");
requireSnippet('pricing page', pricingPage, "investorPlan: role === 'investor' ? 'premium' : undefined");

if (pricingSource.includes("role === 'business' ? (currency === 'VND' ? 500_000 : 20) : (currency === 'VND' ? 1_000_000 : 50)")) {
  failures.push('pricing core still uses the legacy generic Investor rate');
}
if (pricingPage.includes("investor: { unitVi: 'tháng', unitEn: 'month', vn: 1_000_000, other: 50")) {
  failures.push('Pricing page still uses the legacy Investor rate');
}

if (failures.length) {
  console.error('✗ Investor plan entitlement Phase 1 check failed:');
  failures.forEach((failure) => console.error('  - ' + failure));
  process.exit(1);
}

console.log('✓ Investor plan entitlement Phase 1 check: PASS');
