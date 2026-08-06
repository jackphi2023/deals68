#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migrationPath = 'supabase/migrations/20260806102000_advisor_auth_phase2_v1.sql';
const migration = fs.readFileSync(migrationPath, 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const publicLogin = fs.readFileSync('src/pages/Login.tsx', 'utf8');
const advisorRegister = fs.readFileSync('src/pages/AdvisorRegister.tsx', 'utf8');
const advisorLogin = fs.readFileSync('src/pages/AdvisorLogin.tsx', 'utf8');
const advisorAccount = fs.readFileSync('src/pages/AdvisorAccount.tsx', 'utf8');
const advisorAuth = fs.readFileSync('src/lib/advisorAuth.ts', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const requiredMigration = [
  ['isolated signup RPC', /function public\.d68_create_advisor_signup_v1/i],
  ['OTP completion RPC', /function public\.d68_mark_advisor_email_verified_v1/i],
  ['fresh signup nonce', /signup_nonce[\s\S]*30 minutes/i],
  ['fixed advisor role', /'advisor'::public\.user_role/i],
  ['pending account state', /'pending_admin_review'::public\.account_status/i],
  ['dashboard locked before OTP', /pending_admin_review'::public\.account_status, false/i],
  ['pending advisor profile', /'pending'[\s\S]*verification_status/i],
  ['registration audit', /advisor\.registration\.submitted/i],
  ['email verification audit', /advisor\.email\.verified/i],
  ['email confirmation checked', /email_confirmed_at is not null/i],
  ['empty search path', /security definer[\s\S]*set search_path = ''/i],
  ['anon signup RPC grant', /grant execute on function public\.d68_create_advisor_signup_v1[\s\S]*to anon, authenticated, service_role/i],
  ['OTP RPC excludes anon', /grant execute on function public\.d68_mark_advisor_email_verified_v1\(\)[\s\S]*to authenticated, service_role/i],
  ['no automatic advisor activation', /advisor_status'[\s\S]*'pending'/i],
  ['explicit Business RLS boundary', /leaves every existing Business RLS policy unchanged/i],
];

for (const [name, pattern] of requiredMigration) {
  assert.match(migration, pattern, `Missing Session 2 migration contract: ${name}`);
  console.log(`✓ ${name}`);
}

const forbiddenMigration = [
  ['no Business record writes', /insert\s+into\s+public\.businesses/i],
  ['no payment order writes', /insert\s+into\s+public\.payment_orders/i],
  ['no assignment writes', /insert\s+into\s+public\.advisor_assignments/i],
  ['no authority writes', /insert\s+into\s+public\.business_listing_authority/i],
  ['no Business policy changes', /(create|drop)\s+policy[^;]+on\s+public\.(businesses|business_files|business_images|payment_orders|proposals|request_data|business_financial_access_grants)/is],
  ['no direct Advisor activation', /insert\s+into\s+public\.advisor_profiles[\s\S]{0,800}'active'/i],
  ['no Advisor verification shortcut', /verification_status[\s\S]{0,200}'verified'/i],
  ['no anonymous OTP completion', /grant execute on function public\.d68_mark_advisor_email_verified_v1\(\)[^;]+anon/i],
  ['no deprecated auth.role', /auth\.role\s*\(/i],
];

for (const [name, pattern] of forbiddenMigration) {
  assert.doesNotMatch(migration, pattern, `Forbidden Session 2 migration pattern: ${name}`);
  console.log(`✓ ${name}`);
}

const routeChecks = [
  ['Advisor register route VI', /path="\/advisor\/register" element={<AdvisorRegister lang="vi"\/>}/],
  ['Advisor login route VI', /path="\/advisor\/login" element={<AdvisorLogin lang="vi"\/>}/],
  ['Advisor dashboard route VI', /path="\/dashboard\/advisor" element={<AdvisorGate><AdvisorAccount lang="vi"\/><\/AdvisorGate>}/],
  ['Advisor register route EN', /path="\/en\/advisor\/register" element={<AdvisorRegister lang="en"\/>}/],
  ['Advisor login route EN', /path="\/en\/advisor\/login" element={<AdvisorLogin lang="en"\/>}/],
  ['Advisor dashboard route EN', /path="\/en\/dashboard\/advisor" element={<AdvisorGate><AdvisorAccount lang="en"\/><\/AdvisorGate>}/],
  ['generic Advisor registration redirected VI', /path="\/register\/advisor" element={<Navigate to="\/advisor\/register" replace\/>}/],
  ['generic Advisor registration redirected EN', /path="\/en\/register\/advisor" element={<Navigate to="\/en\/advisor\/register" replace\/>}/],
  ['Advisor gate role check', /function AdvisorGate[\s\S]*profile\.role !== 'advisor'/],
  ['Advisor gate OTP check', /AdvisorGate[\s\S]*dashboard_login_enabled/],
];
for (const [name, pattern] of routeChecks) {
  assert.match(app, pattern, `Missing Session 2 route contract: ${name}`);
  console.log(`✓ ${name}`);
}

assert.match(publicLogin, /type LoginRole = 'business' \| 'investor' \| 'admin'/);
assert.match(publicLogin, /publicRoleDefs[\s\S]*key: 'business'[\s\S]*key: 'investor'/);
assert.doesNotMatch(publicLogin, /publicRoleDefs[\s\S]{0,500}key: 'advisor'/);
console.log('✓ Public Business/Investor Login remains unchanged and has no Advisor tab');

assert.match(advisorRegister, /signUp\('advisor'/);
assert.match(advisorRegister, /createAdvisorSignup/);
assert.match(advisorLogin, /completeAdvisorEmailVerification/);
assert.match(advisorLogin, /data\?\.role !== 'advisor'/);
assert.match(advisorAccount, /getMyAdvisorAccount/);
assert.match(advisorAccount, /Không có quyền sửa hồ sơ doanh nghiệp/);
assert.match(advisorAuth, /d68_create_advisor_signup_v1/);
assert.match(advisorAuth, /d68_mark_advisor_email_verified_v1/);
assert.doesNotMatch(`${advisorRegister}\n${advisorLogin}\n${advisorAccount}\n${advisorAuth}`, /\.from\(['"]businesses['"]\)|\.from\(['"]payment_orders['"]\)|d68_admin_create_advisor_assignment/);
console.log('✓ Advisor authentication UI remains isolated from direct Business/payment reads and assignment creation');

assert.equal(
  packageJson.scripts['qa:advisor-session2'],
  'node scripts/deals68-advisor-session2-auth-check.mjs && node scripts/deals68-advisor-session2-postgres-test.mjs',
);
assert.match(packageJson.scripts['qa:release'], /qa:advisor-session0/);
assert.match(packageJson.scripts['qa:release'], /qa:advisor-session1/);
assert.match(packageJson.scripts['qa:release'], /qa:advisor-session2/);

console.log('\nAdvisor Session 2 authentication contract: PASS');
console.log('✓ Advisor registration/login remains separate from Business and Investor auth UI.');
console.log('✓ OTP still unlocks only an authenticated Advisor account; later capabilities remain assignment-gated.');
console.log('✓ Session 2 creates no Business, payment, authority or assignment record.');
