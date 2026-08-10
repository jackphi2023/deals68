#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migrationPaths = [
  'supabase/migrations/20260807163500_advisor_authority_validation_schema_phase7_v1.sql',
  'supabase/migrations/20260807163600_advisor_authority_validation_rpc_phase7_v1.sql',
  'supabase/migrations/20260807163700_advisor_authority_rereview_rpc_phase7_v1.sql',
  'supabase/migrations/20260807163800_advisor_authority_review_views_phase7_v1.sql',
];
const migrations = migrationPaths.map((path) => fs.readFileSync(path, 'utf8')).join('\n');
const advisorLib = fs.readFileSync('src/lib/advisorAuthorityEvidence.ts', 'utf8');
const advisorPanel = fs.readFileSync('src/components/AdvisorAuthorityEvidencePanel.tsx', 'utf8');
const advisorPage = fs.readFileSync('src/pages/AdvisorAccount.tsx', 'utf8');
const adminLib = fs.readFileSync('src/lib/adminAdvisorIntakes.ts', 'utf8');
const adminCard = fs.readFileSync('src/components/AdminAdvisorIntakeCard.tsx', 'utf8');
const adminPage = fs.readFileSync('src/pages/AdminAdvisorIntakes.tsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const requiredTokens = [
  "validation_status text not null default 'unreviewed'",
  "check (validation_status in ('unreviewed','valid','insufficient','invalid'))",
  'replaces_evidence_id uuid references public.advisor_authority_evidence',
  'superseded_by_evidence_id uuid references public.advisor_authority_evidence',
  'create table if not exists public.advisor_authority_rereviews',
  'alter table public.advisor_authority_rereviews enable row level security',
  'revoke all on table public.advisor_authority_rereviews from public, anon, authenticated',
  'advisor_authority_rereviews_one_pending_idx',
  'd68_private.guard_submitted_authority_evidence_immutable',
  "aa.status in ('pending','active','expired')",
  "aa.permissions = array['profile']::text[]",
  "b.owner_id is null",
  "b.visible is false",
  "b.status = 'draft'::public.account_status",
  'd68_advisor_begin_authority_evidence_v2',
  'd68_advisor_complete_authority_evidence_v2',
  'd68_admin_validate_advisor_authority_evidence_v1',
  'd68_admin_request_advisor_authority_evidence_v2',
  'd68_admin_start_advisor_authority_rereview_v1',
  'd68_admin_review_advisor_authority_rereview_v1',
  'd68_get_my_authority_review_v2',
  'd68_admin_list_advisor_business_intakes_v3',
  "'evidence_replacement_requested'",
  "'authority_rereview_started'",
  "'authority_rereview_approved'",
  "'authority_rereview_rejected'",
  'At least one current valid authority evidence is required for re-review approval',
  'Resolve or replace all current insufficient/invalid evidence before re-review approval',
  "permissions = array['profile']::text[]",
  "set search_path = ''",
];
for (const token of requiredTokens) assert.ok(migrations.includes(token), `Session 7 migration missing contract token: ${token}`);

assert.ok(/update public\.business_listing_authority[\s\S]*verification_status = 'pending_review'/i.test(migrations), 're-review start must return authority to pending_review');
assert.ok(/update public\.business_listing_authority[\s\S]*verification_status = 'verified'/i.test(migrations), 're-review approval must explicitly restore verified authority');
assert.ok(/update public\.advisor_assignments[\s\S]*permissions = array\['profile'\]::text\[\]/i.test(migrations), 're-review approval must lock assignment scope to profile');
assert.ok(/status = 'revoked'[\s\S]*revoke_reason/i.test(migrations), 're-review rejection must revoke assignment');
assert.ok(/p_expires_at > now\(\) \+ interval '365 days'/i.test(migrations), 're-review expiry must be bounded to 365 days');
assert.ok(/owner_id[\s\S]*owner::text/i.test(migrations), 'Session 7 completion must support current Storage owner_id with legacy owner fallback');

const forbidden = [
  ['no Business row mutation', /(?:update|delete\s+from)\s+public\.businesses|insert\s+into\s+public\.businesses/i],
  ['no Business ownership mutation', /update\s+public\.businesses[\s\S]*owner_id\s*=/i],
  ['no Business publication mutation', /update\s+public\.businesses[\s\S]*visible\s*=\s*true/i],
  ['no payment write', /(insert|update|delete)\s+(?:into\s+|from\s+)?public\.payment_orders/i],
  ['no Business RLS change', /(create|drop|alter)\s+policy[^;]+on\s+public\.(businesses|business_files|business_images|payment_orders|proposals|request_data|business_financial_access_grants)/is],
  ['no authority Storage UPDATE policy', /create\s+policy\s+[^;]*authority evidence[^;]*for\s+update/is],
  ['no authority Storage DELETE policy', /create\s+policy\s+[^;]*authority evidence[^;]*for\s+delete/is],
  ['no broad scope assignment', /permissions\s*=\s*array\[[^\]]*(files|images|proposals|data_requests|payments|reports)/i],
  ['no anonymous RPC grant', /grant execute on function public\.d68_[^;]+\bto\s+[^;]*anon/i],
];
for (const [name, pattern] of forbidden) assert.doesNotMatch(migrations, pattern, `Forbidden Session 7 pattern: ${name}`);

for (const signature of [
  'public.d68_advisor_begin_authority_evidence_v2(uuid,text,text,text,bigint,text,uuid)',
  'public.d68_advisor_complete_authority_evidence_v2(uuid)',
  'public.d68_admin_validate_advisor_authority_evidence_v1(uuid,text,text,boolean)',
  'public.d68_admin_request_advisor_authority_evidence_v2(uuid,text)',
  'public.d68_admin_start_advisor_authority_rereview_v1(uuid,text)',
  'public.d68_admin_review_advisor_authority_rereview_v1(uuid,text,timestamptz,text)',
  'public.d68_get_my_authority_review_v2(uuid)',
  'public.d68_admin_list_advisor_business_intakes_v3()',
]) {
  assert.ok(migrations.includes(`revoke all on function ${signature} from public, anon, authenticated`), `Missing fail-closed revoke for ${signature}`);
  assert.ok(migrations.includes(`grant execute on function ${signature} to authenticated, service_role`), `Missing authenticated/service grant for ${signature}`);
}

assert.ok(advisorLib.includes('d68_get_my_authority_review_v2') || advisorLib.includes('d68_get_my_authority_review_v3'), 'Advisor review client must use Session 7 v2 or a later server wrapper');
assert.ok(advisorLib.includes('d68_advisor_begin_authority_evidence_v2'), 'Advisor upload client must use Session 7 allocation');
assert.ok(advisorLib.includes('d68_advisor_complete_authority_evidence_v2'), 'Advisor upload client must use Session 7 completion');
assert.ok(advisorLib.includes('p_replaces_evidence_id'), 'Advisor replacement upload must bind server-validated replacement target');
assert.ok(advisorLib.includes('upsert: false'), 'Evidence upload must remain non-overwriting');
assert.equal(/service_role|SUPABASE_SERVICE/i.test(advisorLib), false, 'frontend must not expose service role');
assert.equal(/\.from\(['"](?:businesses|advisor_authority_evidence|advisor_authority_rereviews)['"]\)[\s\S]{0,140}\.(?:insert|update|delete)\(/i.test(advisorLib + advisorPanel + advisorPage), false, 'Advisor frontend must not write protected tables directly');
assert.ok(advisorPanel.includes('Nộp file thay thế') && advisorPanel.includes('replacesEvidenceId'), 'Advisor UI must expose governed replacement upload');
assert.ok(advisorPanel.includes('tái thẩm định') || advisorPanel.includes('Re-review'), 'Advisor UI must explain re-review state');
assert.ok(advisorPage.includes('Ranh giới Phiên 7') || advisorPage.includes('Ranh giới Phiên 8'), 'Advisor dashboard must expose Session 7 boundary or a later inherited boundary');

assert.ok(adminLib.includes('d68_admin_list_advisor_business_intakes_v3') || adminLib.includes('d68_admin_list_advisor_business_intakes_v4'), 'Admin queue must use Session 7 v3 or a later server wrapper');
assert.ok(adminLib.includes('d68_admin_validate_advisor_authority_evidence_v1'), 'Admin client must validate evidence through RPC');
assert.ok(adminLib.includes('d68_admin_start_advisor_authority_rereview_v1'), 'Admin client must start re-review through RPC');
assert.ok(adminLib.includes('d68_admin_review_advisor_authority_rereview_v1'), 'Admin client must decide re-review through RPC');
assert.equal(/\.from\(['"](?:businesses|advisor_authority_evidence|advisor_authority_rereviews)['"]\)[\s\S]{0,140}\.(?:insert|update|delete)\(/i.test(adminLib + adminCard + adminPage), false, 'Admin frontend must not mutate protected tables directly');
assert.ok(adminCard.includes('Hợp lệ') && adminCard.includes('Không hợp lệ') && adminCard.includes('Yêu cầu file thay thế'), 'Admin UI must expose validation actions');
assert.ok(adminCard.includes('Mở tái thẩm định authority') && adminCard.includes('Tái xác minh authority'), 'Admin UI must expose governed re-review actions');
assert.ok(adminPage.includes('Ranh giới Phiên 7') || adminPage.includes('Ranh giới Phiên 8'), 'Admin UI must state Session 7 boundary or a later inherited boundary');

assert.ok(pkg.scripts['qa:advisor-session7'], 'package.json must expose qa:advisor-session7');
assert.ok(pkg.scripts['qa:release']?.includes('qa:advisor-session7'), 'release QA must include Session 7');

console.log('✓ Advisor Session 7 evidence validation & re-review static contract: PASS');
console.log('✓ Evidence payload remains immutable; Admin validation/replacement metadata is governed by RPC.');
console.log('✓ Re-review closes authority access, approval remains profile-only, and rejection revokes assignment.');
console.log('✓ Business ownership, publication, payment and mutation boundaries remain closed.');
