#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const advisorId = '00000000-0000-0000-0000-000000000601';
const adminId = '00000000-0000-0000-0000-000000000602';
const outsiderId = '00000000-0000-0000-0000-000000000603';

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
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb,
  owner_id text,
  unique(bucket_id,name)
);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, service_role;
grant select,insert,update,delete on storage.objects to authenticated, service_role;
grant select,insert,update,delete on storage.buckets to service_role;
`;

const businessPayload = {
  company_name: 'Session Six Client',
  title_vi: 'Gọi vốn mở rộng doanh nghiệp',
  title_en: '',
  description_vi: 'Business intake có tài liệu chứng minh authority riêng tư.',
  description_en: '',
  country_iso2: 'VN',
  city: 'Hồ Chí Minh',
  industry: 'Technology',
  deal_type: 'Fundraising',
};
const authorityPayload = {
  declared_owner_name: 'Session Six Client',
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
async function beginEvidence(assignmentId, mime = 'application/pdf', size = 2048, note = 'Signed mandate') {
  return asRole('authenticated', () => db.query(
    `select public.d68_advisor_begin_authority_evidence_v1($1::uuid,$2::text,$3::text,$4::text,$5::bigint,$6::text) as result`,
    [assignmentId, 'mandate', 'signed-mandate.pdf', mime, size, note],
  ));
}
async function completeEvidence(evidenceId) {
  return asRole('authenticated', () => db.query(
    `select public.d68_advisor_complete_authority_evidence_v1($1::uuid) as result`, [evidenceId],
  ));
}
async function myReview(assignmentId, role = 'authenticated') {
  return asRole(role, () => db.query(
    `select public.d68_get_my_authority_review_v1($1::uuid) as result`, [assignmentId],
  ));
}
async function adminQueue(role = 'authenticated') {
  return asRole(role, () => db.query(`select public.d68_admin_list_advisor_business_intakes_v2() as result`));
}
async function requestEvidence(assignmentId, note, role = 'authenticated') {
  return asRole(role, () => db.query(
    `select public.d68_admin_request_advisor_authority_evidence_v1($1::uuid,$2::text) as result`, [assignmentId, note],
  ));
}
async function reviewDecision(assignmentId, decision, expiry = null, note = null) {
  return asRole('authenticated', () => db.query(
    `select public.d68_admin_review_advisor_business_intake_v1($1::uuid,$2::text,$3::timestamptz,$4::text[],$5::text) as result`,
    [assignmentId, decision, expiry, ['profile'], note],
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
  await db.exec(fs.readFileSync('supabase/migrations/20260807155500_advisor_authority_evidence_phase6_v1.sql', 'utf8'));

  await db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
    ($1::uuid,'advisor6@example.com',now(),'{}'),
    ($2::uuid,'admin6@example.com',now(),'{}'),
    ($3::uuid,'outsider6@example.com',now(),'{}')`, [advisorId, adminId, outsiderId]);
  await db.query(`insert into public.profiles(id,role,username,display_name,email,status,dashboard_login_enabled) values
    ($1::uuid,'advisor','advisor.s6','Advisor Session 6','advisor6@example.com','active',true),
    ($2::uuid,'admin','admin.s6','Admin Session 6','admin6@example.com','active',true),
    ($3::uuid,'business','outsider.s6','Outsider','outsider6@example.com','active',true)`, [advisorId, adminId, outsiderId]);
  await db.query(`insert into public.advisor_profiles(profile_id,created_by,status,title,advisor_type,company_name,verification_status,verified_by,verified_at)
    values ($1::uuid,$2::uuid,'active','M&A Advisor','advisor_broker','Advisor Company','verified',$2::uuid,now())`, [advisorId, adminId]);

  await setActor(advisorId);
  const intake = (await createIntake('session6-evidence-intake-key-000001')).rows[0].result;
  assert.equal(intake.authority_status, 'pending_review');
  assert.equal(intake.assignment_status, 'pending');

  let own = (await myReview(intake.assignment_id)).rows[0].result;
  assert.equal(own.can_upload, true);
  assert.equal(own.evidence.length, 0);
  assert.equal(own.review_history.length, 1);
  assert.equal(own.review_history[0].event_type, 'intake_created');
  assert.equal(own.access.business_mutations_enabled, false);
  assert.equal(own.access.immutable_after_submit, true);

  await assert.rejects(() => beginEvidence(intake.assignment_id, 'text/plain', 20), /Only PDF, JPEG, PNG or WebP/);
  await assert.rejects(() => beginEvidence(intake.assignment_id, 'application/pdf', 10485761), /10 MB or smaller/);

  await setActor(outsiderId);
  await assert.rejects(() => beginEvidence(intake.assignment_id), /Active verified Advisor access required/);
  await assert.rejects(() => myReview(intake.assignment_id), /Active verified Advisor access required/);

  await setActor(advisorId);
  const allocation = (await beginEvidence(intake.assignment_id)).rows[0].result;
  assert.equal(allocation.storage_bucket, 'advisor-authority-evidence-private');
  assert.ok(allocation.storage_path.startsWith(`${intake.authority_id}/${advisorId}/`));
  assert.equal(allocation.immutable_after_submit, true);

  await assert.rejects(
    () => asRole('authenticated', () => db.query(
      `insert into storage.objects(bucket_id,name,owner,metadata) values ('advisor-authority-evidence-private',$1,$2::uuid,$3::jsonb)`,
      [`${intake.authority_id}/${advisorId}/wrong-path.pdf`, advisorId, JSON.stringify({ size: 2048, mimetype: 'application/pdf' })],
    )),
  );

  await asRole('authenticated', () => db.query(
    `insert into storage.objects(bucket_id,name,owner,metadata) values ('advisor-authority-evidence-private',$1,$2::uuid,$3::jsonb)`,
    [allocation.storage_path, advisorId, JSON.stringify({ size: 2048, mimetype: 'application/pdf' })],
  ));

  const completed = (await completeEvidence(allocation.evidence_id)).rows[0].result;
  assert.equal(completed.status, 'submitted');
  assert.equal(completed.authority_status, 'pending_review');
  assert.equal(completed.business_mutations_enabled, false);
  assert.equal(completed.idempotent_replay, false);
  const replay = (await completeEvidence(allocation.evidence_id)).rows[0].result;
  assert.equal(replay.idempotent_replay, true);

  const linked = (await db.query(`select authority_document_ids from public.business_listing_authority where id=$1::uuid`, [intake.authority_id])).rows[0];
  assert.ok(linked.authority_document_ids.includes(allocation.evidence_id));

  own = (await myReview(intake.assignment_id)).rows[0].result;
  assert.equal(own.evidence.length, 1);
  assert.equal(own.evidence[0].original_name, 'signed-mandate.pdf');
  assert.equal(own.review_history.some((event) => event.event_type === 'evidence_submitted'), true);

  await assert.rejects(() => asRole('authenticated', () => db.query(
    `update storage.objects set metadata='{}'::jsonb where bucket_id='advisor-authority-evidence-private' and name=$1`, [allocation.storage_path],
  )));
  await assert.rejects(() => asRole('authenticated', () => db.query(
    `delete from storage.objects where bucket_id='advisor-authority-evidence-private' and name=$1`, [allocation.storage_path],
  )));
  await assert.rejects(() => asRole('authenticated', () => db.query(`select * from public.advisor_authority_evidence`)));

  await setActor(adminId);
  let queue = (await adminQueue()).rows[0].result;
  assert.equal(queue.items.length, 1);
  assert.equal(queue.items[0].evidence_count, 1);
  assert.equal(queue.items[0].evidence.length, 1);
  assert.equal(queue.items[0].review_history.some((event) => event.event_type === 'evidence_submitted'), true);
  assert.equal(queue.access.business_mutations_enabled, false);
  assert.equal(queue.access.publication_enabled, false);
  assert.equal(queue.access.authority_evidence_enabled, true);

  await assert.rejects(() => requestEvidence(intake.assignment_id, 'No'), /at least 5/);
  const requested = (await requestEvidence(intake.assignment_id, 'Please provide the signed authorization letter')).rows[0].result;
  assert.equal(requested.status, 'evidence_requested');
  assert.equal(requested.business_status, 'draft');
  assert.equal(requested.business_visible, false);

  await setActor(advisorId);
  own = (await myReview(intake.assignment_id)).rows[0].result;
  const requestEvent = own.review_history.find((event) => event.event_type === 'evidence_requested');
  assert.equal(requestEvent.note, 'Please provide the signed authorization letter');

  await setActor(adminId);
  const expiry = new Date(Date.now() + 180 * 86400000).toISOString();
  const approved = (await reviewDecision(intake.assignment_id, 'approve', expiry, 'Evidence reviewed')).rows[0].result;
  assert.equal(approved.authority_status, 'verified');
  assert.equal(approved.assignment_status, 'pending');
  assert.deepEqual(approved.permissions, ['profile']);
  assert.equal(approved.can_advisor_accept, true);

  queue = (await adminQueue()).rows[0].result;
  assert.equal(queue.items[0].review_history.some((event) => event.event_type === 'authority_approved'), true);

  await setActor(advisorId);
  own = (await myReview(intake.assignment_id)).rows[0].result;
  assert.equal(own.can_upload, false);
  assert.equal(own.review_history.some((event) => event.event_type === 'authority_approved'), true);
  const advisorApprovedEvent = own.review_history.find((event) => event.event_type === 'authority_approved');
  assert.equal(Object.hasOwn(advisorApprovedEvent, 'note'), false, 'Admin internal approval note must not be exposed to Advisor');
  await assert.rejects(() => beginEvidence(intake.assignment_id), /pending Admin review|pending intake assignment|required|not pending/i);

  await asRole('authenticated', () => db.query(`select public.d68_accept_advisor_assignment($1::uuid)`, [intake.assignment_id]));
  const finalState = (await db.query(`select b.owner_id,b.visible,b.status::text business_status,aa.status assignment_status,aa.permissions
    from public.advisor_assignments aa join public.businesses b on b.id=aa.business_id where aa.id=$1::uuid`, [intake.assignment_id])).rows[0];
  assert.equal(finalState.owner_id, null);
  assert.equal(finalState.visible, false);
  assert.equal(finalState.business_status, 'draft');
  assert.equal(finalState.assignment_status, 'active');
  assert.deepEqual(finalState.permissions, ['profile']);

  await setActor('');
  await assert.rejects(() => adminQueue('anon'));
  const grants = (await db.query(`select
    has_function_privilege('anon','public.d68_advisor_begin_authority_evidence_v1(uuid,text,text,text,bigint,text)','execute') anon_begin,
    has_function_privilege('anon','public.d68_advisor_complete_authority_evidence_v1(uuid)','execute') anon_complete,
    has_function_privilege('anon','public.d68_get_my_authority_review_v1(uuid)','execute') anon_review,
    has_function_privilege('anon','public.d68_admin_request_advisor_authority_evidence_v1(uuid,text)','execute') anon_request,
    has_function_privilege('anon','public.d68_admin_list_advisor_business_intakes_v2()','execute') anon_queue,
    has_function_privilege('authenticated','public.d68_advisor_begin_authority_evidence_v1(uuid,text,text,text,bigint,text)','execute') auth_begin,
    has_function_privilege('authenticated','public.d68_admin_list_advisor_business_intakes_v2()','execute') auth_queue`)).rows[0];
  assert.deepEqual([grants.anon_begin,grants.anon_complete,grants.anon_review,grants.anon_request,grants.anon_queue],[false,false,false,false,false]);
  assert.equal(grants.auth_begin, true);
  assert.equal(grants.auth_queue, true);

  const storagePolicies = (await db.query(`select policyname,cmd from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'advisor authority evidence %' order by cmd`)).rows;
  assert.equal(storagePolicies.length, 2);
  assert.deepEqual(new Set(storagePolicies.map((row) => row.cmd)), new Set(['INSERT','SELECT']));

  const businessPolicyAfter = (await db.query(`select count(*)::int count from pg_policies where schemaname='public' and tablename='businesses'`)).rows[0].count;
  assert.equal(businessPolicyAfter, businessPolicyBefore);
  const payments = (await db.query(`select count(*)::int count from public.payment_orders`)).rows[0].count;
  assert.equal(payments, 0);
  const audits = (await db.query(`select action from public.audit_logs where action in ('advisor.authority_evidence.submitted','advisor.business_intake.evidence_requested') order by created_at`)).rows;
  assert.equal(audits.length, 2);

  console.log('✓ Advisor Session 6 PostgreSQL lifecycle: PASS');
  console.log('✓ Sessions 1→6 apply in sequence; allocated private evidence is owner/Admin readable and immutable after submission.');
  console.log('✓ Admin can request evidence and review history is append-only; approval remains profile-only and acceptance-gated.');
  console.log('✓ Business remains ownerless, draft and non-public; no payment or Business RLS widening occurs.');
} finally {
  await db.close();
}
