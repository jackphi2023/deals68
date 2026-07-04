import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getInvestorByOwner, listBusinesses } from '../lib/data';
import { supabase } from '../lib/supabase';
import { computeFitScore } from '../lib/scoring';
import { formatCompactMoney, percent } from '../lib/format';

type Tab = 'profile' | 'recommended' | 'watchlist' | 'alerts' | 'contacts' | 'security';
const T = (lang: 'vi' | 'en', vi: string, en: string) => lang === 'en' ? en : vi;
const tabs: { id: Tab; icon: string; vi: string; en: string; href: string }[] = [
  { id: 'profile', icon: '✎', vi: 'Hồ sơ', en: 'Profile', href: '/dashboard/investor/profile' },
  { id: 'recommended', icon: '◆', vi: 'Tiêu chí & gợi ý', en: 'Criteria & matches', href: '/dashboard/investor/recommended' },
  { id: 'watchlist', icon: '★', vi: 'Đã lưu', en: 'Watchlist', href: '/dashboard/investor/saved' },
  { id: 'alerts', icon: '🔔', vi: 'Cảnh báo', en: 'Alerts', href: '/dashboard/investor/alerts' },
  { id: 'contacts', icon: '🔒', vi: 'Liên hệ & bảo mật', en: 'Contacts & privacy', href: '/dashboard/investor/privacy' },
  { id: 'security', icon: '⚙', vi: 'Bảo mật', en: 'Security', href: '/dashboard/investor/security' }
];
const tabMap: Record<string, Tab> = { '': 'profile', profile: 'profile', criteria: 'recommended', recommended: 'recommended', saved: 'watchlist', watchlist: 'watchlist', alerts: 'alerts', privacy: 'contacts', contacts: 'contacts', payments: 'security', security: 'security' };
function resolveTab(pathname: string): Tab { const suffix = pathname.replace('/dashboard/investor','').replace(/^\//,'').split('/')[0]; return tabMap[suffix] || 'profile'; }

const INVESTOR_TYPES = ['VC','PE','Institutional','Corporate/Strategic','Individual/Angel','Family Office','Lender/Debt'];
const INDUSTRIES = ['F&B','Healthcare','Retail','Manufacturing','Technology','Logistics','Education','Real Estate','Seafood & Export','Business Services'];
const DEAL_TYPES = ['Fundraise','M&A','Buyout','Debt','Strategic partnership'];
const STAGES = ['Seed','Series A','Growth','Mature','Buyout'];
const COUNTRIES = ['Vietnam','Singapore','United States','Japan','South Korea','Hong Kong','UAE'];
const inputStyle: CSSProperties = { border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 13px', fontSize: 15, color: '#0F2A4A', background: '#F7FAFC', fontWeight: 500, outline: 'none', width: '100%' };
const cardStyle: CSSProperties = { background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '26px 28px' };
const labelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const labelText: CSSProperties = { fontSize: 12.5, fontWeight: 700, color: '#334155' };

function arr(value: any): string[] { if (Array.isArray(value)) return value.filter(Boolean).map(String); if (!value) return []; return String(value).split(/[;,]/).map((x) => x.trim()).filter(Boolean); }
function chip(active: boolean): CSSProperties { return { border: '1px solid ' + (active ? '#1BADEA' : '#E2E8F0'), background: active ? '#E7F6FD' : '#fff', color: active ? '#1596cc' : '#334155', fontSize: 12.5, fontWeight: 700, padding: '8px 11px', borderRadius: 999, cursor: 'pointer' }; }
function countryVi(c: string) { return c === 'United States' ? 'Hoa Kỳ' : c === 'Japan' ? 'Nhật Bản' : c === 'South Korea' ? 'Hàn Quốc' : c; }
function businessTitle(b: any, lang: 'vi' | 'en') { return lang === 'en' ? (b.title_en || b.title_vi) : (b.title_vi || b.title_en); }
function regionFromCountry(c: string) { if (['United States'].includes(c)) return 'Americas'; if (['UAE'].includes(c)) return 'Middle East'; return 'Asia'; }

export default function InvestorDashboard() {
  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const [tab, setTab] = useState<Tab>(() => resolveTab(location.pathname));
  const [inv, setInv] = useState<any>();
  const [allBiz, setAllBiz] = useState<any[]>([]);
  const [saved, setSaved] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [interests, setInterests] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [c2Industries, setC2Industries] = useState<string[]>([]);
  const [c2RevBand, setC2RevBand] = useState('all');
  const [c2EbBand, setC2EbBand] = useState('all');

  useEffect(() => setTab(resolveTab(location.pathname)), [location.pathname]);

  async function load() {
    if (!profile) return;
    setBusy(true); setLoadError('');
    try {
      const i = await getInvestorByOwner(profile.id);
      setInv(i);
      const biz = await listBusinesses(); setAllBiz(biz || []);
      if (i) {
        const [{ data: s }, { data: p }, { data: r }, { data: int }] = await Promise.all([
          supabase.from('saved_businesses').select('*, businesses(*)').eq('investor_id', i.id).order('created_at', { ascending: false }),
          supabase.from('proposals').select('*, businesses(*)').eq('investor_id', i.id).order('sent_at', { ascending: false }),
          supabase.from('request_data').select('*, businesses(public_code,title_vi,title_en,slug,quality_score)').eq('investor_id', i.id).order('created_at', { ascending: false }),
          supabase.from('investor_interests').select('*, businesses(public_code,title_vi,title_en,slug,quality_score,ask_amount,ask_currency,stake_pct)').eq('investor_id', i.id).order('created_at', { ascending: false })
        ]);
        setSaved(s || []); setProposals(p || []); setRequests(r || []); setInterests(int || []);
        setC2Industries(arr(i.industries).slice(0, 4));
      }
    } catch (e: any) { setLoadError(e?.message || 'Could not load investor dashboard.'); }
    finally { setBusy(false); }
  }

  useEffect(() => { if (!loading && !profile) navigate('/login?next=/dashboard/investor'); if (profile) load(); }, [profile?.id, loading]);

  const recommended = useMemo(() => {
    if (!inv) return [];
    const base = allBiz.map((b) => ({ ...b, fit: computeFitScore(b, inv) }));
    return base.filter((b) => {
      if (c2Industries.length && !c2Industries.some((x) => String(b.industry || '').toLowerCase().includes(x.toLowerCase()))) return false;
      if (c2RevBand === '0-1m' && Number(b.revenue_2025 || 0) > 1_000_000) return false;
      if (c2RevBand === '1-10m' && (Number(b.revenue_2025 || 0) < 1_000_000 || Number(b.revenue_2025 || 0) > 10_000_000)) return false;
      if (c2RevBand === '10m+' && Number(b.revenue_2025 || 0) < 10_000_000) return false;
      if (c2EbBand === '0-10' && Number(b.ebitda_margin || 0) > 10) return false;
      if (c2EbBand === '10-20' && (Number(b.ebitda_margin || 0) < 10 || Number(b.ebitda_margin || 0) > 20)) return false;
      if (c2EbBand === '20+' && Number(b.ebitda_margin || 0) < 20) return false;
      return b.fit >= 20;
    }).sort((a, b) => b.fit - a.fit).slice(0, 12);
  }, [allBiz, inv, c2Industries, c2RevBand, c2EbBand]);

  if (loading) return <section style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 24px' }}><div style={cardStyle}>Loading investor dashboard...</div></section>;
  if (!profile) return <Navigate to="/login?next=/dashboard/investor" replace />;
  if (profile.role !== 'investor' && profile.role !== 'admin') return <section style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px' }}><div style={cardStyle}><h2>Investor access only</h2><p>Role hiện tại: {profile.role}. Dashboard này dành cho nhà đầu tư.</p><Link to="/" style={{ color: '#1596cc', fontWeight: 700 }}>Back home</Link></div></section>;
  if (!inv) return <section style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px' }}><div style={{ ...cardStyle, textAlign: 'center' }}><h2>Investor profile not found</h2><p style={{ color: '#64748B' }}>Tài khoản này chưa có hồ sơ NĐT hoặc đang chờ admin duyệt.</p><Link to="/register/investor" style={{ display: 'inline-block', background: '#0F2A4A', color: '#fff', fontWeight: 700, padding: '12px 22px', borderRadius: 10 }}>Create investor profile</Link></div></section>;

  const invName = lang === 'en' ? (inv.title_en || inv.title_vi || 'Investor') : (inv.title_vi || inv.title_en || 'Nhà đầu tư');
  const invCode = inv.code || 'INV';
  const invIndustries = arr(inv.industries);
  const invDealTypes = arr(inv.deal_types);
  const country = inv.country || inv.country_iso2 || 'Vietnam';
  const privacy = inv.privacy || {};

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const sectors = String(fd.get('industries') || '').split(',').map((x) => x.trim()).filter(Boolean);
    const dealTypes = String(fd.get('deal_types') || '').split(',').map((x) => x.trim()).filter(Boolean);
    const criteria = {
      ...(inv.criteria || {}),
      riskAppetite: fd.get('risk_appetite'),
      returnExpectation: fd.get('return_expectation'),
      preferredDealSize: fd.get('preferred_deal_size'),
      excludedSectors: fd.get('excluded_sectors')
    };
    const { error } = await supabase.from('investors').update({
      title_vi: fd.get('title_vi'), title_en: fd.get('title_en'), desc_vi: fd.get('desc_vi'), desc_en: fd.get('desc_en'),
      type: fd.get('type'), country: fd.get('country'), country_iso2: fd.get('country_iso2'), region: regionFromCountry(String(fd.get('country') || country)),
      industries: sectors, deal_types: dealTypes, stage: fd.get('stage'), ticket_min: Number(fd.get('ticket_min') || 0), ticket_max: Number(fd.get('ticket_max') || 0), criteria
    }).eq('id', inv.id);
    setMsg(error ? error.message : T(lang, 'Đã lưu.', 'Saved.'));
    load();
  }

  async function savePrivacy(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const nextPrivacy = { shareEmail: fd.get('shareEmail') === 'on', email: fd.get('email'), sharePhone: fd.get('sharePhone') === 'on', phone: fd.get('phone'), website: fd.get('website'), shareWebsite: fd.get('shareWebsite') === 'on' };
    const { error } = await supabase.from('investors').update({ privacy: nextPrivacy }).eq('id', inv.id);
    setMsg(error ? error.message : T(lang, 'Đã cập nhật bảo mật liên hệ.', 'Contact privacy updated.'));
    load();
  }

  async function requestMoreData(businessId: string) { const { error } = await supabase.from('request_data').insert({ business_id: businessId, investor_id: inv.id, requested_items: ['IM', 'Financial statements', 'NDA'], note: 'Investor requested more data from dashboard.', status: 'requested' }); setMsg(error ? error.message : 'Data request sent to admin/business.'); load(); }
  async function saveBusiness(businessId: string) { const { error } = await supabase.from('saved_businesses').upsert({ business_id: businessId, investor_id: inv.id }, { onConflict: 'investor_id,business_id' }); setMsg(error ? error.message : 'Saved business.'); load(); }
  async function proposalStatus(row: any, status: string) { const { error } = await supabase.from('proposals').update({ status }).eq('id', row.id); setMsg(error ? error.message : 'Proposal updated.'); load(); }

  function businessCard(b: any) {
    const q = Number(b.quality_score || b.data_confidence || 0);
    return <div key={b.id || b.slug} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', height: 150, background: '#0F2A4A' }}>
        <img src={b.image_url || '/assets/deal1.png'} alt={businessTitle(b, lang)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <span style={{ position: 'absolute', top: 10, left: 10, fontSize: 11.5, fontWeight: 800, padding: '4px 9px', borderRadius: 7, background: q >= 80 ? '#E9F9EF' : '#FEF3D3', color: q >= 80 ? '#16A34A' : '#B8860B' }}>Quality {q}</span>
      </div>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#1596cc', background: '#E7F6FD', padding: '3px 9px', borderRadius: 6, alignSelf: 'flex-start' }}>{b.industry || 'Business'}</span>
        <h3 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35, margin: '9px 0 12px', flex: 1 }}>{businessTitle(b, lang)}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 12, borderTop: '1px solid #EEF2F6', marginBottom: 14 }}><div><div style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>{T(lang,'Doanh thu','Revenue')}</div><div style={{ fontSize: 13.5, fontWeight: 700 }}>{formatCompactMoney(b.revenue_2025, b.revenue_currency)}</div></div><div><div style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>{T(lang,'Gọi vốn','Ask')}</div><div style={{ fontSize: 13.5, fontWeight: 800, color: '#1596cc' }}>{formatCompactMoney(b.ask_amount, b.ask_currency)}</div></div></div>
        <div style={{ display: 'flex', gap: 8 }}><Link to={`/businesses/${b.slug}`} style={{ flex: 1, textAlign: 'center', background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 13, padding: 10, borderRadius: 9 }}>{T(lang,'Xem hồ sơ','View')}</Link><button onClick={() => saveBusiness(b.id)} style={{ border: '1px solid #E2E8F0', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 13, padding: '10px 12px', borderRadius: 9 }}>★</button><button onClick={() => requestMoreData(b.id)} style={{ border: '1px solid #E2E8F0', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 13, padding: '10px 12px', borderRadius: 9 }}>📂</button></div>
      </div>
    </div>;
  }

  return <div style={{ width: '100%', overflowX: 'hidden', background: '#F7FAFC' }}>
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '26px 24px 60px' }}>
      <div style={{ marginBottom: 22, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: 12.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Investor Dashboard</div><h1 style={{ fontSize: 25, fontWeight: 800, letterSpacing: -.5, margin: 0 }}>{invName} <span style={{ fontWeight: 500, color: '#64748B', fontSize: 16 }}>· {inv.type}</span> <span style={{ fontWeight: 500, color: '#B8C4D0', fontSize: 12.5 }}>{invCode}</span></h1></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><button onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} style={{ border: '1px solid #E2E8F0', background: '#fff', borderRadius: 999, padding: '8px 14px', fontWeight: 700 }}>{lang.toUpperCase()}</button><button onClick={() => signOut().then(() => navigate('/'))} style={{ background: '#EEF2F6', color: '#334155', fontWeight: 700, fontSize: 14, padding: '10px 16px', borderRadius: 9, border: 'none' }}>{T(lang,'Thoát','Exit')}</button></div>
      </div>

      <div className="d68-dash-cols" style={{ display: 'grid', gridTemplateColumns: '220px minmax(0,1fr)', gap: 24, alignItems: 'start' }}>
        <nav className="d68-side-nav" style={{ position: 'sticky', top: 90, background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tabs.map((t) => <Link key={t.id} to={t.href} onClick={() => setTab(t.id)} style={{ textAlign: 'left', border: 'none', borderRadius: 10, padding: '11px 12px', fontSize: 13.5, fontWeight: tab === t.id ? 800 : 600, color: tab === t.id ? '#0F2A4A' : '#64748B', background: tab === t.id ? '#E7F6FD' : 'transparent' }}>{t.icon} {T(lang, t.vi, t.en)}</Link>)}
          <div style={{ borderTop: '1px solid #EEF2F6', marginTop: 6, paddingTop: 10 }}><Link to={`/investors/${inv.code}`} style={{ display: 'block', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#1596cc', padding: 10 }}>{T(lang,'Xem public profile','View public profile')} ↗</Link></div>
        </nav>

        <main>
          {loadError ? <div style={{ ...cardStyle, marginBottom: 16, color: '#B91C1C' }}>{loadError}</div> : null}
          {msg ? <div style={{ ...cardStyle, marginBottom: 16, color: '#16A34A', fontWeight: 700 }}>{msg}</div> : null}
          {busy ? <div style={{ ...cardStyle, marginBottom: 16, color: '#64748B' }}>{T(lang,'Đang tải dữ liệu...','Loading data...')}</div> : null}

          {tab === 'profile' ? <form onSubmit={saveProfile} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 6px' }}>{T(lang,'Hồ sơ đầu tư','Investor profile')}</h2><p style={{ fontSize: 13.5, color: '#64748B', margin: '0 0 4px' }}>{T(lang,'Tên thật, website, email luôn ẩn công khai.','Your real name, website and email always stay hidden publicly.')}</p>
            <label style={labelStyle}><span style={labelText}>{T(lang,'Tên nhà đầu tư','Investor name')}</span><input name="title_vi" defaultValue={inv.title_vi || inv.title_en || ''} placeholder="VD: VinaCapital" style={inputStyle} /></label>
            <label style={labelStyle}><span style={labelText}>Investor name EN</span><input name="title_en" defaultValue={inv.title_en || inv.title_vi || ''} style={inputStyle} /></label>
            <div className="d68-form-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}><label style={labelStyle}><span style={labelText}>{T(lang,'Loại nhà đầu tư','Investor type')}</span><select name="type" defaultValue={inv.type || 'Individual/Angel'} style={inputStyle}>{INVESTOR_TYPES.map((x) => <option key={x}>{x}</option>)}</select></label><label style={labelStyle}><span style={labelText}>{T(lang,'Quốc gia','Country')}</span><select name="country" defaultValue={country} style={inputStyle}>{COUNTRIES.map((x) => <option key={x}>{x}</option>)}</select></label></div>
            <input name="country_iso2" type="hidden" defaultValue={inv.country_iso2 || ''} />
            <div className="d68-form-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}><label style={labelStyle}><span style={labelText}>{T(lang,'Ticket tối thiểu (USD)','Min ticket (USD)')}</span><input name="ticket_min" type="number" defaultValue={inv.ticket_min || 0} style={inputStyle} /></label><label style={labelStyle}><span style={labelText}>{T(lang,'Ticket tối đa (USD)','Max ticket (USD)')}</span><input name="ticket_max" type="number" defaultValue={inv.ticket_max || 0} style={inputStyle} /></label></div>
            <label style={labelStyle}><span style={labelText}>{T(lang,'Mô tả ẩn danh công khai','Public anonymous description')}</span><textarea name="desc_vi" defaultValue={inv.desc_vi || ''} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></label>
            <label style={labelStyle}><span style={labelText}>Public anonymous description EN</span><textarea name="desc_en" defaultValue={inv.desc_en || inv.desc_vi || ''} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></label>
            <div style={{ borderTop: '1px solid #EEF2F6', paddingTop: 16 }}><div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F2A4A', marginBottom: 12 }}>{T(lang,'Tiêu chí đầu tư','Investment criteria')}</div><label style={labelStyle}><span style={labelText}>{T(lang,'Ngành quan tâm','Industries of interest')}</span><input name="industries" defaultValue={invIndustries.join(', ')} style={inputStyle} /></label><label style={{ ...labelStyle, marginTop: 14 }}><span style={labelText}>{T(lang,'Loại giao dịch quan tâm','Deal types of interest')}</span><input name="deal_types" defaultValue={invDealTypes.join(', ')} style={inputStyle} /></label><div className="d68-form-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 14 }}><label style={labelStyle}><span style={labelText}>{T(lang,'Giai đoạn ưu tiên','Preferred stage')}</span><select name="stage" defaultValue={inv.stage || 'Growth'} style={inputStyle}>{STAGES.map((x) => <option key={x}>{x}</option>)}</select></label><label style={labelStyle}><span style={labelText}>{T(lang,'Khẩu vị rủi ro','Risk appetite')}</span><select name="risk_appetite" defaultValue={inv.criteria?.riskAppetite || 'balanced'} style={inputStyle}><option value="conservative">{T(lang,'Thận trọng','Conservative')}</option><option value="balanced">{T(lang,'Cân bằng','Balanced')}</option><option value="aggressive">{T(lang,'Tăng trưởng cao','Aggressive')}</option></select></label></div><div className="d68-form-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 14 }}><label style={labelStyle}><span style={labelText}>{T(lang,'Kỳ vọng lợi nhuận (%/năm)','Return expectation (%/yr)')}</span><input name="return_expectation" type="number" defaultValue={inv.criteria?.returnExpectation || ''} style={inputStyle} /></label><label style={labelStyle}><span style={labelText}>{T(lang,'Doanh thu/quy mô giao dịch ưa thích','Preferred revenue/deal size')}</span><input name="preferred_deal_size" defaultValue={inv.criteria?.preferredDealSize || ''} style={inputStyle} /></label></div><label style={{ ...labelStyle, marginTop: 14 }}><span style={labelText}>{T(lang,'Ngành loại trừ','Excluded sectors')}</span><input name="excluded_sectors" defaultValue={inv.criteria?.excludedSectors || ''} style={inputStyle} /></label></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="submit" style={{ background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 14.5, padding: '12px 24px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>{T(lang,'Lưu thay đổi','Save changes')}</button></div>
          </form> : null}

          {tab === 'recommended' ? <><div style={{ ...cardStyle, marginBottom: 20 }}><h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 6px' }}>{T(lang,'Tiêu chí đầu tư','Investment criteria')}</h2><p style={{ fontSize: 13.5, color: '#64748B', margin: '0 0 18px' }}>{T(lang,'Chọn lĩnh vực, quy mô doanh thu và tỷ lệ EBITDA để nhận danh sách doanh nghiệp phù hợp.','Pick sectors, revenue size and EBITDA range to get matching businesses.')}</p><div style={{ marginBottom: 16 }}><span style={{ ...labelText, display: 'block', marginBottom: 8 }}>{T(lang,'Lĩnh vực','Sectors')}</span><div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{INDUSTRIES.map((x) => <button key={x} type="button" onClick={() => setC2Industries((cur) => cur.includes(x) ? cur.filter((i) => i !== x) : [...cur, x])} style={chip(c2Industries.includes(x))}>{x}</button>)}</div></div><div className="d68-form-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'end' }}><label style={labelStyle}><span style={labelText}>{T(lang,'Quy mô doanh thu','Revenue size')}</span><select value={c2RevBand} onChange={(e) => setC2RevBand(e.target.value)} style={inputStyle}><option value="all">Any</option><option value="0-1m">0–1M USD</option><option value="1-10m">1–10M USD</option><option value="10m+">10M+ USD</option></select></label><label style={labelStyle}><span style={labelText}>EBITDA margin</span><select value={c2EbBand} onChange={(e) => setC2EbBand(e.target.value)} style={inputStyle}><option value="all">Any</option><option value="0-10">0–10%</option><option value="10-20">10–20%</option><option value="20+">20%+</option></select></label></div></div>{recommended.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>{recommended.map(businessCard)}</div> : <div style={{ background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 16, padding: '44px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 15, fontWeight: 600 }}>{T(lang,'Chưa có doanh nghiệp phù hợp hiện tại, hãy cập nhật sau.','No matching businesses right now — please check back later.')}</div>}</> : null}

          {tab === 'watchlist' ? <div style={cardStyle}><h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 18px' }}>{T(lang,'Doanh nghiệp đã lưu','Saved businesses')}</h2>{saved.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{saved.map((s) => { const biz = s.businesses || s; return <div key={s.id} style={{ border: '1px solid #EEF2F6', borderRadius: 14, padding: '16px 18px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}><div style={{ flex: 1, minWidth: 200 }}><div style={{ fontSize: 15, fontWeight: 700 }}>{businessTitle(biz, lang)}</div><div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 2 }}>{biz.industry}</div></div><span style={{ fontSize: 14, fontWeight: 800, color: '#1596cc' }}>{computeFitScore(biz, inv)}% Fit</span><Link to={`/businesses/${biz.slug}`} style={{ background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 12.5, padding: '9px 14px', borderRadius: 8 }}>{T(lang,'Xem','View')}</Link><button onClick={() => requestMoreData(biz.id)} style={{ background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 12.5, padding: '9px 14px', borderRadius: 8, border: 'none' }}>📂 {T(lang,'Yêu cầu tài liệu','Request data')}</button></div></div>; })}</div> : <div style={{ textAlign: 'center', padding: '36px 20px', color: '#94A3B8', fontSize: 15, fontWeight: 600 }}>{T(lang,'Chưa lưu doanh nghiệp nào.','No saved businesses yet.')}</div>}</div> : null}

          {tab === 'alerts' ? <div style={cardStyle}><h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 18px' }}>{T(lang,'Tuỳ chọn cảnh báo','Alert options')}</h2><div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}><input type="checkbox" defaultChecked /> {T(lang,'Email khi có doanh nghiệp mới phù hợp','Email me when matching businesses are added')}</label><label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}><input type="checkbox" defaultChecked /> {T(lang,'Email khi business phản hồi yêu cầu data','Email me when a business responds to data request')}</label><label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}><input type="checkbox" /> WhatsApp / Zalo alert</label></div></div> : null}

          {tab === 'contacts' ? <form onSubmit={savePrivacy} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 14 }}><h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 6px' }}>{T(lang,'Liên hệ & bảo mật','Contacts & privacy')}</h2><p style={{ fontSize: 13.5, color: '#64748B', margin: '0 0 8px' }}>{T(lang,'Email không bao giờ hiển thị public; thông tin liên hệ chỉ mở sau khi bạn duyệt proposal.','Email is never public; contact information unlocks only after you approve a proposal.')}</p><label style={labelStyle}><span style={labelText}>Email</span><input name="email" defaultValue={privacy.email || profile.email || ''} style={inputStyle} /></label><label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}><input name="shareEmail" type="checkbox" defaultChecked={privacy.shareEmail} /> {T(lang,'Cho phép chia sẻ email sau khi duyệt kết nối','Allow email sharing after approval')}</label><label style={labelStyle}><span style={labelText}>{T(lang,'Số điện thoại','Phone')}</span><input name="phone" defaultValue={privacy.phone || ''} style={inputStyle} /></label><label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}><input name="sharePhone" type="checkbox" defaultChecked={privacy.sharePhone} /> {T(lang,'Cho phép chia sẻ điện thoại sau khi duyệt','Allow phone sharing after approval')}</label><label style={labelStyle}><span style={labelText}>Website</span><input name="website" defaultValue={privacy.website || ''} style={inputStyle} /></label><label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}><input name="shareWebsite" type="checkbox" defaultChecked={privacy.shareWebsite} /> {T(lang,'Cho phép chia sẻ website sau khi duyệt','Allow website sharing after approval')}</label><button type="submit" style={{ alignSelf: 'flex-end', background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 14.5, padding: '12px 24px', borderRadius: 10, border: 'none' }}>{T(lang,'Lưu bảo mật','Save privacy')}</button></form> : null}

          {tab === 'security' ? <div style={cardStyle}><h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 18px' }}>{T(lang,'Bảo mật tài khoản','Account security')}</h2><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}><div style={{ border: '1px solid #EEF2F6', borderRadius: 14, padding: 18 }}><b>{T(lang,'Trạng thái tài khoản','Account status')}</b><div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>{profile.status || 'active'}</div></div><div style={{ border: '1px solid #EEF2F6', borderRadius: 14, padding: 18 }}><b>{T(lang,'Hồ sơ public','Public profile')}</b><div style={{ marginTop: 8 }}><Link to={`/investors/${inv.code}`} style={{ color: '#1596cc', fontWeight: 700 }}>{T(lang,'Xem hồ sơ','View profile')} ↗</Link></div></div></div><div style={{ marginTop: 18 }}>{proposals.length ? <div><h3>Proposals</h3>{proposals.map((p) => <div key={p.id} style={{ borderTop: '1px solid #EEF2F6', padding: '12px 0', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ flex: 1 }}>{businessTitle(p.businesses || {}, lang)}</span><button onClick={() => proposalStatus(p, 'approved')} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px' }}>Approve</button><button onClick={() => proposalStatus(p, 'rejected')} style={{ background: '#F1F5F9', color: '#334155', border: 'none', borderRadius: 8, padding: '8px 12px' }}>Reject</button></div>)}</div> : <p style={{ color: '#64748B' }}>{T(lang,'Chưa có proposal.','No proposals yet.')}</p>}{requests.length || interests.length ? <p style={{ color: '#64748B' }}>{T(lang, `Có ${requests.length} yêu cầu data và ${interests.length} kết nối quan tâm.`, `${requests.length} data requests and ${interests.length} interest connections.`)}</p> : null}</div></div> : null}
        </main>
      </div>
    </div>
  </div>;
}
