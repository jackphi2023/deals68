#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migrationPath = 'supabase/migrations/20260807155500_advisor_authority_evidence_phase6_v1.sql';
const migration = fs.readFileSync(migrationPath, 'utf8');
const advisorLib = fs.readFileSync('src/lib/advisorAuthorityEvidence.ts', 'utf8');
const advisorPage = fs.readFileSync('src/pages/AdvisorAccount.tsx', 'utf8');
const advisorPanel = fs.readFileSync('src/components/AdvisorAuthorityEvidencePanel.tsx', 'utf8');
const adminLib = fs.readFileSync('src/lib/adminAdvisorIntakes.ts', 'utf8');
const adminPage = fs.readFileSync('src/pages/AdminAdvisorIntakes.tsx', 'utf8');
const adminCard = fs.readFileSync('src/components/AdminAdvisorIntakeCard.tsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const required = [
  'create table if not exists public.advisor_authority_evidence',
  'create table if not exists public.advisor_authority_review_events',
  "'advisor-authority-evidence-private'",
  'alter table public.advisor_authority_evidence enable row level security',
  'alter table public.advisor_authority_review_events enable row level security',
  'revoke all on table public.advisor_authority_evidence from public, anon, authenticated',
  'revoke all on table public.advisor_authority_review_events from public, anon, authenticated',
  'd68_private.can_advisor_upload_authority_evidence',
  'd68_private.can_read_advisor_authority_evidence',
  'd68_advisor_begin_authority_evidence_v1',
  'd68_advisor_complete_authority_evidence_v1',
  'd68_get_my_authority_review_v1',
  'd68_admin_request_advisor_authority_evidence_v1',
  'd68_admin_list_advisor_business_intakes_v2',
  "metadata->>'source' = 'advisor_session4_business_intake'",
  "verification_status = 'pending_review'",
  "v_business.owner_id is not null",
  'v_business.visible is true',
  "v_business.status <> 'draft'::public.account_status",
  'Maximum 8 submitted authority evidence files per intake',
  'Authority evidence upload allocation limit reached',
  'Evidence request rate limit reached',
  "new.verification_status in ('verified','rejected')",
  "event_type = 'evidence_requested'",
  "'advisor.authority_evidence.submitted'",
  "'advisor.business_intake.evidence_requested'",
  "set search_path = ''",
];
for (const token of required) assert.ok(migration.includes(token), `Session 6 migration missing contract token: ${token}`);

assert.ok(/allowed_mime_types[\s\S]*application\/pdf[\s\S]*image\/jpeg[\s\S]*image\/png[\s\S]*image\/webp/i.test(migration), 'private bucket MIME allowlist must be explicit');
assert.ok(/file_size_limit[\s\S]*10485760/.test(migration), 'private bucket must cap evidence at 10 MB');
assert.ok(/create policy "advisor authority evidence insert allocated path"[\s\S]*for insert\s+to authenticated[\s\S]*can_advisor_upload_authority_evidence/i.test(migration), 'Storage INSERT must use allocation helper');
assert.ok(/create policy "advisor authority evidence select owner or admin"[\s\S]*for select\s+to authenticated[\s\S]*can_read_advisor_authority_evidence/i.test(migration), 'Storage SELECT must use owner/Admin helper');
assert.equal(migration.includes('create policy "advisor authority evidence update'), false, 'Session 6 must not create Storage UPDATE policy');
assert.equal(migration.includes('create policy "advisor authority evidence delete'), false, 'Session 6 must not create Storage DELETE policy');
assert.ok(migration.includes("p_permissions: ['profile']") === false, 'SQL must not accept frontend scope material');
assert.equal(/permissions\s*=\s*array\[[^\]]*(files|images|reports|proposals|payments)/i.test(migration), false, 'Session 6 must not grant broad Advisor scopes');
assert.equal(/update\s+public\.businesses\s+set/i.test(migration), false, 'Session 6 migration must not mutate Business rows');
assert.equal(/insert\s+into\s+public\.payment_orders/i.test(migration), false, 'Session 6 migration must not create payment orders');
assert.equal(/create\s+policy\s+[^\n]+\s+on\s+public\.businesses/i.test(migration), false, 'Session 6 must not change Business RLS');

for (const signature of [
  'public.d68_advisor_begin_authority_evidence_v1(uuid,text,text,text,bigint,text)',
  'public.d68_advisor_complete_authority_evidence_v1(uuid)',
  'public.d68_get_my_authority_review_v1(uuid)',
  'public.d68_admin_request_advisor_authority_evidence_v1(uuid,text)',
  'public.d68_admin_list_advisor_business_intakes_v2()',
]) {
  assert.ok(migration.includes(`revoke all on function ${signature} from public, anon, authenticated`), `Missing fail-closed revoke for ${signature}`);
  assert.ok(migration.includes(`grant execute on function ${signature} to authenticated, service_role`), `Missing authenticated/service grant for ${signature}`);
}

assert.ok(advisorLib.includes("supabase.storage\n    .from(bucket)\n    .upload"), 'Advisor client must upload only to server-allocated bucket/path');
assert.ok(advisorLib.includes('upsert: false'), 'authority evidence upload must not overwrite objects');
assert.ok(advisorLib.includes("supabase.rpc(\n    'd68_advisor_complete_authority_evidence_v1'"), 'Advisor client must finalize evidence through RPC');
assert.equal(/service_role|SUPABASE_SERVICE/i.test(advisorLib), false, 'frontend must not expose service role');
assert.equal(/\.from\(['"]advisor_authority_evidence['"]\)/.test(advisorLib), false, 'frontend must not access evidence table directly');
assert.equal(/\.from\(['"]businesses['"]\).*\.(insert|update|delete)/s.test(advisorLib + advisorPanel + advisorPage), false, 'Advisor Session 6 frontend must not mutate Business directly');
assert.ok(advisorPanel.includes('10 MB/file') && advisorPanel.includes('immutable after submission'), 'Advisor UI must explain evidence limits/immutability');
assert.ok(advisorPage.includes('Ranh giới Phiên 6'), 'Advisor UI must expose Session 6 boundary');

assert.ok(adminLib.includes('d68_admin_list_advisor_business_intakes_v2'), 'Admin queue must use Session 6 enriched RPC');
assert.ok(adminLib.includes('d68_admin_request_advisor_authority_evidence_v1'), 'Admin client must request evidence through RPC');
assert.equal(/\.from\(['"]advisor_authority_(evidence|review_events)['"]\)/.test(adminLib), false, 'Admin frontend must not query authority tables directly');
assert.equal(/\.from\(['"]businesses['"]\).*\.(insert|update|delete)/s.test(adminLib + adminCard + adminPage), false, 'Admin Session 6 frontend must not mutate Business directly');
assert.ok(adminCard.includes('Yêu cầu bổ sung bằng chứng'), 'Admin UI must expose evidence request action');
assert.ok(adminCard.includes('Lịch sử thẩm định'), 'Admin UI must expose review history');
assert.ok(adminPage.includes('Ranh giới Phiên 6'), 'Admin page must state Session 6 boundary');

assert.ok(pkg.scripts['qa:advisor-session6'], 'package.json must expose qa:advisor-session6');
assert.ok(pkg.scripts['qa:release']?.includes('qa:advisor-session6'), 'release QA must include Session 6');

console.log('✓ Advisor Session 6 authority evidence static contract: PASS');
console.log('✓ Dedicated private immutable Storage evidence path is allocation-gated and owner/Admin readable only.');
console.log('✓ Admin evidence requests and append-only review history add no Business mutation or scope escalation.');
