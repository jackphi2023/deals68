#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260806184000_advisor_business_intake_phase4_v1.sql', 'utf8');
const advisorAuth = fs.readFileSync('src/lib/advisorAuth.ts', 'utf8');
const advisorAccount = fs.readFileSync('src/pages/AdvisorAccount.tsx', 'utf8');
const advisorCreate = fs.readFileSync('src/pages/AdvisorBusinessCreate.tsx', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const required = [
  ['atomic intake RPC', /function public\.d68_create_advisor_business_intake_v1/i],
  ['authenticated actor', /auth\.uid\(\)/i],
  ['active Advisor account', /p\.role = 'advisor'[\s\S]*p\.status = 'active'[\s\S]*dashboard_login_enabled is true/i],
  ['verified Advisor profile', /ap\.status = 'active'[\s\S]*ap\.verification_status = 'verified'/i],
  ['serialized Advisor row lock', /from public\.advisor_profiles[\s\S]*for update/i],
  ['idempotency replay', /idempotent_replay/i],
  ['daily intake guard', /24 hours[\s\S]*>= 10/i],
  ['ownerless draft Business', /owner_id[\s\S]*values \([\s\S]*null[\s\S]*'draft'::public\.account_status/i],
  ['non-public Business', /false,[\s\S]*'draft'::public\.account_status/i],
  ['pending authority', /'pending_review'/i],
  ['pending profile assignment', /'pending'[\s\S]*array\['profile'\]::text\[\]/i],
  ['atomic audit', /advisor\.business_intake\.created/i],
  ['empty search path', /security definer[\s\S]*set search_path = ''/i],
  ['authenticated-only grant', /grant execute on function public\.d68_create_advisor_business_intake_v1[\s\S]*to authenticated, service_role/i],
  ['Business RLS boundary', /leaves all existing Business RLS policies/i],
];

for (const [name, pattern] of required) {
  assert.match(migration, pattern, `Missing Session 4 contract: ${name}`);
  console.log(`✓ ${name}`);
}

const forbidden = [
  ['no Business ownership', /insert into public\.businesses[\s\S]{0,1800}v_actor[\s\S]{0,300}'draft'/i],
  ['no verified authority', /insert into public\.business_listing_authority[\s\S]{0,1500}'verified'/i],
  ['no active assignment', /insert into public\.advisor_assignments[\s\S]{0,900}'active'/i],
  ['no assignment scope escalation', /array\[(?!'profile'\])[^\]]+\]::text\[\]/i],
  ['no payment write', /insert\s+into\s+public\.payment_orders/i],
  ['no Business policy changes', /(create|drop|alter)\s+policy[^;]+on\s+public\.(businesses|business_files|business_images|payment_orders|proposals|request_data|business_financial_access_grants)/is],
  ['no anonymous grant', /grant execute on function public\.d68_create_advisor_business_intake_v1[^;]+anon/i],
  ['no user-controlled role', /p_business_payload->>'role'|p_authority_payload->>'verification_status'|p_business_payload->>'owner_id'/i],
];

for (const [name, pattern] of forbidden) {
  assert.doesNotMatch(migration, pattern, `Forbidden Session 4 pattern: ${name}`);
  console.log(`✓ ${name}`);
}

assert.match(advisorAuth, /d68_create_advisor_business_intake_v1/);
assert.match(advisorAuth, /createAdvisorIntakeKey/);
assert.match(advisorCreate, /createAdvisorBusinessIntake/);
assert.match(advisorCreate, /authorityConfirmed/);
assert.match(advisorCreate, /không tự dịch|no automatic translation/i);
assert.match(advisorAccount, /<AdvisorBusinessCreate/);
assert.match(advisorAccount, /Ranh giới Phiên 4|Session 4 boundary/);
assert.match(advisorAccount, /chưa có quyền chỉnh sửa|no edit access/i);
assert.doesNotMatch(`${advisorAuth}\n${advisorCreate}\n${advisorAccount}`, /\.from\(['"]businesses['"]\)|\.insert\(|\.update\(/);
console.log('✓ Advisor UI uses only the isolated intake RPC and retains no direct Business mutations');

assert.equal(
  packageJson.scripts['qa:advisor-session4'],
  'node scripts/deals68-advisor-session4-intake-check.mjs && node scripts/deals68-advisor-session4-postgres-test.mjs',
);
assert.match(packageJson.scripts['qa:release'], /qa:advisor-session4/);

console.log('\nAdvisor Session 4 atomic Business intake contract: PASS');
console.log('✓ One RPC creates draft Business, pending authority, pending assignment and audit atomically.');
console.log('✓ No ownership, publication, payment or Business edit access is granted.');
