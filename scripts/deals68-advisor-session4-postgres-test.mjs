#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const advisorId = '00000000-0000-0000-0000-000000000401';
const brokerId = '00000000-0000-0000-0000-000000000402';
const outsiderId = '00000000-0000-0000-0000-000000000403';
const pendingId = '00000000-0000-0000-0000-000000000404';

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
  id uuid primary key, role public.user_role not null, email text, username text,
  display_name text, country_iso2 text default 'VN', language_code text default 'vi',
  timezone text default 'Asia/Ho_Chi_Minh', phone_country_iso2 text default 'VN',
  phone text, status public.account_status default 'draft',
  dashboard_login_enabled boolean default false, created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.advisor_profiles (
  id uuid primary key default gen_random_uuid(), profile_id uuid references public.profiles(id),
  created_by uuid references public.profiles(id), status text default 'pending', title text,
  advisor_type text not null default 'advisor', company_name text, website text,
  payload jsonb default '{}'::jsonb, metadata jsonb default '{}'::jsonb,
  visibility text default 'private', verification_status text default 'pending',
  verified_by uuid, verified_at timestamptz, suspended_by uuid, suspended_at timestamptz,
  suspension_reason text, created_at timestamptz default now(), updated_at timestamptz default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles(id),
  username text unique, public_code text unique, slug text not null unique,
  company_name_private text, title_vi text not null, title_en text not null,
  description_vi text, description_en text, country_iso2 text default 'VN', city text,
  city_key text, industry text, industry_key text, deal_type text, plan text default 'standard',
  revenue_2025 numeric default 0, revenue_currency text default 'VND',
  ebitda_margin numeric default 0, ask_amount numeric default 0, ask_currency text default 'VND',
  stake_pct numeric default 0, financial_input jsonb default '{}'::jsonb,
  visible boolean default true, status public.account_status default 'active',
  quota_total integer default 100, quota_used integer default 0, pending_changes_json jsonb,
  public_snapshot_json jsonb, public_version integer not null default 0,
  pending_submitted_at timestamptz, pending_submitted_by uuid references public.profiles(id),
  moderation_status text not null default 'pending_admin_review',
  show_on_homepage boolean not null default false,
  revenue_public_visible boolean not null default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table public.business_listing_authority (
  id uuid primary key default gen_random_uuid(), business_id uuid not null unique references public.businesses(id) on delete cascade,
  listing_party_type public.d68_listing_party_type not null default 'business_owner',
  declared_owner_name text, declared_principal_name text, declared_agent_name text,
  declared_asset_name text, declared_asset_address text,
  verification_status public.d68_authority_verification_status not null default 'declared',
  verification_reasons jsonb not null default '[]'::jsonb,
  authority_document_ids uuid[] not null default '{}'::uuid[], verified_by uuid,
  verified_at timestamptz, expires_at timestamptz, report_policy public.d68_report_access_policy,
  report_notice_vi text, report_notice_en text, created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.advisor_assignments (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  investor_id uuid, profile_id uuid not null references public.profiles(id),
  created_by uuid references public.profiles(id), status text not null default 'pending',
  title text, payload jsonb not null default '{}'::jsonb, visibility text not null default 'private',
  sort_order int default 100, created_at timestamptz default now(), updated_at timestamptz default now(),
  authority_id uuid not null references public.business_listing_authority(id),
  permissions text[] not null default array['profile']::text[],
  granted_by uuid not null references public.profiles(id), granted_at timestamptz not null,
  accepted_at timestamptz, expires_at timestamptz, suspended_by uuid, suspended_at timestamptz,
  suspension_reason text, revoked_by uuid, revoked_at timestamptz, revoke_reason text,
  updated_by uuid, metadata jsonb not null default '{}'::jsonb,
  unique(profile_id,business_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid, action text not null,
  entity_type text, entity_id text, detail jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create table public.payment_orders (id uuid primary key default gen_random_uuid(), profile_id uuid);

alter table public.businesses enable row level security;
create policy business_owner_select on public.businesses for select to authenticated
  using (owner_id = (select auth.uid()));
create policy business_owner_update on public.businesses for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
`;

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

async function actor(id) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${id || ''}', false)`);
}
async function asRole(role, fn) {
  await db.exec(`set role ${role}`);
  try { return await fn(); } finally { await db.exec('reset role'); }
}
async function intake(key, business = payload, declaration = authority, role = 'authenticated') {
  return asRole(role, () => db.query(
    `select public.d68_create_advisor_business_intake_v1($1::text,$2::jsonb,$3::jsonb) as result`,
    [key, JSON.stringify(business), JSON.stringify(declaration)],
  ));
}
async function counts() {
  const result = await db.query(`select
    (select count(*)::int from public.businesses) businesses,
    (select count(*)::int from public.business_listing_authority) authority,
    (select count(*)::int from public.advisor_assignments) assignments,
    (select count(*)::int from public.audit_logs) audit,
    (select count(*)::int from public.payment_orders) payments`);
  return result.rows[0];
}

try {
  await db.exec(foundation);
  const policyBefore = await db.query(`select count(*)::int count from pg_policies where tablename='businesses'`);
  await db.exec(fs.readFileSync('supabase/migrations/20260806184000_advisor_business_intake_phase4_v1.sql', 'utf8'));

  await db.exec(`
    insert into public.profiles(id,role,email,display_name,status,dashboard_login_enabled) values
    ('${advisorId}','advisor','advisor@example.com','Advisor Test','active',true),
    ('${brokerId}','advisor','broker@example.com','Broker Test','active',true),
    ('${outsiderId}','business','outsider@example.com','Outsider','active',true),
    ('${pendingId}','advisor','pending@example.com','Pending Advisor','pending_admin_review',true);
    insert into public.advisor_profiles(profile_id,created_by,status,title,advisor_type,company_name,verification_status,verified_by,verified_at) values
    ('${advisorId}','${advisorId}','active','M&A Advisor','advisor_broker','Advisor Company','verified','${advisorId}',now()),
    ('${brokerId}','${brokerId}','active','Deal Broker','broker','Broker Company','verified','${brokerId}',now()),
    ('${pendingId}','${pendingId}','pending','Pending Advisor','advisor','Pending Company','pending',null,null);
  `);

  await actor(outsiderId);
  await assert.rejects(() => intake('outsider-intake-key-0000000001'));

  await actor(pendingId);
  await assert.rejects(() => intake('pending-intake-key-0000000001'));

  await actor(advisorId);
  await assert.rejects(() => intake(
    'invalid-intake-key-0000000001',
    { ...payload, description_vi: '' },
  ));
  assert.deepEqual(await counts(), { businesses: 0, authority: 0, assignments: 0, audit: 0, payments: 0 });

  const key = 'advisor-intake-key-000000000001';
  const created = await intake(key);
  const result = created.rows[0].result;
  assert.deepEqual(
    [result.business_status, result.moderation_status, result.authority_status, result.assignment_status, result.idempotent_replay],
    ['draft', 'pending_admin_review', 'pending_review', 'pending', false],
  );

  const business = (await db.query(`select owner_id,visible,status::text,moderation_status,public_snapshot_json,
    show_on_homepage,revenue_public_visible,revenue_2025,ebitda_margin,ask_amount,financial_input,pending_submitted_by
    from public.businesses where id=$1::uuid`, [result.business_id])).rows[0];
  assert.equal(business.owner_id, null);
  assert.equal(business.visible, false);
  assert.equal(business.status, 'draft');
  assert.equal(business.moderation_status, 'pending_admin_review');
  assert.equal(business.public_snapshot_json, null);
  assert.equal(business.show_on_homepage, false);
  assert.equal(business.revenue_public_visible, false);
  assert.equal(Number(business.revenue_2025), 0);
  assert.equal(Number(business.ebitda_margin), 0);
  assert.equal(Number(business.ask_amount), 0);
  assert.deepEqual(business.financial_input, {});
  assert.equal(business.pending_submitted_by, advisorId);

  const authorityRow = (await db.query(`select listing_party_type::text,verification_status::text,verified_by,verified_at
    from public.business_listing_authority where id=$1::uuid`, [result.authority_id])).rows[0];
  assert.deepEqual(
    [authorityRow.listing_party_type, authorityRow.verification_status, authorityRow.verified_by, authorityRow.verified_at],
    ['authorized_advisor', 'pending_review', null, null],
  );

  const assignment = (await db.query(`select status,permissions,accepted_at,expires_at,metadata,profile_id,created_by,granted_by
    from public.advisor_assignments where id=$1::uuid`, [result.assignment_id])).rows[0];
  assert.equal(assignment.status, 'pending');
  assert.deepEqual(assignment.permissions, ['profile']);
  assert.equal(assignment.accepted_at, null);
  assert.equal(assignment.expires_at, null);
  assert.equal(assignment.profile_id, advisorId);
  assert.equal(assignment.created_by, advisorId);
  assert.equal(assignment.granted_by, advisorId);
  assert.equal(assignment.metadata.source, 'advisor_session4_business_intake');
  assert.equal(assignment.metadata.admin_review_required, true);

  const audit = (await db.query(`select action,entity_id,detail from public.audit_logs`)).rows;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, 'advisor.business_intake.created');
  assert.equal(audit[0].entity_id, result.business_id);

  const replay = (await intake(key)).rows[0].result;
  assert.equal(replay.idempotent_replay, true);
  assert.equal(replay.business_id, result.business_id);
  assert.deepEqual(await counts(), { businesses: 1, authority: 1, assignments: 1, audit: 1, payments: 0 });

  const directRead = await asRole('authenticated', () => db.query(`select count(*)::int count from public.businesses`));
  assert.equal(directRead.rows[0].count, 0);
  const directUpdate = await asRole('authenticated', () => db.query(
    `update public.businesses set title_vi='Escalated' where id=$1::uuid`,
    [result.business_id],
  ));
  assert.equal(directUpdate.affectedRows, 0);

  await actor(brokerId);
  const brokerResult = (await intake(
    'broker-intake-key-000000000001',
    { ...payload, company_name: 'Broker Client', title_vi: 'Chuyển nhượng doanh nghiệp' },
    { ...authority, declared_owner_name: 'Broker Client' },
  )).rows[0].result;
  const brokerAuthority = (await db.query(
    `select listing_party_type::text party from public.business_listing_authority where id=$1::uuid`,
    [brokerResult.authority_id],
  )).rows[0];
  assert.equal(brokerAuthority.party, 'authorized_broker');

  await actor('');
  await assert.rejects(() => intake(
    'anon-intake-key-00000000000001',
    payload,
    authority,
    'anon',
  ));

  const grants = (await db.query(`select
    has_function_privilege('anon','public.d68_create_advisor_business_intake_v1(text,jsonb,jsonb)','execute') anon_execute,
    has_function_privilege('authenticated','public.d68_create_advisor_business_intake_v1(text,jsonb,jsonb)','execute') authenticated_execute`)).rows[0];
  assert.equal(grants.anon_execute, false);
  assert.equal(grants.authenticated_execute, true);

  const policyAfter = await db.query(`select count(*)::int count from pg_policies where tablename='businesses'`);
  assert.equal(policyAfter.rows[0].count, policyBefore.rows[0].count);

  console.log('✓ Advisor Session 4 PostgreSQL lifecycle: PASS');
  console.log('✓ Draft Business, pending authority, pending assignment and audit are atomic and idempotent.');
  console.log('✓ No ownership, publication, payment or direct Business access is granted.');
} finally {
  await db.close();
}
