#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const migrationDir = 'supabase/migrations';
const phase1Names = fs.readdirSync(migrationDir)
  .filter((name) => /_market_partner_affiliate_phase1_v1\.sql$/.test(name));
const phase2Names = fs.readdirSync(migrationDir)
  .filter((name) => /_market_partner_affiliate_phase2_dashboard_v1\.sql$/.test(name));
const phase3Names = fs.readdirSync(migrationDir)
  .filter((name) => /_market_partner_affiliate_phase3_referral_v1\.sql$/.test(name));
assert.equal(phase1Names.length, 1, `Expected exactly one Phase 1 migration, found ${phase1Names.length}`);
assert.equal(phase2Names.length, 1, `Expected exactly one Phase 2 migration, found ${phase2Names.length}`);
assert.equal(phase3Names.length, 1, `Expected exactly one Phase 3 migration, found ${phase3Names.length}`);
const phase1Path = path.join(migrationDir, phase1Names[0]);
const phase2Path = path.join(migrationDir, phase2Names[0]);
const phase3Path = path.join(migrationDir, phase3Names[0]);
const phase1 = fs.readFileSync(phase1Path, 'utf8');
const phase2 = fs.readFileSync(phase2Path, 'utf8');
const phase3 = fs.readFileSync(phase3Path, 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const admin = fs.readFileSync('src/pages/Admin.tsx', 'utf8');
const nav = fs.readFileSync('src/config/adminNavigation.ts', 'utf8');
const marketPartners = fs.readFileSync('src/lib/marketPartners.ts', 'utf8');
const affiliate = fs.readFileSync('src/lib/affiliate.ts', 'utf8');
const authContext = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');
const partnerLogin = fs.readFileSync('src/pages/MarketPartnerLogin.tsx', 'utf8');
const partnerDashboard = fs.readFileSync('src/pages/MarketPartnerDashboard.tsx', 'utf8');
const staticPages = fs.readFileSync('src/pages/StaticPages.tsx', 'utf8');
const adminCss = fs.readFileSync('src/styles/pages/admin.css', 'utf8');
const partnerCss = fs.readFileSync('src/styles/pages/market-partner.css', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

for (const table of [
  'market_partners',
  'affiliate_clicks',
  'affiliate_attributions',
  'affiliate_commissions',
  'affiliate_payouts',
]) {
  assert.match(phase1, new RegExp(`create table if not exists public\\.${table}\\b`, 'i'), `Missing table ${table}`);
  assert.match(phase1, new RegExp(`alter table public\\.${table} enable row level security`, 'i'), `RLS missing for ${table}`);
  assert.match(phase1, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, 'i'), `Public table ACL not closed for ${table}`);
}

assert.match(phase1, /alter type public\.user_role add value if not exists 'market_partner'/i);
assert.match(phase1, /profile_id uuid unique references public\.profiles\(id\)/i);
assert.match(phase1, /source_lead_id uuid unique references public\.partner_leads\(id\)/i);
assert.match(phase1, /partner_leads remains an intake-only lead table/i);
assert.match(phase1, /market_partners_owner_select[\s\S]*auth\.uid\(\)[\s\S]*profile_id/i);
assert.match(phase1, /affiliate_clicks_partner_select[\s\S]*mp\.profile_id = \(select auth\.uid\(\)\)/i);
assert.match(phase1, /affiliate_attributions_partner_select[\s\S]*mp\.profile_id = \(select auth\.uid\(\)\)/i);
assert.match(phase1, /affiliate_commissions_partner_select[\s\S]*mp\.profile_id = \(select auth\.uid\(\)\)/i);
assert.match(phase1, /affiliate_payouts_partner_select[\s\S]*mp\.profile_id = \(select auth\.uid\(\)\)/i);
assert.match(phase1, /market_partners_admin_all[\s\S]*public\.is_admin_user\(\)/i);

for (const rpc of [
  'd68_admin_list_market_partners',
  'd68_admin_create_market_partner',
  'd68_admin_convert_partner_lead',
  'd68_admin_update_market_partner',
  'd68_admin_regenerate_market_partner_code',
  'd68_admin_create_affiliate_commission',
  'd68_admin_set_affiliate_commission_status',
]) {
  assert.match(phase1, new RegExp(`create or replace function public\\.${rpc}\\b`, 'i'), `Missing RPC ${rpc}`);
}
assert.match(phase1, /create or replace function public\.d68_record_affiliate_click/i);
assert.match(phase1, /grant execute on function public\.d68_record_affiliate_click[\s\S]*to anon, authenticated, service_role/i);
assert.doesNotMatch(phase1, /grant\s+(select|insert|update|delete|all)[\s\S]{0,120}affiliate_(clicks|attributions|commissions|payouts)[\s\S]{0,80}to\s+anon/i);
assert.match(phase1, /No raw IP address, user-agent or customer identity is stored/i);
assert.doesNotMatch(phase1, /\b(ip_address|user_agent|raw_payload|payment_payload)\b/i);
assert.match(phase1, /commission_amount numeric\(20,2\)[\s\S]*generated always as \(round\(net_paid_amount \* commission_pct \/ 100, 2\)\) stored/i);
assert.match(phase1, /Commission requires a confirmed payment/i);
assert.match(phase1, /lower\(coalesce\(v_payment\.status, ''\)\) <> 'confirmed'/i);
assert.match(phase1, /v_payment\.confirmed_at is null/i);
assert.match(phase1, /payment order does not belong to the attributed account/i);
assert.doesNotMatch(phase1, /create\s+(or replace\s+)?trigger[\s\S]{0,200}(payment|commission)/i);
assert.match(phase1, /No automatic payment trigger is installed in Phase 1/i);
assert.doesNotMatch(phase1, /admin_priority|ticket_min|ticket_max|investment_appetite|investor_plan/i);

assert.match(phase2, /create or replace function public\.d68_get_my_market_partner_dashboard\(\)/i);
assert.match(phase2, /create or replace function public\.d68_update_my_market_partner_bank_account\([\s\S]*p_bank_account jsonb/i);
assert.match(phase2, /where mp\.profile_id = auth\.uid\(\)/i);
assert.match(phase2, /aggregate affiliate metrics; no customer identity or payment payload/i);
assert.match(phase2, /strict field whitelist and server-side validation/i);
assert.match(phase2, /revoke all on function public\.d68_get_my_market_partner_dashboard\(\)[\s\S]*from public, anon, authenticated/i);
assert.match(phase2, /grant execute on function public\.d68_get_my_market_partner_dashboard\(\)[\s\S]*to authenticated, service_role/i);
assert.doesNotMatch(phase2, /grant execute on function public\.d68_get_my_market_partner_dashboard\(\)[\s\S]{0,100}to anon/i);
assert.doesNotMatch(phase2, /create\s+(or replace\s+)?trigger[\s\S]{0,200}(payment|commission)/i);
assert.doesNotMatch(phase2, /subject_profile_id|payment_order_id|payload\s*[,)]|raw_payload|customer_email/i);

assert.match(phase3, /create or replace function public\.d68_attach_affiliate_attribution_from_profile\(\)/i);
assert.match(phase3, /from auth\.users u/i);
assert.match(phase3, /new\.role::text not in \('business', 'investor'\)/i);
assert.match(phase3, /mp\.status = 'active'/i);
assert.match(phase3, /clicked_at >= now\(\) - interval '30 days'/i);
assert.match(phase3, /if v_requested_click_id is null then[\s\S]*return new;/i);
assert.match(phase3, /if v_click_id is null then[\s\S]*return new;/i);
assert.match(phase3, /on conflict \(subject_profile_id\) do nothing/i);
assert.match(phase3, /create trigger d68_profiles_attach_affiliate_attribution/i);
assert.doesNotMatch(phase3, /insert into public\.affiliate_commissions/i);
assert.doesNotMatch(phase3, /update public\.payment_orders/i);
assert.doesNotMatch(phase3, /create\s+(or replace\s+)?trigger[\s\S]{0,160}(payment|commission)/i);

assert.match(app, /path="\/admin\/market-partners" element=\{<Admin\/>\}/);
assert.match(app, /path="\/market-partner\/login" element=\{<MarketPartnerLogin\/>\}/);
assert.match(app, /path="\/market-partner\/dashboard" element=\{<MarketPartnerGate><MarketPartnerDashboard\/><\/MarketPartnerGate>\}/);
assert.match(app, /function MarketPartnerGate/);
assert.match(app, /function AffiliateReferralRuntime/);
assert.match(app, /captureAffiliateReferralFromCurrentPage/);
assert.match(app, /\['market_partner', 'admin'\]\.includes\(String\(profile\.role\)\)/);
assert.match(nav, /\| 'market_partners'/);
assert.match(nav, /id: 'market_partners'[\s\S]*href: '\/admin\/market-partners'[\s\S]*aliases: \['market-partners'\]/);
assert.doesNotMatch(nav, /id: 'leads'[\s\S]{0,180}aliases: \[[^\]]*'market-partners'/);

for (const token of [
  "from '../lib/marketPartners'",
  'listAdminMarketPartners',
  'createMarketPartner',
  'convertPartnerLead',
  'updateMarketPartner',
  'regenerateMarketPartnerCode',
  "tab === 'market_partners'",
  'Convert lead → Market Partner',
  'customerDiscountPct',
  'commissionPct',
]) assert.ok(admin.includes(token), `Admin missing ${token}`);
assert.ok(adminCss.includes('.d68-admin-market-partners'), 'Admin Market Partner CSS missing');
assert.ok(marketPartners.includes("supabase.rpc('d68_admin_create_market_partner'"));
assert.ok(marketPartners.includes("supabase.rpc('d68_admin_convert_partner_lead'"));
assert.ok(marketPartners.includes("supabase.rpc('d68_admin_update_market_partner'"));
assert.ok(marketPartners.includes("supabase.rpc('d68_admin_regenerate_market_partner_code'"));
assert.ok(marketPartners.includes("supabase.rpc('d68_get_my_market_partner_dashboard'"));
assert.ok(marketPartners.includes("supabase.rpc('d68_update_my_market_partner_bank_account'"));
assert.ok(affiliate.includes("supabase.rpc('d68_record_affiliate_click'"));
assert.ok(affiliate.includes('window.localStorage'));
assert.ok(affiliate.includes('document.cookie'));
assert.ok(affiliate.includes("url.searchParams.delete('ref')"));
assert.ok(affiliate.includes('writeReferralCookie(record)'));
assert.ok(affiliate.includes('`${record.code}|${record.clickId}`'));
assert.doesNotMatch(affiliate, /supabase\.from\(|affiliate_commissions|payment_orders/i);
assert.ok(authContext.includes('getAffiliateReferralForSignup'));
assert.ok(authContext.includes('affiliate_code: referral?.code'));
assert.ok(authContext.includes('affiliate_click_id: referral?.clickId'));
assert.ok(staticPages.includes("supabase.from('partner_leads').insert"), 'Existing /partners lead form must remain active');
assert.equal(pkg.scripts['qa:market-partner-v1'], 'node scripts/qa-market-partner-v1.mjs');
assert.ok(pkg.scripts['qa:release'].includes('qa:market-partner-v1'), 'qa:release must include Market Partner contract');

assert.match(partnerLogin, /String\(partnerProfile\?\.role \|\| ''\) !== 'market_partner'/);
assert.match(partnerLogin, /await signOut\(\)/);
assert.match(partnerLogin, /\/market-partner\/dashboard/);
assert.doesNotMatch(partnerLogin, /dashboardForRole|roleDefs|business|investor/);
assert.match(partnerDashboard, /getMyMarketPartnerDashboard/);
assert.match(partnerDashboard, /updateMyMarketPartnerBankAccount/);
assert.match(partnerDashboard, /Link giới thiệu của bạn/);
assert.match(partnerDashboard, /Giao dịch/);
assert.match(partnerDashboard, /Thu nhập/);
assert.match(partnerDashboard, /Mã & chiến dịch/);
assert.match(partnerDashboard, /Tài khoản nhận hoa hồng/);
assert.match(partnerLogin, /d68_claim_market_partner_signup/);
assert.match(partnerLogin, /market_partner_activation_nonce/);
assert.match(partnerDashboard, /Thu nhập\/Hoa hồng theo Chính sách Đối tác thị trường/);
assert.match(partnerDashboard, /Lịch sử chi trả/);
assert.match(partnerDashboard, /Khách hàng đã được xác nhận thanh toán dịch vụ thành công/);
assert.doesNotMatch(partnerDashboard, /supabase\.(from|rpc)|from\(['"]affiliate_|insert\(|update\(/i);
assert.ok(partnerCss.includes('.d68-mp-dashboard-layout'));
assert.ok(partnerCss.includes('.d68-mp-balance-card'));
assert.ok(partnerCss.includes('.d68-mp-referral-card'));
assert.ok(partnerCss.includes('@media(max-width:760px)'));

// Execute all three migrations against a minimal PostgreSQL fixture in PGlite.
const db = new PGlite();
const fixture = `
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema extensions;
create table auth.users (
  id uuid primary key,
  created_at timestamptz not null default now(),
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create type public.user_role as enum ('business','investor','advisor','affiliate','admin');
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
`;

try {
  await db.exec(fixture);
  await db.exec(phase1);
  await db.exec(phase2);
  await db.exec(phase3);
  const adminId = '00000000-0000-0000-0000-000000000001';
  const customerId = '00000000-0000-0000-0000-000000000002';
  const partnerProfileId = '00000000-0000-0000-0000-000000000003';
  const invalidCustomerId = '00000000-0000-0000-0000-000000000004';
  const noClickCustomerId = '00000000-0000-0000-0000-000000000005';
  await db.exec(`insert into public.profiles(id,role,email) values ('${adminId}','admin','admin@example.com'),('${partnerProfileId}','market_partner','partner@example.com');`);
  await db.exec(`select set_config('request.jwt.claim.sub','${adminId}',false);`);
  const lead = await db.query(`insert into public.partner_leads(full_name,email,country,status) values ('QA Partner','qa.partner@example.com','Vietnam','new') returning id;`);
  const leadId = lead.rows[0].id;
  const converted = await db.query(`select public.d68_admin_convert_partner_lead('${leadId}',5,12,'active','QA-PARTNER') as partner;`);
  const partner = converted.rows[0].partner;
  assert.equal(partner.affiliate_code, 'QA-PARTNER');
  assert.equal(Number(partner.customer_discount_pct), 5);
  assert.equal(Number(partner.commission_pct), 12);
  const leadStatus = await db.query(`select status from public.partner_leads where id='${leadId}';`);
  assert.equal(leadStatus.rows[0].status, 'converted');

  await db.exec(`update public.market_partners set profile_id='${partnerProfileId}' where id='${partner.id}';`);
  await db.exec(`select set_config('request.jwt.claim.sub','',false);`);
  const click = await db.query(`select public.d68_record_affiliate_click('qa-partner','/register/business?x=1','example.com','campaign','partner','phase3','visitor-token-1234567890') as id;`);
  assert.ok(click.rows[0].id);
  const storedClick = await db.query(`select landing_path,referrer_host,visitor_hash from public.affiliate_clicks;`);
  assert.equal(storedClick.rows[0].landing_path, '/register/business');
  assert.equal(storedClick.rows[0].referrer_host, 'example.com');
  assert.equal(String(storedClick.rows[0].visitor_hash).length, 64);

  await db.exec(`insert into auth.users(id,created_at,raw_user_meta_data) values ('${customerId}',now(),jsonb_build_object('affiliate_code','QA-PARTNER','affiliate_click_id','${click.rows[0].id}'));`);
  await db.exec(`insert into public.profiles(id,role,email) values ('${customerId}','business','customer@example.com');`);
  const attribution = await db.query(`select id,partner_id,click_id,affiliate_code,subject_profile_id,subject_role,status from public.affiliate_attributions where subject_profile_id='${customerId}';`);
  assert.equal(attribution.rows.length, 1);
  assert.equal(attribution.rows[0].partner_id, partner.id);
  assert.equal(attribution.rows[0].click_id, click.rows[0].id);
  assert.equal(attribution.rows[0].affiliate_code, 'QA-PARTNER');
  assert.equal(attribution.rows[0].subject_role, 'business');
  assert.equal(attribution.rows[0].status, 'registered');
  const attributionId = attribution.rows[0].id;

  await db.exec(`update public.profiles set role='business' where id='${customerId}';`);
  assert.equal((await db.query(`select count(*)::int as count from public.affiliate_attributions where subject_profile_id='${customerId}';`)).rows[0].count, 1);
  await db.exec(`insert into auth.users(id,created_at,raw_user_meta_data) values ('${invalidCustomerId}',now(),'{"affiliate_code":"UNKNOWN"}'::jsonb);`);
  await db.exec(`insert into public.profiles(id,role,email) values ('${invalidCustomerId}','investor','invalid@example.com');`);
  await db.exec(`insert into auth.users(id,created_at,raw_user_meta_data) values ('${noClickCustomerId}',now(),'{"affiliate_code":"QA-PARTNER"}'::jsonb);`);
  await db.exec(`insert into public.profiles(id,role,email) values ('${noClickCustomerId}','business','noclick@example.com');`);
  assert.equal((await db.query(`select count(*)::int as count from public.affiliate_attributions;`)).rows[0].count, 1);
  assert.equal((await db.query(`select count(*)::int as count from public.affiliate_commissions;`)).rows[0].count, 0);

  const payment = await db.query(`insert into public.payment_orders(profile_id,status,confirmed_at,payload) values ('${customerId}','confirmed',now(),'{"price":{"total":"1000","currency":"USD"}}') returning id;`);
  const paymentId = payment.rows[0].id;
  await db.exec(`select set_config('request.jwt.claim.sub','${adminId}',false);`);
  const commission = await db.query(`select public.d68_admin_create_affiliate_commission('${attributionId}','${paymentId}') as commission;`);
  assert.equal(Number(commission.rows[0].commission.net_paid_amount), 1000);
  assert.equal(Number(commission.rows[0].commission.commission_pct), 12);
  assert.equal(Number(commission.rows[0].commission.commission_amount), 120);
  const duplicate = await db.query(`select public.d68_admin_create_affiliate_commission('${attributionId}','${paymentId}') as commission;`);
  assert.equal(duplicate.rows[0].commission.id, commission.rows[0].commission.id);

  await db.exec(`select set_config('request.jwt.claim.sub','${partnerProfileId}',false);`);
  const dashboard = await db.query(`select public.d68_get_my_market_partner_dashboard() as dashboard;`);
  assert.equal(dashboard.rows[0].dashboard.partner.affiliate_code, 'QA-PARTNER');
  assert.equal(Number(dashboard.rows[0].dashboard.metrics.click_count), 1);
  assert.equal(Number(dashboard.rows[0].dashboard.metrics.signup_count), 1);
  assert.equal(Number(dashboard.rows[0].dashboard.metrics.recorded_commission), 120);
  assert.equal(dashboard.rows[0].dashboard.partner.profile_id, undefined);
  assert.equal(dashboard.rows[0].dashboard.metrics.payment_order_id, undefined);
  assert.equal(dashboard.rows[0].dashboard.metrics.subject_profile_id, undefined);

  const bank = await db.query(`select public.d68_update_my_market_partner_bank_account('{"bank_name":"QA Bank","account_holder":"QA Partner","account_number":"001-234","currency":"USD","swift_code":"QABKUS33"}'::jsonb) as result;`);
  assert.equal(bank.rows[0].result.bank_account_json.bank_name, 'QA Bank');
  assert.equal(bank.rows[0].result.bank_account_json.currency, 'USD');
  const storedBank = await db.query(`select bank_account_json from public.market_partners where id='${partner.id}';`);
  assert.equal(storedBank.rows[0].bank_account_json.account_holder, 'QA Partner');
} finally {
  await db.close();
}

console.log('✓ Market Partner / Affiliate v1 Phase 1–3 QA: PASS');
console.log('✓ Schema, RLS, ACL, Admin RPCs, dedicated login, referral capture, server-side signup attribution, owner-only dashboard and bank settings verified.');
console.log('✓ Existing partner_leads form remains intact; no Business/Investor Dashboard, affiliate discount or automatic payment/commission change.');
