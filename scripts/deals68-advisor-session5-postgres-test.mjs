#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const advisorId = '00000000-0000-0000-0000-000000000501';
const adminId = '00000000-0000-0000-0000-000000000502';
const outsiderId = '00000000-0000-0000-0000-000000000503';

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

create table public.investors (id uuid primary key default gen_random_uuid());

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id),
  username text unique,
  public_code text unique,
  slug text not null unique,
  company_name_private text,
  title_vi text not null,
  title_en text not null,
  description_vi text,
  description_en text,
  country_iso2 text default 'VN',
  city text,
  city_key text,
  industry text,
  industry_key text,
  deal_type text,
  plan text default 'standard',
  revenue_2025 numeric default 0,
  revenue_currency text default 'VND',
  ebitda_margin numeric default 0,
  ask_amount numeric default 0,
  ask_currency text default 'VND',
  stake_pct numeric default 0,
  financial_input jsonb default '{}'::jsonb,
  visible boolean default false,
  status public.account_status default 'active',
  quota_total integer default 100,
  quota_used integer default 0,
  pending_changes_json jsonb,
  public_snapshot_json jsonb,
  public_version integer not null default 0,
  pending_submitted_at timestamptz,
  pending_submitted_by uuid references public.profiles(id),
  moderation_status text not null default 'pending_admin_review',
  show_on_homepage boolean not null default false,
  revenue_public_visible boolean not null default false,
  image_url text,
  hero_image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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
  verified_by uuid references public.profiles(id) on delete set null,
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
  investor_id uuid references public.investors(id) on delete cascade,
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
  investor_id uuid references public.investors(id) on delete cascade,
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

create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid,
  business_id uuid,
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

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
`;

const payload = {
  company_name: 'Session Five Client',
  title_vi: 'Gọi vốn mở rộng doanh nghiệp',
  title_en: '',
  description_vi: 'Hồ sơ doanh nghiệp được Advisor gửi để Admin thẩm định quyền đại diện.',
  description_en: '',
  country_iso2: 'VN',
  city: 'Hồ Chí Minh',
  industry: 'Technology',
  deal_type: 'Fundraising',
};
const declaration = {
  declared_owner_name: 'Session Five Client',
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
async function createIntake(key, company = payload.company_name) {
  return asRole('authenticated', () => db.query(
    `select public.d68_create_advisor_business_intake_v1($1::text,$2::jsonb,$3::jsonb) as result`,
    [key, JSON.stringify({ ...payload, company_name: company, title_vi: `${payload.title_vi} ${company}` }), JSON.stringify({ ...declaration, declared_owner_name: company })],
  ));
}
async function listIntakes(role = 'authenticated') {
  return asRole(role, () => db.query(`select public.d68_admin_list_advisor_business_intakes_v1() as result`));
}
async function review(assignmentId, decision, expiry = null, permissions = ['profile'], note = null, role = 'authenticated') {
  return asRole(role, () => db.query(
    `select public.d68_admin_review_advisor_business_intake_v1($1::uuid,$2::text,$3::timestamptz,$4::text[],$5::text) as result`,
    [assignmentId, decision, expiry, permissions, note],
  ));
}

try {
  await db.exec(foundation);
  await db.exec(fs.readFileSync('supabase/migrations/20260806093000_advisor_assignment_security_phase1_v1.sql', 'utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20260806102000_advisor_auth_phase2_v1.sql', 'utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20260806111000_advisor_readonly_portfolio_phase3_v1.sql', 'utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20260806184000_advisor_business_intake_phase4_v1.sql', 'utf8'));
  const policyBefore = await db.query(`select count(*)::int count from pg_policies where tablename='businesses'`);
  await db.exec(fs.readFileSync('supabase/migrations/20260806203000_advisor_authority_review_phase5_v1.sql', 'utf8'));

  await db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
    ($1::uuid,'advisor@example.com',now(),'{}'),
    ($2::uuid,'admin@example.com',now(),'{}'),
    ($3::uuid,'outsider@example.com',now(),'{}')`,
    [advisorId, adminId, outsiderId]);
  await db.query(`insert into public.profiles(id,role,username,display_name,email,status,dashboard_login_enabled) values
    ($1::uuid,'advisor','advisor.s5','Advisor Session 5','advisor@example.com','active',true),
    ($2::uuid,'admin','admin.s5','Admin Session 5','admin@example.com','active',true),
    ($3::uuid,'business','outsider.s5','Outsider','outsider@example.com','active',true)`,
    [advisorId, adminId, outsiderId]);
  await db.query(`insert into public.advisor_profiles(profile_id,created_by,status,title,advisor_type,company_name,verification_status,verified_by,verified_at)
    values ($1::uuid,$2::uuid,'active','M&A Advisor','advisor_broker','Advisor Company','verified',$2::uuid,now())`,
    [advisorId, adminId]);

  await setActor(advisorId);
  const first = (await createIntake('session5-approve-intake-key-000001')).rows[0].result;
  assert.equal(first.authority_status, 'pending_review', 'Session 4 intake must work with the Session 5 trigger fix');
  assert.equal(first.assignment_status, 'pending');

  const pendingPortfolio = (await asRole('authenticated', () => db.query(`select public.d68_get_my_advisor_portfolio_v1() as result`))).rows[0].result;
  const pendingPortfolioItem = pendingPortfolio.items.find((item) => item.assignment_id === first.assignment_id);
  assert.equal(pendingPortfolioItem.can_accept, false, 'Pending authority must not be acceptable');
  assert.equal(pendingPortfolioItem.can_open_context, false);

  await setActor(outsiderId);
  await assert.rejects(() => listIntakes(), /Admin access required/);
  await assert.rejects(() => review(first.assignment_id, 'approve'), /Admin access required/);

  await setActor(adminId);
  const queue = (await listIntakes()).rows[0].result;
  assert.equal(queue.access.business_mutations_enabled, false);
  assert.equal(queue.access.publication_enabled, false);
  assert.deepEqual(queue.access.allowed_permissions, ['profile']);
  assert.equal(queue.items.length, 1);
  assert.equal(queue.items[0].review_status, 'pending_review');
  assert.equal(queue.items[0].can_review, true);
  assert.equal(Object.hasOwn(queue.items[0].business, 'revenue_2025'), false, 'Admin queue must use an explicit intake allowlist');
  assert.equal(Object.hasOwn(queue.items[0].business, 'financial_input'), false);

  await assert.rejects(
    () => review(first.assignment_id, 'approve', new Date(Date.now() + 90 * 86400000).toISOString(), ['files'], 'Invalid scope'),
    /profile scope/,
  );
  await assert.rejects(
    () => review(first.assignment_id, 'approve', new Date(Date.now() + 400 * 86400000).toISOString(), ['profile'], 'Too long'),
    /365 days/,
  );
  const unchanged = (await db.query(`select aa.status,bla.verification_status::text authority_status
    from public.advisor_assignments aa join public.business_listing_authority bla on bla.id=aa.authority_id
    where aa.id=$1::uuid`, [first.assignment_id])).rows[0];
  assert.deepEqual([unchanged.status, unchanged.authority_status], ['pending', 'pending_review']);

  const expiry = new Date(Date.now() + 180 * 86400000).toISOString();
  const approved = (await review(first.assignment_id, 'approve', expiry, ['profile'], 'Authority declaration reviewed')).rows[0].result;
  assert.equal(approved.authority_status, 'verified');
  assert.equal(approved.assignment_status, 'pending');
  assert.deepEqual(approved.permissions, ['profile']);
  assert.equal(approved.can_advisor_accept, true);
  assert.equal(approved.business_status, 'draft');
  assert.equal(approved.business_visible, false);

  const approvedRows = (await db.query(`select b.owner_id,b.visible,b.status::text business_status,
      aa.status assignment_status,aa.permissions,aa.accepted_at,aa.granted_by,aa.metadata,
      bla.verification_status::text authority_status,bla.verified_by,bla.verified_at,bla.expires_at
    from public.advisor_assignments aa
    join public.businesses b on b.id=aa.business_id
    join public.business_listing_authority bla on bla.id=aa.authority_id
    where aa.id=$1::uuid`, [first.assignment_id])).rows[0];
  assert.equal(approvedRows.owner_id, null);
  assert.equal(approvedRows.visible, false);
  assert.equal(approvedRows.business_status, 'draft');
  assert.equal(approvedRows.assignment_status, 'pending');
  assert.deepEqual(approvedRows.permissions, ['profile']);
  assert.equal(approvedRows.accepted_at, null);
  assert.equal(approvedRows.granted_by, adminId);
  assert.equal(approvedRows.metadata.admin_review_required, false);
  assert.equal(approvedRows.metadata.admin_review_status, 'approved');
  assert.equal(approvedRows.authority_status, 'verified');
  assert.equal(approvedRows.verified_by, adminId);
  assert.ok(approvedRows.verified_at);
  assert.ok(approvedRows.expires_at);

  await assert.rejects(() => review(first.assignment_id, 'approve', expiry, ['profile'], 'Replay'), /no longer pending/);

  const approvedQueue = (await listIntakes()).rows[0].result;
  assert.equal(approvedQueue.items[0].review_status, 'approved_awaiting_acceptance');
  assert.equal(approvedQueue.items[0].can_review, false);

  await setActor(advisorId);
  await asRole('authenticated', () => db.query(`select public.d68_accept_advisor_assignment($1::uuid)`, [first.assignment_id]));
  const active = (await db.query(`select status,accepted_at from public.advisor_assignments where id=$1::uuid`, [first.assignment_id])).rows[0];
  assert.equal(active.status, 'active');
  assert.ok(active.accepted_at);

  const second = (await createIntake('session5-reject-intake-key-000002', 'Rejected Client')).rows[0].result;
  await setActor(adminId);
  await assert.rejects(() => review(second.assignment_id, 'reject', null, ['profile'], 'No'), /at least 5/);
  const rejected = (await review(second.assignment_id, 'reject', null, ['profile'], 'Authority evidence is insufficient')).rows[0].result;
  assert.equal(rejected.authority_status, 'rejected');
  assert.equal(rejected.assignment_status, 'revoked');
  assert.equal(rejected.can_advisor_accept, false);
  assert.equal(rejected.business_status, 'draft');
  assert.equal(rejected.business_visible, false);

  await setActor(advisorId);
  await assert.rejects(
    () => asRole('authenticated', () => db.query(`select public.d68_accept_advisor_assignment($1::uuid)`, [second.assignment_id])),
    /pending assignment/,
  );
  const directUpdate = await asRole('authenticated', () => db.query(
    `update public.businesses set title_vi='Escalated' where id=$1::uuid`,
    [second.business_id],
  ));
  assert.equal(directUpdate.affectedRows, 0, 'Advisor still cannot update Business directly');

  const audits = (await db.query(`select action,detail from public.audit_logs
    where action in ('advisor.business_intake.authority_approved','advisor.business_intake.authority_rejected')
    order by created_at`)).rows;
  assert.equal(audits.length, 2);
  assert.equal(audits[0].action, 'advisor.business_intake.authority_approved');
  assert.equal(audits[1].action, 'advisor.business_intake.authority_rejected');
  assert.equal(audits[0].detail.business_status_unchanged, 'draft');
  assert.equal(audits[0].detail.business_visible_unchanged, false);

  await setActor('');
  await assert.rejects(() => listIntakes('anon'));
  const grants = (await db.query(`select
    has_function_privilege('anon','public.d68_admin_list_advisor_business_intakes_v1()','execute') anon_list,
    has_function_privilege('anon','public.d68_admin_review_advisor_business_intake_v1(uuid,text,timestamptz,text[],text)','execute') anon_review,
    has_function_privilege('authenticated','public.d68_admin_list_advisor_business_intakes_v1()','execute') authenticated_list,
    has_function_privilege('authenticated','public.d68_admin_review_advisor_business_intake_v1(uuid,text,timestamptz,text[],text)','execute') authenticated_review`)).rows[0];
  assert.equal(grants.anon_list, false);
  assert.equal(grants.anon_review, false);
  assert.equal(grants.authenticated_list, true);
  assert.equal(grants.authenticated_review, true);

  const policyAfter = await db.query(`select count(*)::int count from pg_policies where tablename='businesses'`);
  assert.equal(policyAfter.rows[0].count, policyBefore.rows[0].count);
  const payments = await db.query(`select count(*)::int count from public.payment_orders`);
  assert.equal(payments.rows[0].count, 0);

  console.log('✓ Advisor Session 5 PostgreSQL lifecycle: PASS');
  console.log('✓ Session 4 pending intake now passes the hardened assignment trigger.');
  console.log('✓ Admin approval verifies authority but leaves profile-only assignment pending for Advisor acceptance.');
  console.log('✓ Rejection revokes assignment; Business remains ownerless, draft and non-public.');
} finally {
  await db.close();
}
