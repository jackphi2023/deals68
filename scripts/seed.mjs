import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const businesses = JSON.parse(fs.readFileSync(path.join(__dirname, 'businesses.json'), 'utf8'));
const investors = JSON.parse(fs.readFileSync(path.join(__dirname, 'investors.json'), 'utf8'));

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL || 'admin@deals68.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'deals68Admin68!';
if (!url || !service) throw new Error('Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

function safeEmail(prefix, fallbackDomain='deals68.seed') { return `${prefix.replace(/[^a-z0-9._-]/gi,'').toLowerCase()}@${fallbackDomain}`; }
function investorPassword(code) { const suffix = Buffer.from(code).toString('base64').replace(/[^A-Za-z0-9]/g,'').slice(-3) || '68X'; return `deals68${suffix}`; }
async function ensureUser(email, password, metadata={}) {
  const { data: created, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata });
  if (!error && created.user) return created.user;
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = list.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (found) { await supabase.auth.admin.updateUserById(found.id, { password, email_confirm: true, user_metadata: metadata }); return found; }
  throw error;
}
async function upsertProfile(user, role, username, password, extra={}) {
  const row = { id: user.id, role, username, email: user.email, display_name: extra.display_name || username, country_iso2: extra.country_iso2 || 'VN', language_code: role === 'investor' ? 'en' : 'vi', timezone: extra.timezone || 'Asia/Ho_Chi_Minh', status: 'active', dashboard_login_enabled: true, initial_password: password };
  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' });
  if (error) throw error;
  return row;
}
async function createBuckets(){
  await supabase.storage.createBucket('business-files-private', { public: false }).catch(()=>{});
  await supabase.storage.createBucket('business-images-public', { public: true }).catch(()=>{});
}
async function seedQuality(){
  const rows = [
    ['profile_completeness','Độ hoàn thiện hồ sơ','Profile completeness',15,10],['financials_quality','Chất lượng số liệu tài chính','Financial data quality',20,20],['data_confidence','Độ tin cậy nguồn dữ liệu','Data source confidence',15,30],['deal_terms','Điều khoản giao dịch rõ ràng','Deal terms clarity',10,40],['documents','Tài liệu/Data room','Documents and data room',15,50],['valuation_reason','Logic định giá','Valuation rationale',10,60],['growth_margin','Tăng trưởng & biên lợi nhuận','Growth and margin profile',10,70],['admin_review','Đã được admin rà soát','Admin reviewed',5,80]
  ].map(([key,label_vi,label_en,weight,sort_order])=>({key,label_vi,label_en,weight,sort_order,active:true}));
  const { error } = await supabase.from('quality_criteria').upsert(rows, { onConflict:'key' }); if(error) throw error;
}
async function seedAdmin(){ const user=await ensureUser(adminEmail,adminPassword,{role:'admin'}); await upsertProfile(user,'admin','admin',adminPassword,{display_name:'Deals68 Admin'}); console.log('✓ admin', adminEmail, adminPassword); }
async function seedBusinesses(){
  for (const b of businesses) {
    const email = safeEmail(b.username);
    const user = await ensureUser(email, b.password, { role:'business', username:b.username });
    await upsertProfile(user,'business',b.username,b.password,{display_name:b.company_name_private,country_iso2:b.country_iso2});
    const row = { ...b, owner_id:user.id, visible:true, status:'active', financial_input:b.financial_input || {}, quality_breakdown:{seeded:true} };
    delete row.password;
    const { error } = await supabase.from('businesses').upsert(row, { onConflict:'slug' }); if(error) throw error;
  }
  console.log('✓ businesses', businesses.length);
}
function countryToIso2(country){ const map={Vietnam:'VN',Singapore:'SG',Japan:'JP','South Korea':'KR','United States':'US','Hong Kong':'HK',China:'CN',Malaysia:'MY',Indonesia:'ID',Thailand:'TH',Taiwan:'TW',Philippines:'PH',Israel:'IL'}; return map[country] || 'US'; }
async function seedInvestors(){
  let count=0;
  for (const inv of investors) {
    const username = inv.code.toLowerCase().replace('-','_');
    const email = /.+@.+\..+/.test(inv._privateEmail || '') ? inv._privateEmail.toLowerCase() : safeEmail(username);
    const pass = investorPassword(inv.code);
    let user;
    try { user = await ensureUser(email, pass, {role:'investor', username}); } catch (e) { user = await ensureUser(safeEmail(username), pass, {role:'investor', username}); }
    await upsertProfile(user,'investor',username,pass,{display_name: inv._privateName || inv.code, country_iso2: countryToIso2(inv.country), timezone:'UTC'});
    const row = { owner_id:user.id, code:inv.code, username, type:inv.type, title_vi:inv.titleVi, title_en:inv.titleEn, desc_vi:inv.descVi, desc_en:inv.descEn, country_iso2:countryToIso2(inv.country), country:inv.country, region:inv.region, industries:inv.industries || [], deal_types:inv.dealTypes || [], stage:inv.stage, ticket_min:inv.ticketMin || 0, ticket_max:inv.ticketMax || 0, criteria:{ sectors: inv.industries || [], revenueRange:'', ebitdaRange:'', dealTypes:inv.dealTypes || [] }, privacy:{ shareEmail:false, email:inv._privateEmail || '', sharePhone:false, phoneCountry:countryToIso2(inv.country), phone:'' }, private_name:inv._privateName, private_website:inv._privateWebsite, private_email:inv._privateEmail, visible:true, verified:!!inv.verified, admin_priority:!!inv.admin_priority, activity_level:inv.activity_level || 'medium', status:'active' };
    const { error } = await supabase.from('investors').upsert(row, { onConflict:'code' }); if(error) throw error;
    count++;
    if (count % 100 === 0) console.log('  investors', count);
  }
  console.log('✓ investors', count);
}
async function seedPromos(){
  const {data: admin} = await supabase.from('profiles').select('id').eq('role','admin').limit(1).maybeSingle();
  const rows=[{code:'FREE10JULY-DN16',description:'Free promotion for 16 businesses until 10/7/2026',role:'business',discount_pct:100,quota_total:16,quota_used:0,starts_at:'2026-07-03T00:00:00+07:00',ends_at:'2026-07-10T23:59:59+07:00',active:true,created_by:admin?.id},{code:'FREE10JULY-INV16',description:'Free promotion for 16 investors until 10/7/2026',role:'investor',discount_pct:100,quota_total:16,quota_used:0,starts_at:'2026-07-03T00:00:00+07:00',ends_at:'2026-07-10T23:59:59+07:00',active:true,created_by:admin?.id}];
  const { error } = await supabase.from('promo_codes').upsert(rows, { onConflict:'code' }); if(error) throw error; console.log('✓ promos');
}

await createBuckets();
await seedQuality();
await seedAdmin();
await seedBusinesses();
await seedInvestors();
await seedPromos();
console.log('\nDONE. Test accounts:');
console.log(`Admin: ${adminEmail} / ${adminPassword}`);
for (const b of businesses) console.log(`Business: ${b.username} / ${b.password}`);
console.log('Investor example: inv_0001 /', investorPassword('INV-0001'));
