#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const adminId = '00000000-0000-0000-0000-000000000001';
const ownerId = '00000000-0000-0000-0000-000000000002';
const advisorId = '00000000-0000-0000-0000-000000000003';
const businessId = '00000000-0000-0000-0000-000000000010';
const authorityId = '00000000-0000-0000-0000-000000000020';
const advisorProfileId = '00000000-0000-0000-0000-000000000030';

const foundation = `
  create schema auth;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;

  create type public.user_role as enum ('business','investor','advisor','affiliate','admin','market_partner');
  create type public.account_status as enum ('draft','payment_pending','pending_admin_review','active','hidden','expired','rejected');
  create type public.d68_listing_party_type as enum ('business_owner','legal_representative','asset_owner','authorized_broker','authorized_advisor','asset_operator','other');
  create type public.d68_authority_verification_status as enum ('not_required','declared','missing','pending_review','verified','insufficient_scope','expired','rejected','entity_mismatch');
  create type public.d68_report_access_policy as enum ('owner_only','owner_and_authorized_party','admin_only');

  create table public.profiles (
    id uuid primary key,
    role public.user_role not null,
    status public.account_status default 'draft',
    dashboard_login_enabled boolean default false
  );

  create table public.businesses (
    id uuid primary key,
    owner_id uuid references public.profiles(id),
    public_code text,
    slug text not null,
    company_name_private text,
    title_vi text not null,
    title_en text not null,
    status public.account_status default 'active',
    moderation_status text not null default 'pending_admin_review',
    plan text default 'standard',
    plan_expires_at timestamptz,
    quota_total integer default 100,
    quota_used integer default 0,
    updated_at timestamptz default now()
  );

  create table public.business_listing_authority (
    id uuid primary key,
    business_id uuid not null unique references public.businesses(id) on delete cascade,
    listing_party_type public.d68_listing_party_type not null default 'business_owner',
    verification_status public.d68_authority_verification_status not null default 'declared',
    expires_at timestamptz,
    report_policy public.d68_report_access_policy,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table public.advisor_profiles (
    id uuid primary key default gen_random_uuid(),
    business_id uuid references public.businesses(id) on delete cascade,
    investor_id uuid,
    profile_id uuid references public.profiles(id) on delete set null,
    created_by uuid references public.profiles(id) on delete set null,
    status text default 'active',
    title text,
    payload jsonb default '{}'::jsonb,
    visibility text default 'private',
    sort_order int default 100,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );

  create table public.advisor_assignments (
    id uuid primary key default gen_random_uuid(),
    business_id uuid references public.businesses(id) on delete cascade,
    investor_id uuid,
    profile_id uuid references public.profiles(id) on delete set null,
    created_by uuid references public.profiles(id) on delete set null,
    status text default 'active',
    title text,
    payload jsonb default '{}'::jsonb,
    visibility text default 'private',
    sort_order int default 100,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );

  create table public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid,
    action text not null,
    entity_type text,
    entity_id text,
    detail jsonb default '{}'::jsonb,
    created_at timestamptz default now()
  );

  alter table public.advisor_profiles enable row level security;
  alter table public.advisor_assignments enable row level security;
  alter table public.business_listing_authority enable row level security;

  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create function public.is_admin() returns boolean language sql stable security definer set search_path='public' as $$
    select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.status='active')
  $$;

  create policy advisor_profiles_admin_all on public.advisor_profiles for all using (public.is_admin()) with check (public.is_admin());
  create policy advisor_profiles_own_select on public.advisor_profiles for select using (visibility='public' or created_by=auth.uid() or profile_id=auth.uid() or public.is_admin());
  create policy advisor_profiles_own_insert on public.advisor_profiles for insert with check (created_by=auth.uid() or profile_id=auth.uid() or public.is_admin());
  create policy advisor_profiles_own_update on public.advisor_profiles for update using (created_by=auth.uid() or profile_id=auth.uid() or public.is_admin()) with check (created_by=auth.uid() or profile_id=auth.uid() or public.is_admin());
  create policy advisor_assignments_admin_all on public.advisor_assignments for all using (public.is_admin()) with check (public.is_admin());
  create policy advisor_assignments_own_select on public.advisor_assignments for select using (visibility='public' or created_by=auth.uid() or profile_id=auth.uid() or public.is_admin());
  create policy advisor_assignments_own_insert on public.advisor_assignments for insert with check (created_by=auth.uid() or profile_id=auth.uid() or public.is_admin());
  create policy advisor_assignments_own_update on public.advisor_assignments for update using (created_by=auth.uid() or profile_id=auth.uid() or public.is_admin()) with check (created_by=auth.uid() or profile_id=auth.uid() or public.is_admin());
  create policy business_listing_authority_owner_select on public.business_listing_authority for select to authenticated using (exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));

  grant all on all tables in schema public to anon, authenticated, service_role;
  grant execute on all functions in schema public to anon, authenticated, service_role;
`;

async function setActor(id) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${id}', false);`);
}

try {
  await db.exec(foundation);
  await db.exec(fs.readFileSync('supabase/migrations/20260806093000_advisor_assignment_security_phase1_v1.sql', 'utf8'));

  await db.query(`insert into public.profiles(id,role,status,dashboard_login_enabled) values
    ($1,'admin','active',true),($2,'business','active',true),($3,'advisor','active',true)`, [adminId, ownerId, advisorId]);
  await db.query(`insert into public.businesses(id,owner_id,public_code,slug,title_vi,title_en,status) values ($1,$2,'D68-QA','qa-business','QA Business','QA Business','active')`, [businessId, ownerId]);
  await db.query(`insert into public.business_listing_authority(id,business_id,listing_party_type,verification_status) values ($1,$2,'authorized_advisor','verified')`, [authorityId, businessId]);
  await db.query(`insert into public.advisor_profiles(id,profile_id,created_by,status,advisor_type,verification_status,verified_by,verified_at) values ($1,$2,$3,'active','advisor','verified',$3,now())`, [advisorProfileId, advisorId, adminId]);

  await setActor(advisorId);
  let directInsertBlocked = false;
  try {
    await db.exec(`set role authenticated; insert into public.advisor_assignments(business_id,profile_id,authority_id,granted_at) values ('${businessId}','${advisorId}','${authorityId}',now()); reset role;`);
  } catch {
    directInsertBlocked = true;
    await db.exec('reset role;');
  }
  assert.equal(directInsertBlocked, true, 'Advisor direct INSERT must be blocked');

  await setActor(adminId);
  const created = await db.query(`select (public.d68_admin_create_advisor_assignment($1,$2,$3,array['profile','files'],now()+interval '30 days','QA assignment','{}'::jsonb)).id as id`, [advisorId,businessId,authorityId]);
  const assignmentId = created.rows[0].id;

  await setActor(advisorId);
  const accepted = await db.query(`select (public.d68_accept_advisor_assignment($1)).status as status`, [assignmentId]);
  assert.equal(accepted.rows[0].status, 'active');

  const allowedProfile = await db.query(`select d68_private.can_manage_business($1,'profile') as allowed`, [businessId]);
  const allowedPayments = await db.query(`select d68_private.can_manage_business($1,'payments') as allowed`, [businessId]);
  assert.equal(allowedProfile.rows[0].allowed, true);
  assert.equal(allowedPayments.rows[0].allowed, false);

  await setActor(adminId);
  await db.query(`select public.d68_admin_set_advisor_assignment_status($1,'revoked','QA revoke')`, [assignmentId]);
  await setActor(advisorId);
  const afterRevoke = await db.query(`select d68_private.can_manage_business($1,'profile') as allowed`, [businessId]);
  assert.equal(afterRevoke.rows[0].allowed, false);

  const audit = await db.query(`select action from public.audit_logs order by created_at, action`);
  assert.deepEqual(audit.rows.map((row) => row.action).sort(), [
    'advisor.assignment.accepted',
    'advisor.assignment.created',
    'advisor.assignment.status_changed',
  ]);

  const businessPolicies = await db.query(`select count(*)::int as count from pg_policies where tablename in ('businesses','business_files','business_images','payment_orders','proposals','request_data','business_financial_access_grants')`);
  assert.equal(businessPolicies.rows[0].count, 0, 'Session 1 fixture should not create or modify Business policies');

  console.log('✓ Advisor Session 1 PostgreSQL lifecycle: PASS');
  console.log('✓ Direct self-assignment is blocked.');
  console.log('✓ Pending → active → revoked is audited and scope-aware.');
  console.log('✓ Existing Business RLS is untouched.');
} finally {
  await db.close();
}
