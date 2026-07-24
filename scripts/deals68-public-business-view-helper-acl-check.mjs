#!/usr/bin/env node
import fs from 'node:fs';

const migrationName = '20260724140213_public_business_view_band_helper_acl_fix_v1.sql';
const homepageMigrationName = '20260724142506_homepage_business_ids_safe_view_v1.sql';
const failures = [];
const read = (path) => (fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '');
const sql = read(`supabase/migrations/${migrationName}`);
const homepageSql = read(`supabase/migrations/${homepageMigrationName}`);
const sitemap = read('scripts/generate-sitemap.mjs');
const data = read('src/lib/data.ts');

for (const signature of [
  'public.d68_public_revenue_band_key(numeric, text)',
  'public.d68_public_revenue_band_rank(numeric, text)',
  'public.d68_public_revenue_match_band_key(numeric, text)',
  'public.d68_public_ebitda_band_key(numeric)',
]) {
  if (!sql.includes(`grant execute on function ${signature}`)) {
    failures.push(`Migration does not restore EXECUTE for ${signature}`);
  }
}

if (!sql.includes('to anon, authenticated, service_role;')) {
  failures.push('Migration must grant helper execution only to explicit Supabase application roles');
}
if (!sql.includes('from public;')) {
  failures.push('Migration must keep implicit PUBLIC function execution revoked');
}
if (sql.includes('grant select on table public.businesses')) {
  failures.push('Migration must not reopen direct public Business base-table reads');
}
if (sql.includes('revenue_2025') || sql.includes('ebitda_margin')) {
  failures.push('ACL fix must not alter or expose exact financial fields');
}

for (const snippet of [
  'create or replace function public.get_homepage_business_ids',
  'from public.public_businesses_safe b',
  'security invoker',
  'set search_path = public, pg_temp',
  'revoke all on function public.get_homepage_business_ids(integer)',
  'to anon, authenticated, service_role',
  "'base_table_read', false",
  "'returns_public_ids_only', true",
]) {
  if (!homepageSql.includes(snippet)) failures.push(`Homepage selector migration missing: ${snippet}`);
}
if (homepageSql.includes('from public.businesses b')) {
  failures.push('Homepage selector must not read the Business base table');
}
for (const forbidden of ['revenue_2025', 'revenue_month', 'ebitda_margin', 'growth_pct', 'financial_input']) {
  if (homepageSql.includes(forbidden)) failures.push(`Homepage selector exposes or references financial field: ${forbidden}`);
}
if (!data.includes("'get_homepage_business_ids'")) {
  failures.push('Homepage data loader no longer calls the canonical selector RPC');
}
if (!data.includes(".from('public_businesses_safe')")) {
  failures.push('Homepage data loader must hydrate selected IDs from public_businesses_safe');
}

for (const safeView of ["'public_businesses_safe'", "'public_investors_safe'"]) {
  if (!sitemap.includes(safeView)) failures.push(`Sitemap missing safe view ${safeView}`);
}
for (const unsafeTable of ["'businesses'", "'investors'"]) {
  if (sitemap.includes(`fetchRows(\n    ${unsafeTable},`)) {
    failures.push(`Sitemap still reads base table ${unsafeTable}`);
  }
}

if (failures.length) {
  console.error('✗ Deals68 public Business view helper ACL check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✓ Deals68 public Business view/helper/Homepage selector contract: PASS');
