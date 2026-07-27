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
const register = fs.readFileSync('src/pages/Register.tsx', 'utf8');
const admin = fs.readFileSync('src/pages/Admin.tsx', 'utf8');
const affiliate = fs.readFileSync('src/lib/affiliate.ts', 'utf8');
const marketPartners = fs.readFileSync('src/lib/marketPartners.ts', 'utf8');
const dashboard = fs.readFileSync('src/pages/MarketPartnerDashboard.tsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

for (const token of [
  'commission_basis_currency text not null default \'VND\'',
  'commission_tier_1_max numeric(20,2) not null default 20000000',
  'commission_tier_2_max numeric(20,2) not null default 50000000',
  'commission_tier_1_pct numeric(5,2) not null default 40',
  'commission_tier_2_pct numeric(5,2) not null default 50',
  'commission_tier_3_pct numeric(5,2) not null default 60',
  'create or replace function public.d68_admin_update_market_partner_commercial_policy',
  'create or replace function public.d68_get_affiliate_checkout_quote',
  'create or replace function public.d68_affiliate_commission_pct_for_net_paid',
  'Promo code cannot be combined with a Market Partner code',
  "'calculation_basis', 'net_paid_amount'",
  "'affiliate_policy_version', 'market-partner-v1-phase4'",
  'No automatic commission trigger is installed in Phase 4',
]) {
  assert.ok(phase4.includes(token), `Phase 4 migration missing: ${token}`);
}
assert.match(phase4, /v_affiliate_discount := round\(v_eligible_amount \* v_partner\.customer_discount_pct \/ 100, 2\)/i);
assert.match(phase4, /when p_net_paid_amount < v_partner\.commission_tier_1_max then v_partner\.commission_tier_1_pct/i);
assert.match(phase4, /when p_net_paid_amount <= v_partner\.commission_tier_2_max then v_partner\.commission_tier_2_pct/i);
assert.match(phase4, /else v_partner\.commission_tier_3_pct/i);
assert.match(phase4, /update auth\.users[\s\S]*- 'affiliate_code'[\s\S]*- 'affiliate_click_id'/i);
assert.doesNotMatch(phase4, /create\s+(or replace\s+)?trigger[\s\S]{0,180}(payment|commission)/i);
assert.doesNotMatch(phase4, /insert into public\.affiliate_commissions[\s\S]{0,100}trigger/i);

for (const token of [
  'applyAffiliateCodeForCheckout',
  'getAffiliateCheckoutQuote',
  'clearStoredAffiliateReferral',
  'affiliateActive',
  'Giảm giá Đối tác',
  'Không thể cộng dồn mã Đối tác và mã khuyến mãi',
  'affiliate_policy_version',
]) assert.ok(register.includes(token), `Register Phase 4 missing ${token}`);
assert.ok(register.includes('disabled={Boolean(affiliateReferral)}'), 'Partner code should lock the promo field until removed.');
assert.ok(register.includes('disabled={affiliateLoading || Boolean(affiliateReferral && !affiliateActive)}'), 'Payment acknowledgement must fail closed while the Partner quote is unresolved.');

for (const token of [
  'applyAffiliateCodeForCheckout',
  'd68_get_affiliate_checkout_quote',
  'clearStoredAffiliateReferral',
]) assert.ok(affiliate.includes(token), `Affiliate helper missing ${token}`);
assert.doesNotMatch(affiliate, /supabase\.from\(['"]payment_orders|affiliate_commissions/i);

for (const token of [
  'DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY',
  'commissionTier1Max',
  'commissionTier2Max',
  'commissionTier2Pct',
  'commissionTier3Pct',
  'd68_admin_update_market_partner_commercial_policy',
]) assert.ok(marketPartners.includes(token), `Market Partner helper missing ${token}`);

for (const token of [
  'X · Giảm giá khách hàng',
  'Y1 · Dưới mốc 1',
  'Y2 · Từ mốc 1 đến mốc 2',
  'Y3 · Trên mốc 2',
  'Mốc doanh thu 1',
  'Mốc doanh thu 2',
]) assert.ok(admin.includes(token), `Admin commercial policy UI missing ${token}`);

for (const token of [
  'CƠ CẤU HOA HỒNG THEO DOANH THU',
  'trên số tiền khách thực thanh toán',
  'Không cộng dồn mã khuyến mãi khác',
  'READ-ONLY · PHASE 4',
]) assert.ok(dashboard.includes(token), `Partner Dashboard Phase 4 missing ${token}`);

assert.equal(pkg.scripts['qa:market-partner-phase4'], 'node scripts/qa-market-partner-phase4.mjs');
assert.ok(pkg.scripts['qa:release'].includes('qa:market-partner-phase4'));

const db = new PGlite();
const fixture = `
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema extensions;
create type public.user_role as enum ('business','investor','advisor','affiliate','admin');
create table auth.users (
  id uuid primary key,
  email text,
  created_at timestamptz not null default now(),
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create table public.profiles (
  id uuid primary key,
  role public.user_role not null,
  display_name text,
  email text
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
  insert into public.profiles(id,role,display_name,email)
  values (user_uuid, role_text::public.user_role, profile_payload->>'display_name', lower(user_email))
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

  const adminId = '00000000-0000-0000-0000-000000000001';
  const partnerProfileId = '00000000-0000-0000-0000-000000000002';
  const customerId = '00000000-0000-0000-0000-000000000003';
  const stackedCustomerId = '00000000-0000-0000-0000-000000000004';

  await db.exec(`insert into public.profiles(id,role,email) values ('${adminId}','admin','admin@example.com'),('${partnerProfileId}','market_partner','partner@example.com');`);
  await db.exec(`select set_config('request.jwt.claim.sub','${adminId}',false);`);
  const created = await db.query(`select public.d68_admin_create_market_partner('QA Partner','partner@qa.example',null,'Vietnam','VN',null,40,40,'active','${partnerProfileId}','QA-PHASE4',null) as partner;`);
  const partner = created.rows[0].partner;
  await db.query(`select public.d68_admin_update_market_partner_commercial_policy('${partner.id}',40,'VND',20000000,50000000,40,50,60);`);

  await db.exec(`select set_config('request.jwt.claim.sub','',false);`);
  const click = await db.query(`select public.d68_record_affiliate_click('QA-PHASE4','/register/business','example.com','registration','manual_code','phase4','phase4-visitor-token-123456789') as id;`);
  const clickId = click.rows[0].id;
  assert.ok(clickId);

  const quote4 = await db.query(`select public.d68_get_affiliate_checkout_quote('QA-PHASE4','${clickId}','business','VN','standard',4,null) as quote;`);
  assert.equal(quote4.rows[0].quote.valid, true);
  assert.equal(Number(quote4.rows[0].quote.price.subtotal), 2_000_000);
  assert.equal(Number(quote4.rows[0].quote.price.termDiscount), 0);
  assert.equal(Number(quote4.rows[0].quote.affiliate.discount_amount), 800_000);
  assert.equal(Number(quote4.rows[0].quote.affiliate.net_paid_amount), 1_200_000);

  const quote8 = await db.query(`select public.d68_get_affiliate_checkout_quote('QA-PHASE4','${clickId}','business','VN','standard',8,null) as quote;`);
  assert.equal(Number(quote8.rows[0].quote.price.subtotal), 4_000_000);
  assert.equal(Number(quote8.rows[0].quote.price.termDiscount), 600_000);
  assert.equal(Number(quote8.rows[0].quote.affiliate.eligible_amount), 3_400_000);
  assert.equal(Number(quote8.rows[0].quote.affiliate.discount_amount), 1_360_000);
  assert.equal(Number(quote8.rows[0].quote.affiliate.net_paid_amount), 2_040_000);

  assert.equal(Number((await db.query(`select public.d68_affiliate_commission_pct_for_net_paid('${partner.id}',19999999,'VND') as pct;`)).rows[0].pct), 40);
  assert.equal(Number((await db.query(`select public.d68_affiliate_commission_pct_for_net_paid('${partner.id}',20000000,'VND') as pct;`)).rows[0].pct), 50);
  assert.equal(Number((await db.query(`select public.d68_affiliate_commission_pct_for_net_paid('${partner.id}',50000000,'VND') as pct;`)).rows[0].pct), 50);
  assert.equal(Number((await db.query(`select public.d68_affiliate_commission_pct_for_net_paid('${partner.id}',50000001,'VND') as pct;`)).rows[0].pct), 60);
  await assert.rejects(
    () => db.query(`select public.d68_affiliate_commission_pct_for_net_paid('${partner.id}',1000,'USD');`),
    /currency mismatch/i,
  );

  const nonce = 'phase4-signup-nonce-12345678901234567890';
  await db.exec(`insert into auth.users(id,email,created_at,raw_user_meta_data) values ('${customerId}','customer@example.com',now(),jsonb_build_object('signup_nonce','${nonce}','affiliate_code','QA-PHASE4','affiliate_click_id','${clickId}'));`);
  const bundle = await db.query(`select public.create_signup_bundle_v2(
    '${customerId}','customer@example.com','business','${nonce}',
    '{"display_name":"Customer","country_iso2":"VN"}'::jsonb,
    '{"plan":"standard"}'::jsonb,
    null,
    '{"title":"Business order","country":"VN","plan":"standard","price":{"termWeeks":4,"subtotal":1,"total":1},"orderCode":"D68-QA-PHASE4"}'::jsonb
  ) as bundle;`);
  const paymentId = bundle.rows[0].bundle.payment_order_id;
  const payment = await db.query(`select payload,status from public.payment_orders where id='${paymentId}';`);
  assert.equal(payment.rows[0].status, 'pending');
  assert.equal(payment.rows[0].payload.affiliate.affiliate_code, 'QA-PHASE4');
  assert.equal(payment.rows[0].payload.affiliate.partner_id, partner.id);
  assert.equal(Number(payment.rows[0].payload.affiliate.customer_discount_pct), 40);
  assert.equal(Number(payment.rows[0].payload.price.subtotal), 2_000_000);
  assert.equal(Number(payment.rows[0].payload.price.total), 1_200_000);
  assert.equal(Number(payment.rows[0].payload.net_paid_amount), 1_200_000);
  assert.equal(payment.rows[0].payload.affiliate_policy_version, 'market-partner-v1-phase4');
  assert.equal((await db.query(`select count(*)::int as count from public.affiliate_commissions;`)).rows[0].count, 0);

  const attribution = await db.query(`select id,partner_id,click_id,status from public.affiliate_attributions where subject_profile_id='${customerId}';`);
  assert.equal(attribution.rows.length, 1);
  assert.equal(attribution.rows[0].partner_id, partner.id);
  assert.equal(attribution.rows[0].click_id, clickId);

  const stackedNonce = 'phase4-stacked-nonce-123456789012345678';
  await db.exec(`insert into auth.users(id,email,created_at,raw_user_meta_data) values ('${stackedCustomerId}','stacked@example.com',now(),jsonb_build_object('signup_nonce','${stackedNonce}','affiliate_code','QA-PHASE4','affiliate_click_id','${clickId}'));`);
  await assert.rejects(
    () => db.query(`select public.create_signup_bundle_v2(
      '${stackedCustomerId}','stacked@example.com','business','${stackedNonce}',
      '{"display_name":"Stacked","country_iso2":"VN"}'::jsonb,
      '{"plan":"standard"}'::jsonb,
      null,
      '{"country":"VN","plan":"standard","price":{"termWeeks":4,"promoCode":"PROMO10","promoDiscountPct":10,"promoDiscount":200000},"orderCode":"D68-QA-STACK"}'::jsonb
    );`),
    /cannot be combined/i,
  );

  await db.exec(`update public.payment_orders set status='confirmed', confirmed_at=now() where id='${paymentId}';`);
  await db.exec(`select set_config('request.jwt.claim.sub','${adminId}',false);`);
  const commission = await db.query(`select public.d68_admin_create_affiliate_commission('${attribution.rows[0].id}','${paymentId}') as commission;`);
  assert.equal(Number(commission.rows[0].commission.net_paid_amount), 1_200_000);
  assert.equal(Number(commission.rows[0].commission.commission_pct), 40);
  assert.equal(Number(commission.rows[0].commission.commission_amount), 480_000);
  const duplicate = await db.query(`select public.d68_admin_create_affiliate_commission('${attribution.rows[0].id}','${paymentId}') as commission;`);
  assert.equal(duplicate.rows[0].commission.id, commission.rows[0].commission.id);
} finally {
  await db.close();
}

console.log('✓ Market Partner / Affiliate Phase 4 QA: PASS');
console.log('✓ X discount, package + term + affiliate net amount, non-stacking and Y tier boundaries verified server-side.');
console.log('✓ Payment payload receives a validated affiliate snapshot; no automatic commission is created in Phase 4.');
