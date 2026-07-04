import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import InvestorCard from '../components/InvestorCard';
import { listInvestors } from '../lib/data';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
const PAGE_SIZE = 12;

const investorTypes = ['VC', 'PE', 'Corporate/Strategic', 'Family Office', 'Individual/Angel', 'Lender/Debt'];
const countries = [
  ['VN', 'Vietnam'], ['SG', 'Singapore'], ['US', 'United States'], ['JP', 'Japan'], ['KR', 'Korea'], ['HK', 'Hong Kong']
];
const industries = ['F&B', 'Healthcare', 'Retail', 'Manufacturing', 'Technology', 'Logistics', 'Education', 'Real Estate'];
const dealTypes = ['equity', 'debt', 'M&A', 'strategic acquisition', 'minority stake'];

function numberFromParam(value: string | null, fallback: number) {
  const n = Number(value || fallback);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default function Investors({ lang }: { lang: Lang }) {
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState({
    search: params.get('q') || '',
    type: params.get('type') || '',
    country: params.get('country') || '',
    region: params.get('region') || '',
    industry: params.get('industry') || '',
    dealType: params.get('dealType') || '',
    sort: params.get('sort') || 'ranking'
  });
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const page = numberFromParam(params.get('page'), 1);

  async function load(nextFilters = filters) {
    setLoading(true);
    setError('');
    try {
      const data = await listInvestors({ ...nextFilters, limit: 1000 });
      setItems(data);
    } catch (err: any) {
      setItems([]);
      setError(err?.message || 'Could not load investors.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const visibleItems = useMemo(() => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [items, page]);

  function applyFilters(nextFilters = filters, nextPage = 1) {
    const next = new URLSearchParams();
    if (nextFilters.search) next.set('q', nextFilters.search);
    if (nextFilters.type) next.set('type', nextFilters.type);
    if (nextFilters.country) next.set('country', nextFilters.country);
    if (nextFilters.region) next.set('region', nextFilters.region);
    if (nextFilters.industry) next.set('industry', nextFilters.industry);
    if (nextFilters.dealType) next.set('dealType', nextFilters.dealType);
    if (nextFilters.sort && nextFilters.sort !== 'ranking') next.set('sort', nextFilters.sort);
    if (nextPage > 1) next.set('page', String(nextPage));
    setParams(next);
    load(nextFilters);
  }

  function resetFilters() {
    const next = { search: '', type: '', country: '', region: '', industry: '', dealType: '', sort: 'ranking' };
    setFilters(next);
    setParams(new URLSearchParams());
    load(next);
  }

  function changePage(nextPage: number) {
    const next = new URLSearchParams(params);
    if (nextPage <= 1) next.delete('page'); else next.set('page', String(nextPage));
    setParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return <>
    <section className="list-hero investor-list-hero">
      <div className="container list-hero-inner">
        <div>
          <span className="badge-title blue">◆ {T(lang, 'Danh bạ nhà đầu tư ẩn danh', 'Anonymous Investor Directory')}</span>
          <h1>{T(lang, 'Tìm nhà đầu tư phù hợp cho thương vụ của bạn', 'Find the right investors for your deal')}</h1>
          <p>{T(lang, 'Lọc theo loại nhà đầu tư, khẩu vị ngành, quy mô ticket, khu vực và hình thức đầu tư. Danh tính thật và liên hệ được bảo mật cho đến khi có kết nối được duyệt.', 'Filter by investor type, sector appetite, ticket size, geography and deal type. Real identity and contacts stay private until an approved connection.')}</p>
        </div>
        <div className="list-hero-card">
          <b>{loading ? '...' : items.length || 624}</b>
          <span>{T(lang, 'hồ sơ đang hoạt động', 'active profiles')}</span>
          <Link className="btn gold block" to="/register/business">{T(lang, 'Đăng DN để nhận đề xuất', 'List a business')}</Link>
        </div>
      </div>
    </section>

    <section className="section alt">
      <div className="container business-layout">
        <aside className="filter-panel">
          <div className="filter-panel-head">
            <h3>{T(lang, 'Bộ lọc', 'Filters')}</h3>
            <button onClick={resetFilters}>{T(lang, 'Xóa', 'Reset')}</button>
          </div>
          <label className="search-label"><span>{T(lang, 'Từ khóa', 'Keyword')}</span><input className="input" value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})} placeholder={T(lang,'Mã, ngành, mô tả...','Code, sector, description...')} /></label>
          <label className="search-label"><span>{T(lang, 'Loại nhà đầu tư', 'Investor type')}</span><select className="select" value={filters.type} onChange={e=>setFilters({...filters,type:e.target.value})}><option value="">{T(lang,'Tất cả','All')}</option>{investorTypes.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          <label className="search-label"><span>{T(lang, 'Quốc gia', 'Country')}</span><select className="select" value={filters.country} onChange={e=>setFilters({...filters,country:e.target.value})}><option value="">{T(lang,'Tất cả','All')}</option>{countries.map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
          <label className="search-label"><span>{T(lang, 'Khu vực quan tâm', 'Region appetite')}</span><input className="input" value={filters.region} onChange={e=>setFilters({...filters,region:e.target.value})} placeholder={T(lang,'VD: SEA, Vietnam','e.g. SEA, Vietnam')} /></label>
          <label className="search-label"><span>{T(lang, 'Ngành quan tâm', 'Sector focus')}</span><select className="select" value={filters.industry} onChange={e=>setFilters({...filters,industry:e.target.value})}><option value="">{T(lang,'Tất cả','All')}</option>{industries.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          <label className="search-label"><span>{T(lang, 'Hình thức đầu tư', 'Deal type')}</span><select className="select" value={filters.dealType} onChange={e=>setFilters({...filters,dealType:e.target.value})}><option value="">{T(lang,'Tất cả','All')}</option>{dealTypes.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          <button className="btn blue block" onClick={()=>applyFilters()}>{T(lang, 'Áp dụng bộ lọc', 'Apply filters')}</button>
          <div className="notice small-note">🔒 {T(lang, 'Email, số điện thoại, website và tên thật của nhà đầu tư không hiển thị ở trang công khai.', 'Email, phone, website and real investor names never appear on public pages.')}</div>
        </aside>

        <main>
          <div className="list-toolbar">
            <div><b>{items.length}</b> {T(lang, 'hồ sơ phù hợp', 'matching profiles')}{loading && <span className="muted"> · {T(lang, 'đang tải', 'loading')}</span>}</div>
            <label>{T(lang, 'Sắp xếp', 'Sort')}<select className="select" value={filters.sort} onChange={e=>{const next={...filters,sort:e.target.value};setFilters(next);applyFilters(next);}}><option value="ranking">{T(lang,'Ưu tiên / hoạt động','Ranking / active')}</option><option value="verified">{T(lang,'Đã xác minh','Verified first')}</option><option value="ticket">{T(lang,'Ticket lớn nhất','Largest ticket')}</option><option value="newest">{T(lang,'Mới nhất','Newest')}</option></select></label>
          </div>
          {error && <div className="notice warn" style={{marginBottom:18}}>{error}</div>}
          {loading ? <div className="empty">{T(lang, 'Đang tải danh sách nhà đầu tư...', 'Loading investors...')}</div> : visibleItems.length ? <div className="grid investor-grid">{visibleItems.map(inv=><InvestorCard key={inv.id || inv.code} inv={inv} lang={lang}/>)}</div> : <div className="empty"><h3>{T(lang, 'Chưa tìm thấy nhà đầu tư phù hợp', 'No matching investors found')}</h3><p>{T(lang, 'Thử xóa bớt bộ lọc hoặc tìm theo ngành rộng hơn.', 'Try removing filters or searching a broader sector.')}</p></div>}
          {!loading && items.length > PAGE_SIZE && <div className="pagination-row"><button className="btn secondary" disabled={page<=1} onClick={()=>changePage(page-1)}>← {T(lang,'Trước','Previous')}</button><span className="muted">{T(lang,'Trang','Page')} {page}/{totalPages}</span><button className="btn secondary" disabled={page>=totalPages} onClick={()=>changePage(page+1)}>{T(lang,'Tiếp','Next')} →</button></div>}
        </main>
      </div>
    </section>
  </>;
}
