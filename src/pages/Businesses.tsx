import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BusinessCard from '../components/BusinessCard';
import { fallbackSeedBusinesses, listBusinesses } from '../lib/data';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
const pageSize = 9;

const countries = [
  { value: '', vi: 'Tất cả quốc gia', en: 'All countries' },
  { value: 'VN', vi: 'Việt Nam', en: 'Vietnam' },
  { value: 'SG', vi: 'Singapore', en: 'Singapore' },
  { value: 'US', vi: 'Mỹ', en: 'United States' },
  { value: 'JP', vi: 'Nhật Bản', en: 'Japan' },
  { value: 'KR', vi: 'Hàn Quốc', en: 'Korea' },
];

const industries = ['', 'F&B', 'Y tế & Sức khỏe', 'Công nghệ', 'Bán lẻ', 'Sản xuất', 'Logistics', 'Thủy sản', 'Bất động sản'];
const dealTypes = ['', 'Gọi vốn', 'Bán cổ phần', 'Bán toàn bộ', 'Sang nhượng', 'Vay vốn'];
const sortOptions = [
  { value: 'featured', vi: 'Ưu tiên / chất lượng', en: 'Featured / quality' },
  { value: 'newest', vi: 'Mới nhất', en: 'Newest' },
  { value: 'revenue', vi: 'Doanh thu cao', en: 'Highest revenue' },
  { value: 'ask', vi: 'Nhu cầu vốn cao', en: 'Highest ask' },
];
const txTabs = [
  { key: '', vi: 'Tất cả', en: 'All deals' },
  { key: 'Gọi vốn', vi: 'Gọi vốn', en: 'Fundraising' },
  { key: 'Bán cổ phần', vi: 'Bán cổ phần', en: 'Stake sale' },
  { key: 'Sang nhượng', vi: 'Sang nhượng', en: 'Transfer' },
  { key: 'Vay vốn', vi: 'Vay vốn', en: 'Debt' },
];

type Filters = { q: string; country: string; industry: string; dealType: string; sort: string; page: number };
function readFilters(params: URLSearchParams): Filters { return { q: params.get('q') || '', country: params.get('country') || '', industry: params.get('industry') || '', dealType: params.get('dealType') || '', sort: params.get('sort') || 'featured', page: Math.max(1, Number(params.get('page') || 1)) }; }
function matchText(value: unknown, needle: string) { return !needle || String(value || '').toLowerCase().includes(needle.toLowerCase()); }
function clientFilter(items: any[], filters: Filters) {
  let out = items.filter((b) => {
    const text = [b.title_vi, b.title_en, b.description_vi, b.description_en, b.industry, b.city, b.public_code].join(' ');
    return matchText(text, filters.q) && (!filters.country || b.country_iso2 === filters.country) && (!filters.industry || matchText(b.industry, filters.industry)) && (!filters.dealType || matchText(b.deal_type, filters.dealType));
  });
  return out.slice().sort((a,b) => {
    if (filters.sort === 'newest') return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    if (filters.sort === 'revenue') return Number(b.revenue_2025 || 0) - Number(a.revenue_2025 || 0);
    if (filters.sort === 'ask') return Number(b.ask_amount || 0) - Number(a.ask_amount || 0);
    return (Number(b.quality_score || 0) - Number(a.quality_score || 0)) || String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

export default function Businesses({ lang }: { lang: Lang }) {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const [draft, setDraft] = useState(filters);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { setDraft(filters); }, [params.toString()]);
  useEffect(() => { let mounted = true; async function load() { setLoading(true); setError(''); try { const data = await listBusinesses({ includeHidden: false }); if (mounted) setItems(data); } catch (err: any) { try { if (mounted) setItems(await fallbackSeedBusinesses()); } catch { if (mounted) setError(err?.message || 'Cannot load businesses'); } } finally { if (mounted) setLoading(false); } } load(); return () => { mounted = false; }; }, []);

  const filtered = useMemo(() => clientFilter(items, filters), [items, params.toString()]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(filters.page, totalPages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function apply(next: Partial<Filters> = {}) {
    const merged = { ...draft, ...next, page: next.page || 1 } as Filters;
    const sp = new URLSearchParams();
    if (merged.q) sp.set('q', merged.q); if (merged.country) sp.set('country', merged.country); if (merged.industry) sp.set('industry', merged.industry); if (merged.dealType) sp.set('dealType', merged.dealType); if (merged.sort && merged.sort !== 'featured') sp.set('sort', merged.sort); if (merged.page && merged.page > 1) sp.set('page', String(merged.page));
    setParams(sp);
  }
  function clear() { const next = { q:'', country:'', industry:'', dealType:'', sort:'featured', page:1 }; setDraft(next); setParams(new URLSearchParams()); }
  function setDealType(dealType: string) { const next = {...draft, dealType}; setDraft(next); apply(next); }

  return <>
    <div className="d68-txbar"><div className="d68-txtabs">{txTabs.map(tab=><button key={tab.key || 'all'} className={!filters.dealType && !tab.key || filters.dealType === tab.key ? 'active' : ''} onClick={()=>setDealType(tab.key)}>{lang==='en'?tab.en:tab.vi}</button>)}</div></div>
    <div className="d68-list-title">
      <div className="d68-breadcrumb"><Link to="/">{T(lang,'Trang chủ','Home')}</Link><span>›</span><Link to="/businesses">{T(lang,'Doanh nghiệp','Businesses')}</Link><span>›</span><b>Việt Nam</b></div>
      <h1>{T(lang, 'Doanh nghiệp đang chào bán & gọi vốn tại Việt Nam', 'Businesses for Sale & Investment in Vietnam')}</h1>
      <p>{T(lang, 'Hồ sơ được ẩn danh, có chỉ số chất lượng và dữ liệu tài chính tóm tắt để nhà đầu tư sàng lọc nhanh trước khi yêu cầu kết nối.', 'Anonymous, quality-scored business teasers help investors screen opportunities before requesting a connection.')}</p>
      <div className="d68-list-statbar"><span><b>{loading ? '...' : filtered.length}</b> {T(lang,'hồ sơ phù hợp','matching profiles')}</span><span>🔒 {T(lang,'Tên pháp lý, email, mã số thuế và tài liệu chi tiết được khóa','Legal name, email, tax code and documents are locked')}</span><Link to="/register/business">{T(lang,'Đăng doanh nghiệp','List a business')}</Link></div>
    </div>

    <div className="d68-list-cols">
      <aside className="d68-filter-card">
        <div className="d68-filter-head"><b>{T(lang,'Bộ lọc thương vụ','Deal filters')}</b><button onClick={clear}>{T(lang,'Xóa lọc','Clear')}</button></div>
        <div className="d68-filter-body">
          <label><span>{T(lang,'Từ khóa','Keyword')}</span><input value={draft.q} onChange={e=>setDraft({...draft,q:e.target.value})} placeholder={T(lang,'ngành, thành phố, mã hồ sơ...','sector, city, deal code...')}/></label>
          <label><span>{T(lang,'Quốc gia','Country')}</span><select value={draft.country} onChange={e=>setDraft({...draft,country:e.target.value})}>{countries.map(c=><option key={c.value} value={c.value}>{lang==='en'?c.en:c.vi}</option>)}</select></label>
          <label><span>{T(lang,'Ngành','Industry')}</span><select value={draft.industry} onChange={e=>setDraft({...draft,industry:e.target.value})}>{industries.map(i=><option key={i || 'all'} value={i}>{i || T(lang,'Tất cả ngành','All industries')}</option>)}</select></label>
          <label><span>{T(lang,'Loại thương vụ','Deal type')}</span><select value={draft.dealType} onChange={e=>setDraft({...draft,dealType:e.target.value})}>{dealTypes.map(i=><option key={i || 'all'} value={i}>{i || T(lang,'Tất cả hình thức','All deal types')}</option>)}</select></label>
          <button className="d68-ref-apply" onClick={()=>apply()}>{T(lang,'Áp dụng bộ lọc','Apply filters')}</button>
          <p className="d68-lock-note">🔒 {T(lang,'Thông tin nhạy cảm chỉ mở sau khi kết nối được duyệt.','Sensitive data unlocks only after approved connection.')}</p>
        </div>
      </aside>
      <main>
        <div className="d68-main-toolbar"><span><b>{filtered.length}</b> {T(lang,'doanh nghiệp','businesses')} · {T(lang,'trang','page')} {safePage}/{totalPages}</span><label>{T(lang,'Sắp xếp','Sort')}<select value={draft.sort} onChange={e=>{ const sort=e.target.value; setDraft({...draft,sort}); apply({sort}); }}>{sortOptions.map(o=><option value={o.value} key={o.value}>{lang==='en'?o.en:o.vi}</option>)}</select></label></div>
        {loading ? <div className="d68-card-grid">{Array.from({length:6}).map((_,i)=><div className="deal-card" key={i}><div className="d68-skeleton" style={{height:180}}/><div className="card-body"><div className="d68-skeleton" style={{height:18,width:'70%',marginBottom:16}}/><div className="d68-skeleton" style={{height:80}}/></div></div>)}</div>
        : error ? <div className="empty">{error}</div>
        : visible.length === 0 ? <div className="empty">{T(lang,'Chưa có doanh nghiệp phù hợp bộ lọc.','No businesses match these filters.')}</div>
        : <div className="d68-card-grid business-grid">{visible.map((b,i)=><BusinessCard key={b.id || b.slug} b={b} lang={lang} index={i}/>)}</div>}
        <div className="pagination-row"><button className="btn secondary" disabled={safePage<=1} onClick={()=>apply({page:safePage-1})}>← {T(lang,'Trước','Prev')}</button><div className="d68-pagination">{Array.from({length:totalPages}).map((_,idx)=><button key={idx} aria-current={safePage===idx+1 ? 'true' : undefined} onClick={()=>apply({page:idx+1})}>{idx+1}</button>)}</div><button className="btn secondary" disabled={safePage>=totalPages} onClick={()=>apply({page:safePage+1})}>{T(lang,'Sau','Next')} →</button></div>
      </main>
    </div>
  </>;
}
