#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migrationPath = 'supabase/migrations/20260806093000_advisor_assignment_security_phase1_v1.sql';
const migration = fs.readFileSync(migrationPath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const session0 = fs.readFileSync('tests/specs/advisor-session0-business-baseline-contract.json', 'utf8');

const required = [
  ['private helper schema', /create schema if not exists d68_private/i],
  ['advisor profile identity unique', /advisor_profiles_profile_id_uidx/i],
  ['assignment business and profile unique', /advisor_assignments_profile_business_uidx/i],
  ['authority required', /alter column authority_id set not null/i],
  ['business-only assignment', /advisor_assignments_business_only_check[\s\S]*investor_id is null/i],
  ['scoped permissions', /advisor_assignments_permissions_check[\s\S]*data_requests[\s\S]*payments[\s\S]*reports/i],
  ['unsafe assignment insert removed', /drop policy if exists advisor_assignments_own_insert/i],
  ['unsafe assignment update removed', /drop policy if exists advisor_assignments_own_update/i],
  ['advisor direct writes revoked', /revoke all on table public\.advisor_assignments from public, anon, authenticated/i],
  ['advisor table read only', /grant select on table public\.advisor_assignments to authenticated/i],
  ['central manage helper', /function d68_private\.can_manage_business/i],
  ['active assignment required', /aa\.status = 'active'/i],
  ['verified authority required', /bla\.verification_status = 'verified'/i],
  ['assignment create RPC', /function public\.d68_admin_create_advisor_assignment/i],
  ['assignment accept RPC', /function public\.d68_accept_advisor_assignment/i],
  ['assignment status RPC', /function public\.d68_admin_set_advisor_assignment_status/i],
  ['profile status RPC', /function public\.d68_admin_set_advisor_profile_status/i],
  ['audit assignment create', /advisor\.assignment\.created/i],
  ['audit assignment accept', /advisor\.assignment\.accepted/i],
  ['audit assignment status', /advisor\.assignment\.status_changed/i],
  ['public execute revoked', /revoke execute on function public\.d68_admin_create_advisor_assignment[\s\S]*from public, anon/i],
  ['authenticated execute explicit', /grant execute on function public\.d68_admin_create_advisor_assignment[\s\S]*to authenticated, service_role/i],
  ['search path hardened', /security definer[\s\S]*set search_path = ''/i],
  ['session 2 deferral explicit', /Advisor profile creation is intentionally deferred to Session 2/i],
];

for (const [name, pattern] of required) {
  assert.match(migration, pattern, `Missing Session 1 contract: ${name}`);
  console.log(`✓ ${name}`);
}

const forbidden = [
  ['no Business RLS widening', /create policy[^;]+on public\.(businesses|business_files|business_images|payment_orders|proposals|request_data|business_financial_access_grants)\b/is],
  ['no Business policy drop', /drop policy[^;]+on public\.(businesses|business_files|business_images|payment_orders|proposals|request_data|business_financial_access_grants)\b/is],
  ['no deprecated auth.role', /auth\.role\s*\(/i],
  ['no user metadata authorization', /raw_user_meta_data|user_metadata/i],
  ['no anonymous RPC access', /grant execute[^;]+to anon/i],
  ['no Advisor self assignment insert policy', /create policy[^;]+advisor_assignments[^;]+for insert[^;]+profile_id\s*=\s*\(?select auth\.uid/is],
];

for (const [name, pattern] of forbidden) {
  assert.doesNotMatch(migration, pattern, `Forbidden Session 1 pattern: ${name}`);
  console.log(`✓ ${name}`);
}

assert.equal(packageJson.scripts['qa:advisor-session1'], 'node scripts/deals68-advisor-session1-security-check.mjs && node scripts/deals68-advisor-session1-postgres-test.mjs');
assert.match(packageJson.scripts['qa:release'], /qa:advisor-session1/);
assert.match(session0, /runtimeChangesAllowed"\s*:\s*false/);

console.log('\nAdvisor Session 1 security contract: PASS');
console.log('✓ Existing Business RLS remains unchanged.');
console.log('✓ Advisor writes are assignment-RPC-only and audited.');
