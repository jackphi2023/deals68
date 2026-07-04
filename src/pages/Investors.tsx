import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { countInvestors, listInvestors } from '../lib/data';
import { formatCompactMoney } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
const PAGE_SIZE = 12;
const investorTypes = ['VC', 'PE', 'Institutional', 'Corporate/Strategic', 'Individual/Angel', 'Family Office', 'Lender/Debt'];
const regions = ['asia', 'americas', 'europe', 'oceania', 'mideast'];
const countries = ['VN', 'SG', 'US', 'JP', 'KR', 'HK', 'AU', 'DE', 'CA'];

type Investor = {
  id: string;
  code: string;
  type: string;
  titleVi: string;
  titleEn: string;
  descVi: string;
  descEn: string;
  country: string;
  region: string;
  industries: string[];
  dealTypes: string[];
  stage: string;
  ticketMin: number;
  ticketMax: number;
  verified: boolean;
  activity: string;
};

function arr(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (!v) return [];
  return String(v).split(/[;,]/).map((x) => x.trim()).filter(Boolean);
}
function normalize(inv: any): Investor {
  const code = inv.code || inv.username || inv.id;
  const titleVi = inv.title_vi || code || 'Hồ sơ nhà đầu tư đang cập nhật';
  return {
    id: String(inv.id || code), code: String(code), type: inv.type || 'Investor',
    titleVi, titleEn: inv.title_en || titleVi, descVi: inv.desc_vi || '', descEn: inv.desc_en || inv.desc_vi || '',
    country: inv.country || inv.country_iso2 || 'Global', region: inv.region || 'global',
    industries: arr(inv.industries), dealTypes: arr(inv.deal_types), stage: inv.stage || 'Any',
    ticketMin: Number(inv.ticket_min || 0), ticketMax: Number(inv.ticket_max || 0), verified: inv.verified === true,
    activity: inv.activity_level || (inv.verified ? 'medium' : 'pending')
  };
}
function regionLabel(lang: Lang, r: string) {
  const v = String(r || '').toLowerCase();
  if (v.includes('america')) return T(lang, 'Châu Mỹ', 'Americas');
  if (v.includes('europe')) return T(lang, 'Châu Âu', 'Europe');
  if (v.includes('oceania')) return T(lang, 'Châu Úc', 'Oceania');
  if (v.includes('middle') || v.includes('mideast')) return T(lang, 'Trung Đông', 'Middle East');
  if (v.includes('asia')) return T(lang, 'Châu Á', 'Asia');
  return 'Global';
}
function ticket(i: Investor) {
  if (!i.ticketMin && !i.ticketMax) return 'TBD';
  return `${formatCompactMoney(i.ticketMin, 'USD')} – ${formatCompactMoney(i.ticketMax, 'USD')}`;
}
function Skeleton() { return <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 14, padding: 20 }}><div style={{ height: 18, width: '55%', background: '#EEF2F6', borderRadius: 8 }} /><div style={{ height: 12, width: '86%', background: '#EEF2F6', borderRadius: 8, marginTop: 14 }} /><div style={{ height: 38, width: '100%', background: '#EEF2F6', borderRadius: 10, marginTop: 18 }} /></div>; }
function InvestorCard({ inv, lang, onProposal }: { inv: Investor; lang: Lang; onProposal: () => void }) {
  return <article style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 14, padding: 20, display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
    <div style={{ width: 46, height: 46, borderRadius: 12, background: '#E7F6FD', color: '#1596cc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{inv.type.slice(0,2).toUpperCase()}</div>
    <div style={{ flex: 1, minWidth: 240 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}><span style={{ fontSize: 12, fontWeight: 700, color: '#1596cc', background: '#E7F6FD', padding: '4px 9px', borderRadius: 6 }}>{inv.type}</span><span style={{ fontSize: 12, fontWeight: 700, color: '#64748B', background: '#F1F5F9', padding: '4px 9px', borderRadius: 6 }}>📍 {inv.country}</span>{inv.verified ? <span style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', background: '#E9F9EF', padding: '4px 9px', borderRadius: 6 }}>✓ Verified</span> : null}</div>
      <h3 style={{ margin: '0 0 6px', fontSize: 16, lineHeight: 1.35 }}>{T(lang, inv.titleVi, inv.titleEn)}</h3>
      <p style={{ margin: '0 0 12px', color: '#64748B', fontSize: 13.5, lineHeight: 1.55 }}>{T(lang, inv.descVi || 'Hồ sơ ẩn danh đang được cập nhật tiêu chí đầu tư.', inv.descEn || 'Anonymous profile updating investment criteria.')}</p>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: '#475569', fontSize: 12.5 }}><span><b>Ticket:</b> {ticket(inv)}</span><span><b>{T(lang,'Ngành','Industries')}:</b> {inv.industries.join(', ') || 'TBD'}</span><span><b>{T(lang,'Giai đoạn','Stage')}:</b> {inv.stage}</span></div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}><Link to={`/investors/${inv.code}`} style={{ textAlign: 'center', border: '1px solid #E2E8F0', color: '#334155', fontWeight: 700, fontSize: 13.5, padding: '10px 14px', borderRadius: 9 }}>{T(lang, 'Xem chi tiết', 'View detail')}</Link><button onClick={onProposal} style={{ border: 'none', background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 13.5, padding: '10px 14px', borderRadius: 9 }}>{T(lang, 'Gửi hồ sơ DN', 'Send business proposal')}</button></div>
  </article>;
}

export default function Investors({ lang }: { lang: Lang }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('');
  const [industry, setIndustry] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true); setError('');
      const filters = { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, type: type || undefined, region: region || undefined, country: country || undefined, industry: industry || undefined };
      try {
        const [data, cnt] = await Promise.all([listInvestors(filters), countInvestors(filters).catch(() => null)]);
        if (!live) return;
        setItems((data || []).map(normalize)); setTotal(cnt);
      } catch (e: any) {
        if (!live) return;
        setItems([]); setTotal(0); setError(e?.message || T(lang, 'Không tải được dữ liệu nhà đầu tư.', 'Could not load investors.'));
      } finally { if (live) setLoading(false); }
    }
    load();
    return () => { live = false; };
  }, [page, type, region, country, industry, lang]);

  const pages = useMemo(() => total === null ? null : Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  function proposal() { if (!profile) navigate('/register/business'); else if (profile.role !== 'business') setFeedback(T(lang, 'Chỉ tài khoản Doanh nghiệp được gửi proposal.', 'Only Business accounts can send proposals.')); else setFeedback(T(lang, 'Proposal sẽ được gửi từ dashboard doanh nghiệp ở bước tiếp theo.', 'Proposal will be sent from the Business dashboard in the next step.')); }

  return <main style={{ background: '#F7FAFC', minHeight: '70vh' }}>
    <section style={{ maxWidth: 1240, margin: '0 auto', padding: '34px 24px 18px' }}>
      <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 12 }}><Link to="/">{T(lang, 'Trang chủ', 'Home')}</Link> › <b style={{ color: '#475569' }}>{T(lang, 'Nhà đầu tư', 'Investors')}</b></div>
      <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -.8, margin: '0 0 8px' }}>{T(lang, 'Nhà đầu tư trên Deals68', 'Investors on Deals68')}</h1>
      <p style={{ color: '#64748B', maxWidth: 820, lineHeight: 1.6, margin: 0 }}>{T(lang, 'Danh sách lấy từ Supabase active/visible, không dùng hồ sơ nhà đầu tư giả khi tải lỗi.', 'List is loaded from active/visible Supabase records; no fake investor profiles are shown on error.')}</p>
    </section>
    <section style={{ maxWidth: 1240, margin: '0 auto', padding: '0 24px 44px', display: 'grid', gridTemplateColumns: '260px minmax(0,1fr)', gap: 22 }} className="d68-list-cols">
      <aside style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: 18, alignSelf: 'start', position: 'sticky', top: 90 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><b>{T(lang, 'Bộ lọc', 'Filters')}</b><button onClick={() => { setType(''); setRegion(''); setCountry(''); setIndustry(''); setPage(1); }} style={{ border: 'none', background: 'none', color: '#1596cc', fontWeight: 700 }}>{T(lang, 'Xóa', 'Clear')}</button></div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#94A3B8', marginBottom: 6 }}>{T(lang, 'Loại nhà đầu tư', 'Investor type')}</label><select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} style={{ width: '100%', padding: 10, border: '1px solid #E2E8F0', borderRadius: 9, marginBottom: 14 }}><option value="">All</option>{investorTypes.map((x) => <option key={x}>{x}</option>)}</select>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#94A3B8', marginBottom: 6 }}>{T(lang, 'Khu vực', 'Region')}</label><select value={region} onChange={(e) => { setRegion(e.target.value); setPage(1); }} style={{ width: '100%', padding: 10, border: '1px solid #E2E8F0', borderRadius: 9, marginBottom: 14 }}><option value="">All</option>{regions.map((x) => <option key={x} value={x}>{regionLabel(lang, x)}</option>)}</select>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#94A3B8', marginBottom: 6 }}>{T(lang, 'Quốc gia', 'Country')}</label><select value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }} style={{ width: '100%', padding: 10, border: '1px solid #E2E8F0', borderRadius: 9, marginBottom: 14 }}><option value="">All</option>{countries.map((x) => <option key={x}>{x}</option>)}</select>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#94A3B8', marginBottom: 6 }}>{T(lang, 'Ngành quan tâm', 'Preferred industry')}</label><input value={industry} onChange={(e) => { setIndustry(e.target.value); setPage(1); }} placeholder="F&B, Technology..." style={{ width: '100%', padding: 10, border: '1px solid #E2E8F0', borderRadius: 9 }} />
      </aside>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: 14, marginBottom: 14 }}><span>{loading ? T(lang, 'Đang tải dữ liệu thật...', 'Loading live data...') : `${items.length}${total !== null ? ` / ${total}` : ''} ${T(lang, 'hồ sơ', 'profiles')}`}</span><span>{T(lang, 'Nguồn: Supabase active + visible', 'Source: Supabase active + visible')}</span></div>
        {feedback ? <div style={{ background: '#FEF3D3', border: '1px solid #F5D98A', color: '#8a6413', padding: 12, borderRadius: 12, marginBottom: 12 }}>{feedback}</div> : null}
        {error ? <div style={{ background: '#FDECEC', border: '1px solid #FCA5A5', color: '#991B1B', padding: 14, borderRadius: 12, marginBottom: 12 }}>{error}</div> : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{loading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} />) : items.map((inv) => <InvestorCard key={inv.id} inv={inv} lang={lang} onProposal={proposal} />)}</div>
        {!loading && !error && !items.length ? <div style={{ background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 16, padding: 44, textAlign: 'center', color: '#64748B', marginTop: 18 }}><b>{T(lang, 'Chưa có nhà đầu tư phù hợp.', 'No matching investor profiles.')}</b></div> : null}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 24 }}><button disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ padding: '10px 14px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff' }}>←</button><span style={{ padding: '10px 4px', fontWeight: 700 }}>{page}{pages ? ` / ${pages}` : ''}</span><button disabled={loading || (pages !== null && page >= pages)} onClick={() => setPage((p) => p + 1)} style={{ padding: '10px 14px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff' }}>→</button></div>
      </div>
    </section>
  </main>;
}
