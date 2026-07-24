#!/usr/bin/env node
import fs from 'node:fs';

const migrationName = '20260724085657_business_public_financial_redaction_phase_b_v1.sql';
const hiddenInvestorFixName = '20260724090819_business_financial_redaction_phase_b_hidden_investor_fix_v1.sql';
const publicEbitdaName = '20260724213000_business_public_ebitda_visibility_v1.sql';
const failures = [];
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const sql = read(`supabase/migrations/${migrationName}`);
const hiddenInvestorFixSql = read(`supabase/migrations/${hiddenInvestorFixName}`);
const publicEbitdaSql = read(`supabase/migrations/${publicEbitdaName}`);
const data = read('src/lib/data.ts');
const home = read('src/pages/Home.tsx');
const businesses = read('src/pages/Businesses.tsx');
const detail = read('src/pages/BusinessDetail.tsx');
const investor = read('src/pages/InvestorDashboard.tsx');
const seo = read('netlify/edge-functions/seo.ts');

const requiredSql = [
  'null::numeric as revenue_2025',
  'null::numeric as ebitda_margin',
  'security_invoker = false',
  'revenue_band_key',
  'revenue_match_band_key',
  'ebitda_band_key',
  'create or replace function public.d68_get_business_financial_summaries',
  "'financial_summary' = any(g.scopes)",
  'revoke select on table public.businesses from public, anon',
  'create policy "business select owner or admin"',
  'd68_calculate_business_quality_score_payload_internal',
  "'exact_revenue_public', false",
];
for (const snippet of requiredSql) if (!sql.includes(snippet)) failures.push(`Migration missing: ${snippet}`);
for (const snippet of [
  "i.status in (",
  "'active'::public.account_status",
  "'hidden'::public.account_status",
  'create or replace function public.d68_get_business_financial_summaries',
  'create or replace function public.d68_request_business_financial_access',
  "'grant_required', true",
]) if (!hiddenInvestorFixSql.includes(snippet)) failures.push(`Hidden Investor fix missing: ${snippet}`);
for (const snippet of [
  'public_businesses_safe_revenue_redacted_v1',
  "'revenue_2025', null",
  "'ebitda_margin', coalesce(",
  "'exact_revenue_public', false",
  "'exact_ebitda_public', true",
  "notify pgrst, 'reload schema'",
]) if (!publicEbitdaSql.includes(snippet)) failures.push(`Public EBITDA migration missing: ${snippet}`);
if (publicEbitdaSql.includes("'revenue_2025', coalesce(")) failures.push('Public EBITDA migration must not restore exact Revenue');

const publicSnapshotStart = sql.indexOf("jsonb_build_object(\n      'title_vi'");
const publicSnapshotEnd = sql.indexOf(') as public_snapshot_json', publicSnapshotStart);
const publicSnapshot = sql.slice(publicSnapshotStart, publicSnapshotEnd);
for (const forbidden of ["'revenue_2025', base.", "'ebitda_margin', base.", "'growth_pct', base.", 'excluded_physical_asset_value']) {
  if (publicSnapshot.includes(forbidden)) failures.push(`Public snapshot still exposes: ${forbidden}`);
}

for (const snippet of [
  'attachAuthorizedBusinessFinancials',
  'd68_get_business_financial_summaries',
  "q = q.eq('revenue_band_key', filters.revenueBand)",
  "q.order('revenue_band_rank'",
  'financials_restricted',
]) if (!data.includes(snippet)) failures.push(`Data layer missing: ${snippet}`);

if (!home.includes('SensitiveFinancialValue') || !home.includes('value={null}')) failures.push('Homepage restricted component or public-only value missing');
if (!data.includes('filters.includeAuthorizedFinancials === false')) failures.push('Public cache financial hydration opt-out missing');
if (!data.includes("filters.includeHidden && filters.revenueBand === 'small'")) failures.push('Owner/Admin exact revenue filtering regression');
if (!data.includes("q.order('revenue_2025', { ascending: false")) failures.push('Owner/Admin exact revenue sorting regression');
if (!data.includes('filters.includeHidden || filters.includeAuthorizedFinancials === false')) failures.push('Owner/Admin base rows should not require secure re-hydration');
const homepageFunction = data.slice(data.indexOf('export async function listHomepageBusinesses'), data.indexOf('export async function countBusinesses'));
if (homepageFunction.includes('await attachAuthorizedBusinessFinancials')) failures.push('Homepage public cache must not hydrate exact financials');
if (!homepageFunction.includes('includeAuthorizedFinancials: false')) failures.push('Homepage fallback must disable exact financial hydration');
if (homepageFunction.includes("return listBusinesses({ limit: safeLimit, sort: 'featured' });")) failures.push('A Homepage error fallback can still hydrate exact financials');
const publicOnlyFallbackCount = (homepageFunction.match(/includeAuthorizedFinancials: false/g) || []).length;
if (publicOnlyFallbackCount < 3) failures.push('All three Homepage fallback paths must remain public-only');
if (!businesses.includes('SensitiveFinancialValue')) failures.push('Business cards restricted component missing');
if (!detail.includes('SensitiveFinancialValue')) failures.push('Business detail restricted component missing');
if (!investor.includes('revenue_match_band_key') || !investor.includes('attachAuthorizedBusinessFinancials')) failures.push('Investor Dashboard band/grant hydration missing');
if (!seo.includes("fetchRows('public_businesses_safe', params)")) failures.push('SEO still bypasses safe Business view');
if (seo.includes("fetchRows('businesses', params)")) failures.push('SEO directly reads businesses table');

const pkg = JSON.parse(read('package.json') || '{}');
if (pkg.scripts?.['qa:financial-redaction-phase-b'] !== 'node scripts/deals68-business-financial-redaction-phase-b-check.mjs') failures.push('Phase B package script missing');

if (failures.length) {
  console.error('✗ Deals68 Business financial redaction Phase B check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}
console.log('✓ Deals68 Business financial redaction Phase B contract: PASS');
