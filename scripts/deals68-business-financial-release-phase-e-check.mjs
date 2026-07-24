#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const read = (file) => fs.readFileSync(file, 'utf8');
const migrations = fs.readdirSync('supabase/migrations').filter((name) => name.endsWith('_business_dataroom_access_phase_e_stabilization.sql'));
check(migrations.length === 1, 'Exactly one Phase E Dataroom stabilization migration must exist.');
const migration = migrations.length ? read(path.join('supabase/migrations', migrations[0])) : '';
const detail = read('src/pages/BusinessDetail.tsx');
const service = read('src/lib/businessFinancialAccess.ts');
const data = read('src/lib/data.ts');
const netlify = read('netlify.toml');
const cleanup = read('src/styles/pages/release-cleanup.css');

[
  'get_business_file_metadata_for_viewer',
  'd68_get_business_dataroom_file_access',
  "'dataroom' = any(g.scopes)",
  "g.status = 'active'",
  'g.expires_at is null or g.expires_at > now()',
  'access_business_dataroom_file',
  'from public, anon',
  'to authenticated, service_role',
  'files select owner admin or active dataroom grant',
  'business files select owner admin or active dataroom grant',
  'select f.*',
  'into file_row',
  'select b.owner_id',
  'into business_owner',
  "file_row.review_status is distinct from 'approved'",
  'Deliberately no INSERT/UPDATE into business_financial_access_grants',
].forEach((snippet) => check(migration.includes(snippet), 'Migration missing: ' + snippet));
check(!migration.includes('into file_row, business_owner'), 'PL/pgSQL rowtype and owner lookups must be separate.');
check(!/insert\s+into\s+public\.business_financial_access_grants/i.test(migration), 'Phase E must not create/backfill Dataroom grants.');
check(!detail.includes(".from('proposals')"), 'Business Detail must not infer file access from Proposal state.');
check(detail.includes('getBusinessFinancialAccess(b.id)'), 'Business Detail must use the central access snapshot.');
check(detail.includes('getBusinessDataroomFileAccess(String(doc.id))'), 'File download must pass the audited file-access RPC.');
check(detail.includes('.createSignedUrl(fileAccess.file_path, 60)'), 'Signed URL must be short-lived and use the audited path.');
check(!detail.includes('createSignedUrl(doc.file_path'), 'Client metadata must not directly choose the private file path.');
check(service.includes("supabase.rpc('d68_get_business_dataroom_file_access'"), 'Service must expose the audited Dataroom file gate.');
check(service.includes("supabase.rpc('d68_get_business_financial_access'"), 'Service must expose the central access snapshot.');
check(data.includes(".from('public_businesses_safe')"), 'Public Business reads must continue using the redacted view.');
check(data.includes("supabase.rpc('d68_get_business_financial_summaries'"), 'Exact financial hydration must remain behind the secure RPC.');
check(netlify.includes('command = "npm run build"') && netlify.includes('publish = "dist"'), 'Netlify build/publish contract changed unexpectedly.');
check(!cleanup.includes('{'), 'release-cleanup.css contains active CSS.');
check(!fs.existsSync('scripts/apply-phase-e-stabilization.mjs'), 'Temporary Phase E applicator remains in the final tree.');
check(!fs.existsSync('supabase/.temp/cli-latest'), 'Supabase CLI cache metadata must not be committed.');

if (failures.length) {
  console.error('✗ Deals68 Phase E stabilization check failed:');
  failures.forEach((failure) => console.error('  - ' + failure));
  process.exit(1);
}
console.log('✓ Deals68 Phase E stabilization check: PASS');
