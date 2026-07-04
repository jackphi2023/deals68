import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fallbackSeedBusinesses, listBusinesses } from '../lib/data';
import { formatCompactMoney, percent } from '../lib/format';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
const pageSize = 9;

const txTabs = [
  { key: '', vi: 'Tất cả thương vụ', en: 'All deals' },
  { key: 'Fundraise', vi: 'Gọi vốn', en: 'Fundraising' },
  { key: 'Full Acquisition', vi: 'Mua bán doanh nghiệp', en: 'Business sale' },
  { key: 'Asset transfer', vi: 'Sang nhượng tài sản', en: 'Asset transfer' },
  { key: 'Strategic investor', vi: 'Nhà đầu tư chiến lược', en: 'Strategic investor' },
  { key: 'Debt', vi: 'Vay vốn', en: 'Debt' },
];

const revenueBands = [
  { key: 'any', vi: 'Bất kỳ', en: 'Any' },
  { key: 's', vi: '< 10 tỷ ₫', en: '< VND 10B' },
  { key: 'm', vi: '10 – 100 tỷ ₫', en: 'VND 10B – 100B' },
  { key: 'l', vi: '> 100 tỷ ₫', en: '> VND 100B' },
];

const listedByOptions = [
  { key: 'owner', vi: 'Chủ doanh nghiệp', en: 'Owner' },
  { key: 'advisor', vi: 'Cố vấn', en: 'Advisor' },
  { key: 'deals68', vi: 'Deals68 kiểm duyệt', en: 'Deals68 reviewed' },
];

const sortOptions = [
  { value: 'recent', vi: 'Mới cập nhật', en: 'Most recent' },
  { value: 'revHigh', vi: 'Doanh thu cao đến thấp', en: 'Revenue high to low' },
  { value: 'revLow', vi: 'Doanh thu thấp đến cao', en: 'Revenue low to high' },
  { value: 'rating', vi: 'Điểm chất lượng cao', en: 'Quality rating' },
];

type Filters = {
  dealType: string;
  provinces: string[];
  industries: string[];
  revenueBand: string;
  listedBy: string[];
  verifiedOnly: boolean;
  featuredOnly: boolean;
  sort: string;
  view: 'grid' | 'list';
  page: number;
};

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function csv(value: string | null) {
  return (value || '').split(',').map(x => decodeURIComponent(x).trim()).filter(Boolean);
}

function readFilters(params: URLSearchParams): Filters {
  const view = params.get('view') === 'list' ? 'list' : 'grid';
  return {
    dealType: params.get('dealType') || '',
    provinces: csv(params.get('province')),
    industries: csv(params.get('industry')),
    revenueBand: params.get('revenue') || 'any',
    listedBy: csv(params.get('listedBy')),
    verifiedOnly: params.get('verified') === '1',
    featuredOnly: params.get('featured') === '1',
    sort: params.get('sort') || 'recent',
    view,
    page: Math.max(1, Number(params.get('page') || 1)),
  };
}

function writeFilters(filters: Filters) {
  const sp = new URLSearchParams();
  if (filters.dealType) sp.set('dealType', filters.dealType);
  if (filters.provinces.length) sp.set('province', filters.provinces.map(encodeURIComponent).join(','));
  if (filters.industries.length) sp.set('industry', filters.industries.map(encodeURIComponent).join(','));
  if (filters.revenueBand && filters.revenueBand !== 'any') sp.set('revenue', filters.revenueBand);
  if (filters.listedBy.length) sp.set('listedBy', filters.listedBy.join(','));
  if (filters.verifiedOnly) sp.set('verified', '1');
  if (filters.featuredOnly) sp.set('featured', '1');
  if (filters.sort && filters.sort !== 'recent') sp.set('sort', filters.sort);
  if (filters.view === 'list') sp.set('view', 'list');
  if (filters.page > 1) sp.set('page', String(filters.page));
  return sp;
}

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter(x => x !== value) : [...list, value];
}

function splitIndustry(value?: string | null) {
  return String(value || '').split(';').map(x => x.trim()).filter(Boolean);
}

function primaryIndustry(value?: string | null) {
  return splitIndustry(value)[0] || 'Doanh nghiệp';
}

function shortCity(value?: string | null) {
  const city = String(value || '').trim();
  if (!city) return 'Việt Nam';
  if (city === 'Ho Chi Minh City') return 'TP.HCM';
  if (city === 'Mekong Delta') return 'ĐBSCL';
  return city;
}

function revenueBandOf(b: any) {
  const revenueVnd = b.revenue_currency === 'USD' ? Number(b.revenue_2025 || 0) * 25_000 : Number(b.revenue_2025 || 0);
  if (revenueVnd < 10_000_000_000) return 's';
  if (revenueVnd <= 100_000_000_000) return 'm';
  return 'l';
}

function dealTypeLabel(lang: Lang, raw?: string | null) {
  const value = String(raw || '').toLowerCase();
  if (value.includes('debt') || value.includes('loan') || value.includes('vay')) return T(lang, 'Vay vốn', 'Debt');
  if (value.includes('asset') || value.includes('transfer') || value.includes('sang')) return T(lang, 'Sang nhượng', 'Transfer');
  if (value.includes('full') || value.includes('sale') || value.includes('acquisition')) return T(lang, 'Bán doanh nghiệp', 'Business sale');
  if (value.includes('strategic')) return T(lang, 'Nhà đầu tư chiến lược', 'Strategic investor');
  if (value.includes('fund') || value.includes('equity') || value.includes('primary')) return T(lang, 'Gọi vốn', 'Fundraising');
  return T(lang, 'Cơ hội đầu tư', 'Investment deal');
}

function matchesDealType(raw: string | null | undefined, filter: string) {
  if (!filter) return true;
  const value = String(raw || '').toLowerCase();
  return filter.toLowerCase().split(' ').some(part => part.length > 3 && value.includes(part)) || value.includes(filter.toLowerCase());
}

function compareBySort(sort: string) {
  return (a: any, b: any) => {
    if (sort === 'revHigh') return Number(b.revenue_2025 || 0) - Number(a.revenue_2025 || 0);
    if (sort === 'revLow') return Number(a.revenue_2025 || 0) - Number(b.revenue_2025 || 0);
    if (sort === 'rating') return Number(b.quality_score || 0) - Number(a.quality_score || 0);
    return String(b.created_at || b.updated_at || '').localeCompare(String(a.created_at || a.updated_at || '')) || Number(b.quality_score || 0) - Number(a.quality_score || 0);
  };
}

function filterBusinesses(items: any[], filters: Filters) {
  return items.filter(b => {
    const province = shortCity(b.city);
    const industryList = splitIndustry(b.industry);
    const listedByOk = !filters.listedBy.length || filters.listedBy.includes('deals68') || filters.listedBy.includes('owner');
    return matchesDealType(b.deal_type, filters.dealType)
      && (!filters.provinces.length || filters.provinces.includes(province))
      && (!filters.industries.length || industryList.some(x => filters.industries.includes(x)))
      && (filters.revenueBand === 'any' || revenueBandOf(b) === filters.revenueBand)
      && listedByOk
      && (!filters.verifiedOnly || Number(b.data_confidence || 0) >= 70)
      && (!filters.featuredOnly || b.plan === 'featured');
  }).slice().sort(compareBySort(filters.sort));
}

function countBy(items: any[], getter: (item: any) => string | string[]) {
  const map = new Map<string, number>();
  items.forEach(item => {
    const values = getter(item);
    const list = Array.isArray(values) ? values : [values];
    list.filter(Boolean).forEach(value => map.set(value, (map.get(value) || 0) + 1));
  });
  return map;
}

function tintClass(index: number) {
  return `d68-business-card__media d68-business-card__media--${(index % 6) + 1}`;
}

function ReferenceBusinessCard({ b, lang, view, index }: { b: any; lang: Lang; view: 'grid' | 'list'; index: number }) {
  const title = lang === 'en' ? (b.title_en || b.title_vi) : (b.title_vi || b.title_en);
  const description = lang === 'en' ? (b.description_en || b.highlights_en) : (b.description_vi || b.highlights_vi);
  const imageUrl = b.image_url || `/assets/deal${(index % 6) + 1}.png`;
  const isFeatured = b.plan === 'featured';
  const rating = Number(b.quality_score || 0) || Number(b.data_confidence || 0) || 0;
  const ask = b.stake_pct ? `${formatCompactMoney(b.ask_amount, b.ask_currency)} · ${percent(b.stake_pct)}` : formatCompactMoney(b.ask_amount, b.ask_currency);
  const rootClass = view === 'list' ? 'd68-card d68-business-card d68-business-card--list' : 'd68-business-card';

  return <Link className={rootClass} to={`/businesses/${b.slug}`}>
    <div className={tintClass(index)}>
      <img src={imageUrl} alt={title} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      {isFeatured && <span className="d68-featured-badge">★ Featured</span>}
      <span className="d68-rating-badge"><span>★</span>{rating || '-'}</span>
      {!imageUrl && <span className="d68-anon-badge">🔒 {T(lang, 'Ẩn danh', 'Anonymous')}</span>}
    </div>
    <div className="d68-business-card__body">
      <div className="d68-business-card__tags">
        <span>{primaryIndustry(b.industry)}</span>
        <span>{dealTypeLabel(lang, b.deal_type)}</span>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="d68-metrics d68-business-card__metrics">
        <div><span>{T(lang, 'Doanh thu', 'Revenue')}</span><b>{formatCompactMoney(b.revenue_2025, b.revenue_currency)}</b></div>
        <div><span>EBITDA</span><b>{percent(b.ebitda_margin)}</b></div>
        <div><span>{T(lang, 'Nhu cầu', 'Amount')}</span><b>{ask}</b></div>
      </div>
      <div className="d68-business-card__foot">
        <span>{shortCity(b.city)} · {b.public_code || 'D68'}</span>
        <b>{T(lang, 'Xem chi tiết', 'View details')} →</b>
      </div>
    </div>
  </Link>;
}

function CheckboxRow({ label, count, checked, onChange }: { label: string; count?: number; checked: boolean; onChange: () => void }) {
  return <label className="d68-filter-check">
    <input type="checkbox" checked={checked} onChange={onChange} />
    <span>{label}</span>
    {typeof count === 'number' && <em>{count}</em>}
  </label>;
}

export default function Businesses({ lang }: { lang: Lang }) {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const [draft, setDraft] = useState(filters);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { setDraft(filters); }, [params.toString()]);
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await listBusinesses({ includeHidden: false });
        if (mounted) setItems(data);
      } catch (err: any) {
        try {
          if (mounted) setItems(await fallbackSeedBusinesses());
        } catch {
          if (mounted) setError(err?.message || 'Không tải được danh sách doanh nghiệp.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const provinceCounts = useMemo(() => countBy(items, b => shortCity(b.city)), [items]);
  const industryCounts = useMemo(() => countBy(items, b => splitIndustry(b.industry)), [items]);
  const provinces = useMemo(() => unique(items.map(b => shortCity(b.city))).slice(0, 8), [items]);
  const industries = useMemo(() => unique(items.flatMap(b => splitIndustry(b.industry))).slice(0, 8), [items]);
  const filtered = useMemo(() => filterBusinesses(items, filters), [items, params.toString()]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(filters.page, totalPages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function commit(next: Filters) {
    setParams(writeFilters({ ...next, page: Math.min(next.page || 1, totalPages) }));
  }
  function apply(next: Partial<Filters> = {}) {
    commit({ ...draft, ...next, page: next.page || 1 } as Filters);
  }
  function clear() {
    const next = { dealType: '', provinces: [], industries: [], revenueBand: 'any', listedBy: [], verifiedOnly: false, featuredOnly: false, sort: 'recent', view: 'grid' as const, page: 1 };
    setDraft(next);
    setParams(new URLSearchParams());
  }
  function setTransactionTab(dealType: string) {
    const next = { ...draft, dealType, page: 1 };
    setDraft(next);
    commit(next);
  }

  return <div className="d68-businesses-page">
    <div className="d68-txbar"><div className="d68-txtabs">{txTabs.map(tab => <button key={tab.key || 'all'} className={filters.dealType === tab.key ? 'active' : ''} onClick={() => setTransactionTab(tab.key)}>{lang === 'en' ? tab.en : tab.vi}</button>)}</div></div>

    <div className="d68-businesses-title">
      <div className="d68-businesses-breadcrumb"><Link to="/">{T(lang, 'Trang chủ', 'Home')}</Link><span>›</span><Link to="/businesses">{T(lang, 'Doanh nghiệp', 'Businesses')}</Link><span>›</span><b>Việt Nam</b></div>
      <h1 className="d68-h1">{T(lang, 'Doanh nghiệp đang chào bán & gọi vốn tại Việt Nam', 'Businesses for Sale & Investment in Vietnam')}</h1>
      <p>{T(lang, `Hiển thị ${visible.length} trong ${filtered.length} thương vụ tại Việt Nam — hồ sơ ẩn danh do chủ doanh nghiệp và cố vấn đăng, đã qua kiểm duyệt Deals68.`, `Showing ${visible.length} of ${filtered.length} deals in Vietnam — anonymous profiles posted by owners and advisors, reviewed by Deals68.`)}</p>
    </div>

    <div className="d68-list-cols">
      <aside className="d68-sidebar">
        <div className="d68-filter-head"><span>{T(lang, 'Bộ lọc', 'Filters')}</span><button onClick={clear}>{T(lang, 'Xóa lọc', 'Clear')}</button></div>
        <div className="d68-filter-scroll">
          <div className="d68-filter-title">{T(lang, 'Tỉnh / Thành phố', 'Location')}</div>
          {provinces.map(p => <CheckboxRow key={p} label={p} count={provinceCounts.get(p)} checked={draft.provinces.includes(p)} onChange={() => setDraft({ ...draft, provinces: toggleValue(draft.provinces, p) })} />)}

          <div className="d68-filter-title d68-filter-title--border">{T(lang, 'Ngành', 'Industry')}</div>
          {industries.map(i => <CheckboxRow key={i} label={i} count={industryCounts.get(i)} checked={draft.industries.includes(i)} onChange={() => setDraft({ ...draft, industries: toggleValue(draft.industries, i) })} />)}

          <div className="d68-filter-title d68-filter-title--border">{T(lang, 'Doanh thu / năm', 'Annual revenue')}</div>
          <select className="d68-filter-select" value={draft.revenueBand} onChange={e => setDraft({ ...draft, revenueBand: e.target.value })}>{revenueBands.map(b => <option key={b.key} value={b.key}>{lang === 'en' ? b.en : b.vi}</option>)}</select>

          <div className="d68-filter-title d68-filter-title--border">{T(lang, 'Đăng bởi', 'Listed by')}</div>
          {listedByOptions.map(lb => <CheckboxRow key={lb.key} label={lang === 'en' ? lb.en : lb.vi} checked={draft.listedBy.includes(lb.key)} onChange={() => setDraft({ ...draft, listedBy: toggleValue(draft.listedBy, lb.key) })} />)}

          <div className="d68-filter-switches">
            <CheckboxRow label={T(lang, 'Đã xác minh', 'Verified only')} checked={draft.verifiedOnly} onChange={() => setDraft({ ...draft, verifiedOnly: !draft.verifiedOnly })} />
            <CheckboxRow label={T(lang, 'Nổi bật', 'Featured only')} checked={draft.featuredOnly} onChange={() => setDraft({ ...draft, featuredOnly: !draft.featuredOnly })} />
          </div>
        </div>
        <div className="d68-filter-submit"><button onClick={() => apply()}>{T(lang, 'Áp dụng bộ lọc', 'Apply filters')}</button></div>
      </aside>

      <main>
        <div className="d68-businesses-toolbar">
          <div>{loading ? '...' : filtered.length} {T(lang, 'thương vụ', 'deals')}</div>
          <div className="d68-businesses-toolbar__actions">
            <div className="d68-view-toggle"><button className={filters.view === 'grid' ? 'active' : ''} onClick={() => apply({ view: 'grid' })}>▦ {T(lang, 'Lưới', 'Grid')}</button><button className={filters.view === 'list' ? 'active' : ''} onClick={() => apply({ view: 'list' })}>☰ {T(lang, 'Danh sách', 'List')}</button></div>
            <label>{T(lang, 'Sắp xếp:', 'Sort by:')}<select value={draft.sort} onChange={e => { const sort = e.target.value; setDraft({ ...draft, sort }); apply({ sort }); }}>{sortOptions.map(o => <option key={o.value} value={o.value}>{lang === 'en' ? o.en : o.vi}</option>)}</select></label>
          </div>
        </div>

        {loading ? <div className="d68-grid-view">{Array.from({ length: 6 }).map((_, i) => <div className="d68-business-card" key={i}><div className={`d68-business-card__media d68-business-card__media--${(i % 6) + 1}`} /><div className="d68-business-card__body"><div className="d68-skeleton d68-skeleton--title"/><div className="d68-skeleton d68-skeleton--text"/></div></div>)}</div>
          : error ? <div className="empty">{error}</div>
          : visible.length === 0 ? <div className="empty">{T(lang, 'Chưa có doanh nghiệp phù hợp bộ lọc.', 'No businesses match these filters.')}</div>
          : <div className={filters.view === 'list' ? 'd68-business-list-view' : 'd68-grid-view'}>{visible.map((b, i) => <ReferenceBusinessCard key={b.id || b.slug} b={b} lang={lang} view={filters.view} index={i} />)}</div>}

        <div className="pagination-row"><button className="btn secondary" disabled={safePage <= 1} onClick={() => apply({ page: safePage - 1 })}>← {T(lang, 'Trước', 'Previous')}</button><div className="d68-pagination">{Array.from({ length: totalPages }).map((_, idx) => <button key={idx} aria-current={safePage === idx + 1 ? 'true' : undefined} onClick={() => apply({ page: idx + 1 })}>{idx + 1}</button>)}</div><button className="btn secondary" disabled={safePage >= totalPages} onClick={() => apply({ page: safePage + 1 })}>{T(lang, 'Sau', 'Next')} →</button></div>
      </main>
    </div>
  </div>;
}
