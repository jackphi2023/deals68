import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getInvestorByOwner, listBusinesses } from '../lib/data';
import { supabase } from '../lib/supabase';
import { computeFitScore } from '../lib/scoring';
import { formatCompactMoney } from '../lib/format';

type Lang = 'vi' | 'en';
type Tab = 'profile' | 'recommended' | 'watchlist' | 'alerts' | 'contacts' | 'security';
const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
const tabs: { id: Tab; icon: string; vi: string; en: string; href: string }[] = [
  { id: 'profile', icon: '✎', vi: 'Hồ sơ', en: 'Profile', href: '/dashboard/investor/profile' },
  { id: 'recommended', icon: '◆', vi: 'Tiêu chí & gợi ý', en: 'Criteria & matches', href: '/dashboard/investor/recommended' },
  { id: 'watchlist', icon: '★', vi: 'Đã lưu', en: 'Watchlist', href: '/dashboard/investor/saved' },
  { id: 'alerts', icon: '🔔', vi: 'Cảnh báo', en: 'Alerts', href: '/dashboard/investor/alerts' },
  { id: 'contacts', icon: '🔒', vi: 'Liên hệ & bảo mật', en: 'Contacts & privacy', href: '/dashboard/investor/privacy' },
  { id: 'security', icon: '⚙', vi: 'Bảo mật', en: 'Security', href: '/dashboard/investor/security' }
];
const tabMap: Record<string, Tab> = { '': 'profile', profile: 'profile', criteria: 'recommended', recommended: 'recommended', saved: 'watchlist', watchlist: 'watchlist', alerts: 'alerts', privacy: 'contacts', contacts: 'contacts', security: 'security' };
const INVESTOR_TYPES = ['VC','PE','Institutional','Corporate/Strategic','Individual/Angel','Family Office','Lender/Debt'];
const INDUSTRIES = ['F&B','Y tế & Sức khỏe','Bán lẻ','Sản xuất','Công nghệ','Logistics','Giáo dục','Bất động sản','Thủy sản & Xuất khẩu','Business Services'];
const DEAL_TYPES = ['Gọi vốn','M&A','Bán cổ phần','Vay vốn','JV / Đối tác'];
const STAGES = ['Seed','Series A','Growth','Mature','Buyout'];
const COUNTRIES = ['Việt Nam','Singapore','United States','Japan','South Korea','Hong Kong','UAE'];
function resolveTab(pathname: string): Tab { const suffix = pathname.replace('/dashboard/investor','').replace(/^\//,'').split('/')[0]; return tabMap[suffix] || 'profile'; }
function arr(value: any): string[] { if (Array.isArray(value)) return value.filter(Boolean).map(String); if (!value) return []; return String(value).split(/[;,]/).map((x) => x.trim()).filter(Boolean); }
function businessTitle(b: any, lang: Lang) { return lang === 'en' ? (b.title_en || b.title_vi || b.public_code) : (b.title_vi || b.title_en || b.public_code); }
function countryIsoFromName(c: string) { const m: Record<string,string> = { 'Việt Nam':'VN', Vietnam:'VN', Singapore:'SG', 'United States':'US', Japan:'JP', 'South Korea':'KR', 'Hong Kong':'HK', UAE:'AE' }; return m[c] || ''; }
function regionFromCountry(c: string) { if (['United States'].includes(c)) return 'americas'; if (['UAE'].includes(c)) return 'mideast'; return 'asia'; }

export default function InvestorDashboard() {
  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [lang, setLang] = useState<Lang>('vi');
  const [tab, setTab] = useState<Tab>(() => resolveTab(location.pathname));
  const [inv, setInv] = useState<any>(null);
  const [allBiz, setAllBiz] = useState<any[]>([]);
  const [saved, setSaved] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [interests, setInterests] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [filterIndustries, setFilterIndustries] = useState<string[]>([]);
  const [revBand, setRevBand] = useState('all');
  const [ebBand, setEbBand] = useState('all');

  useEffect(() => setTab(resolveTab(location.pathname)), [location.pathname]);

  async function load() {
    if (!profile) return;
    setBusy(true); setErr('');
    try {
      const i = await getInvestorByOwner(profile.id);
      setInv(i);
      const biz = await listBusinesses({ limit: 60 });
      setAllBiz(biz || []);
      if (i) {
        const [{ data: s }, { data: r }, { data: int }] = await Promise.all([
          supabase.from('saved_businesses').select('*, businesses(public_code,title_vi,title_en,slug,quality_score,industry,revenue_2025,revenue_currency,ask_amount,ask_currency,image_url)').eq('investor_id', i.id).order('created_at', { ascending: false }),
          supabase.from('request_data').select('*, businesses(public_code,title_vi,title_en,slug,quality_score)').eq('investor_id', i.id).order('created_at', { ascending: false }),
          supabase.from('investor_interests').select('*, businesses(public_code,title_vi,title_en,slug,quality_score,ask_amount,ask_currency,stake_pct)').eq('investor_id', i.id).order('created_at', { ascending: false })
        ]);
        setSaved(s || []); setRequests(r || []); setInterests(int || []);
        setFilterIndustries(arr(i.industries).slice(0, 4));
      }
    } catch (e: any) { setErr(e?.message || 'Could not load investor dashboard.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (!loading && !profile) navigate('/login?next=/dashboard/investor'); if (profile) load(); }, [profile?.id, loading]);

  const recommended = useMemo(() => {
    if (!inv) return [];
    return allBiz.map((b) => ({ ...b, fit: computeFitScore(b, inv) })).filter((b) => {
      if (filterIndustries.length && !filterIndustries.some((x) => String(b.industry || '').toLowerCase().includes(x.toLowerCase()))) return false;
      const rev = Number(b.revenue_2025 || 0);
      const cur = String(b.revenue_currency || 'VND');
      const revUsd = cur === 'USD' ? rev : rev / 26000;
      if (revBand === '0-1m' && revUsd > 1_000_000) return false;
      if (revBand === '1-10m' && (revUsd < 1_000_000 || revUsd > 10_000_000)) return false;
      if (revBand === '10m+' && revUsd < 10_000_000) return false;
      const eb = Number(b.ebitda_margin || 0);
      if (ebBand === '0-10' && eb > 10) return false;
      if (ebBand === '10-20' && (eb < 10 || eb > 20)) return false;
      if (ebBand === '20+' && eb < 20) return false;
      return b.fit >= 20;
    }).sort((a, b) => b.fit - a.fit).slice(0, 12);
  }, [allBiz, inv, filterIndustries, revBand, ebBand]);

  if (loading) return <main className="d68-dashboard-page"><div className="d68-dashboard-wrap"><div className="d68-dashboard-card">Loading investor dashboard...</div></div></main>;
  if (!profile) return <Navigate to="/login?next=/dashboard/investor" replace />;
  if (profile.role !== 'investor' && profile.role !== 'admin') return <main className="d68-dashboard-page"><div className="d68-dashboard-wrap"><div className="d68-dashboard-card"><h2>Investor access only</h2><p>Role hiện tại: {profile.role}</p><Link to="/">Back home</Link></div></div></main>;
  if (!inv) return <main className="d68-dashboard-page"><div className="d68-dashboard-wrap"><div className="d68-dashboard-card" style={{ textAlign: 'center' }}><h2>{T(lang, 'Chưa có hồ sơ nhà đầu tư', 'Investor profile not found')}</h2><p>{T(lang, 'Tài khoản này chưa có hồ sơ NĐT hoặc đang chờ Admin duyệt.', 'This account has no investor profile yet or is pending Admin review.')}</p><Link to="/register/investor" className="d68-dashboard-btn">{T(lang, 'Tạo hồ sơ NĐT', 'Create investor profile')}</Link></div></div></main>;

  const invName = lang === 'en' ? (inv.title_en || inv.title_vi || 'Investor') : (inv.title_vi || inv.title_en || 'Nhà đầu tư');
  const pendingProfile = inv.privacy?.pending_profile_changes;
  const invIndustries = arr(inv.industries);
  const invDealTypes = arr(inv.deal_types);
  const country = inv.country || 'Việt Nam';

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const sectors = String(fd.get('industries') || '').split(',').map((x) => x.trim()).filter(Boolean);
    const dealTypes = String(fd.get('deal_types') || '').split(',').map((x) => x.trim()).filter(Boolean);
    const next = {
      title_vi: String(fd.get('title_vi') || '').trim(),
      title_en: String(fd.get('title_en') || '').trim(),
      desc_vi: String(fd.get('desc_vi') || '').trim(),
      desc_en: String(fd.get('desc_en') || '').trim(),
      type: String(fd.get('type') || '').trim(),
      country: String(fd.get('country') || '').trim(),
      country_iso2: countryIsoFromName(String(fd.get('country') || '')) || inv.country_iso2,
      region: regionFromCountry(String(fd.get('country') || country)),
      industries: sectors,
      deal_types: dealTypes,
      stage: String(fd.get('stage') || '').trim(),
      ticket_min: Number(fd.get('ticket_min') || 0),
      ticket_max: Number(fd.get('ticket_max') || 0),
      criteria: { ...(inv.criteria || {}), riskAppetite: fd.get('risk_appetite'), returnExpectation: fd.get('return_expectation'), preferredDealSize: fd.get('preferred_deal_size'), excludedSectors: fd.get('excluded_sectors') }
    };
    const privacy = { ...(inv.privacy || {}), pending_profile_changes: next, pending_submitted_at: new Date().toISOString() };
    const privatePatch = {
      privacy,
      private_name: String(fd.get('private_name') || '').trim(),
      private_website: String(fd.get('private_website') || '').trim()
    };
    const { error } = await supabase.from('investors').update(privatePatch).eq('id', inv.id);
    setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã lưu thay đổi, chờ Admin duyệt để hiển thị các cập nhật và đảm bảo luôn ẩn danh.', 'Saved changes, pending Admin approval to display updates while keeping the profile anonymous.'));
    load();
  }
  async function savePrivacy(e: FormEvent) { e.preventDefault(); const fd = new FormData(e.currentTarget as HTMLFormElement); const privacy = { ...(inv.privacy || {}), shareEmail: fd.get('shareEmail') === 'on', email: fd.get('email'), sharePhone: fd.get('sharePhone') === 'on', phone: fd.get('phone'), website: fd.get('website'), shareWebsite: fd.get('shareWebsite') === 'on' }; const { error } = await supabase.from('investors').update({ privacy, private_email: fd.get('email'), private_phone: fd.get('phone'), private_website: fd.get('website') }).eq('id', inv.id); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã cập nhật bảo mật liên hệ.', 'Contact privacy updated.')); load(); }
  async function requestMoreData(businessId: string) { const { error } = await supabase.from('request_data').insert({ business_id: businessId, investor_id: inv.id, requested_items: ['IM', 'Financial statements', 'NDA'], note: 'Investor requested more data from dashboard.', status: 'pending' }); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã gửi yêu cầu dữ liệu.', 'Data request sent.')); load(); }
  async function saveBusiness(businessId: string) { const { error } = await supabase.from('saved_businesses').upsert({ business_id: businessId, investor_id: inv.id }, { onConflict: 'investor_id,business_id' }); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã lưu doanh nghiệp.', 'Business saved.')); load(); }

  function businessCard(b: any) { const q = Number(b.quality_score || b.data_confidence || 0); return <article key={b.id || b.slug} className="d68-match-card"><div className="d68-match-card__media">{b.image_url ? <img src={b.image_url} alt={businessTitle(b, lang)} /> : null}<span>Fit {b.fit ?? q}</span></div><div className="d68-match-card__body"><span className="d68-dashboard-badge blue" style={{ alignSelf: 'flex-start' }}>{b.industry || 'Business'}</span><h3>{businessTitle(b, lang)}</h3><div className="d68-match-card__metrics"><div><small>{T(lang,'Doanh thu','Revenue')}</small><b>{formatCompactMoney(b.revenue_2025, b.revenue_currency)}</b></div><div><small>{T(lang,'Nhu cầu','Ask')}</small><b>{formatCompactMoney(b.ask_amount, b.ask_currency)}</b></div></div><div style={{ display: 'flex', gap: 8 }}><Link to={`/businesses/${b.slug}`} className="d68-dashboard-btn" style={{ flex: 1, textAlign: 'center' }}>{T(lang,'Xem hồ sơ','View')}</Link><button onClick={() => saveBusiness(b.id)} className="d68-dashboard-btn light">★</button><button onClick={() => requestMoreData(b.id)} className="d68-dashboard-btn light">📂</button></div></div></article>; }

  return <main className="d68-dashboard-page"><div className="d68-dashboard-wrap"><header className="d68-dashboard-head"><div><div className="d68-dashboard-kicker">Investor Dashboard</div><h1>{invName} <span className="d68-dashboard-muted" style={{ fontSize: 16, fontWeight: 500 }}>· {inv.type}</span> <span className="d68-dashboard-mini">{inv.code}</span></h1></div><div className="d68-dashboard-actions"><button onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} className="d68-dashboard-btn light">{lang.toUpperCase()}</button><button onClick={() => signOut().then(() => navigate('/'))} className="d68-dashboard-btn light" style={{ background: '#475569', color: '#fff', borderColor: '#334155' }}>{T(lang,'Thoát','Exit')}</button></div></header>{msg ? <div className="d68-dashboard-notice ok">{msg}</div> : null}{err ? <div className="d68-dashboard-notice err">{err}</div> : null}{busy ? <div className="d68-dashboard-notice warn">{T(lang,'Đang tải dữ liệu...','Loading data...')}</div> : null}{pendingProfile ? <div className="d68-dashboard-notice warn">{T(lang,'Có thay đổi hồ sơ đang chờ Admin duyệt. Public profile vẫn dùng bản đang được duyệt trước đó.', 'Profile changes are pending Admin review. Public profile still uses the current approved data.')}</div> : null}<div className="d68-dashboard-cols"><nav className="d68-dashboard-side">{tabs.map((t) => <Link key={t.id} to={t.href} onClick={() => setTab(t.id)} className={tab === t.id ? 'active' : ''}>{t.icon} {T(lang,t.vi,t.en)}</Link>)}<div style={{ borderTop: '1px solid #EEF2F6', marginTop: 6, paddingTop: 10 }}><Link to={`/investors/${inv.code}`} style={{ textAlign: 'center', color: '#1596cc' }}>{T(lang,'Xem public profile','View public profile')} ↗</Link></div></nav><section>
    {tab === 'profile' ? <form onSubmit={saveProfile} className="d68-dashboard-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><h2>{T(lang,'Hồ sơ đầu tư','Investor profile')}</h2><label className="d68-dashboard-field"><span>{T(lang,'Tên Quỹ đầu tư / Nhà đầu tư — nội bộ, không public','Fund / investor name — internal, not public')}</span><input className="d68-dashboard-input" name="private_name" defaultValue={inv.private_name || inv.privacy?.private_name || ''}/></label><label className="d68-dashboard-field"><span>Website</span><input className="d68-dashboard-input" name="private_website" defaultValue={inv.private_website || inv.privacy?.website || ''}/></label><label className="d68-dashboard-field"><span>{T(lang,'Tên nhà đầu tư public','Public investor title')}</span><input className="d68-dashboard-input" name="title_vi" defaultValue={pendingProfile?.title_vi || inv.title_vi || inv.title_en || ''}/></label><label className="d68-dashboard-field"><span>Investor title EN</span><input className="d68-dashboard-input" name="title_en" defaultValue={pendingProfile?.title_en || inv.title_en || inv.title_vi || ''}/></label><div className="d68-dashboard-form2"><label className="d68-dashboard-field"><span>{T(lang,'Loại nhà đầu tư','Investor type')}</span><select className="d68-dashboard-input" name="type" defaultValue={pendingProfile?.type || inv.type || 'Individual/Angel'}>{INVESTOR_TYPES.map((x) => <option key={x}>{x}</option>)}</select></label><label className="d68-dashboard-field"><span>{T(lang,'Quốc gia','Country')}</span><select className="d68-dashboard-input" name="country" defaultValue={pendingProfile?.country || country}>{COUNTRIES.map((x) => <option key={x}>{x}</option>)}</select></label><label className="d68-dashboard-field"><span>Ticket min (USD)</span><input className="d68-dashboard-input" name="ticket_min" type="number" defaultValue={pendingProfile?.ticket_min || inv.ticket_min || 0}/></label><label className="d68-dashboard-field"><span>Ticket max (USD)</span><input className="d68-dashboard-input" name="ticket_max" type="number" defaultValue={pendingProfile?.ticket_max || inv.ticket_max || 0}/></label></div><label className="d68-dashboard-field"><span>{T(lang,'Mô tả ẩn danh công khai','Public anonymous description')}</span><textarea className="d68-dashboard-input d68-dashboard-textarea" name="desc_vi" defaultValue={pendingProfile?.desc_vi || inv.desc_vi || ''}/></label><label className="d68-dashboard-field"><span>Public anonymous description EN</span><textarea className="d68-dashboard-input d68-dashboard-textarea" name="desc_en" defaultValue={pendingProfile?.desc_en || inv.desc_en || inv.desc_vi || ''}/></label><label className="d68-dashboard-field"><span>{T(lang,'Ngành quan tâm','Industries of interest')}</span><input className="d68-dashboard-input" name="industries" defaultValue={(pendingProfile?.industries || invIndustries).join(', ')}/></label><label className="d68-dashboard-field"><span>{T(lang,'Loại giao dịch quan tâm','Deal types of interest')}</span><input className="d68-dashboard-input" name="deal_types" defaultValue={(pendingProfile?.deal_types || invDealTypes).join(', ')}/></label><div className="d68-dashboard-form2"><label className="d68-dashboard-field"><span>{T(lang,'Giai đoạn ưu tiên','Preferred stage')}</span><select className="d68-dashboard-input" name="stage" defaultValue={pendingProfile?.stage || inv.stage || 'Growth'}>{STAGES.map((x) => <option key={x}>{x}</option>)}</select></label><label className="d68-dashboard-field"><span>{T(lang,'Khẩu vị rủi ro','Risk appetite')}</span><select className="d68-dashboard-input" name="risk_appetite" defaultValue={pendingProfile?.criteria?.riskAppetite || inv.criteria?.riskAppetite || 'balanced'}><option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="aggressive">Aggressive</option></select></label><label className="d68-dashboard-field"><span>{T(lang,'Kỳ vọng lợi nhuận','Return expectation')}</span><input className="d68-dashboard-input" name="return_expectation" defaultValue={pendingProfile?.criteria?.returnExpectation || inv.criteria?.returnExpectation || ''}/></label><label className="d68-dashboard-field"><span>{T(lang,'Quy mô ưa thích','Preferred deal size')}</span><input className="d68-dashboard-input" name="preferred_deal_size" defaultValue={pendingProfile?.criteria?.preferredDealSize || inv.criteria?.preferredDealSize || ''}/></label></div><label className="d68-dashboard-field"><span>{T(lang,'Ngành loại trừ','Excluded sectors')}</span><input className="d68-dashboard-input" name="excluded_sectors" defaultValue={pendingProfile?.criteria?.excludedSectors || inv.criteria?.excludedSectors || ''}/></label><p>{T(lang,'Public profile không đổi ngay. Admin duyệt để hiển thị các cập nhật, đảm bảo luôn ẩn danh.', 'Public profile does not change immediately. Admin approval is required to display updates while keeping the profile anonymous.')}</p><div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="d68-dashboard-btn">{T(lang,'Lưu & gửi Admin duyệt','Save & submit to Admin')}</button></div></form> : null}
    {tab === 'recommended' ? <><div className="d68-dashboard-card" style={{ marginBottom: 18 }}><h2>{T(lang,'Tiêu chí & gợi ý','Criteria & matches')}</h2><p>{T(lang,'Chọn bộ lọc để tìm doanh nghiệp phù hợp theo dữ liệu public.', 'Use filters to find matching businesses from public data.')}</p><div className="d68-chip-select">{INDUSTRIES.map((x) => <button key={x} type="button" className={filterIndustries.includes(x) ? 'active' : ''} onClick={() => setFilterIndustries((cur) => cur.includes(x) ? cur.filter((i) => i !== x) : [...cur, x])}>{x}</button>)}</div><div className="d68-dashboard-form2" style={{ marginTop: 16 }}><label className="d68-dashboard-field"><span>{T(lang,'Quy mô doanh thu','Revenue size')}</span><select className="d68-dashboard-input" value={revBand} onChange={(e) => setRevBand(e.target.value)}><option value="all">Any</option><option value="0-1m">0–1M USD</option><option value="1-10m">1–10M USD</option><option value="10m+">10M+ USD</option></select></label><label className="d68-dashboard-field"><span>EBITDA margin</span><select className="d68-dashboard-input" value={ebBand} onChange={(e) => setEbBand(e.target.value)}><option value="all">Any</option><option value="0-10">0–10%</option><option value="10-20">10–20%</option><option value="20+">20%+</option></select></label></div></div>{recommended.length ? <div className="d68-dashboard-grid3">{recommended.map(businessCard)}</div> : <div className="d68-dashboard-empty">{T(lang,'Chưa có doanh nghiệp phù hợp.','No matching businesses yet.')}</div>}</> : null}
    {tab === 'watchlist' ? <Rows title={T(lang,'Doanh nghiệp đã lưu','Saved businesses')} rows={saved} empty={T(lang,'Chưa lưu doanh nghiệp nào.','No saved businesses yet.')} /> : null}
    {tab === 'alerts' ? <Rows title={T(lang,'Yêu cầu dữ liệu / tương tác','Data requests / interactions')} rows={[...requests, ...interests]} empty={T(lang,'Chưa có cảnh báo.','No alerts yet.')} /> : null}
    {tab === 'contacts' ? <form onSubmit={savePrivacy} className="d68-dashboard-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><h2>{T(lang,'Liên hệ & bảo mật','Contacts & privacy')}</h2><p>{T(lang,'Các thông tin này không hiển thị public trừ khi Admin/workflow cho phép.', 'These details are not public unless approved by Admin/workflow.')}</p><label className="d68-dashboard-field"><span>Email</span><input className="d68-dashboard-input" name="email" defaultValue={inv.privacy?.email || inv.private_email || ''}/></label><label><input name="shareEmail" type="checkbox" defaultChecked={!!inv.privacy?.shareEmail}/> {T(lang,'Cho phép chia sẻ email sau khi kết nối được duyệt','Allow email sharing after approved connection')}</label><label className="d68-dashboard-field"><span>Phone</span><input className="d68-dashboard-input" name="phone" defaultValue={inv.privacy?.phone || inv.private_phone || ''}/></label><label><input name="sharePhone" type="checkbox" defaultChecked={!!inv.privacy?.sharePhone}/> {T(lang,'Cho phép chia sẻ số điện thoại sau khi kết nối được duyệt','Allow phone sharing after approved connection')}</label><label className="d68-dashboard-field"><span>Website</span><input className="d68-dashboard-input" name="website" defaultValue={inv.privacy?.website || inv.private_website || ''}/></label><label><input name="shareWebsite" type="checkbox" defaultChecked={!!inv.privacy?.shareWebsite}/> {T(lang,'Cho phép chia sẻ website sau khi kết nối được duyệt','Allow website sharing after approved connection')}</label><div><button className="d68-dashboard-btn">{T(lang,'Lưu bảo mật','Save privacy')}</button></div></form> : null}
    {tab === 'security' ? <div className="d68-dashboard-card"><h2>{T(lang,'Bảo mật','Security')}</h2><p>{T(lang,'Đổi mật khẩu qua luồng quên mật khẩu để Supabase gửi email xác thực.', 'Change password through the forgot password flow so Supabase sends a verified email.')}</p><Link to="/forgot-password?role=investor" className="d68-dashboard-btn">{T(lang,'Đặt lại mật khẩu','Reset password')}</Link></div> : null}
  </section></div></div></main>;
}
function Rows({ title, rows, empty }: any) { return <div className="d68-dashboard-card"><h2>{title}</h2>{rows.length ? rows.map((r: any) => <div key={r.id} className="d68-dashboard-row"><div style={{ flex: 1 }}><b>{r.businesses?.title_vi || r.businesses?.title_en || r.businesses?.public_code || r.id}</b><div className="d68-dashboard-mini">{r.status || 'pending'} · {new Date(r.created_at).toLocaleString()}</div></div></div>) : <div className="d68-dashboard-empty">{empty}</div>}</div>; }
