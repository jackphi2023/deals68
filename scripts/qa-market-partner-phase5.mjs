#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const migrationDir = 'supabase/migrations';
function migration(suffix) {
  const names = fs.readdirSync(migrationDir).filter((name) => name.endsWith(suffix));
  assert.equal(names.length, 1, `Expected exactly one ${suffix} migration, found ${names.length}`);
  return fs.readFileSync(path.join(migrationDir, names[0]), 'utf8');
}

const phase1 = migration('_market_partner_affiliate_phase1_v1.sql');
const phase2 = migration('_market_partner_affiliate_phase2_dashboard_v1.sql');
const phase3 = migration('_market_partner_affiliate_phase3_referral_v1.sql');
const phase4 = migration('_market_partner_affiliate_phase4_checkout_v1.sql');
const phase5 = migration('_market_partner_affiliate_phase5_commission_payout_v1.sql');
const login = fs.readFileSync('src/pages/MarketPartnerLogin.tsx', 'utf8');
const dashboard = fs.readFileSync('src/pages/MarketPartnerDashboard.tsx', 'utf8');
const helper = fs.readFileSync('src/lib/marketPartners.ts', 'utf8');
const adminComponent = fs.readFileSync('src/components/admin/AdminMarketPartnerFinance.tsx', 'utf8');
const admin = fs.readFileSync('src/pages/Admin.tsx', 'utf8');
const roleSource = fs.readFileSync('src/lib/supabase.ts', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

for (const token of [
  'policy_snapshot jsonb',
  'd68_can_claim_market_partner_account',
  'd68_claim_market_partner_signup',
  'd68_create_affiliate_commission_for_payment',
  'd68_payment_confirmed_affiliate_commission_trigger',
  'create trigger d68_payment_confirmed_affiliate_commission',
  'affiliate_commission_auto_create_failed',
  "'requires_admin_reconciliation', true",
  "'snapshot_source', 'payment_order.payload.affiliate'",
  'd68_admin_set_affiliate_commission_status',
  'd68_admin_create_affiliate_payout',
  'd68_admin_set_affiliate_payout_status',
  'd68_admin_list_affiliate_commissions',
  'd68_admin_list_affiliate_payouts',
  "'commissions', v_commissions",
  "'payouts', v_payouts",
  'Paid commission is immutable',
  'Payment reference is required',
]) {
  assert.ok(phase5.includes(token), `Phase 5 migration missing: ${token}`);
}
assert.match(phase5, /when v_net_paid < v_tier_1_max then v_tier_1_pct/i);
assert.match(phase5, /when v_net_paid <= v_tier_2_max then v_tier_2_pct/i);
assert.match(phase5, /on conflict \(payment_order_id\) do nothing/i);
assert.match(phase5, /exception when others then[\s\S]*affiliate_commission_auto_create_failed/i);
assert.doesNotMatch(phase5, /jsonb_build_object\([\s\S]{0,300}'subject_profile_id'/i);
assert.doesNotMatch(phase5, /'payment_order_id'[\s\S]{0,300}v_commissions/i);

for (const token of [
  'Kích hoạt tài khoản Partner',
  'market_partner_activation_nonce',
  'market_partner_affiliate_code',
  'd68_can_claim_market_partner_account',
  'd68_claim_market_partner_signup',
  "type: 'signup'",
  'Email hoặc mã affiliate không khớp',
]) assert.ok(login.includes(token), `Partner activation UI missing ${token}`);

for (const token of [
  'Commission',
  'Lịch sử payout',
  'Không hiển thị danh tính khách hàng hoặc payment payload',
  'pending_commission',
  'approved_commission',
  'paid_commission',
]) assert.ok(dashboard.includes(token), `Partner finance Dashboard missing ${token}`);

for (const token of [
  'listAdminAffiliateCommissions',
  'listAdminAffiliatePayouts',
  'setAffiliateCommissionStatus',
  'createAffiliatePayout',
  'setAffiliatePayoutStatus',
]) assert.ok(helper.includes(token), `Market Partner helper missing ${token}`);

for (const token of [
  'Commission chờ duyệt và lịch sử',
  'Tạo đợt đối soát',
  'Payout / thanh toán hoa hồng',
  'Duyệt payout',
  'Đánh dấu đã trả',
]) assert.ok(adminComponent.includes(token), `Admin finance component missing ${token}`);
assert.doesNotMatch(adminComponent, /supabase\.(from|rpc)/i);
assert.ok(admin.includes('AdminMarketPartnerFinance'), 'Admin Phase 5 finance component is not wired.');
assert.ok(roleSource.includes("'market_partner'"), 'Supabase Role type must include market_partner.');
assert.equal(pkg.scripts['qa:market-partner-phase5'], 'node scripts/qa-market-partner-phase5.mjs');
assert.ok(pkg.scripts['qa:release'].includes('qa:market-partner-phase5'));

const db = new PGlite();
const fixture = `
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema extensions;
create type public.user_role as enum ('business','investor','advisor','affiliate','admin');
create type public.account_status as enum ('draft','payment_pending','pending_admin_review','active','hidden','expired','rejected');
create table auth.users (
  id uuid primary key,
  email text,
  created_at timestamptz not null default now(),
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create table public.profiles (
  id uuid primary key,
  role public.user_role not null,
  username text,
  display_name text,
  email text,
  country_iso2 text default 'VN',
  language_code text default 'vi',
  timezone text default 'Asia/Ho_Chi_Minh',
  phone_country_iso2 text default 'VN',
  phone text,
  status public.account_status default 'draft',
  dashboard_login_enabled boolean default false,
  initial_password text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid,
  investor_id uuid,
  profile_id uuid,
  created_by uuid,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order integer default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid,
  investor_id uuid,
  profile_id uuid,
  created_by uuid,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order integer default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table public.partner_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  country text,
  intro text,
  source text default 'market_partner_page',
  status text default 'new',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid,
  investor_id uuid,
  profile_id uuid,
  created_by uuid,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order integer default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  order_code text,
  confirmed_at timestamptz,
  confirmed_by uuid,
  rejected_at timestamptz,
  rejected_by uuid,
  applied_at timestamptz,
  applied_result jsonb not null default '{}'::jsonb
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
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function public.is_admin_user() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text='admin')
$$;
create function extensions.digest(value text, algorithm text) returns bytea language sql immutable as $$
  select decode(md5(value) || md5(value || algorithm), 'hex')
$$;
create or replace function public.create_signup_bundle(
  user_uuid uuid,
  user_email text,
  role_text text,
  profile_payload jsonb default '{}'::jsonb,
  business_payload jsonb default null::jsonb,
  investor_payload jsonb default null::jsonb,
  payment_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_entity_id uuid := gen_random_uuid();
  v_payment_id uuid;
begin
  insert into public.profiles(id,role,display_name,email,status,dashboard_login_enabled)
  values (user_uuid, role_text::public.user_role, profile_payload->>'display_name', lower(user_email), 'payment_pending', false)
  on conflict (id) do update set role=excluded.role, display_name=excluded.display_name, email=excluded.email;

  insert into public.payment_orders(
    business_id, investor_id, profile_id, created_by, status, title, payload,
    visibility, sort_order, order_code, created_at, updated_at
  ) values (
    case when role_text='business' then v_entity_id else null end,
    case when role_text='investor' then v_entity_id else null end,
    user_uuid, user_uuid, 'pending', payment_payload->>'title', payment_payload,
    'private', 0, payment_payload->>'orderCode', now(), now()
  ) returning id into v_payment_id;

  return jsonb_build_object(
    'business_id', case when role_text='business' then v_entity_id else null end,
    'investor_id', case when role_text='investor' then v_entity_id else null end,
    'payment_order_id', v_payment_id
  );
end;
$$;
`;

try {
  await db.exec(fixture);
  await db.exec(phase1);
  await db.exec(phase2);
  await db.exec(phase3);
  await db.exec(phase4);
  await db.exec(phase5);

  const collisionState = await db.query(`
    select
      to_regclass('d68_legacy.affiliate_clicks_pre_market_partner') is not null as legacy_clicks,
      to_regclass('d68_legacy.affiliate_payouts_pre_market_partner') is not null as legacy_payouts,
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='affiliate_clicks' and column_name='partner_id') as new_clicks,
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='affiliate_payouts' and column_name='partner_id') as new_payouts;
  `);
  assert.deepEqual(collisionState.rows[0], {
    legacy_clicks: true,
    legacy_payouts: true,
    new_clicks: true,
    new_payouts: true,
  });

  const adminId = '00000000-0000-0000-0000-000000000001';
  const partnerProfileId = '00000000-0000-0000-0000-000000000002';
  const customerId = '00000000-0000-0000-0000-000000000003';
  const invalidCustomerId = '00000000-0000-0000-0000-000000000004';
  const claimUserId = '00000000-0000-0000-0000-000000000005';
  const mismatchUserId = '00000000-0000-0000-0000-000000000006';
  const businessClaimUserId = '00000000-0000-0000-0000-000000000007';

  await db.exec(`insert into public.profiles(id,role,email,status,dashboard_login_enabled) values ('${adminId}','admin','admin@example.com','active',true),('${partnerProfileId}','market_partner','partner@example.com','active',true);`);
  await db.exec(`select set_config('request.jwt.claim.sub','${adminId}',false);`);

  const created = await db.query(`select public.d68_admin_create_market_partner('QA Phase5 Partner','partner@qa.example',null,'Vietnam','VN',null,40,40,'active','${partnerProfileId}','QA-PHASE5',null) as partner;`);
  const partner = created.rows[0].partner;
  await db.query(`select public.d68_admin_update_market_partner_commercial_policy('${partner.id}',40,'VND',20000000,50000000,40,50,60);`);
  await db.exec(`update public.market_partners set bank_account_json='{"bank_name":"QA Bank","account_holder":"QA Partner","account_number":"123456789","currency":"VND"}'::jsonb where id='${partner.id}';`);

  await db.exec(`select set_config('request.jwt.claim.sub','',false);`);
  const click = await db.query(`select public.d68_record_affiliate_click('QA-PHASE5','/register/business','example.com','registration','manual_code','phase5','phase5-visitor-token-123456789') as id;`);
  const clickId = click.rows[0].id;
  assert.ok(clickId);

  const signupNonce = 'phase5-signup-nonce-12345678901234567890';
  await db.exec(`insert into auth.users(id,email,created_at,raw_user_meta_data) values ('${customerId}','customer@example.com',now(),jsonb_build_object('signup_nonce','${signupNonce}','affiliate_code','QA-PHASE5','affiliate_click_id','${clickId}'));`);
  const bundle = await db.query(`select public.create_signup_bundle_v2(
    '${customerId}','customer@example.com','business','${signupNonce}',
    '{"display_name":"Customer","country_iso2":"VN"}'::jsonb,
    '{"plan":"standard"}'::jsonb,
    null,
    '{"title":"Business order","country":"VN","plan":"standard","price":{"termWeeks":4,"subtotal":1,"total":1},"orderCode":"D68-QA-PHASE5"}'::jsonb
  ) as bundle;`);
  const paymentId = bundle.rows[0].bundle.payment_order_id;
  const attribution = await db.query(`select id from public.affiliate_attributions where subject_profile_id='${customerId}';`);
  assert.equal(attribution.rows.length, 1);
  assert.equal((await db.query(`select count(*)::int as count from public.affiliate_commissions;`)).rows[0].count, 0);

  await db.exec(`select set_config('request.jwt.claim.sub','${adminId}',false);`);
  await db.query(`select public.d68_admin_update_market_partner_commercial_policy('${partner.id}',5,'VND',1000000,2000000,5,6,7);`);
  await db.exec(`update public.payment_orders set status='confirmed', confirmed_at=now(), confirmed_by='${adminId}' where id='${paymentId}';`);

  const commission = await db.query(`select * from public.affiliate_commissions where payment_order_id='${paymentId}';`);
  assert.equal(commission.rows.length, 1);
  assert.equal(commission.rows[0].status, 'pending');
  assert.equal(Number(commission.rows[0].net_paid_amount), 1_200_000);
  assert.equal(Number(commission.rows[0].commission_pct), 40, 'Commission must use the Phase 4 payment snapshot, not the later Partner policy.');
  assert.equal(Number(commission.rows[0].commission_amount), 480_000);
  assert.equal(Number(commission.rows[0].policy_snapshot.selected_commission_pct), 40);

  await db.exec(`update public.payment_orders set status='confirmed', updated_at=now() where id='${paymentId}';`);
  assert.equal((await db.query(`select count(*)::int as count from public.affiliate_commissions where payment_order_id='${paymentId}';`)).rows[0].count, 1);

  await db.exec(`insert into public.profiles(id,role,email,status) values ('${invalidCustomerId}','business','invalid@example.com','payment_pending');`);
  const invalidPayment = await db.query(`insert into public.payment_orders(profile_id,created_by,status,confirmed_at,confirmed_by,order_code,payload) values ('${invalidCustomerId}','${invalidCustomerId}','confirmed',now(),'${adminId}','D68-INVALID-P5','{"affiliate":{"partner_id":"${partner.id}","affiliate_code":"QA-PHASE5","click_id":"${clickId}","net_paid_amount":"oops","currency":"VND","commission_policy":{"basis_currency":"VND"},"policy_version":"market-partner-v1-phase4"}}'::jsonb) returning id,status;`);
  assert.equal(invalidPayment.rows[0].status, 'confirmed');
  assert.equal((await db.query(`select count(*)::int as count from public.affiliate_commissions where payment_order_id='${invalidPayment.rows[0].id}';`)).rows[0].count, 0);
  assert.equal((await db.query(`select count(*)::int as count from public.audit_logs where action='affiliate_commission_auto_create_failed' and entity_id='${invalidPayment.rows[0].id}';`)).rows[0].count, 1);

  const approved = await db.query(`select public.d68_admin_set_affiliate_commission_status('${commission.rows[0].id}','approved',null) as row;`);
  assert.equal(approved.rows[0].row.status, 'approved');
  const payout = await db.query(`select public.d68_admin_create_affiliate_payout('${partner.id}','VND',array['${commission.rows[0].id}'::uuid],null,null,0,'QA payout') as row;`);
  assert.equal(payout.rows[0].row.status, 'draft');
  assert.equal(Number(payout.rows[0].row.net_payout_amount), 480_000);
  const payoutId = payout.rows[0].row.id;
  assert.equal((await db.query(`select payout_id from public.affiliate_commissions where id='${commission.rows[0].id}';`)).rows[0].payout_id, payoutId);

  await db.query(`select public.d68_admin_set_affiliate_payout_status('${payoutId}','approved',null,null);`);
  await db.query(`select public.d68_admin_set_affiliate_payout_status('${payoutId}','processing',null,null);`);
  const paid = await db.query(`select public.d68_admin_set_affiliate_payout_status('${payoutId}','paid','BANK-QA-001',null) as row;`);
  assert.equal(paid.rows[0].row.status, 'paid');
  assert.equal((await db.query(`select status from public.affiliate_commissions where id='${commission.rows[0].id}';`)).rows[0].status, 'paid');
  assert.equal((await db.query(`select status from public.affiliate_attributions where id='${attribution.rows[0].id}';`)).rows[0].status, 'paid');
  await assert.rejects(
    () => db.query(`select public.d68_admin_set_affiliate_commission_status('${commission.rows[0].id}','reversed','late reversal');`),
    /immutable/i,
  );

  await db.exec(`select set_config('request.jwt.claim.sub','${partnerProfileId}',false);`);
  const dashboardResult = await db.query(`select public.d68_get_my_market_partner_dashboard() as dashboard;`);
  const dashboardData = dashboardResult.rows[0].dashboard;
  assert.equal(dashboardData.commissions.length, 1);
  assert.equal(dashboardData.payouts.length, 1);
  assert.equal(dashboardData.commissions[0].status, 'paid');
  assert.equal(dashboardData.payouts[0].payment_reference, 'BANK-QA-001');
  const safeDashboardJson = JSON.stringify(dashboardData);
  for (const forbidden of ['payment_order_id','subject_profile_id','policy_snapshot','customer@example.com','D68-QA-PHASE5']) {
    assert.ok(!safeDashboardJson.includes(forbidden), `Partner dashboard exposed forbidden value: ${forbidden}`);
  }

  await db.exec(`select set_config('request.jwt.claim.sub','${adminId}',false);`);
  const claimPartner = (await db.query(`select public.d68_admin_create_market_partner('Claim Partner','claim@example.com',null,'Vietnam','VN',null,40,40,'active',null,'CLAIM-P5',null) as partner;`)).rows[0].partner;
  const preflight = await db.query(`select public.d68_can_claim_market_partner_account('claim@example.com','CLAIM-P5') as allowed;`);
  assert.equal(preflight.rows[0].allowed, true);
  assert.equal((await db.query(`select public.d68_can_claim_market_partner_account('claim@example.com','WRONG-P5') as allowed;`)).rows[0].allowed, false);
  const activationNonce = 'phase5-activation-nonce-123456789012345678';
  await db.exec(`insert into auth.users(id,email,created_at,raw_user_meta_data) values ('${claimUserId}','claim@example.com',now(),jsonb_build_object('role','market_partner','market_partner_activation_nonce','${activationNonce}','market_partner_affiliate_code','CLAIM-P5'));`);
  assert.equal((await db.query(`select public.d68_can_claim_market_partner_account('claim@example.com','CLAIM-P5') as allowed;`)).rows[0].allowed, false);
  await db.exec(`select set_config('request.jwt.claim.sub','',false);`);
  const claimed = await db.query(`select public.d68_claim_market_partner_signup('${claimUserId}','claim@example.com','CLAIM-P5','${activationNonce}') as row;`);
  assert.equal(claimed.rows[0].row.partner_id, claimPartner.id);
  assert.equal((await db.query(`select role::text as role,dashboard_login_enabled,status::text as status from public.profiles where id='${claimUserId}';`)).rows[0].role, 'market_partner');
  assert.equal((await db.query(`select profile_id from public.market_partners where id='${claimPartner.id}';`)).rows[0].profile_id, claimUserId);

  const mismatchNonce = 'phase5-mismatch-nonce-1234567890123456789';
  await db.exec(`insert into auth.users(id,email,created_at,raw_user_meta_data) values ('${mismatchUserId}','claim@example.com',now(),jsonb_build_object('role','market_partner','market_partner_activation_nonce','${mismatchNonce}','market_partner_affiliate_code','WRONG-P5'));`);
  await assert.rejects(
    () => db.query(`select public.d68_claim_market_partner_signup('${mismatchUserId}','claim@example.com','WRONG-P5','${mismatchNonce}');`),
    /activation data is invalid/i,
  );

  await db.exec(`select set_config('request.jwt.claim.sub','${adminId}',false);`);
  await db.query(`select public.d68_admin_create_market_partner('Business Claim Guard','business-claim@example.com',null,'Vietnam','VN',null,40,40,'active',null,'BUSINESS-P5',null);`);
  const businessNonce = 'phase5-business-nonce-12345678901234567890';
  await db.exec(`insert into auth.users(id,email,created_at,raw_user_meta_data) values ('${businessClaimUserId}','business-claim@example.com',now(),jsonb_build_object('role','market_partner','market_partner_activation_nonce','${businessNonce}','market_partner_affiliate_code','BUSINESS-P5')); insert into public.profiles(id,role,email,status) values ('${businessClaimUserId}','business','business-claim@example.com','active');`);
  await db.exec(`select set_config('request.jwt.claim.sub','',false);`);
  await assert.rejects(
    () => db.query(`select public.d68_claim_market_partner_signup('${businessClaimUserId}','business-claim@example.com','BUSINESS-P5','${businessNonce}');`),
    /activation data is invalid/i,
  );
} finally {
  await db.close();
}

console.log('✓ Market Partner / Affiliate Phase 5 QA: PASS');
console.log('✓ Account claim, immutable X/Y snapshot, automatic commission, non-blocking reconciliation failure and payout lifecycle verified.');
console.log('✓ Partner Dashboard exposes safe commission/payout history without customer identity or raw payment fields.');
