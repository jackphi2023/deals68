import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { countInvestors, getMyBusiness, listInvestors } from '../lib/data';
import { formatCompactMoney } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Lang } from '../lib/i18n';
import { localizedPath } from '../lib/i18nRoutes';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
const PAGE_SIZE = 12;
const investorTypes = ['VC', 'PE', 'Institutional', 'Corporate/Strategic', 'Individual/Angel', 'Family Office', 'Lender/Debt'];
const regions = ['asia', 'americas', 'europe', 'oceania', 'mideast'];
const countries = ['VN', 'SG', 'US', 'JP', 'KR', 'HK', 'AU', 'DE', 'CA'];
const stages = ['Seed', 'Series A', 'Growth', 'Mature', 'Any'];
const ticketBands = [
  { value: '', vi: 'Mọi ticket', en: 'Any ticket' },
  { value: '100000', vi: '≤ 100.000 USD', en: '≤ $100K' },
  { value: '1000000', vi: '≤ 1 triệu USD', en: '≤ $1M' },
  { value: '5000000', vi: '≤ 5 triệu USD', en: '≤ $5M' },
  { value: '50000000', vi: '≤ 50 triệu USD', en: '≤ $50M' }
];

type Investor = {
  id: string; code: string; type: string; titleVi: string; titleEn: string; descVi: string; descEn: string;
  country: string; region: string; industries: string[]; dealTypes: string[]; stage: string;
  ticketMin: number; ticketMax: number; verified: boolean; activity: string;
};

function arr(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (!v) return [];
  return String(v).split(/[;,]/).map((x) => x.trim()).filter(Boolean);
}
function normalize(inv: any): Investor {
  const code = String(inv.code || '');
  const titleVi = inv.title_vi || code || 'Hồ sơ nhà đầu tư đang cập nhật';
  return {
    id: String(inv.id || code),
    code,
    type: inv.type || 'Investor',
    titleVi,
    titleEn: inv.title_en || titleVi,
    descVi: inv.desc_vi || '',
    descEn: inv.desc_en || inv.desc_vi || '',
    country: inv.country || inv.country_iso2 || 'Global',
    region: inv.region || 'global',
    industries: arr(inv.industries),
    dealTypes: arr(inv.deal_types),
    stage: inv.stage || 'Any',
    ticketMin: Number(inv.ticket_min || 0),
    ticketMax: Number(inv.ticket_max || 0),
    verified: inv.verified === true,
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
  if (!i.ticketMin && !i.ticketMax) return '—';
  if (!i.ticketMin) return `≤ ${formatCompactMoney(i.ticketMax, 'USD')}`;
  if (!i.ticketMax) return `≥ ${formatCompactMoney(i.ticketMin, 'USD')}`;
  return `${formatCompactMoney(i.ticketMin, 'USD')} – ${formatCompactMoney(i.ticketMax, 'USD')}`;
}
function activityLabel(lang: Lang, activity: string) {
  const a = String(activity || '').toLowerCase();
  if (a.includes('high') || a.includes('active')) return T(lang, 'Hoạt động cao', 'High activity');
  if (a.includes('medium')) return T(lang, 'Hoạt động vừa', 'Medium activity');
  if (a.includes('low')) return T(lang, 'Hoạt động thấp', 'Low activity');
  return T(lang, 'Đang cập nhật', 'Updating');
}
function initials(type: string) { return String(type || 'IN').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'IN'; }

function Skeleton() {
  return <div className="d68-investor-card" aria-hidden="true"><div className="d68-investor-card__avatar" /><div className="d68-investor-card__body"><div className="d68-investor-skeleton d68-investor-skeleton--title" /><div className="d68-investor-skeleton d68-investor-skeleton--text" /></div></div>;
}
function InvestorCard({ inv, lang, onProposal }: { inv: Investor; lang: Lang; onProposal: () => void }) {
  const to = (path: string) => localizedPath(path, lang);
  const title = T(lang, inv.titleVi, inv.titleEn);
  const desc = T(lang, inv.descVi || 'Hồ sơ ẩn danh đang được cập nhật tiêu chí đầu tư.', inv.descEn || 'Anonymous profile updating investment criteria.');
  return <article className="d68-investor-card">
    <div className="d68-investor-card__avatar">{initials(inv.type)}</div>
    <div className="d68-investor-card__body">
      <div className="d68-investor-card__tags"><span>{inv.type}</span><span>📍 {inv.country}</span>{inv.verified ? <span className="ok">✓ {T(lang, 'Xác minh', 'Verified')}</span> : null}<span className="activity">● {activityLabel(lang, inv.activity)}</span></div>
      <h3>{title}</h3>
      <p>{desc}</p>
      <div className="d68-investor-card__meta"><span><b>Ticket:</b> {ticket(inv)}</span><span><b>{T(lang,'Ngành','Industries')}:</b> {inv.industries.slice(0, 4).join(', ') || '—'}</span><span><b>{T(lang,'Giai đoạn','Stage')}:</b> {inv.stage || '—'}</span></div>
    </div>
    <div className="d68-investor-card__actions"><Link to={to(`/investors/${inv.code}`)}>{T(lang, 'Xem chi tiết', 'View detail')}</Link><button onClick={onProposal}>{T(lang, 'Gửi hồ sơ DN', 'Send business proposal')}</button></div>
  </article>;
}

export default function Investors({ lang }: { lang: Lang }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const to = (path: string) => localizedPath(path, lang);
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [items, setItems] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [type, setType] = useState(() => params.get('type') || '');
  const [region, setRegion] = useState(() => params.get('region') || '');
  const [country, setCountry] = useState(() => params.get('country') || '');
  const [industry, setIndustry] = useState(() => params.get('industry') || '');
  const [stage, setStage] = useState(() => params.get('stage') || '');
  const [minTicket, setMinTicket] = useState(() => params.get('minTicket') || '');
  const [search, setSearch] = useState(() => params.get('search') || params.get('q') || '');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    setType(p.get('type') || ''); setRegion(p.get('region') || ''); setCountry(p.get('country') || ''); setIndustry(p.get('industry') || '');
    setStage(p.get('stage') || ''); setMinTicket(p.get('minTicket') || ''); setSearch(p.get('search') || p.get('q') || ''); setPage(1);
  }, [location.search]);

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true); setError('');
      const filters = { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, type: type || undefined, region: region || undefined, country: country || undefined, industry: industry || undefined, stage: stage || undefined, minTicket: minTicket || undefined, search: search || undefined, sort: 'ranking' };
      try {
        const [data, cnt] = await Promise.all([listInvestors(filters), countInvestors(filters).catch(() => null)]);
        if (!live) return;
        setItems((data || []).map(normalize).filter((x) => x.code));
        setTotal(cnt);
      } catch (e: any) {
        if (!live) return; setItems([]); setTotal(0); setError(e?.message || T(lang, 'Không tải được dữ liệu nhà đầu tư.', 'Could not load investors.'));
      } finally { if (live) setLoading(false); }
    }
    load();
    return () => { live = false; };
  }, [page, type, region, country, industry, stage, minTicket, search, lang]);

  const pages = useMemo(() => total === null ? null : Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const clear = () => { setType(''); setRegion(''); setCountry(''); setIndustry(''); setStage(''); setMinTicket(''); setSearch(''); setPage(1); };
  async function proposal(inv: Investor) {
    if (!profile) { navigate('/register/business'); return; }
    if (profile.role !== 'business') { setFeedback(T(lang, 'Chỉ tài khoản Doanh nghiệp được gửi proposal.', 'Only Business accounts can send proposals.')); return; }
    const biz = await getMyBusiness(profile.id).catch(() => null);
    if (!biz?.id) { setFeedback(T(lang, 'Tài khoản chưa có hồ sơ Doanh nghiệp để gửi.', 'No Business profile found for this account.')); return; }
    const { data, error: rpcErr } = await supabase.rpc('submit_business_proposal', { business_uuid: biz.id, investor_uuid: inv.id, proposal_note: 'Submitted from Investors listing page.' });
    if (rpcErr) setFeedback(rpcErr.message);
    else setFeedback(T(lang, 'Đã gửi proposal và trừ hạn mức nếu đủ điều kiện.', 'Proposal submitted and quota used if eligible.') + (data?.remaining_quota !== undefined ? ` Remaining: ${data.remaining_quota}` : ''));
  }

  return <main className="d68-investors-page">
    <section className="d68-investors-title">
      <div className="d68-investors-breadcrumb"><Link to={to('/')}>{T(lang, 'Trang chủ', 'Home')}</Link> › <b>{T(lang, 'Nhà đầu tư', 'Investors')}</b></div>
      <h1>{T(lang, 'Danh sách nhà đầu tư trên Deals68', 'Investor profiles on Deals68')}</h1>
      <p>{T(lang, `${total ?? '…'} hồ sơ Nhà đầu tư ẩn danh — VC, PE, định chế, chiến lược, family office, lender và cá nhân.`, `${total ?? '…'} anonymous investor profiles — VC, PE, institutional, strategic, family office, lenders and individuals.`)}</p>
      {!profile ? <div className="d68-investors-banner"><span>ℹ️ {T(lang, 'Đăng nhập để lưu nhà đầu tư và gửi proposal phù hợp.', 'Log in to save investors and submit matching proposals.')}</span><Link to={to('/login')}>{T(lang, 'Đăng nhập', 'Log in')}</Link></div> : null}
      {feedback ? <div className="d68-investors-banner d68-investors-banner--dark"><span>{feedback}</span></div> : null}
    </section>

    <section className="d68-investors-layout">
      <aside className="d68-investors-sidebar">
        <div className="d68-investors-filter-head"><span>{T(lang, 'Bộ lọc', 'Filters')}</span><button onClick={clear}>{T(lang, 'Xóa lọc', 'Clear')}</button></div>
        <div className="d68-investors-filter-scroll">
          <label>{T(lang, 'Từ khóa', 'Keyword')}</label><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={T(lang, 'Mã, loại, quốc gia...', 'Code, type, country...')} />
          <label>{T(lang, 'Loại nhà đầu tư', 'Investor type')}</label><select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="">{T(lang, 'Tất cả', 'All')}</option>{investorTypes.map((x) => <option key={x}>{x}</option>)}</select>
          <label>{T(lang, 'Khu vực', 'Region')}</label><select value={region} onChange={(e) => { setRegion(e.target.value); setPage(1); }}><option value="">{T(lang, 'Tất cả', 'All')}</option>{regions.map((x) => <option key={x} value={x}>{regionLabel(lang, x)}</option>)}</select>
          <label>{T(lang, 'Quốc gia', 'Country')}</label><select value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }}><option value="">{T(lang, 'Tất cả', 'All')}</option>{countries.map((x) => <option key={x}>{x}</option>)}</select>
          <label>{T(lang, 'Ngành quan tâm', 'Preferred industry')}</label><input value={industry} onChange={(e) => { setIndustry(e.target.value); setPage(1); }} placeholder="F&B, Technology..." />
          <label>{T(lang, 'Giai đoạn', 'Stage')}</label><select value={stage} onChange={(e) => { setStage(e.target.value); setPage(1); }}><option value="">{T(lang, 'Tất cả', 'All')}</option>{stages.map((x) => <option key={x}>{x}</option>)}</select>
          <label>{T(lang, 'Ticket tối thiểu', 'Minimum ticket')}</label><select value={minTicket} onChange={(e) => { setMinTicket(e.target.value); setPage(1); }}>{ticketBands.map((x) => <option key={x.value} value={x.value}>{T(lang, x.vi, x.en)}</option>)}</select>
        </div>
      </aside>

      <div className="d68-investors-results">
        <div className="d68-investors-toolbar"><span>{loading ? T(lang, 'Đang tải dữ liệu…', 'Loading data…') : `${items.length}${total !== null ? ` / ${total}` : ''} ${T(lang, 'nhà đầu tư', 'investors')}`}</span><span>{T(lang, 'Sắp xếp: Xếp hạng hoạt động', 'Sort: activity ranking')}</span></div>
        {error ? <div className="d68-investors-error">{error}</div> : null}
        <div className="d68-investors-list">{loading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} />) : items.map((inv) => <InvestorCard key={inv.id} inv={inv} lang={lang} onProposal={() => proposal(inv)} />)}</div>
        {!loading && !error && !items.length ? <div className="d68-investors-empty"><b>{T(lang, 'Chưa có nhà đầu tư phù hợp.', 'No matching investor profiles.')}</b><button onClick={clear}>{T(lang, 'Xóa bộ lọc', 'Clear filters')}</button></div> : null}
        <div className="d68-investors-pagination"><button disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>←</button><span>{page}{pages ? ` / ${pages}` : ''}</span><button disabled={loading || (pages !== null && page >= pages)} onClick={() => setPage((p) => p + 1)}>→</button></div>
      </div>
    </section>
  </main>;
}
