#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260806203000_advisor_authority_review_phase5_v1.sql', 'utf8');
const adminLib = fs.readFileSync('src/lib/adminAdvisorIntakes.ts', 'utf8');
const adminPage = fs.readFileSync('src/pages/AdminAdvisorIntakes.tsx', 'utf8');
const adminCard = fs.readFileSync('src/components/AdminAdvisorIntakeCard.tsx', 'utf8');
const main = fs.readFileSync('src/main.tsx', 'utf8');
const navigation = fs.readFileSync('src/config/adminNavigation.ts', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const required = [
  ['intake list RPC', /function public\.d68_admin_list_advisor_business_intakes_v1/i],
  ['review RPC', /function public\.d68_admin_review_advisor_business_intake_v1/i],
  ['active Admin database check', /p\.role = 'admin'[\s\S]*p\.status = 'active'/i],
  ['assignment row lock', /from public\.advisor_assignments[\s\S]*for update/i],
  ['authority row lock', /from public\.business_listing_authority[\s\S]*for update/i],
  ['Business state reconciliation lock', /from public\.businesses[\s\S]*for update/i],
  ['Session 4 source restriction', /advisor_session4_business_intake/i],
  ['profile-only scope', /p_permissions <> array\['profile'\]::text\[\]/i],
  ['bounded expiry', /365 days/i],
  ['authority approval', /verification_status = 'verified'/i],
  ['assignment remains pending for acceptance', /can_advisor_accept/i],
  ['authority rejection', /verification_status = 'rejected'/i],
  ['assignment revocation', /status = 'revoked'/i],
  ['approval audit', /advisor\.business_intake\.authority_approved/i],
  ['rejection audit', /advisor\.business_intake\.authority_rejected/i],
  ['narrow pending trigger exception', /new\.status = 'pending'[\s\S]*admin_review_required[\s\S]*pending_review/i],
  ['terminal fail-closed transition support', /new\.status in \('revoked', 'expired'\)/i],
  ['empty search path', /security definer[\s\S]*set search_path = ''/i],
  ['authenticated grants', /grant execute on function public\.d68_admin_review_advisor_business_intake_v1[\s\S]*to authenticated, service_role/i],
  ['Business boundary declaration', /leaves Business RLS[\s\S]*direct Advisor Business mutation privileges unchanged/i],
];

for (const [name, pattern] of required) {
  assert.match(migration, pattern, `Missing Session 5 contract: ${name}`);
  console.log(`✓ ${name}`);
}

const forbidden = [
  ['no Business mutation', /update\s+public\.businesses|delete\s+from\s+public\.businesses/i],
  ['no Business ownership', /set\s+owner_id\s*=/i],
  ['no Business publication', /set[\s\S]{0,200}visible\s*=\s*true/i],
  ['no payment write', /(insert|update|delete)\s+(into\s+|from\s+)?public\.payment_orders/i],
  ['no Business policy changes', /(create|drop|alter)\s+policy[^;]+on\s+public\.(businesses|business_files|business_images|payment_orders|proposals|request_data|business_financial_access_grants)/is],
  ['no broad scope', /array\['(files|images|proposals|data_requests|payments|reports)'\]/i],
  ['no anonymous grant', /grant execute on function public\.d68_admin_(list|review)_advisor_business_intakes?[^;]+anon/i],
  ['no client direct table writes', /\.from\(['"](?:businesses|business_listing_authority|advisor_assignments)['"]\)[\s\S]{0,120}\.(?:insert|update|delete)\(/i],
];

for (const [name, pattern] of forbidden) {
  assert.doesNotMatch(`${migration}\n${adminLib}\n${adminPage}\n${adminCard}`, pattern, `Forbidden Session 5 pattern: ${name}`);
  console.log(`✓ ${name}`);
}

// Later sessions may enrich the Admin intake queue by wrapping Session 5 v1 in a
// versioned read RPC. The Session 5 decision path itself must remain v1 and the
// underlying Session 5 migration contract above remains locked.
assert.match(adminLib, /d68_admin_list_advisor_business_intakes_v[1234]/);
assert.match(adminLib, /d68_admin_review_advisor_business_intake_v1/);
assert.match(adminPage, /AdminAdvisorIntakes/);
assert.match(adminPage, /approveAdminAdvisorIntake|reviewAdminAdvisorIntake/);
assert.match(adminCard, /Từ chối|Reject/i);
assert.match(`${adminPage}\n${adminCard}`, /Hồ sơ doanh nghiệp|Business profile/i);
assert.match(adminPage, /180/);
assert.match(main, /AdminAdvisorIntakes/);
assert.match(main, /\/admin\/advisor-intakes/);
assert.match(navigation, /advisor_intakes/);
assert.match(navigation, /Duyệt Advisor intake/);
console.log('✓ Admin queue may use a later read-only wrapper; Session 5 decision RPC, navigation and exact route remain wired');

assert.equal(
  packageJson.scripts['qa:advisor-session5'],
  'node scripts/deals68-advisor-session5-review-check.mjs && node scripts/deals68-advisor-session5-postgres-test.mjs',
);
assert.match(packageJson.scripts['qa:release'], /qa:advisor-session5/);

console.log('\nAdvisor Session 5 Admin authority review contract: PASS');
console.log('✓ Admin can approve or reject only Session 4 intake authority.');
console.log('✓ Approval remains profile-only and pending until Advisor acceptance.');
console.log('✓ Business ownership, publication, payment and mutation boundaries remain closed.');
