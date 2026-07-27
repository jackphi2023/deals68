from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)


app_path = Path('src/App.tsx')
app = app_path.read_text()
app = replace_once(
    app,
    "import { langFromPath, stripLangPrefix, toLocalizedPath } from './lib/i18nRoutes';\n",
    "import { langFromPath, stripLangPrefix, toLocalizedPath } from './lib/i18nRoutes';\nimport { captureAffiliateReferralFromCurrentPage } from './lib/affiliate';\n",
    'App affiliate import',
)
scroll_block = """function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);
  return null;
}
"""
runtime_block = scroll_block + """
function AffiliateReferralRuntime() {
  const location = useLocation();
  useEffect(() => {
    void captureAffiliateReferralFromCurrentPage().catch(() => undefined);
  }, [location.pathname, location.search]);
  return null;
}
"""
app = replace_once(app, scroll_block, runtime_block, 'App referral runtime')
app = replace_once(
    app,
    "    <ScrollToTop />\n    <RoutePrefetch />",
    "    <ScrollToTop />\n    <AffiliateReferralRuntime />\n    <RoutePrefetch />",
    'App runtime mount',
)
app_path.write_text(app)


dashboard_path = Path('src/pages/MarketPartnerDashboard.tsx')
dashboard = dashboard_path.read_text()
dashboard = replace_once(
    dashboard,
    'Phase 2 chỉ hiển thị tổng số đăng ký. Danh sách chi tiết sẽ được mở sau khi Phase 3 kích hoạt attribution an toàn.',
    'Phase 3 đã kích hoạt click và signup attribution. Dashboard chỉ hiển thị số tổng hợp, không công khai danh tính khách hàng.',
    'Dashboard leads wording',
)
dashboard = replace_once(
    dashboard,
    'Mã affiliate hiện tại: ${partner.affiliate_code}. Tracking ?ref=CODE sẽ được kích hoạt trong Phase 3.',
    'Mã affiliate hiện tại: ${partner.affiliate_code}. Tracking ?ref=CODE đang hoạt động trên các trang public và đăng ký.',
    'Dashboard campaign wording',
)
dashboard = replace_once(
    dashboard,
    '<span>READ-ONLY · PHASE 2</span>',
    '<span>READ-ONLY · PHASE 3</span>',
    'Dashboard phase badge',
)
dashboard = replace_once(
    dashboard,
    'Thông tin này chỉ Partner và Admin được xem. Phase 2 chưa phát sinh thanh toán tự động.',
    'Thông tin này chỉ Partner và Admin được xem. Phase 3 chưa phát sinh thanh toán tự động.',
    'Dashboard bank wording',
)
dashboard_path.write_text(dashboard)


qa_path = Path('scripts/qa-market-partner-v1.mjs')
qa = qa_path.read_text()
qa = replace_once(
    qa,
    "const phase2Names = fs.readdirSync(migrationDir)\n  .filter((name) => /_market_partner_affiliate_phase2_dashboard_v1\\.sql$/.test(name));\n",
    "const phase2Names = fs.readdirSync(migrationDir)\n  .filter((name) => /_market_partner_affiliate_phase2_dashboard_v1\\.sql$/.test(name));\nconst phase3Names = fs.readdirSync(migrationDir)\n  .filter((name) => /_market_partner_affiliate_phase3_referral_v1\\.sql$/.test(name));\n",
    'QA phase3 discovery',
)
qa = replace_once(
    qa,
    "assert.equal(phase2Names.length, 1, `Expected exactly one Phase 2 migration, found ${phase2Names.length}`);\n",
    "assert.equal(phase2Names.length, 1, `Expected exactly one Phase 2 migration, found ${phase2Names.length}`);\nassert.equal(phase3Names.length, 1, `Expected exactly one Phase 3 migration, found ${phase3Names.length}`);\n",
    'QA phase3 count',
)
qa = replace_once(
    qa,
    "const phase2Path = path.join(migrationDir, phase2Names[0]);\nconst phase1 = fs.readFileSync(phase1Path, 'utf8');\nconst phase2 = fs.readFileSync(phase2Path, 'utf8');\n",
    "const phase2Path = path.join(migrationDir, phase2Names[0]);\nconst phase3Path = path.join(migrationDir, phase3Names[0]);\nconst phase1 = fs.readFileSync(phase1Path, 'utf8');\nconst phase2 = fs.readFileSync(phase2Path, 'utf8');\nconst phase3 = fs.readFileSync(phase3Path, 'utf8');\n",
    'QA phase3 read',
)
qa = replace_once(
    qa,
    "const marketPartners = fs.readFileSync('src/lib/marketPartners.ts', 'utf8');\n",
    "const marketPartners = fs.readFileSync('src/lib/marketPartners.ts', 'utf8');\nconst affiliate = fs.readFileSync('src/lib/affiliate.ts', 'utf8');\nconst authContext = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');\n",
    'QA frontend reads',
)
phase2_assert = "assert.doesNotMatch(phase2, /subject_profile_id|payment_order_id|payload\\s*[,)]|raw_payload|customer_email/i);\n"
phase3_assert = phase2_assert + """
assert.match(phase3, /create or replace function public\.d68_attach_affiliate_attribution_from_profile\(\)/i);
assert.match(phase3, /from auth\.users u/i);
assert.match(phase3, /new\.role::text not in \('business', 'investor'\)/i);
assert.match(phase3, /mp\.status = 'active'/i);
assert.match(phase3, /clicked_at >= now\(\) - interval '30 days'/i);
assert.match(phase3, /on conflict \(subject_profile_id\) do nothing/i);
assert.match(phase3, /create trigger d68_profiles_attach_affiliate_attribution/i);
assert.doesNotMatch(phase3, /insert into public\.affiliate_commissions/i);
assert.doesNotMatch(phase3, /update public\.payment_orders/i);
assert.doesNotMatch(phase3, /create\s+(or replace\s+)?trigger[\s\S]{0,160}(payment|commission)/i);
"""
qa = replace_once(qa, phase2_assert, phase3_assert, 'QA phase3 SQL assertions')
qa = replace_once(
    qa,
    "assert.match(app, /function MarketPartnerGate/);\n",
    "assert.match(app, /function MarketPartnerGate/);\nassert.match(app, /function AffiliateReferralRuntime/);\nassert.match(app, /captureAffiliateReferralFromCurrentPage/);\n",
    'QA App referral assertions',
)
qa = replace_once(
    qa,
    "assert.ok(marketPartners.includes(\"supabase.rpc('d68_update_my_market_partner_bank_account'\"));\n",
    "assert.ok(marketPartners.includes(\"supabase.rpc('d68_update_my_market_partner_bank_account'\"));\nassert.ok(affiliate.includes(\"supabase.rpc('d68_record_affiliate_click'\"));\nassert.ok(affiliate.includes('window.localStorage'));\nassert.ok(affiliate.includes('document.cookie'));\nassert.ok(affiliate.includes(\"url.searchParams.delete('ref')\"));\nassert.doesNotMatch(affiliate, /supabase\.from\(|affiliate_commissions|payment_orders/i);\nassert.ok(authContext.includes('getAffiliateReferralForSignup'));\nassert.ok(authContext.includes('affiliate_code: referral?.code'));\nassert.ok(authContext.includes('affiliate_click_id: referral?.clickId'));\n",
    'QA frontend Phase3 assertions',
)
qa = replace_once(
    qa,
    "assert.match(partnerDashboard, /Phase 2 không tự tính hoặc tạo hoa hồng/);\n",
    "assert.match(partnerDashboard, /Phase 2 không tự tính hoặc tạo hoa hồng/);\nassert.match(partnerDashboard, /Phase 3 đã kích hoạt click và signup attribution/);\nassert.match(partnerDashboard, /Tracking \?ref=CODE đang hoạt động/);\n",
    'QA dashboard Phase3 assertions',
)
qa = replace_once(
    qa,
    '// Execute both migrations against a minimal PostgreSQL fixture in PGlite.',
    '// Execute all three migrations against a minimal PostgreSQL fixture in PGlite.',
    'QA migration comment',
)
qa = replace_once(
    qa,
    "create schema extensions;\ncreate type public.user_role",
    "create schema extensions;\ncreate table auth.users (\n  id uuid primary key,\n  created_at timestamptz not null default now(),\n  raw_user_meta_data jsonb not null default '{}'::jsonb\n);\ncreate type public.user_role",
    'QA auth users fixture',
)
qa = replace_once(
    qa,
    "  await db.exec(phase1);\n  await db.exec(phase2);\n",
    "  await db.exec(phase1);\n  await db.exec(phase2);\n  await db.exec(phase3);\n",
    'QA execute phase3',
)
pattern = re.compile(
    r"  const adminId = '00000000-0000-0000-0000-000000000001';[\s\S]*?  assert\.equal\(storedBank\.rows\[0\]\.bank_account_json\.account_holder, 'QA Partner'\);"
)
replacement = """  const adminId = '00000000-0000-0000-0000-000000000001';
  const customerId = '00000000-0000-0000-0000-000000000002';
  const partnerProfileId = '00000000-0000-0000-0000-000000000003';
  const invalidCustomerId = '00000000-0000-0000-0000-000000000004';
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
  assert.equal(storedBank.rows[0].bank_account_json.account_holder, 'QA Partner');"""
qa, count = pattern.subn(replacement, qa, count=1)
if count != 1:
    raise SystemExit(f'QA integration block: expected 1 match, found {count}')
qa = qa.replace('Phase 1–2 QA: PASS', 'Phase 1–3 QA: PASS')
qa = qa.replace('dedicated login, owner-only dashboard and bank settings verified.', 'dedicated login, referral capture, server-side signup attribution, owner-only dashboard and bank settings verified.')
qa = qa.replace('no Business/Investor Dashboard or automatic payment/commission change.', 'no Business/Investor Dashboard, affiliate discount or automatic payment/commission change.')
qa_path.write_text(qa)
