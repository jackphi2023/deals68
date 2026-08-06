#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const advisorId = '00000000-0000-0000-0000-000000000301';
const adminId = '00000000-0000-0000-0000-000000000302';
const ownerId = '00000000-0000-0000-0000-000000000303';
const outsiderId = '00000000-0000-0000-0000-000000000304';
const businessId = '00000000-0000-0000-0000-000000000305';
const filesOnlyBusinessId = '00000000-0000-0000-0000-000000000306';
const authorityId = '00000000-0000-0000-0000-000000000307';
const filesOnlyAuthorityId = '00000000-0000-0000-0000-000000000308';

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
    username text,
    public_code text,
    slug text not null,
    company_name_private text,
    title_vi text not null,
    title_en text not null,
    description_vi text,
    description_en text,
    country_iso2 text,
    city text,
    industry text,
    deal_type text,
    plan text default 'standard',
    revenue_2025 numeric,
    revenue_currency text,
    ebitda_margin numeric,
    ask_amount numeric,
    ask_currency text,
    financial_input jsonb,
    visible boolean default false,
    status public.account_status default 'active',
    image_url text,
    hero_image_url text,
    industry_key text,
    city_key text,
    moderation_status text not null default 'pending_admin_review',
    updated_at timestamptz default now()
  );

  create table public.payment_orders (id uuid primary key default gen_random_uuid(), profile_id uuid, created_at timestamptz default now());

  create table public.business_listing_authority (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null unique references public.businesses(id) on delete cascade,
    listing_party_type public.d68_listing_party_type not null default 'business_owner',
    declared_owner_name text,
    declared_principal_name text,
    declared_agent_name text,
    declared_asset_name text,
    declared_asset_address text,
    verification_status public.d68_authority_verification_status not null default 'declared',
    verification_reasons jsonb not null default '[]'::jsonb,
    authority_document_ids uuid[] not null default '{}'::uuid[],
    verified_by uuid,
    verified_at timestamptz,
    expires_at timestamptz,
    report_policy public.d68_report_access_policy,
    report_notice_vi text,
    report_notice_en text,
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
    id uuid primary key default gen_random_uuid(), actor_id uuid, action text not null,
    entity_type text, entity_id text, detail jsonb default '{}'::jsonb, created_at timestamptz default now()
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

  create policy business_owner_select on public.businesses for select to authenticated using (owner_id = (select auth.uid()));
  create policy business_owner_update on public.businesses for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
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

async function asRole(role, fn) {
  await db.exec(`set role ${role};`);
  try { return await fn(); } finally { await db.exec('reset role;'); }
}

try {
  await db.exec(foundation);
  await db.exec(fs.readFileSync('supabase/migrations/20260806093000_advisor_assignment_security_phase1_v1.sql', 'utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20260806102000_advisor_auth_phase2_v1.sql', 'utf8'));
  const policyBefore = await db.query(`select count(*)::int as count from pg_policies where tablename='businesses'`);
  await db.exec(fs.readFileSync('supabase/migrations/20260806111000_advisor_readonly_portfolio_phase3_v1.sql', 'utf8'));

  await db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
    ($1::uuid,'advisor@example.com',now(),'{}'),($2::uuid,'admin@example.com',now(),'{}'),
    ($3::uuid,'owner@example.com',now(),'{}'),($4::uuid,'outsider@example.com',now(),'{}')`,
    [advisorId, adminId, ownerId, outsiderId]);
  await db.query(`insert into public.profiles(id,role,username,display_name,email,status,dashboard_login_enabled) values
    ($1::uuid,'advisor','advisor.test','Advisor Test','advisor@example.com','active',true),
    ($2::uuid,'admin','admin.test','Admin Test','admin@example.com','active',true),
    ($3::uuid,'business','owner.test','Owner Test','owner@example.com','active',true),
    ($4::uuid,'business','outsider.test','Outsider Test','outsider@example.com','active',true)`,
    [advisorId, adminId, ownerId, outsiderId]);
  await db.query(`insert into public.advisor_profiles(profile_id,created_by,status,title,advisor_type,verification_status,verified_by,verified_at)
    values ($1::uuid,$2::uuid,'active','M&A Advisor','advisor_broker','verified',$2::uuid,now())`, [advisorId, adminId]);
  await db.query(`insert into public.businesses(id,owner_id,public_code,slug,company_name_private,title_vi,title_en,country_iso2,city,industry,industry_key,city_key,deal_type,status,moderation_status,visible,revenue_2025,ebitda_margin,ask_amount,financial_input)
    values
    ($1::uuid,$3::uuid,'D68-301','private-client','Private Client Holdings','Thương vụ tăng trưởng','Growth transaction','VN','Hồ Chí Minh','Technology','technology','ho-chi-minh','fundraising','active','approved',true,987654321,42,123456789,'{"secret":"never-return"}'),
    ($2::uuid,$3::uuid,'D68-302','files-only-client','Files Only Holdings','Hồ sơ tài liệu','Files assignment','VN','Hà Nội','Logistics','logistics','ha-noi','sale','active','approved',true,111111111,33,222222222,'{"secret":"files-only"}')`,
    [businessId, filesOnlyBusinessId, ownerId]);
  await db.query(`insert into public.business_listing_authority(id,business_id,listing_party_type,declared_asset_name,verification_status,verified_by,verified_at,expires_at)
    values ($1::uuid,$3::uuid,'authorized_advisor','Private Client Asset','verified',$5::uuid,now(),now()+interval '1 year'),
           ($2::uuid,$4::uuid,'authorized_broker','Files Only Asset','verified',$5::uuid,now(),now()+interval '1 year')`,
    [authorityId, filesOnlyAuthorityId, businessId, filesOnlyBusinessId, adminId]);

  await setActor(outsiderId);
  let outsiderBlocked = false;
  try { await asRole('authenticated', () => db.query(`select public.d68_get_my_advisor_portfolio_v1()`)); }
  catch { outsiderBlocked = true; }
  assert.equal(outsiderBlocked, true, 'Non-Advisor accounts must not read Advisor portfolio');

  await setActor(adminId);
  const created = await asRole('authenticated', () => db.query(`select public.d68_admin_create_advisor_assignment(
    $1::uuid,$2::uuid,$3::uuid,array['profile']::text[],now()+interval '6 months','Lead advisor','{}'::jsonb) as row`,
    [advisorId, businessId, authorityId]));
  const assignmentId = created.rows[0].row.id;
  const filesOnlyCreated = await asRole('authenticated', () => db.query(`select public.d68_admin_create_advisor_assignment(
    $1::uuid,$2::uuid,$3::uuid,array['files']::text[],now()+interval '6 months','Files advisor','{}'::jsonb) as row`,
    [advisorId, filesOnlyBusinessId, filesOnlyAuthorityId]));
  const filesOnlyAssignmentId = filesOnlyCreated.rows[0].row.id;

  await setActor(advisorId);
  const directRows = await asRole('authenticated', () => db.query(`select count(*)::int as count from public.businesses`));
  assert.equal(directRows.rows[0].count, 0, 'Advisor must not SELECT Business rows directly');

  const pendingPortfolio = await asRole('authenticated', () => db.query(`select public.d68_get_my_advisor_portfolio_v1() as result`));
  assert.equal(pendingPortfolio.rows[0].result.items.length, 2);
  const pendingItem = pendingPortfolio.rows[0].result.items.find((item) => item.business_id === businessId);
  assert.equal(pendingItem.status, 'pending');
  assert.equal(pendingItem.can_accept, true);
  assert.equal(pendingItem.can_open_context, false);
  assert.equal(Object.hasOwn(pendingItem.business, 'company_name'), false, 'Pending assignment must not reveal private company name');

  let pendingContextBlocked = false;
  try { await asRole('authenticated', () => db.query(`select public.d68_get_my_advisor_business_context_v1($1::uuid)`, [businessId])); }
  catch { pendingContextBlocked = true; }
  assert.equal(pendingContextBlocked, true, 'Pending assignment must not open Business context');

  await asRole('authenticated', () => db.query(`select public.d68_accept_advisor_assignment($1::uuid)`, [assignmentId]));
  await asRole('authenticated', () => db.query(`select public.d68_accept_advisor_assignment($1::uuid)`, [filesOnlyAssignmentId]));

  const activePortfolio = await asRole('authenticated', () => db.query(`select public.d68_get_my_advisor_portfolio_v1() as result`));
  const activeItem = activePortfolio.rows[0].result.items.find((item) => item.business_id === businessId);
  const filesOnlyItem = activePortfolio.rows[0].result.items.find((item) => item.business_id === filesOnlyBusinessId);
  assert.equal(activeItem.status, 'active');
  assert.equal(activeItem.can_open_context, true);
  assert.equal(activeItem.business.company_name, 'Private Client Holdings');
  assert.equal(filesOnlyItem.status, 'active');
  assert.equal(filesOnlyItem.can_open_context, false, 'Non-profile scope must not open Business context');

  const contextResult = await asRole('authenticated', () => db.query(`select public.d68_get_my_advisor_business_context_v1($1::uuid) as result`, [businessId]));
  const context = contextResult.rows[0].result;
  assert.equal(context.access.mode, 'read_only');
  assert.equal(context.access.mutations_enabled, false);
  assert.equal(context.business.company_name, 'Private Client Holdings');
  const serialized = JSON.stringify(context);
  for (const forbidden of ['revenue_2025','ebitda_margin','ask_amount','financial_input','987654321','123456789','never-return']) {
    assert.equal(serialized.includes(forbidden), false, `Context must redact ${forbidden}`);
  }

  let filesOnlyContextBlocked = false;
  try { await asRole('authenticated', () => db.query(`select public.d68_get_my_advisor_business_context_v1($1::uuid)`, [filesOnlyBusinessId])); }
  catch { filesOnlyContextBlocked = true; }
  assert.equal(filesOnlyContextBlocked, true, 'Files-only assignment must not open profile context');

  let updateBlocked = false;
  try {
    const attemptedUpdate = await asRole('authenticated', () => db.query(
      `update public.businesses set title_vi='Hacked' where id=$1::uuid returning id`,
      [businessId],
    ));
    updateBlocked = attemptedUpdate.rows.length === 0;
  } catch {
    updateBlocked = true;
  }
  assert.equal(updateBlocked, true, 'Advisor must not update Business records');

  const grants = await db.query(`select
    has_function_privilege('anon','public.d68_get_my_advisor_portfolio_v1()','execute') as anon_portfolio,
    has_function_privilege('authenticated','public.d68_get_my_advisor_portfolio_v1()','execute') as auth_portfolio,
    has_function_privilege('anon','public.d68_get_my_advisor_business_context_v1(uuid)','execute') as anon_context,
    has_function_privilege('authenticated','public.d68_get_my_advisor_business_context_v1(uuid)','execute') as auth_context`);
  assert.deepEqual(grants.rows[0], { anon_portfolio: false, auth_portfolio: true, anon_context: false, auth_context: true });

  const policyAfter = await db.query(`select count(*)::int as count from pg_policies where tablename='businesses'`);
  assert.equal(policyAfter.rows[0].count, policyBefore.rows[0].count, 'Session 3 must not modify Business RLS policies');

  console.log('✓ Advisor Session 3 PostgreSQL lifecycle: PASS');
  console.log('✓ Pending assignments are visible but cannot open Business context.');
  console.log('✓ Active profile-scoped assignments expose only redacted read-only context.');
  console.log('✓ Direct Business reads/writes, financial data and non-profile scopes remain blocked.');
  console.log('✓ Existing Business RLS remains unchanged.');
} finally {
  await db.close();
}
