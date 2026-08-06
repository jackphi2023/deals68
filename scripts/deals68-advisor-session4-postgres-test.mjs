#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const advisorId = '00000000-0000-0000-0000-000000000401';
const brokerId = '00000000-0000-0000-0000-000000000402';
const outsiderId = '00000000-0000-0000-0000-000000000403';
const pendingAdvisorId = '00000000-0000-0000-0000-000000000404';

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

  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create table public.profiles (
    id uuid primary key,
    role public.user_role not null,
    email text,
    username text,
    display_name text,
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

  create table public.advisor_profiles (
    id uuid primary key default gen_random_uuid(),
    business_id uuid,
    investor_id uuid,
    profile_id uuid references public.profiles(id) on delete set null,
    created_by uuid references public.profiles(id) on delete set null,
    status text default 'pending',
    title text,
    payload jsonb default '{}'::jsonb,
    visibility text default 'private',
    sort_order int default 100,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    advisor_type text not null default 'advisor',
    company_name text,
    website text,
    metadata jsonb not null default '{}'::jsonb,
    verification_status text not null default 'pending',
    verified_by uuid references public.profiles(id),
    verified_at timestamptz,
    suspended_by uuid references public.profiles(id),
    suspended_at timestamptz,
    suspension_reason text
  );

  create table public.businesses (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid references public.profiles(id) on delete set null,
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
    visible boolean default true,
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
    verified_by uuid references public.profiles(id),
    verified_at timestamptz,
    expires_at timestamptz,
    report_policy public.d68_report_access_policy,
    report_notice_vi text,
    report_notice_en text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table public.advisor_assignments (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    investor_id uuid,
    profile_id uuid not null references public.profiles(id) on delete cascade,
    created_by uuid references public.profiles(id) on delete set null,
    status text not null default 'pending',
    title text,
    payload jsonb not null default '{}'::jsonb,
    visibility text not null default 'private',
    sort_order int default 100,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    authority_id uuid not null references public.business_listing_authority(id) on delete restrict,
    permissions text[] not null default array['profile']::text[],
    granted_by uuid not null references public.profiles(id) on delete restrict,
    granted_at timestamptz not null,
    accepted_at timestamptz,
    expires_at timestamptz,
    suspended_by uuid references public.profiles(id),
    suspended_at timestamptz,
    suspension_reason text,
    revoked_by uuid references public.profiles(id),
    revoked_at timestamptz,
    revoke_reason text,
    updated_by uuid references public.profiles(id),
    metadata jsonb not null default '{}'::jsonb,
    constraint advisor_assignments_profile_business_uidx unique(profile_id,business_id),
    constraint advisor_assignments_status_check check(status in ('pending','active','suspended','revoked','expired')),
    constraint advisor_assignments_permissions_check check(cardinality(permissions)>0 and permissions <@ array['profile','files','images','proposals','data_requests','payments','reports']::text[]),
    constraint advisor_assignments_active_state_check check(status <> 'active' or (accepted_at is not null and suspended_at is null and revoked_at is null))
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
    created_at timestamptz default now()
  );

  alter table public.businesses enable row level security;
  create policy business_owner_select on public.businesses for select to authenticated
    using (owner_id = (select auth.uid()));
  create policy business_owner_update on public.businesses for update to authenticated
    using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));

  grant usage on schema public to anon, authenticated, service_role;
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

const payload = {
  company_name: 'Atomic Client Holdings',
  title_vi: 'Gọi vốn mở rộng chuỗi',
  title_en: '',
  description_vi: 'Doanh nghiệp đang tìm đối tác vốn để mở rộng hoạt động tại Việt Nam.',
  description_en: '',
  country_iso2: 'VN',
  city: 'Hồ Chí Minh',
  industry: 'Retail',
  deal_type: 'Fundraising',
};

const authority = {
  declared_owner_name: 'Atomic Client Holdings',
  declared_principal_name: 'Nguyen Principal',
  declared_agent_name: 'Advisor Test',
  declared_asset_address: 'Ho Chi Minh City',
};

try {
  await db.exec(foundation);
  const policyBefore = await db.query(`select count(*)::int as count from pg_policies where tablename='businesses'`);
  await db.exec(fs.readFileSync('supabase/migrations/20260806184000_advisor_business_intake_phase4_v1.sql', 'utf8'));

  await db.query(`insert into public.profiles(id,role,email,display_name,status,dashboard_login_enabled) values
    ($1::uuid,'advisor','advisor@example.com','Advisor Test','active',true),
    ($2::uuid,'advisor','broker@example.com','Broker Test','active',true),
    ($3::uuid,'business','outsider@example.com','Outsider','active',true),
    ($4::uuid,'advisor','pending@example.com','Pending Advisor','pending_admin_review',true)`,
    [advisorId, brokerId, outsiderId, pendingAdvisorId]);
  await db.query(`insert into public.advisor_profiles(profile_id,created_by,status,title,advisor_type,company_name,verification_status,verified_by,verified_at) values
    ($1::uuid,$1::uuid,'active','M&A Advisor','advisor_broker','Advisor Company','verified',$1::uuid,now()),
    ($2::uuid,$2::uuid,'active','Deal Broker','broker','Broker Company','verified',$2::uuid,now()),
    ($4::uuid,$4::uuid,'pending','Pending Advisor','advisor','Pending Company','pending',null,null)`,
    [advisorId, brokerId, pendingAdvisorId]);

  await setActor(outsiderId);
  let roleBlocked = false;
  try {
    await asRole('authenticated', () => db.query(
      `select public.d68_create_advisor_business_intake_v1($1::text,$2::jsonb,$3::jsonb)`,
      ['outsider-intake-key-0000000001', JSON.stringify(payload), JSON.stringify(authority)],
    ));
  } catch { roleBlocked = true; }
  assert.equal(roleBlocked, true, 'Non-Advisor must be blocked');

  await setActor(pendingAdvisorId);
  let pendingBlocked = false;
  try {
    await asRole('authenticated', () => db.query(
      `select public.d68_create_advisor_business_intake_v1($1::text,$2::jsonb,$3::jsonb)`,
      ['pending-intake-key-0000000001', JSON.stringify(payload), JSON.stringify(authority)],
    ));
  } catch { pendingBlocked = true; }
  assert.equal(pendingBlocked, true, 'Unverified Advisor must be blocked');

  await setActor(advisorId);
  let invalidBlocked = false;
  try {
    await asRole('authenticated', () => db.query(
      `select public.d68_create_advisor_business_intake_v1($1::text,$2::jsonb,$3::jsonb)`,
      ['invalid-intake-key-0000000001', JSON.stringify({ ...payload, description_vi: '' }), JSON.stringify(authority)],
    ));
  } catch { invalidBlocked = true; }
  assert.equal(invalidBlocked, true, 'Invalid payload must fail');
  const afterInvalid = await db.query(`select
    (select count(*)::int from public.businesses) as businesses,
    (select count(*)::int from public.business_listing_authority) as authority,
    (select count(*)::int from public.advisor_assignments) as assignments,
    (select count(*)::int from public.audit_logs) as audit`);
  assert.deepEqual(afterInvalid.rows[0], { businesses: 0, authority: 0, assignments: 0, audit: 0 }, 'Failed intake must roll back atomically');

  const intakeKey = 'advisor-intake-key-000000000001';
  const created = await asRole('authenticated', () => db.query(
    `select public.d68_create_advisor_business_intake_v1($1::text,$2::jsonb,$3::jsonb) as result`,
    [intakeKey, JSON.stringify(payload), JSON.stringify(authority)],
  ));
  const result = created.rows[0].result;
  assert.equal(result.business_status, 'draft');
  assert.equal(result.moderation_status, 'pending_admin_review');
  assert.equal(result.authority_status, 'pending_review');
  assert.equal(result.assignment_status, 'pending');
  assert.equal(result.idempotent_replay, false);

  const business = await db.query(`select owner_id,visible,status::text,moderation_status,public_snapshot_json,
    show_on_homepage,revenue_public_visible,revenue_2025,ebitda_margin,ask_amount,financial_input,pending_submitted_by
    from public.businesses where id=$1::uuid`, [result.business_id]);
  assert.equal(business.rows[0].owner_id, null);
  assert.equal(business.rows[0].visible, false);
  assert.equal(business.rows[0].status, 'draft');
  assert.equal(business.rows[0].moderation_status, 'pending_admin_review');
  assert.equal(business.rows[0].public_snapshot_json, null);
  assert.equal(business.rows[0].show_on_homepage, false);
  assert.equal(business.rows[0].revenue_public_visible, false);
  assert.equal(Number(business.rows[0].revenue_2025), 0);
  assert.equal(Number(business.rows[0].ebitda_margin), 0);
  assert.equal(Number(business.rows[0].ask_amount), 0);
  assert.deepEqual(business.rows[0].financial_input, {});
  assert.equal(business.rows[0].pending_submitted_by, advisorId);

  const authorityRow = await db.query(`select listing_party_type::text,verification_status::text,verified_by,verified_at
    from public.business_listing_authority where id=$1::uuid`, [result.authority_id]);
  assert.equal(authorityRow.rows[0].listing_party_type, 'authorized_advisor');
  assert.equal(authorityRow.rows[0].verification_status, 'pending_review');
  assert.equal(authorityRow.rows[0].verified_by, null);
  assert.equal(authorityRow.rows[0].verified_at, null);

  const assignment = await db.query(`select status,permissions,accepted_at,expires_at,metadata,profile_id,created_by,granted_by
    from public.advisor_assignments where id=$1::uuid`, [result.assignment_id]);
  assert.equal(assignment.rows[0].status, 'pending');
  assert.deepEqual(assignment.rows[0].permissions, ['profile']);
  assert.equal(assignment.rows[0].accepted_at, null);
  assert.equal(assignment.rows[0].expires_at, null);
  assert.equal(assignment.rows[0].profile_id, advisorId);
  assert.equal(assignment.rows[0].created_by, advisorId);
  assert.equal(assignment.rows[0].granted_by, advisorId);
  assert.equal(assignment.rows[0].metadata.source, 'advisor_session4_business_intake');
  assert.equal(assignment.rows[0].metadata.admin_review_required, true);

  const audit = await db.query(`select action,entity_id,detail from public.audit_logs`);
  assert.equal(audit.rows.length, 1);
  assert.equal(audit.rows[0].action, 'advisor.business_intake.created');
  assert.equal(audit.rows[0].entity_id, result.business_id);
  assert.equal(audit.rows[0].detail.authority_status, 'pending_review');

  const payments = await db.query(`select count(*)::int as count from public.payment_orders`);
  assert.equal(payments.rows[0].count, 0, 'Session 4 must not create a payment order');

  const replay = await asRole('authenticated', () => db.query(
    `select public.d68_create_advisor_business_intake_v1($1::text,$2::jsonb,$3::jsonb) as result`,
    [intakeKey, JSON.stringify(payload), JSON.stringify(authority)],
  ));
  assert.equal(replay.rows[0].result.idempotent_replay, true);
  assert.equal(replay.rows[0].result.business_id, result.business_id);
  const afterReplay = await db.query(`select
    (select count(*)::int from public.businesses) as businesses,
    (select count(*)::int from public.business_listing_authority) as authority,
    (select count(*)::int from public.advisor_assignments) as assignments,
    (select count(*)::int from public.audit_logs) as audit`);
  assert.deepEqual(afterReplay.rows[0], { businesses: 1, authority: 1, assignments: 1, audit: 1 });

  const directRead = await asRole('authenticated', () => db.query(`select count(*)::int as count from public.businesses`));
  assert.equal(directRead.rows[0].count, 0, 'Advisor cannot directly SELECT the ownerless draft');
  const directUpdate = await asRole('authenticated', () => db.query(`update public.businesses set title_vi='Escalated' where id=$1::uuid`, [result.business_id]));
  assert.equal(directUpdate.affectedRows, 0, 'Advisor cannot directly UPDATE the ownerless draft');

  await setActor(brokerId);
  const brokerCreated = await asRole('authenticated', () => db.query(
    `select public.d68_create_advisor_business_intake_v1($1::text,$2::jsonb,$3::jsonb) as result`,
    ['broker-intake-key-000000000001', JSON.stringify({ ...payload, company_name: 'Broker Client', title_vi: 'Chuyển nhượng doanh nghiệp' }), JSON.stringify({ ...authority, declared_owner_name: 'Broker Client' })],
  ));
  const brokerAuthority = await db.query(`select listing_party_type::text from public.business_listing_authority where id=$1::uuid`, [brokerCreated.rows[0].result.authority_id]);
  assert.equal(brokerAuthority.rows[0].listing_party_type, 'authorized_broker');

  await setActor('');
  let anonBlocked = false;
  try {
    await asRole('anon', () => db.query(
      `select public.d68_create_advisor_business_intake_v1($1::text,$2::jsonb,$3::jsonb)`,
      ['anon-intake-key-00000000000001', JSON.stringify(payload), JSON.stringify(authority)],
    ));
  } catch { anonBlocked = true; }
  assert.equal(anonBlocked, true, 'Anonymous role must not execute intake RPC');

  const grants = await db.query(`select
    has_function_privilege('anon','public.d68_create_advisor_business_intake_v1(text,jsonb,jsonb)','execute') as anon_execute,
    has_function_privilege('authenticated','public.d68_create_advisor_business_intake_v1(text,jsonb,jsonb)','execute') as authenticated_execute`);
  assert.equal(grants.rows[0].anon_execute, false);
  assert.equal(grants.rows[0].authenticated_execute, true);

  const policyAfter = await db.query(`select count(*)::int as count from pg_policies where tablename='businesses'`);
  assert.equal(policyAfter.rows[0].count, policyBefore.rows[0].count, 'Session 4 must not change Business policies');

  console.log('✓ Advisor Session 4 PostgreSQL lifecycle: PASS');
  console.log('✓ Draft Business, pending authority, pending assignment and audit are atomic and idempotent.');
  console.log('✓ No ownership, publication, payment or direct Business access is granted.');
} finally {
  await db.close();
}
