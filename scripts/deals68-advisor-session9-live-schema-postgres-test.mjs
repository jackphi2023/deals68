#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const advisorId = '00000000-0000-0000-0000-000000009901';
const businessId = '00000000-0000-0000-0000-000000009921';
const authorityId = '00000000-0000-0000-0000-000000009922';
const assignmentId = '00000000-0000-0000-0000-000000009923';

await db.exec(`
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create schema d68_private;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
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
  owner_id uuid,
  public_code text,
  company_name_private text,
  title_vi text,
  title_en text,
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
returns jsonb language sql stable security definer set search_path='' as $$ select jsonb_build_object('items','[]'::jsonb,'expiry_alert',null,'access','{}'::jsonb) $$;
create or replace function public.d68_admin_list_advisor_business_intakes_v4()
returns jsonb language sql stable security definer set search_path='' as $$ select jsonb_build_object('items','[]'::jsonb,'attention_summary','{}'::jsonb,'access','{}'::jsonb) $$;
grant execute on function public.d68_get_my_authority_review_v3(uuid) to authenticated, service_role;
grant execute on function public.d68_admin_list_advisor_business_intakes_v4() to authenticated, service_role;
`);

await db.query(`insert into public.profiles(id,role,status,email,language_code) values ($1,'advisor','active','advisor@example.com','vi')`, [advisorId]);
await db.query(`insert into public.advisor_profiles(profile_id,status,verification_status) values ($1,'active','verified')`, [advisorId]);
await db.query(`insert into public.businesses(id,public_code,company_name_private,title_vi,status,visible) values ($1,'D68-LIVE','Tên nội bộ','Tiêu đề Business','draft',false)`, [businessId]);
await db.query(`insert into public.business_listing_authority(id,business_id,verification_status,expires_at) values ($1,$2,'verified',now()+interval '6 days')`, [authorityId,businessId]);
await db.query(`insert into public.advisor_assignments(id,authority_id,business_id,profile_id,status,permissions,metadata) values ($1,$2,$3,$4,'active',array['profile']::text[],jsonb_build_object('source','advisor_session4_business_intake'))`, [assignmentId,authorityId,businessId,advisorId]);

const core = fs.readFileSync('supabase/migrations/20260810174500_advisor_authority_email_notifications_phase9_v1.sql','utf8');
const fix = fs.readFileSync('supabase/migrations/20260810174700_advisor_authority_email_live_schema_fix_phase9_v1.sql','utf8');
await db.exec(core);
await db.exec(fix);

const queued = await db.query(`select d68_private.enqueue_advisor_authority_notifications_v1() as result`);
assert.equal(queued.rows[0].result.queued, 1, 'Production-schema enqueue should create one 7-day email job');
const jobs = await db.query(`select alert_code, status, payload->>'business_name' as business_name from public.advisor_authority_notification_outbox where assignment_id=$1`, [assignmentId]);
assert.equal(jobs.rows.length, 1);
assert.equal(jobs.rows[0].alert_code, 'expiry_7d');
assert.equal(jobs.rows[0].status, 'pending');
assert.equal(jobs.rows[0].business_name, 'Tiêu đề Business', 'Bilingual Business title should be preferred over private company name');

const replay = await db.query(`select d68_private.enqueue_advisor_authority_notifications_v1() as result`);
assert.equal(replay.rows[0].result.queued, 0, 'Production-schema replay must remain deduped');

const business = await db.query(`select owner_id,status,visible from public.businesses where id=$1`, [businessId]);
assert.equal(business.rows[0].owner_id, null);
assert.equal(business.rows[0].status, 'draft');
assert.equal(business.rows[0].visible, false);

console.log('✓ Advisor Session 9 production Business schema PostgreSQL smoke: PASS');
console.log('✓ company_name_private/title_vi/title_en compatibility verified with exact-alert dedupe and no Business mutation.');
