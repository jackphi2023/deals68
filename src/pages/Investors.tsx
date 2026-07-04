import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import InvestorCard from '../components/InvestorCard';
import { listInvestors } from '../lib/data';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
const PAGE_SIZE = 12;
const investorTypes = ['VC', 'PE', 'Institutional', 'Corporate/Strategic', 'Individual/Angel', 'Family Office', 'Lender/Debt'];
const countries = [['', 'Tất cả quốc gia', 'All countries'], ['VN', 'Việt Nam', 'Vietnam'], ['SG', 'Singapore', 'Singapore'], ['US', 'Mỹ', 'United States'], ['JP', 'Nhật Bản', 'Japan'], ['KR', 'Hàn Quốc', 'Korea'], ['HK', 'Hong Kong', 'Hong Kong']];
const industries = ['', 'F&B', 'Healthcare', 'Retail', 'Manufacturing', 'Technology', 'Logistics', 'Education', 'Real Estate'];
const stages = ['', 'Seed', 'Series A', 'Growth', 'Mature', 'Buyout'];
function numberFromParam(value: string | null, fallback: number) { const n = Number(value || fallback); return Number.isFinite(n) && n > 0 ? n : fallback; }

export default function Investors({ lang }: { lang: Lang }) {
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState({
    search: params.get('q') || '', type: params.get('type') || '', country: params.get('country') || '', region: params.get('region') || '', industry: params.get('industry') || '', stage: params.get('stage') || '', ticket: params.get('ticket') || '', sort: params.get('sort') || 'ranking'
  });
  const [items, setItems] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const page = numberFromParam(params.get('page'), 1);
  async function load(nextFilters = filters) { setLoading(true); setError(''); try { const data = await listInvestors({ ...nextFilters, minTicket: nextFilters.ticket, limit: 1000 }); setItems(data); } catch (err: any) { setItems([]); setError(err?.message || 'Could not load investors.'); } finally { setLoading(false); } }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const visibleItems = useMemo(() => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [items, page]);
  function applyFilters(nextFilters = filters, nextPage = 1) { const next = new URLSearchParams(); if (nextFilters.search) next.set('q', nextFilters.search); if (nextFilters.type) next.set('type', nextFilters.type); if (nextFilters.country) next.set('country', nextFilters.country); if (nextFilters.region) next.set('region', nextFilters.region); if (nextFilters.industry) next.set('industry', nextFilters.industry); if (nextFilters.stage) next.set('stage', nextFilters.stage); if (nextFilters.ticket) next.set('ticket', nextFilters.ticket); if (nextFilters.sort && nextFilters.sort !== 'ranking') next.set('sort', nextFilters.sort); if (nextPage > 1) next.set('page', String(nextPage)); setParams(next); load(nextFilters); }
  function resetFilters() { const next = { search: '', type: '', country: '', region: '', industry: '', stage: '', ticket: '', sort: 'ranking' }; setFilters(next); setParams(new URLSearchParams()); load(next); }
  function changePage(nextPage: number) { const next = new URLSearchParams(params); if (nextPage <= 1) next.delete('page'); else next.set('page', String(nextPage)); setParams(next); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  return <>
    <div className="d68-list-title">
      <h1>{T(lang, 'Nhà đầu tư trên Deals68', 'Investors on Deals68')}</h1>
      <p>{T(lang, `${items.length || 624} hồ sơ Nhà đầu tư ẩn danh — VC, PE, định chế, chiến lược, family office và cá nhân. Sắp xếp theo mức độ hoạt động.`, `${items.length || 624} anonymous investor profiles — VC, PE, institutional, strategic, family office and individuals. Sorted by activity ranking.`)}</p>
      <div className="d68-list-statbar"><span>🔒 {T(lang,'Tên thật, email, website, số điện thoại không hiển thị công khai','Real name, email, website and phone are not public')}</span><Link to="/register/investor">{T(lang,'Đăng ký nhà đầu tư','Register as investor')}</Link></div>
    </div>
    <div className="d68-list-cols">
      <aside className="d68-filter-card">
        <div className="d68-filter-head"><b>{T(lang, 'Bộ lọc', 'Filters')}</b><button onClick={resetFilters}>{T(lang, 'Xóa lọc', 'Clear')}</button></div>
        <div className="d68-filter-body">
          <label><span>{T(lang, 'Loại nhà đầu tư', 'Investor type')}</span><select value={filters.type} onChange={e=>setFilters({...filters,type:e.target.value})}><option value="">{T(lang,'Tất cả','All')}</option>{investorTypes.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          <label><span>{T(lang, 'Quốc gia', 'Country')}</span><select value={filters.country} onChange={e=>setFilters({...filters,country:e.target.value})}>{countries.map(([v,vi,en])=><option key={v || 'all'} value={v}>{lang==='en'?en:vi}</option>)}</select></label>
          <label><span>{T(lang, 'Khu vực', 'Region')}</span><input value={filters.region} onChange={e=>setFilters({...filters,region:e.target.value})} placeholder={T(lang,'VD: SEA, Vietnam','e.g. SEA, Vietnam')} /></label>
          <label><span>{T(lang, 'Ngành quan tâm', 'Preferred industry')}</span><select value={filters.industry} onChange={e=>setFilters({...filters,industry:e.target.value})}>{industries.map(x=><option key={x || 'all'} value={x}>{x || T(lang,'Tất cả','All')}</option>)}</select></label>
          <label><span>{T(lang, 'Giai đoạn', 'Stage')}</span><select value={filters.stage} onChange={e=>setFilters({...filters,stage:e.target.value})}>{stages.map(x=><option key={x || 'all'} value={x}>{x || T(lang,'Tất cả','All')}</option>)}</select></label>
          <label><span>{T(lang, 'Ticket tối thiểu (USD)', 'Min ticket (USD)')}</span><select value={filters.ticket} onChange={e=>setFilters({...filters,ticket:e.target.value})}><option value="">{T(lang,'Bất kỳ','Any')}</option><option value="100000">≤ $100K</option><option value="1000000">≤ $1M</option><option value="5000000">≤ $5M</option><option value="10000000">≤ $10M</option></select></label>
          <label><span>{T(lang, 'Từ khóa', 'Keyword')}</span><input value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})} placeholder={T(lang,'mã, ngành, mô tả...','code, sector, description...')} /></label>
          <button className="d68-ref-apply" onClick={()=>applyFilters()}>{T(lang, 'Áp dụng bộ lọc', 'Apply filters')}</button>
          <p className="d68-lock-note">🔒 {T(lang, 'Thông tin liên hệ chỉ mở sau khi proposal/connection được admin duyệt.', 'Contacts unlock only after admin-approved proposal/connection.')}</p>
        </div>
      </aside>
      <main>
        <div className="d68-main-toolbar"><span><b>{items.length}</b> {T(lang, 'hồ sơ phù hợp', 'matching profiles')}{loading && <span className="muted"> · {T(lang, 'đang tải', 'loading')}</span>}</span><label>{T(lang, 'Sắp xếp', 'Sort')}<select value={filters.sort} onChange={e=>{const next={...filters,sort:e.target.value};setFilters(next);applyFilters(next);}}><option value="ranking">{T(lang,'Ưu tiên / hoạt động','Ranking / active')}</option><option value="verified">{T(lang,'Đã xác minh','Verified first')}</option><option value="ticket">{T(lang,'Ticket lớn nhất','Largest ticket')}</option><option value="newest">{T(lang,'Mới nhất','Newest')}</option></select></label></div>
        {error && <div className="notice warn" style={{marginBottom:18}}>{error}</div>}
        {loading ? <div className="empty">{T(lang, 'Đang tải danh sách nhà đầu tư...', 'Loading investors...')}</div> : visibleItems.length ? <div className="d68-card-grid investor-grid">{visibleItems.map(inv=><InvestorCard key={inv.id || inv.code} inv={inv} lang={lang}/>)}</div> : <div className="empty"><h3>{T(lang, 'Chưa tìm thấy nhà đầu tư phù hợp', 'No matching investors found')}</h3><p>{T(lang, 'Thử xóa bớt bộ lọc hoặc tìm theo ngành rộng hơn.', 'Try removing filters or searching a broader sector.')}</p></div>}
        {!loading && items.length > PAGE_SIZE && <div className="pagination-row"><button className="btn secondary" disabled={page<=1} onClick={()=>changePage(page-1)}>← {T(lang,'Trước','Previous')}</button><span className="muted">{T(lang,'Trang','Page')} {page}/{totalPages}</span><button className="btn secondary" disabled={page>=totalPages} onClick={()=>changePage(page+1)}>{T(lang,'Tiếp','Next')} →</button></div>}
      </main>
    </div>
  </>;
}
