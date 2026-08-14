#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260806111000_advisor_readonly_portfolio_phase3_v1.sql', 'utf8');
const advisorAccount = fs.readFileSync('src/pages/AdvisorAccount.tsx', 'utf8');
const advisorAuth = fs.readFileSync('src/lib/advisorAuth.ts', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const requiredMigration = [
  ['portfolio RPC', /function public\.d68_get_my_advisor_portfolio_v1\(\)/i],
  ['Business context RPC', /function public\.d68_get_my_advisor_business_context_v1\([\s\S]*p_business_id uuid/i],
  ['active Advisor role', /p\.role = 'advisor'[\s\S]*p\.status = 'active'/i],
  ['verified Advisor profile', /ap\.status = 'active'[\s\S]*ap\.verification_status = 'verified'/i],
  ['dashboard login enabled', /dashboard_login_enabled is true/i],
  ['accepted active assignment', /aa\.status = 'active'[\s\S]*aa\.accepted_at is not null/i],
  ['unexpired assignment', /aa\.expires_at is null or aa\.expires_at > now\(\)/i],
  ['profile scope enforcement', /can_manage_business\(p_business_id, 'profile'\)/i],
  ['verified authority', /bla\.verification_status = 'verified'/i],
  ['read-only access declaration', /'mode', 'read_only'[\s\S]*'mutations_enabled', false/i],
  ['empty search path', /security definer[\s\S]*set search_path = ''/i],
  ['authenticated portfolio grant', /grant execute on function public\.d68_get_my_advisor_portfolio_v1\(\)[\s\S]*to authenticated, service_role/i],
  ['authenticated context grant', /grant execute on function public\.d68_get_my_advisor_business_context_v1\(uuid\)[\s\S]*to authenticated, service_role/i],
  ['explicit Business RLS boundary', /does not create or modify Business RLS policies/i],
];

for (const [name, pattern] of requiredMigration) {
  assert.match(migration, pattern, `Missing Session 3 migration contract: ${name}`);
  console.log(`✓ ${name}`);
}

const forbiddenMigration = [
  ['no Business policy changes', /(create|drop|alter)\s+policy[^;]+on\s+public\.(businesses|business_files|business_images|payment_orders|proposals|request_data|business_financial_access_grants)/is],
  ['no Business table writes', /(insert\s+into|update|delete\s+from)\s+public\.businesses/i],
  ['no assignment creation', /insert\s+into\s+public\.advisor_assignments/i],
  ['no authority creation', /insert\s+into\s+public\.business_listing_authority/i],
  ['no payment writes', /(insert\s+into|update|delete\s+from)\s+public\.payment_orders/i],
  ['no financial payload', /revenue_2025|financial_input|ebitda_margin|ask_amount|offer_amount|self_valuation/i],
  ['no workflow data reads', /public\.(business_files|business_images|proposals|request_data|payment_orders|business_financial_access_grants)/i],
  ['no anonymous RPC grant', /grant execute on function public\.d68_get_my_advisor_(portfolio|business_context)_v1[^;]+anon/i],
  ['no deprecated auth.role', /auth\.role\s*\(/i],
];

for (const [name, pattern] of forbiddenMigration) {
  assert.doesNotMatch(migration, pattern, `Forbidden Session 3 migration pattern: ${name}`);
  console.log(`✓ ${name}`);
}

assert.match(advisorAuth, /d68_get_my_advisor_portfolio_v1/);
assert.match(advisorAuth, /d68_get_my_advisor_business_context_v1/);
assert.match(advisorAuth, /d68_accept_advisor_assignment/);
assert.doesNotMatch(advisorAuth, /\.from\(['"]businesses['"]\)/);
assert.doesNotMatch(advisorAuth, /d68_admin_create_advisor_assignment|d68_admin_set_advisor_assignment_status/);
console.log('✓ Advisor client uses scoped RPCs and cannot create/administer assignments');

assert.match(advisorAccount, /getMyAdvisorPortfolio/);
assert.match(advisorAccount, /getMyAdvisorBusinessContext/);
assert.match(advisorAccount, /acceptAdvisorAssignment/);
assert.match(advisorAccount, /useSearchParams/);
assert.match(advisorAccount, /can_open_context/);
assert.match(advisorAccount, /Không có quyền sửa|No edit access/i);
assert.match(advisorAccount, /Chỉ đọc|Read only/i);
assert.doesNotMatch(advisorAccount, /\.from\(['"]businesses['"]\)|payment_orders|d68_admin_create_advisor_assignment/);
console.log('✓ Advisor portfolio, context switching and acceptance UI remain read-only and assignment-gated');

assert.equal(
  packageJson.scripts['qa:advisor-session3'],
  'node scripts/deals68-advisor-session3-readonly-check.mjs && node scripts/deals68-advisor-session3-postgres-test.mjs',
);
assert.match(packageJson.scripts['qa:release'], /qa:advisor-session3/);

console.log('\nAdvisor Session 3 read-only portfolio contract: PASS');
console.log('✓ Portfolio and Business context are exposed only through field-restricted RPCs.');
console.log('✓ Context requires an active, accepted, unexpired profile-scoped assignment.');
console.log('✓ Existing Business RLS and all mutation paths remain unchanged.');
