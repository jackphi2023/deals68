#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const advisorId = '00000000-0000-0000-0000-000000000801';
const adminId = '00000000-0000-0000-0000-000000000802';
const outsiderId = '00000000-0000-0000-0000-000000000803';
const assignmentId = '00000000-0000-0000-0000-000000000811';

const foundation = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema auth to authenticated, service_role;
grant execute on function auth.uid() to authenticated, service_role;

create table public.profiles (
  id uuid primary key,
  role text not null,
  status text not null default 'active'
);

create table public.advisor_assignments (
  id uuid primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade
);

create table public.fixture_authority_state (
  assignment_id uuid primary key,
  profile_id uuid not null,
  authority_status text not null,
  expires_at timestamptz,
  rereview_id uuid,
  rereview_status text
);

create or replace function public.d68_get_my_authority_review_v2(p_assignment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_state public.fixture_authority_state;
begin
  select * into v_state
  from public.fixture_authority_state s
  where s.assignment_id = p_assignment_id and s.profile_id = v_actor;
  if not found then
    raise exception 'Session 4 Advisor intake assignment not found' using errcode='42501';
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'assignment_id', p_assignment_id,
    'business_id', '00000000-0000-0000-0000-000000000821'::uuid,
    'authority_id', '00000000-0000-0000-0000-000000000822'::uuid,
    'assignment_status', 'active',
    'authority_status', v_state.authority_status,
    'authority_expires_at', v_state.expires_at,
    'authority_lifecycle_status', case when v_state.rereview_status='pending' then 'rereview_pending' else 'expiring_soon' end,
    'can_upload', v_state.rereview_status='pending',
    'evidence', '[]'::jsonb,
    'review_history', '[]'::jsonb,
    'current_rereview', case when v_state.rereview_id is null then null else jsonb_build_object(
      'rereview_id', v_state.rereview_id,
      'cycle_no', 1,
      'status', v_state.rereview_status,
      'started_at', now(),
      'reason', 'Expiry re-review'
    ) end,
    'access', jsonb_build_object('business_mutations_enabled', false)
  ));
end;
$$;

create or replace function public.d68_admin_list_advisor_business_intakes_v3()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if not exists (select 1 from public.profiles p where p.id=v_actor and p.role='admin' and p.status='active') then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  return jsonb_build_object(
    'items', jsonb_build_array(
      jsonb_build_object(
        'assignment_id','00000000-0000-0000-0000-000000000831',
        'authority_id','00000000-0000-0000-0000-000000000841',
        'review_status','accepted',
        'can_start_rereview',false,
        'current_rereview',jsonb_build_object('status','pending','rereview_id','00000000-0000-0000-0000-000000000851'),
        'authority',jsonb_build_object('verification_status','pending_review'),
        'business',jsonb_build_object('status','draft','visible',false,'owner_id',null),
        'assignment',jsonb_build_object('permissions',jsonb_build_array('profile'))
      ),
      jsonb_build_object(
        'assignment_id','00000000-0000-0000-0000-000000000832',
        'authority_id','00000000-0000-0000-0000-000000000842',
        'review_status','accepted',
        'can_start_rereview',true,
        'current_rereview',null,
        'authority',jsonb_build_object('verification_status','verified','expires_at',now()-interval '1 day'),
        'business',jsonb_build_object('status','draft','visible',false,'owner_id',null),
        'assignment',jsonb_build_object('permissions',jsonb_build_array('profile'))
      ),
      jsonb_build_object(
        'assignment_id','00000000-0000-0000-0000-000000000833',
        'authority_id','00000000-0000-0000-0000-000000000843',
        'review_status','accepted',
        'can_start_rereview',true,
        'current_rereview',null,
        'authority',jsonb_build_object('verification_status','verified','expires_at',now()+interval '6 days'),
        'business',jsonb_build_object('status','draft','visible',false,'owner_id',null),
        'assignment',jsonb_build_object('permissions',jsonb_build_array('profile'))
      ),
      jsonb_build_object(
        'assignment_id','00000000-0000-0000-0000-000000000834',
        'authority_id','00000000-0000-0000-0000-000000000844',
        'review_status','accepted',
        'can_start_rereview',true,
        'current_rereview',null,
        'authority',jsonb_build_object('verification_status','verified','expires_at',now()+interval '40 days'),
        'business',jsonb_build_object('status','draft','visible',false,'owner_id',null),
        'assignment',jsonb_build_object('permissions',jsonb_build_array('profile'))
      )
    ),
    'access', jsonb_build_object(
      'allowed_permissions',jsonb_build_array('profile'),
      'business_mutations_enabled',false,
      'publication_enabled',false
    )
  );
end;
$$;

grant execute on function public.d68_get_my_authority_review_v2(uuid) to authenticated, service_role;
grant execute on function public.d68_admin_list_advisor_business_intakes_v3() to authenticated, service_role;
`;

async function setActor(id) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${id || ''}', false)`);
}

async function asRole(role, fn) {
  await db.exec(`set role ${role}`);
  try { return await fn(); } finally { await db.exec('reset role'); }
}

async function queryResult(sql, params = []) {
  const result = await db.query(sql, params);
  return result.rows[0]?.result;
}

await db.exec(foundation);
await db.query(
  `insert into public.profiles(id,role,status) values ($1,'advisor','active'),($2,'admin','active'),($3,'advisor','active')`,
  [advisorId, adminId, outsiderId],
);
await db.query(`insert into public.advisor_assignments(id,profile_id) values ($1,$2)`, [assignmentId, advisorId]);
await db.query(
  `insert into public.fixture_authority_state(assignment_id,profile_id,authority_status,expires_at) values ($1,$2,'verified',now()+interval '6 days')`,
  [assignmentId, advisorId],
);

const migration = fs.readFileSync('supabase/migrations/20260810170000_advisor_authority_expiry_alerts_phase8_v1.sql', 'utf8');
await db.exec(migration);

await setActor(advisorId);
const first = await asRole('authenticated', () => queryResult(
  `select public.d68_get_my_authority_review_v3($1::uuid) as result`,
  [assignmentId],
));
assert.equal(first.expiry_alert.code, 'expiry_7d');
assert.equal(first.expiry_alert.severity, 'high');
assert.equal(first.expiry_alert.acknowledged, false);
assert.equal(first.access.external_notification_delivery_enabled, false);
assert.equal(first.access.business_mutations_enabled, false);
const alertKey = first.expiry_alert.key;
assert.ok(alertKey.startsWith('expiry_7d:'), 'alert key must bind code and current expiry');

let staleRejected = false;
try {
  await asRole('authenticated', () => queryResult(
    `select public.d68_advisor_ack_authority_expiry_alert_v1($1::uuid,$2::text) as result`,
    [assignmentId, 'expiry_7d:stale'],
  ));
} catch (error) {
  staleRejected = /stale|does not belong/i.test(String(error?.message || error));
}
assert.equal(staleRejected, true, 'stale/arbitrary acknowledgement key must be rejected');

const ack = await asRole('authenticated', () => queryResult(
  `select public.d68_advisor_ack_authority_expiry_alert_v1($1::uuid,$2::text) as result`,
  [assignmentId, alertKey],
));
assert.equal(ack.acknowledged, true);
assert.equal(ack.business_mutations_enabled, false);
assert.equal(ack.external_notification_delivery_enabled, false);

const receiptCount = await db.query(`select count(*)::int as count from public.advisor_authority_alert_receipts where assignment_id=$1`, [assignmentId]);
assert.equal(receiptCount.rows[0].count, 1);

const second = await asRole('authenticated', () => queryResult(
  `select public.d68_get_my_authority_review_v3($1::uuid) as result`,
  [assignmentId],
));
assert.equal(second.expiry_alert.acknowledged, true);
assert.ok(second.expiry_alert.acknowledged_at);

await setActor(outsiderId);
let outsiderRejected = false;
try {
  await asRole('authenticated', () => queryResult(
    `select public.d68_get_my_authority_review_v3($1::uuid) as result`,
    [assignmentId],
  ));
} catch (error) {
  outsiderRejected = /assignment not found|42501/i.test(String(error?.message || error));
}
assert.equal(outsiderRejected, true, 'another Advisor must not read this authority alert');

await setActor(adminId);
const queue = await asRole('authenticated', () => queryResult(`select public.d68_admin_list_advisor_business_intakes_v4() as result`));
assert.equal(queue.items.length, 4);
assert.equal(queue.items[0].attention.code, 'rereview_pending');
assert.equal(queue.items[1].attention.code, 'expired');
assert.equal(queue.items[2].attention.code, 'expiry_7d');
assert.equal(queue.items[3].attention.code, 'none');
assert.equal(queue.items[1].attention.recommended_action, 'start_rereview');
assert.equal(queue.items[0].attention.recommended_action, 'review_rereview');
assert.deepEqual(queue.attention_summary, { total: 3, critical: 2, high: 1, medium: 0, notice: 0 });
assert.equal(queue.access.external_notification_delivery_enabled, false);
assert.equal(queue.access.business_mutations_enabled, false);
assert.equal(queue.access.publication_enabled, false);

const acl = await db.query(`
  select
    has_table_privilege('authenticated','public.advisor_authority_alert_receipts','SELECT') as auth_select,
    has_table_privilege('authenticated','public.advisor_authority_alert_receipts','INSERT') as auth_insert,
    has_function_privilege('anon','public.d68_get_my_authority_review_v3(uuid)','EXECUTE') as anon_read,
    has_function_privilege('anon','public.d68_advisor_ack_authority_expiry_alert_v1(uuid,text)','EXECUTE') as anon_ack,
    has_function_privilege('anon','public.d68_admin_list_advisor_business_intakes_v4()','EXECUTE') as anon_admin,
    has_function_privilege('authenticated','public.d68_get_my_authority_review_v3(uuid)','EXECUTE') as auth_read
`);
assert.equal(acl.rows[0].auth_select, false);
assert.equal(acl.rows[0].auth_insert, false);
assert.equal(acl.rows[0].anon_read, false);
assert.equal(acl.rows[0].anon_ack, false);
assert.equal(acl.rows[0].anon_admin, false);
assert.equal(acl.rows[0].auth_read, true);

console.log('✓ Advisor Session 8 PostgreSQL authority expiry alerts & Admin queue: PASS');
console.log('✓ 7-day alert is server-derived, acknowledgement rejects stale keys and persists one private receipt.');
console.log('✓ Outsider Advisor access is denied and anonymous RPC execution remains denied.');
console.log('✓ Admin queue sorts re-review > expired > 7-day and retains Business/publication mutation=false.');
