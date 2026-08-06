#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const advisorId = '00000000-0000-0000-0000-000000000101';
const otherId = '00000000-0000-0000-0000-000000000102';
const nonce = 'session2-advisor-signup-nonce-00000001';

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

  create table auth.users (
    id uuid primary key,
    email text,
    created_at timestamptz not null default now(),
    email_confirmed_at timestamptz,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );

  create table public.profiles (
    id uuid primary key,
    role public.user_role not null,
    username text unique,
    display_name text,
    email text,
    country_iso2 text default 'VN',
    language_code text default 'vi',
    timezone text default 'Asia/Ho_Chi_Minh',
    phone_country_iso2 text default 'VN',
    phone text,
    status public.account_status default 'draft',
    dashboard_login_enabled boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );

  create table public.businesses (
    id uuid primary key default gen_random_uuid(),
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

  create table public.payment_orders (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid,
    created_at timestamptz default now()
  );

  create table public.business_listing_authority (
    id uuid primary key default gen_random_uuid(),
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

  alter table public.businesses enable row level security;
  alter table public.advisor_profiles enable row level security;
  alter table public.advisor_assignments enable row level security;
  alter table public.business_listing_authority enable row level security;

  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create function public.is_admin() returns boolean language sql stable security definer set search_path='public' as $$
    select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.status='active')
  $$;

  create policy business_owner_select on public.businesses for select to authenticated
    using (owner_id = (select auth.uid()));
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
  await db.exec(`select set_config('request.jwt.claim.sub', '${id || ''}', false);`);
}

try {
  await db.exec(foundation);
  await db.exec(fs.readFileSync('supabase/migrations/20260806093000_advisor_assignment_security_phase1_v1.sql', 'utf8'));
  const policyBefore = await db.query(`select count(*)::int as count from pg_policies where tablename='businesses'`);
  await db.exec(fs.readFileSync('supabase/migrations/20260806102000_advisor_auth_phase2_v1.sql', 'utf8'));

  await db.query(`insert into auth.users(id,email,created_at,raw_user_meta_data) values
    ($1,'advisor@example.com',now(),jsonb_build_object('role','advisor','signup_nonce',$2)),
    ($3,'other@example.com',now(),jsonb_build_object('role','business','signup_nonce',$2))`, [advisorId, nonce, otherId]);

  await setActor('');
  await db.exec('set role anon;');
  const created = await db.query(`
    select public.d68_create_advisor_signup_v1(
      $1,$2,$3,
      jsonb_build_object(
        'username','advisor.test','display_name','Advisor Test','country_iso2','VN',
        'language_code','vi','timezone','Asia/Ho_Chi_Minh',
        'phone_country_iso2','VN','phone','+84 900000000'
      ),
      jsonb_build_object(
        'advisor_type','advisor_broker','title','M&A Advisor',
        'company_name','Deals Advisory','website','https://example.com',
        'introduction','Experienced transaction advisor.',
        'expertise',jsonb_build_array('M&A','Fundraising')
      )
    ) as result
  `, [advisorId, 'advisor@example.com', nonce]);
  await db.exec('reset role;');
  assert.equal(created.rows[0].result.advisor_status, 'pending');
  assert.equal(created.rows[0].result.verification_status, 'pending');

  const profile = await db.query(`select role,status,dashboard_login_enabled from public.profiles where id=$1`, [advisorId]);
  assert.equal(profile.rows[0].role, 'advisor');
  assert.equal(profile.rows[0].status, 'pending_admin_review');
  assert.equal(profile.rows[0].dashboard_login_enabled, false);

  const advisor = await db.query(`select status,verification_status,advisor_type,visibility from public.advisor_profiles where profile_id=$1`, [advisorId]);
  assert.deepEqual(advisor.rows[0], {
    status: 'pending',
    verification_status: 'pending',
    advisor_type: 'advisor_broker',
    visibility: 'private',
  });

  const sideEffects = await db.query(`select
    (select count(*)::int from public.businesses) as businesses,
    (select count(*)::int from public.payment_orders) as payments,
    (select count(*)::int from public.business_listing_authority) as authorities,
    (select count(*)::int from public.advisor_assignments) as assignments`);
  assert.deepEqual(sideEffects.rows[0], { businesses: 0, payments: 0, authorities: 0, assignments: 0 });

  await setActor(advisorId);
  let directWriteBlocked = false;
  try {
    await db.exec(`set role authenticated; insert into public.advisor_profiles(profile_id,created_by,status) values ('${otherId}','${advisorId}','pending'); reset role;`);
  } catch {
    directWriteBlocked = true;
    await db.exec('reset role;');
  }
  assert.equal(directWriteBlocked, true, 'Authenticated clients must not directly insert Advisor profiles');

  let unverifiedBlocked = false;
  try {
    await db.exec('set role authenticated;');
    await db.query(`select public.d68_mark_advisor_email_verified_v1()`);
    await db.exec('reset role;');
  } catch {
    unverifiedBlocked = true;
    await db.exec('reset role;');
  }
  assert.equal(unverifiedBlocked, true, 'OTP completion must require confirmed email');

  await db.query(`update auth.users set email_confirmed_at=now() where id=$1`, [advisorId]);
  await db.exec('set role authenticated;');
  const verified = await db.query(`select public.d68_mark_advisor_email_verified_v1() as result`);
  await db.exec('reset role;');
  assert.equal(verified.rows[0].result.dashboard_login_enabled, true);
  assert.equal(verified.rows[0].result.advisor_status, 'pending');
  assert.equal(verified.rows[0].result.verification_status, 'pending');

  const afterOtp = await db.query(`select status,dashboard_login_enabled from public.profiles where id=$1`, [advisorId]);
  assert.equal(afterOtp.rows[0].status, 'pending_admin_review');
  assert.equal(afterOtp.rows[0].dashboard_login_enabled, true);

  let wrongRoleBlocked = false;
  try {
    await db.exec('set role anon;');
    await db.query(`select public.d68_create_advisor_signup_v1($1,'other@example.com',$2,'{}'::jsonb,'{}'::jsonb)`, [otherId, nonce]);
    await db.exec('reset role;');
  } catch {
    wrongRoleBlocked = true;
    await db.exec('reset role;');
  }
  assert.equal(wrongRoleBlocked, true, 'Non-Advisor signup metadata must be rejected');

  const grants = await db.query(`select
    has_function_privilege('anon','public.d68_create_advisor_signup_v1(uuid,text,text,jsonb,jsonb)','execute') as anon_create,
    has_function_privilege('anon','public.d68_mark_advisor_email_verified_v1()','execute') as anon_verify,
    has_function_privilege('authenticated','public.d68_mark_advisor_email_verified_v1()','execute') as auth_verify`);
  assert.deepEqual(grants.rows[0], { anon_create: true, anon_verify: false, auth_verify: true });

  const audit = await db.query(`select action from public.audit_logs where actor_id=$1 order by action`, [advisorId]);
  assert.deepEqual(audit.rows.map((row) => row.action), [
    'advisor.email.verified',
    'advisor.registration.submitted',
  ]);

  const policyAfter = await db.query(`select count(*)::int as count from pg_policies where tablename='businesses'`);
  assert.equal(policyAfter.rows[0].count, policyBefore.rows[0].count, 'Session 2 must not modify Business RLS policies');

  console.log('✓ Advisor Session 2 PostgreSQL lifecycle: PASS');
  console.log('✓ Fresh signup creates only pending Advisor identity/profile records.');
  console.log('✓ Email OTP unlocks only dashboard login; Admin verification stays pending.');
  console.log('✓ No Business, payment, authority or assignment side effect exists.');
  console.log('✓ Existing Business RLS remains unchanged.');
} finally {
  await db.close();
}
