#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const advisorId = '00000000-0000-0000-0000-000000000701';
const adminId = '00000000-0000-0000-0000-000000000702';
const outsiderId = '00000000-0000-0000-0000-000000000703';

function session5Foundation() {
  const source = fs.readFileSync('scripts/deals68-advisor-session5-postgres-test.mjs', 'utf8');
  const startMarker = 'const foundation = `';
  const endMarker = '`;\n\nconst payload =';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, 'Could not extract Session 5 PostgreSQL foundation');
  return source.slice(start + startMarker.length, end);
}

const storageFoundation = `
create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id) on delete cascade,
  name text not null,
  owner uuid,
  owner_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb,
  unique(bucket_id,name)
);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, service_role;
grant select,insert,update,delete on storage.objects to authenticated, service_role;
grant select,insert,update,delete on storage.buckets to service_role;
`;

const businessPayload = {
  company_name: 'Session Seven Client',
  title_vi: 'Business intake authority validation',
  title_en: '',
  description_vi: 'Business intake kiểm thử evidence validation và authority re-review.',
  description_en: '',
  country_iso2: 'VN',
  city: 'Hồ Chí Minh',
  industry: 'Technology',
  deal_type: 'Fundraising',
};
const authorityPayload = {
  declared_owner_name: 'Session Seven Client',
  declared_principal_name: 'Client Principal',
  declared_agent_name: 'Advisor Company',
  declared_asset_address: 'Ho Chi Minh City',
};

async function setActor(id) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${id || ''}', false)`);
}
async function asRole(role, fn) {
  await db.exec(`set role ${role}`);
  try { return await fn(); } finally { await db.exec('reset role'); }
}
async function createIntake(key) {
  return asRole('authenticated', () => db.query(
    `select public.d68_create_advisor_business_intake_v1($1::text,$2::jsonb,$3::jsonb) as result`,
    [key, JSON.stringify(businessPayload), JSON.stringify(authorityPayload)],
  ));
}
async function beginEvidence(assignmentId, name, replacesEvidenceId = null, size = 2048) {
  return asRole('authenticated', () => db.query(
    `select public.d68_advisor_begin_authority_evidence_v2($1::uuid,$2::text,$3::text,$4::text,$5::bigint,$6::text,$7::uuid) as result`,
    [assignmentId, 'mandate', name, 'application/pdf', size, `Evidence ${name}`, replacesEvidenceId],
  ));
}
async function putAllocatedObject(allocation) {
  return asRole('authenticated', () => db.query(
    `insert into storage.objects(bucket_id,name,owner,owner_id,metadata) values ($1,$2,$3::uuid,$3::text,$4::jsonb)`,
    [allocation.storage_bucket, allocation.storage_path, advisorId, JSON.stringify({ size: 2048, mimetype: 'application/pdf' })],
  ));
}
async function completeEvidence(evidenceId) {
  return asRole('authenticated', () => db.query(
    `select public.d68_advisor_complete_authority_evidence_v2($1::uuid) as result`, [evidenceId],
  ));
}
async function myReview(assignmentId, role = 'authenticated') {
  return asRole(role, () => db.query(
    `select public.d68_get_my_authority_review_v2($1::uuid) as result`, [assignmentId],
  ));
}
async function adminQueue(role = 'authenticated') {
  return asRole(role, () => db.query(`select public.d68_admin_list_advisor_business_intakes_v3() as result`));
}
async function validateEvidence(evidenceId, status, note = null, replacement = false) {
  return asRole('authenticated', () => db.query(
    `select public.d68_admin_validate_advisor_authority_evidence_v1($1::uuid,$2::text,$3::text,$4::boolean) as result`,
    [evidenceId, status, note, replacement],
  ));
}
async function reviewInitial(assignmentId, decision, expiry = null, note = null) {
  return asRole('authenticated', () => db.query(
    `select public.d68_admin_review_advisor_business_intake_v1($1::uuid,$2::text,$3::timestamptz,$4::text[],$5::text) as result`,
    [assignmentId, decision, expiry, ['profile'], note],
  ));
}
async function startRereview(assignmentId, note = 'Authority expiry / mandate re-check') {
  return asRole('authenticated', () => db.query(
    `select public.d68_admin_start_advisor_authority_rereview_v1($1::uuid,$2::text) as result`, [assignmentId, note],
  ));
}
async function decideRereview(rereviewId, decision, expiry = null, note = null) {
  return asRole('authenticated', () => db.query(
    `select public.d68_admin_review_advisor_authority_rereview_v1($1::uuid,$2::text,$3::timestamptz,$4::text) as result`,
    [rereviewId, decision, expiry, note],
  ));
}
async function businessContext(businessId) {
  return asRole('authenticated', () => db.query(
    `select public.d68_get_my_advisor_business_context_v1($1::uuid) as result`, [businessId],
  ));
}

try {
  await db.exec(session5Foundation());
  for (const migration of [
    '20260806093000_advisor_assignment_security_phase1_v1.sql',
    '20260806102000_advisor_auth_phase2_v1.sql',
    '20260806111000_advisor_readonly_portfolio_phase3_v1.sql',
    '20260806184000_advisor_business_intake_phase4_v1.sql',
    '20260806203000_advisor_authority_review_phase5_v1.sql',
  ]) await db.exec(fs.readFileSync(`supabase/migrations/${migration}`, 'utf8'));

  const businessPolicyBefore = (await db.query(`select count(*)::int count from pg_policies where schemaname='public' and tablename='businesses'`)).rows[0].count;
  await db.exec(storageFoundation);
  for (const migration of [
    '20260807155500_advisor_authority_evidence_phase6_v1.sql',
    '20260807155600_advisor_authority_evidence_phase6_fk_indexes_v1.sql',
    '20260807163500_advisor_authority_validation_schema_phase7_v1.sql',
    '20260807163600_advisor_authority_validation_rpc_phase7_v1.sql',
    '20260807163700_advisor_authority_rereview_rpc_phase7_v1.sql',
    '20260807163800_advisor_authority_review_views_phase7_v1.sql',
  ]) await db.exec(fs.readFileSync(`supabase/migrations/${migration}`, 'utf8'));

  await db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
    ($1::uuid,'advisor7@example.com',now(),'{}'),
    ($2::uuid,'admin7@example.com',now(),'{}'),
    ($3::uuid,'outsider7@example.com',now(),'{}')`, [advisorId, adminId, outsiderId]);
  await db.query(`insert into public.profiles(id,role,username,display_name,email,status,dashboard_login_enabled) values
    ($1::uuid,'advisor','advisor.s7','Advisor Session 7','advisor7@example.com','active',true),
    ($2::uuid,'admin','admin.s7','Admin Session 7','admin7@example.com','active',true),
    ($3::uuid,'business','outsider.s7','Outsider','outsider7@example.com','active',true)`, [advisorId, adminId, outsiderId]);
  await db.query(`insert into public.advisor_profiles(profile_id,created_by,status,title,advisor_type,company_name,verification_status,verified_by,verified_at)
    values ($1::uuid,$2::uuid,'active','M&A Advisor','advisor_broker','Advisor Company','verified',$2::uuid,now())`, [advisorId, adminId]);

  await setActor(advisorId);
  const intake = (await createIntake('session7-validation-intake-key-000001')).rows[0].result;
  assert.equal(intake.authority_status, 'pending_review');
  assert.equal(intake.assignment_status, 'pending');

  let own = (await myReview(intake.assignment_id)).rows[0].result;
  assert.equal(own.authority_lifecycle_status, 'initial_pending');
  assert.equal(own.can_upload, true);
  assert.equal(own.access.replacement_upload_enabled, true);
  assert.equal(own.access.business_mutations_enabled, false);

  const firstAllocation = (await beginEvidence(intake.assignment_id, 'mandate-v1.pdf')).rows[0].result;
  await putAllocatedObject(firstAllocation);
  const firstCompleted = (await completeEvidence(firstAllocation.evidence_id)).rows[0].result;
  assert.equal(firstCompleted.status, 'submitted');

  await setActor(adminId);
  await assert.rejects(() => validateEvidence(firstAllocation.evidence_id, 'invalid', 'bad', false), /at least 5/i);
  const invalid = (await validateEvidence(firstAllocation.evidence_id, 'invalid', 'Signature cannot be verified', true)).rows[0].result;
  assert.equal(invalid.validation_status, 'invalid');
  assert.equal(invalid.request_replacement, true);

  let queue = (await adminQueue()).rows[0].result;
  assert.equal(queue.items.length, 1);
  assert.equal(queue.items[0].evidence_validation_summary.invalid, 1);
  assert.equal(queue.items[0].can_validate_evidence, true);
  assert.equal(queue.access.business_mutations_enabled, false);
  assert.equal(queue.access.publication_enabled, false);

  await setActor(advisorId);
  own = (await myReview(intake.assignment_id)).rows[0].result;
  assert.equal(own.evidence[0].validation_status, 'invalid');
  assert.equal(Object.hasOwn(own.evidence[0], 'validation_note'), false, 'Admin validation note must not be exposed as evidence metadata');
  const replacementRequest = own.review_history.find((event) => event.event_type === 'evidence_replacement_requested');
  assert.equal(replacementRequest.note, 'Signature cannot be verified');

  const replacementAllocation = (await beginEvidence(intake.assignment_id, 'mandate-v2.pdf', firstAllocation.evidence_id)).rows[0].result;
  assert.equal(replacementAllocation.replaces_evidence_id, firstAllocation.evidence_id);
  await putAllocatedObject(replacementAllocation);
  const replacementCompleted = (await completeEvidence(replacementAllocation.evidence_id)).rows[0].result;
  assert.equal(replacementCompleted.replaces_evidence_id, firstAllocation.evidence_id);
  const oldEvidence = (await db.query(`select validation_status,superseded_by_evidence_id,superseded_at from public.advisor_authority_evidence where id=$1::uuid`, [firstAllocation.evidence_id])).rows[0];
  assert.equal(oldEvidence.validation_status, 'invalid');
  assert.equal(oldEvidence.superseded_by_evidence_id, replacementAllocation.evidence_id);
  assert.ok(oldEvidence.superseded_at);
  await assert.rejects(
    () => db.query(`update public.advisor_authority_evidence set original_name='tampered.pdf' where id=$1::uuid`, [firstAllocation.evidence_id]),
    /payload is immutable/i,
  );

  await setActor(adminId);
  const validReplacement = (await validateEvidence(replacementAllocation.evidence_id, 'valid', 'Signed mandate verified', false)).rows[0].result;
  assert.equal(validReplacement.validation_status, 'valid');
  queue = (await adminQueue()).rows[0].result;
  assert.equal(queue.items[0].evidence_count, 1, 'Only one current evidence remains after replacement');
  assert.equal(queue.items[0].total_evidence_count, 2, 'Superseded evidence remains in audit history');
  assert.equal(queue.items[0].evidence_validation_summary.valid, 1);
  assert.equal(queue.items[0].evidence_validation_summary.invalid, 0);

  const initialExpiry = new Date(Date.now() + 180 * 86400000).toISOString();
  const approved = (await reviewInitial(intake.assignment_id, 'approve', initialExpiry, 'Authority verified after evidence review')).rows[0].result;
  assert.equal(approved.authority_status, 'verified');
  assert.equal(approved.assignment_status, 'pending');
  assert.deepEqual(approved.permissions, ['profile']);

  await setActor(advisorId);
  await asRole('authenticated', () => db.query(`select public.d68_accept_advisor_assignment($1::uuid)`, [intake.assignment_id]));
  const contextBeforeRereview = (await businessContext(intake.business_id)).rows[0].result;
  assert.equal(contextBeforeRereview.access.mode, 'read_only');

  await setActor(adminId);
  const started = (await startRereview(intake.assignment_id)).rows[0].result;
  assert.equal(started.authority_status, 'pending_review');
  assert.equal(started.assignment_status, 'active');
  assert.equal(started.context_access_suspended_by_authority, true);
  const assignmentDuringReview = (await db.query(`select status,permissions,accepted_at from public.advisor_assignments where id=$1::uuid`, [intake.assignment_id])).rows[0];
  assert.equal(assignmentDuringReview.status, 'active');
  assert.deepEqual(assignmentDuringReview.permissions, ['profile']);
  assert.ok(assignmentDuringReview.accepted_at);

  await setActor(advisorId);
  await assert.rejects(() => businessContext(intake.business_id), /verified|authority|access|assignment/i);
  own = (await myReview(intake.assignment_id)).rows[0].result;
  assert.equal(own.authority_lifecycle_status, 'rereview_pending');
  assert.equal(own.can_upload, true);
  assert.equal(own.current_rereview.cycle_no, 1);
  assert.equal(own.current_rereview.reason, 'Authority expiry / mandate re-check');

  const extraAllocation = (await beginEvidence(intake.assignment_id, 'supporting-v1.pdf')).rows[0].result;
  await putAllocatedObject(extraAllocation);
  await completeEvidence(extraAllocation.evidence_id);

  await setActor(adminId);
  await validateEvidence(extraAllocation.evidence_id, 'invalid', 'Document date is inconsistent', false);
  const newExpiry = new Date(Date.now() + 240 * 86400000).toISOString();
  await assert.rejects(() => decideRereview(started.rereview_id, 'approve', newExpiry, 'Ready'), /Resolve or replace all current insufficient\/invalid/i);

  await setActor(advisorId);
  const extraReplacement = (await beginEvidence(intake.assignment_id, 'supporting-v2.pdf', extraAllocation.evidence_id)).rows[0].result;
  await putAllocatedObject(extraReplacement);
  await completeEvidence(extraReplacement.evidence_id);

  await setActor(adminId);
  await validateEvidence(extraReplacement.evidence_id, 'valid', 'Updated document verified', false);
  const rereviewApproved = (await decideRereview(started.rereview_id, 'approve', newExpiry, 'Re-review completed')).rows[0].result;
  assert.equal(rereviewApproved.authority_status, 'verified');
  assert.equal(rereviewApproved.assignment_status, 'active');
  assert.deepEqual(rereviewApproved.permissions, ['profile']);
  assert.equal(rereviewApproved.business_status, 'draft');
  assert.equal(rereviewApproved.business_visible, false);

  await setActor(advisorId);
  const contextRestored = (await businessContext(intake.business_id)).rows[0].result;
  assert.equal(contextRestored.access.mode, 'read_only');
  own = (await myReview(intake.assignment_id)).rows[0].result;
  assert.equal(own.authority_status, 'verified');
  assert.equal(own.can_upload, false);
  assert.equal(own.review_history.some((event) => event.event_type === 'authority_rereview_approved'), true);
  const advisorRereviewApproval = own.review_history.find((event) => event.event_type === 'authority_rereview_approved');
  assert.equal(Object.hasOwn(advisorRereviewApproval, 'note'), false, 'Admin re-review approval note must remain internal');

  await setActor(adminId);
  const second = (await startRereview(intake.assignment_id, 'Mandate relationship must be terminated')).rows[0].result;
  const rejected = (await decideRereview(second.rereview_id, 'reject', null, 'Principal terminated the mandate')).rows[0].result;
  assert.equal(rejected.authority_status, 'rejected');
  assert.equal(rejected.assignment_status, 'revoked');
  assert.deepEqual(rejected.permissions, ['profile']);

  await setActor(advisorId);
  await assert.rejects(() => businessContext(intake.business_id), /active|verified|access|assignment/i);
  own = (await myReview(intake.assignment_id)).rows[0].result;
  assert.equal(own.authority_lifecycle_status, 'rejected');
  assert.equal(own.can_upload, false);

  const finalState = (await db.query(`select b.owner_id,b.visible,b.status::text business_status,aa.status assignment_status,aa.permissions,bla.verification_status::text authority_status
    from public.advisor_assignments aa
    join public.businesses b on b.id=aa.business_id
    join public.business_listing_authority bla on bla.id=aa.authority_id
    where aa.id=$1::uuid`, [intake.assignment_id])).rows[0];
  assert.equal(finalState.owner_id, null);
  assert.equal(finalState.visible, false);
  assert.equal(finalState.business_status, 'draft');
  assert.equal(finalState.assignment_status, 'revoked');
  assert.deepEqual(finalState.permissions, ['profile']);
  assert.equal(finalState.authority_status, 'rejected');

  await setActor(outsiderId);
  await assert.rejects(() => adminQueue());
  await assert.rejects(() => startRereview(intake.assignment_id), /Admin access required/);

  await setActor('');
  await assert.rejects(() => adminQueue('anon'));
  const grants = (await db.query(`select
    has_function_privilege('anon','public.d68_advisor_begin_authority_evidence_v2(uuid,text,text,text,bigint,text,uuid)','execute') anon_begin,
    has_function_privilege('anon','public.d68_advisor_complete_authority_evidence_v2(uuid)','execute') anon_complete,
    has_function_privilege('anon','public.d68_get_my_authority_review_v2(uuid)','execute') anon_review,
    has_function_privilege('anon','public.d68_admin_validate_advisor_authority_evidence_v1(uuid,text,text,boolean)','execute') anon_validate,
    has_function_privilege('anon','public.d68_admin_request_advisor_authority_evidence_v2(uuid,text)','execute') anon_request,
    has_function_privilege('anon','public.d68_admin_start_advisor_authority_rereview_v1(uuid,text)','execute') anon_start,
    has_function_privilege('anon','public.d68_admin_review_advisor_authority_rereview_v1(uuid,text,timestamptz,text)','execute') anon_decide,
    has_function_privilege('anon','public.d68_admin_list_advisor_business_intakes_v3()','execute') anon_queue,
    has_function_privilege('authenticated','public.d68_get_my_authority_review_v2(uuid)','execute') auth_review,
    has_function_privilege('authenticated','public.d68_admin_list_advisor_business_intakes_v3()','execute') auth_queue`)).rows[0];
  assert.deepEqual([
    grants.anon_begin, grants.anon_complete, grants.anon_review, grants.anon_validate,
    grants.anon_request, grants.anon_start, grants.anon_decide, grants.anon_queue,
  ], [false,false,false,false,false,false,false,false]);
  assert.equal(grants.auth_review, true);
  assert.equal(grants.auth_queue, true);

  await setActor(advisorId);
  await assert.rejects(() => asRole('authenticated', () => db.query(`select * from public.advisor_authority_rereviews`)));
  await assert.rejects(() => asRole('authenticated', () => db.query(`select * from public.advisor_authority_evidence`)));

  const storagePolicies = (await db.query(`select policyname,cmd from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'advisor authority evidence %' order by cmd`)).rows;
  assert.equal(storagePolicies.length, 2);
  assert.deepEqual(new Set(storagePolicies.map((row) => row.cmd)), new Set(['INSERT','SELECT']));

  const businessPolicyAfter = (await db.query(`select count(*)::int count from pg_policies where schemaname='public' and tablename='businesses'`)).rows[0].count;
  assert.equal(businessPolicyAfter, businessPolicyBefore);
  const payments = (await db.query(`select count(*)::int count from public.payment_orders`)).rows[0].count;
  assert.equal(payments, 0);
  const reviewEvents = (await db.query(`select event_type from public.advisor_authority_review_events where assignment_id=$1::uuid order by created_at`, [intake.assignment_id])).rows.map((row) => row.event_type);
  for (const expected of ['evidence_validated','evidence_replacement_requested','authority_rereview_started','authority_rereview_approved','authority_rereview_rejected']) {
    assert.equal(reviewEvents.includes(expected), true, `Missing Session 7 review event ${expected}`);
  }
  const audits = (await db.query(`select action from public.audit_logs where action like 'advisor.%' order by created_at`)).rows.map((row) => row.action);
  for (const expected of [
    'advisor.authority_evidence.validated',
    'advisor.business_intake.authority_rereview_started',
    'advisor.business_intake.authority_rereview_approved',
    'advisor.business_intake.authority_rereview_rejected',
  ]) assert.equal(audits.includes(expected), true, `Missing Session 7 audit ${expected}`);

  console.log('✓ Advisor Session 7 PostgreSQL lifecycle: PASS');
  console.log('✓ Sessions 1→7 apply in order; evidence validation and replacement preserve immutable file payloads.');
  console.log('✓ Re-review immediately closes context through pending authority and restores it only after valid profile-only approval.');
  console.log('✓ Re-review rejection revokes assignment; Business remains ownerless, draft and non-public with no payment/RLS widening.');
} finally {
  await db.close();
}
