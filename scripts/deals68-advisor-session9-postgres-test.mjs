#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const advisorId = '00000000-0000-0000-0000-000000000901';
const adminId = '00000000-0000-0000-0000-000000000902';
const outsiderId = '00000000-0000-0000-0000-000000000903';
const businessId = '00000000-0000-0000-0000-000000000921';
const authorityId = '00000000-0000-0000-0000-000000000922';
const assignmentId = '00000000-0000-0000-0000-000000000923';

const foundation = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create schema d68_private;

create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, service_role;
grant execute on function auth.uid() to authenticated, service_role;

create table public.profiles (
  id uuid primary key,
  role text not null,
  status text not null default 'active',
  email text,
  language_code text default 'vi'
);
create table public.advisor_profiles (
  profile_id uuid primary key references public.profiles(id),
  status text not null default 'active',
  verification_status text not null default 'verified'
);
create table public.businesses (
  id uuid primary key,
  public_code text,
  company_name text,
  title_vi text,
  title_en text,
  owner_id uuid,
  status text not null default 'draft',
  visible boolean not null default false
);
create table public.business_listing_authority (
  id uuid primary key,
  business_id uuid not null references public.businesses(id),
  verification_status text not null,
  expires_at timestamptz
);
create table public.advisor_assignments (
  id uuid primary key,
  authority_id uuid not null references public.business_listing_authority(id),
  business_id uuid not null references public.businesses(id),
  profile_id uuid not null references public.profiles(id),
  status text not null,
  permissions text[] not null default array['profile']::text[],
  metadata jsonb not null default '{}'::jsonb
);
create table public.advisor_authority_rereviews (
  id uuid primary key,
  assignment_id uuid not null references public.advisor_assignments(id),
  authority_id uuid not null references public.business_listing_authority(id),
  business_id uuid not null references public.businesses(id),
  cycle_no integer not null,
  status text not null
);

create or replace function public.d68_get_my_authority_review_v3(p_assignment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_expiry timestamptz;
  v_authority_status text;
  v_rereview uuid;
  v_code text;
  v_severity text;
  v_key text;
begin
  select bla.expires_at, bla.verification_status,
         (select r.id from public.advisor_authority_rereviews r where r.assignment_id=aa.id and r.status='pending' order by r.cycle_no desc limit 1)
    into v_expiry, v_authority_status, v_rereview
  from public.advisor_assignments aa
  join public.business_listing_authority bla on bla.id=aa.authority_id
  where aa.id=p_assignment_id and aa.profile_id=v_actor;
  if not found then raise exception 'Session 4 Advisor intake assignment not found' using errcode='42501'; end if;
  if v_rereview is not null then v_code='rereview_pending'; v_severity='critical';
  elsif v_authority_status='verified' and v_expiry<=now() then v_code='expired'; v_severity='critical';
  elsif v_authority_status='verified' and v_expiry<=now()+interval '7 days' then v_code='expiry_7d'; v_severity='high';
  elsif v_authority_status='verified' and v_expiry<=now()+interval '14 days' then v_code='expiry_14d'; v_severity='medium';
  elsif v_authority_status='verified' and v_expiry<=now()+interval '30 days' then v_code='expiry_30d'; v_severity='notice';
  end if;
  if v_code is not null then
    v_key := v_code || ':' || coalesce(v_rereview::text,to_char(v_expiry at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  end if;
  return jsonb_build_object(
    'assignment_id',p_assignment_id,'business_id','${businessId}'::uuid,'authority_id','${authorityId}'::uuid,
    'assignment_status','active','authority_status',v_authority_status,'authority_expires_at',v_expiry,
    'authority_lifecycle_status',case when v_rereview is not null then 'rereview_pending' else 'expiring_soon' end,
    'can_upload',v_rereview is not null,'evidence','[]'::jsonb,'review_history','[]'::jsonb,
    'current_rereview',case when v_rereview is null then null else jsonb_build_object('rereview_id',v_rereview,'status','pending','cycle_no',1,'started_at',now(),'reason','Fixture re-review') end,
    'expiry_alert',case when v_code is null then null else jsonb_build_object('key',v_key,'code',v_code,'severity',v_severity,'acknowledged',false) end,
    'access',jsonb_build_object('business_mutations_enabled',false,'external_notification_delivery_enabled',false)
  );
end;$$;

grant execute on function public.d68_get_my_authority_review_v3(uuid) to authenticated, service_role;

create or replace function public.d68_admin_list_advisor_business_intakes_v4()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_actor uuid := (select auth.uid()); begin
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.role='admin' and p.status='active') then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  return jsonb_build_object(
    'items',jsonb_build_array(jsonb_build_object(
      'assignment_id','${assignmentId}','business_id','${businessId}','authority_id','${authorityId}',
      'advisor_profile_id','${advisorId}','submitted_at',now(),'review_status','accepted','can_review',false,
      'business',jsonb_build_object('status','draft','visible',false,'owner_id',null),
      'advisor',jsonb_build_object('profile_id','${advisorId}','email','advisor@example.com'),
      'authority',jsonb_build_object('verification_status','verified','expires_at',(select expires_at from public.business_listing_authority where id='${authorityId}')),
      'assignment',jsonb_build_object('status','active','permissions',jsonb_build_array('profile')),
      'attention',jsonb_build_object('code','expiry_7d','needs_attention',true,'severity','high','rank',2)
    )),
    'attention_summary',jsonb_build_object('total',1,'critical',0,'high',1,'medium',0,'notice',0),
    'access',jsonb_build_object('allowed_permissions',jsonb_build_array('profile'),'business_mutations_enabled',false,'publication_enabled',false)
  );
end;$$;
grant execute on function public.d68_admin_list_advisor_business_intakes_v4() to authenticated, service_role;
`;

async function setActor(id) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${id || ''}', false)`);
}
async function asRole(role, fn) {
  await db.exec(`set role ${role}`);
  try { return await fn(); } finally { await db.exec('reset role'); }
}
async function result(sql, params = []) {
  const r = await db.query(sql, params);
  return r.rows[0]?.result;
}

await db.exec(foundation);
await db.query(`insert into public.profiles(id,role,status,email,language_code) values ($1,'advisor','active','advisor@example.com','vi'),($2,'admin','active','admin@example.com','vi'),($3,'advisor','active','outsider@example.com','en')`, [advisorId,adminId,outsiderId]);
await db.query(`insert into public.advisor_profiles(profile_id,status,verification_status) values ($1,'active','verified'),($2,'active','verified')`, [advisorId,outsiderId]);
await db.query(`insert into public.businesses(id,public_code,company_name,status,visible) values ($1,'D68-S9','Session 9 Fixture','draft',false)`, [businessId]);
await db.query(`insert into public.business_listing_authority(id,business_id,verification_status,expires_at) values ($1,$2,'verified',now()+interval '6 days')`, [authorityId,businessId]);
await db.query(`insert into public.advisor_assignments(id,authority_id,business_id,profile_id,status,permissions,metadata) values ($1,$2,$3,$4,'active',array['profile']::text[],jsonb_build_object('source','advisor_session4_business_intake'))`, [assignmentId,authorityId,businessId,advisorId]);

const core = fs.readFileSync('supabase/migrations/20260810174500_advisor_authority_email_notifications_phase9_v1.sql','utf8');
await db.exec(core);

// Default preferences and Advisor v4 read.
await setActor(advisorId);
const first = await asRole('authenticated', () => result(`select public.d68_get_my_authority_review_v4($1::uuid) as result`, [assignmentId]));
assert.equal(first.expiry_alert.code,'expiry_7d');
assert.equal(first.notification_preferences.email_enabled,true);
assert.equal(first.notification_preferences.email_expiry_7d,true);
assert.equal(first.current_notification_delivery,null);
assert.equal(first.access.email_notification_delivery_enabled,true);
assert.equal(first.access.sms_notification_delivery_enabled,false);
assert.equal(first.access.push_notification_delivery_enabled,false);
assert.equal(first.access.business_mutations_enabled,false);

// Enqueue one current lifecycle job, then replay to prove dedupe.
const enqueue1 = await result(`select d68_private.enqueue_advisor_authority_notifications_v1() as result`);
assert.equal(enqueue1.queued,1);
const enqueue2 = await result(`select d68_private.enqueue_advisor_authority_notifications_v1() as result`);
assert.equal(enqueue2.queued,0);
let rows = await db.query(`select alert_code,status,attempt_count from public.advisor_authority_notification_outbox where assignment_id=$1`,[assignmentId]);
assert.equal(rows.rows.length,1);
assert.equal(rows.rows[0].alert_code,'expiry_7d');
assert.equal(rows.rows[0].status,'pending');

const withDelivery = await asRole('authenticated', () => result(`select public.d68_get_my_authority_review_v4($1::uuid) as result`,[assignmentId]));
assert.equal(withDelivery.current_notification_delivery.status,'pending');

// Authenticated users cannot claim/complete worker jobs.
const workerAcl = await db.query(`select
  has_function_privilege('anon','public.d68_notification_worker_claim_v1(integer)','EXECUTE') as anon_claim,
  has_function_privilege('authenticated','public.d68_notification_worker_claim_v1(integer)','EXECUTE') as auth_claim,
  has_function_privilege('service_role','public.d68_notification_worker_claim_v1(integer)','EXECUTE') as service_claim,
  has_function_privilege('authenticated','public.d68_notification_worker_complete_v1(uuid,boolean,text,text,text)','EXECUTE') as auth_complete,
  has_function_privilege('service_role','public.d68_notification_worker_complete_v1(uuid,boolean,text,text,text)','EXECUTE') as service_complete`);
assert.equal(workerAcl.rows[0].anon_claim,false);
assert.equal(workerAcl.rows[0].auth_claim,false);
assert.equal(workerAcl.rows[0].service_claim,true);
assert.equal(workerAcl.rows[0].auth_complete,false);
assert.equal(workerAcl.rows[0].service_complete,true);

const claimed = await asRole('service_role', () => result(`select public.d68_notification_worker_claim_v1(10) as result`));
assert.equal(claimed.jobs.length,1);
assert.equal(claimed.jobs[0].alert_code,'expiry_7d');
assert.equal(claimed.jobs[0].recipient_email,'advisor@example.com');
assert.equal(claimed.jobs[0].attempt_count,1);
const jobId = claimed.jobs[0].job_id;

const completed = await asRole('service_role', () => result(`select public.d68_notification_worker_complete_v1($1::uuid,true,'fixture','msg-1',null) as result`,[jobId]));
assert.equal(completed.status,'sent');
rows = await db.query(`select status,attempt_count,provider,provider_message_id from public.advisor_authority_notification_outbox where id=$1`,[jobId]);
assert.equal(rows.rows[0].status,'sent');
assert.equal(rows.rows[0].attempt_count,1);
assert.equal(rows.rows[0].provider,'fixture');
assert.equal(rows.rows[0].provider_message_id,'msg-1');
assert.equal((await result(`select d68_private.enqueue_advisor_authority_notifications_v1() as result`)).queued,0,'sent lifecycle must remain deduped');

// Preference off prevents the next lifecycle band from being queued.
const disabled = await asRole('authenticated', () => result(`select public.d68_advisor_update_authority_notification_preferences_v1(true,true,false,true,true,true) as result`));
assert.equal(disabled.email_expiry_14d,false);
await db.query(`update public.business_listing_authority set expires_at=now()+interval '10 days' where id=$1`,[authorityId]);
const noQueue = await result(`select d68_private.enqueue_advisor_authority_notifications_v1() as result`);
assert.equal(noQueue.queued,0,'disabled 14-day band must not enqueue');
const jobCountAfterPref = await db.query(`select count(*)::int as count from public.advisor_authority_notification_outbox where assignment_id=$1`,[assignmentId]);
assert.equal(jobCountAfterPref.rows[0].count,1);

// Turning the band back on creates exactly one new lifecycle job.
await asRole('authenticated', () => result(`select public.d68_advisor_update_authority_notification_preferences_v1(true,true,true,true,true,true) as result`));
const queue14 = await result(`select d68_private.enqueue_advisor_authority_notifications_v1() as result`);
assert.equal(queue14.queued,1);
assert.equal((await result(`select d68_private.enqueue_advisor_authority_notifications_v1() as result`)).queued,0);

// Failure retry policy: attempt 1 -> failed + future retry; after 3rd attempt -> exhausted.
let retryClaim = await asRole('service_role', () => result(`select public.d68_notification_worker_claim_v1(10) as result`));
assert.equal(retryClaim.jobs.length,1);
let retryJob = retryClaim.jobs[0];
let failure = await asRole('service_role', () => result(`select public.d68_notification_worker_complete_v1($1::uuid,false,null,null,'fixture failure') as result`,[retryJob.job_id]));
assert.equal(failure.status,'failed');
for (let expectedAttempt=2; expectedAttempt<=3; expectedAttempt++) {
  await db.query(`update public.advisor_authority_notification_outbox set next_attempt_at=now()-interval '1 minute' where id=$1`,[retryJob.job_id]);
  retryClaim = await asRole('service_role', () => result(`select public.d68_notification_worker_claim_v1(10) as result`));
  assert.equal(retryClaim.jobs.length,1);
  retryJob = retryClaim.jobs[0];
  assert.equal(retryJob.attempt_count,expectedAttempt);
  failure = await asRole('service_role', () => result(`select public.d68_notification_worker_complete_v1($1::uuid,false,null,null,'fixture failure') as result`,[retryJob.job_id]));
}
assert.equal(failure.status,'exhausted');

// Direct table access remains closed.
const tableAcl = await db.query(`select
  has_table_privilege('authenticated','public.advisor_authority_notification_preferences','SELECT') as pref_select,
  has_table_privilege('authenticated','public.advisor_authority_notification_preferences','INSERT') as pref_insert,
  has_table_privilege('authenticated','public.advisor_authority_notification_outbox','SELECT') as outbox_select,
  has_table_privilege('authenticated','public.advisor_authority_notification_outbox','INSERT') as outbox_insert,
  has_function_privilege('anon','public.d68_get_my_authority_review_v4(uuid)','EXECUTE') as anon_read,
  has_function_privilege('authenticated','public.d68_get_my_authority_review_v4(uuid)','EXECUTE') as auth_read`);
assert.equal(tableAcl.rows[0].pref_select,false);
assert.equal(tableAcl.rows[0].pref_insert,false);
assert.equal(tableAcl.rows[0].outbox_select,false);
assert.equal(tableAcl.rows[0].outbox_insert,false);
assert.equal(tableAcl.rows[0].anon_read,false);
assert.equal(tableAcl.rows[0].auth_read,true);

// Another Advisor cannot read or change the assignment notification surface.
await setActor(outsiderId);
let outsiderRejected=false;
try { await asRole('authenticated', () => result(`select public.d68_get_my_authority_review_v4($1::uuid) as result`,[assignmentId])); }
catch (error) { outsiderRejected=/assignment not found|42501/i.test(String(error?.message||error)); }
assert.equal(outsiderRejected,true);

// Admin wrapper monitors delivery without changing the Session 8 queue boundary.
await setActor(adminId);
const adminQueue = await asRole('authenticated', () => result(`select public.d68_admin_list_advisor_business_intakes_v5() as result`));
assert.equal(adminQueue.items.length,1);
assert.equal(adminQueue.items[0].notification.email_enabled,true);
assert.ok(adminQueue.items[0].notification.latest_delivery);
assert.equal(adminQueue.access.email_notification_delivery_enabled,true);
assert.equal(adminQueue.access.business_mutations_enabled,false);
assert.equal(adminQueue.access.publication_enabled,false);

console.log('✓ Advisor Session 9 PostgreSQL controlled authority email notifications: PASS');
console.log('✓ Exact lifecycle dedupe, preference suppression/re-enable, service-only worker ACL and 3-attempt retry lifecycle verified.');
console.log('✓ Direct notification table access and outsider Advisor access remain denied.');
console.log('✓ Admin delivery monitoring preserves Business/publication mutation=false.');
