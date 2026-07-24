#!/usr/bin/env node
import fs from 'node:fs';

const migrationName = '20260724163000_public_business_view_band_helper_acl_fix_v1.sql';
const failures = [];
const read = (path) => (fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '');
const sql = read(`supabase/migrations/${migrationName}`);
const sitemap = read('scripts/generate-sitemap.mjs');

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

console.log('✓ Deals68 public Business view helper ACL contract: PASS');
