import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { listBusinessesPage, listBusinessFacets } from '../lib/data';
import { percent } from '../lib/format';
import { toLocalizedPath } from '../lib/i18nRoutes';
import {
  formatMoneyForLang,
  labelDealType,
  labelIndustry,
  labelLocation,
  locationKeyFromLabel,
  T,
} from '../lib/labels';
import type { Lang } from '../lib/i18n';
import { BusinessOnsiteContent } from '../components/BusinessFaq';
import { PromotionBanner } from '../components/SiteBanners';
import { industryKeyFromLabel } from '../lib/industryTaxonomy';

const PAGE_SIZE = 20;
type Tx = 'all' | 'sale' | 'invest' | 'loan' | 'jv';
type ViewMode = 'grid' | 'list';
type RevenueBand = '' | 'small' | 'mid' | 'large';
type SortMode = 'featured' | 'created' | 'ask' | 'revenue';

type Deal = {
  id: string; slug: string; image: string | null;
  titleVi: string; titleEn: string; descVi: string; descEn: string;
  cityRaw: string; industryRaw: string; group: Tx; dealTypeRaw: string;
  revenueValue: number; revenueCurrency: string; askValue: number; askCurrency: string; stakePct: number;
  ebitda: string; quality: number | null; featured: boolean;
};

function arrText(value: any) { return Array.isArray(value) ? value.filter(Boolean).join(' · ') : String(value || ''); }

function normalizeGroup(raw?: string | null): Tx {
  const v = String(raw || '').toLowerCase();
  if (v.includes('loan') || v.includes('debt') || v.includes('vay')) return 'loan';
  if (v.includes('jv') || v.includes('joint') || v.includes('partner') || v.includes('đối tác')) return 'jv';
  if (v.includes('sale') || v.includes('transfer') || v.includes('m&a') || v.includes('bán') || v.includes('chuyển nhượng')) return 'sale';
  return 'invest';
}
const TX_DB: Record<Exclude<Tx, 'all'>, string> = { sale: 'sale', invest: 'fundrais', loan: 'loan', jv: 'partner' };

function scrollListingToTop(selector: string) {
  if (typeof window === 'undefined') return;
  const el = document.querySelector(selector);
  const top = el instanceof HTMLElement ? Math.max(0, el.getBoundingClientRect().top + window.scrollY - 92) : 0;
  window.scrollTo({ top, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = top;
  document.body.scrollTop = top;
  document.querySelectorAll('.d68-filter-scroll,.d68-investors-sidebar,.d68-list-cols,.d68-investors-results').forEach((node) => {
    if (node instanceof HTMLElement) node.scrollTop = 0;
  });
}

function txFromQuery(raw: string | null): Tx {
  const v = String(raw || '').toLowerCase();
  if (!v) return 'all';
  if (v.includes('loan') || v.includes('vay') || v.includes('debt')) return 'loan';
  if (v.includes('sale') || v.includes('bán') || v.includes('transfer')) return 'sale';
  if (v.includes('jv') || v.includes('partner') || v.includes('đối tác')) return 'jv';
  if (v.includes('invest') || v.includes('fund') || v.includes('gọi')) return 'invest';
  return 'all';
}

function normalizeBusiness(b: any): Deal {
  const titleVi = b.title_vi || b.public_code || 'Hồ sơ doanh nghiệp đang cập nhật';
  const descVi = b.description_vi || arrText(b.highlights_vi) || b.investment_reason_vi || '';
  const q = b.quality_score === null || b.quality_score === undefined ? null : Number(b.quality_score);
  return {
    id: String(b.id || b.slug || b.public_code),
    slug: String(b.slug || ''),
    image: b.image_url || b.hero_image_url || null,
    titleVi,
    titleEn: b.title_en || titleVi,
    descVi,
    descEn: b.description_en || arrText(b.highlights_en) || descVi,
    cityRaw: b.city_key || b.city || b.country_iso2 || 'VN',
    industryRaw: String(b.industry || 'Đang cập nhật').split(';')[0].trim(),
    group: normalizeGroup(b.deal_type),
    dealTypeRaw: b.deal_type || '',
    revenueValue: Number(b.revenue_2025 || 0),
    revenueCurrency: b.revenue_currency || 'VND',
    askValue: Number(b.ask_amount || 0),
    askCurrency: b.ask_currency || b.revenue_currency || 'VND',
    stakePct: Number(b.stake_pct || 0),
    ebitda: b.ebitda_margin === null || b.ebitda_margin === undefined ? 'Đang cập nhật' : percent(b.ebitda_margin),
    quality: Number.isFinite(q) ? q : null,
    featured: b.plan === 'featured'
  };
}

function DealCard({ d, lang, view, tintIndex }: { d: Deal; lang: Lang; view: ViewMode; tintIndex: number }) {
  const title = T(lang, d.titleVi, d.titleEn);
  const desc = T(lang, d.descVi, d.descEn) || T(lang, 'Hồ sơ đang được doanh nghiệp/Admin cập nhật.', 'Profile is being updated by the business/Admin.');
  const nav = (path: string) => toLocalizedPath(path, lang);
  return (
    <Link to={nav(`/businesses/${d.slug}`)} className={`d68-business-card${view === 'list' ? ' d68-business-card--list' : ''}`}>
      <div className={`d68-business-card__media d68-business-card__media--${(tintIndex % 6) + 1}`}>
        {d.image
          ? <img src={d.image} alt={title} loading="lazy" decoding="async" fetchPriority="low" width={640} height={360} />
          : <span className="d68-anon-badge">{T(lang, 'Deals68 · Hồ sơ ẩn danh', 'Deals68 · Anonymous listing')}</span>}
        {d.featured ? <span className="d68-featured-badge">★ {T(lang, 'Nổi bật', 'Featured')}</span> : null}
        {d.quality !== null ? <span className="d68-rating-badge"><span>◆</span>{d.quality}/100</span> : null}
      </div>
      <div className="d68-business-card__body">
        <div className="d68-business-card__tags"><span>{labelIndustry(d.industryRaw, lang)}</span><span>📍 {labelLocation(d.cityRaw, lang)}</span></div>
        <h3 className="d68-entity-title-link">{title}</h3>
        <p>{desc}</p>
        <div className="d68-business-card__metrics">
          <div><span>{T(lang, 'Doanh thu', 'Revenue')}</span><b>{formatMoneyForLang(d.revenueValue, d.revenueCurrency, lang)}</b></div>
          <div><span>EBITDA</span><b>{d.ebitda === 'Đang cập nhật' ? T(lang, 'Đang cập nhật', 'Pending') : d.ebitda}</b></div>
          <div><span>{T(lang, 'Nhu cầu', 'Ask')}</span><b>{formatMoneyForLang(d.askValue, d.askCurrency, lang, { stakePct: d.stakePct })}</b></div>
        </div>
        <div className="d68-business-card__foot"><span>{labelDealType(d.dealTypeRaw, lang)}</span><b>{T(lang, 'Xem chi tiết', 'View details')} →</b></div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="d68-business-card" aria-hidden="true">
      <div className="d68-business-card__media d68-business-card__media--5" />
      <div className="d68-business-card__body">
        <div className="d68-skeleton d68-skeleton--title" />
        <div className="d68-skeleton d68-skeleton--text" />
      </div>
    </div>
  );
}

export default function Businesses({ lang }: { lang: Lang }) {
  const location = useLocation();
  const nav = (path: string) => toLocalizedPath(path, lang);

  const [rows, setRows] = useState<Deal[]>([]);
  const [facets, setFacets] = useState<{ city: string; city_key: string; country_iso2: string; industry: string; industry_key: string; deal_type: string; plan: string; quality_score: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<SortMode>('featured');
  const [tx, setTx] = useState<Tx>('all');
  const [query, setQuery] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [revenueBand, setRevenueBand] = useState<RevenueBand>('');
  const [quality70, setQuality70] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    setQuery(p.get('search') || p.get('q') || '');
    const rawIndustry = p.get('industry') || '';
    const industryKey = industryKeyFromLabel(rawIndustry);
    setIndustries(rawIndustry ? [industryKey || rawIndustry] : []);
    const rawCity = p.get('city') || '';
    setCities(rawCity ? [locationKeyFromLabel(rawCity) || rawCity] : []);
    setTx(txFromQuery(p.get('dealType')));
    setPage(1);
  }, [location.search]);

  useEffect(() => {
    let live = true;
    listBusinessFacets({ search: query || undefined })
      .then((f) => { if (live) setFacets(f); })
      .catch(() => { if (live) setFacets([]); });
    return () => { live = false; };
  }, [query]);

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true); setError('');
      try {
        const filters: any = { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, sort, search: query || undefined, cityKey: cities[0] || undefined, industry: industries[0] || undefined, revenueBand: revenueBand || undefined, minQuality: quality70 ? 70 : undefined, featuredOnly: featuredOnly || undefined };
        if (tx !== 'all') filters.dealType = TX_DB[tx];
        const result = await listBusinessesPage(filters);
        if (!live) return;
        setRows((result.rows || []).map(normalizeBusiness).filter((d) => d.slug));
        setTotal(result.total);
      } catch (e: any) {
        if (!live) return;
        setRows([]); setTotal(0);
        setError(e?.message || T(lang, 'Không tải được dữ liệu doanh nghiệp.', 'Could not load businesses.'));
      } finally { if (live) setLoading(false); }
    }
    load();
    return () => { live = false; };
  }, [page, tx, sort, query, cities, industries, revenueBand, quality70, featuredOnly, lang]);

  const txCounts = useMemo(() => {
    const c: Record<Tx, number> = { all: facets.length, sale: 0, invest: 0, loan: 0, jv: 0 };
    facets.forEach((f) => { c[normalizeGroup(f.deal_type)]++; });
    return c;
  }, [facets]);
  const cityFacets = useMemo(() => {
    const m = new Map<string, number>();
    facets.forEach((f) => {
      const countryIso2 = f.country_iso2 || '';
      const key =
        locationKeyFromLabel(f.city_key, countryIso2) ||
        locationKeyFromLabel(f.city, countryIso2);
      if (!key) return;
      m.set(key, (m.get(key) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [facets]);
  const industryFacets = useMemo(() => {
    const m = new Map<string, number>();
    facets.forEach((f) => {
      const key = industryKeyFromLabel(f.industry_key || f.industry);
      if (!key) return;
      m.set(key, (m.get(key) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 23);
  }, [facets]);

  const pageCount = Math.max(1, Math.ceil((total || rows.length || 1) / PAGE_SIZE));
  const resultStart = total === 0 || (!loading && !rows.length) ? 0 : (page - 1) * PAGE_SIZE + 1;
  const resultEnd = total === null ? (page - 1) * PAGE_SIZE + rows.length : Math.min((page - 1) * PAGE_SIZE + rows.length, total);
  const resultRangeText = total !== null ? `${T(lang, 'Hiển thị', 'Showing')} ${resultStart}-${resultEnd}/${total} ${T(lang, 'doanh nghiệp', 'businesses')}` : `${T(lang, 'Hiển thị', 'Showing')} ${rows.length} ${T(lang, 'doanh nghiệp', 'businesses')}`;
  const toggle = (list: string[], set: (next: string[]) => void, key: string) =>
    set(list.includes(key) ? list.filter((x) => x !== key) : [key]);
  const clearAll = () => { setTx('all'); setQuery(''); setCities([]); setIndustries([]); setRevenueBand(''); setQuality70(false); setFeaturedOnly(false); setPage(1); };
  const goPage = (nextPage: number) => {
    setPage(Math.max(1, nextPage));
    scrollListingToTop('.d68-businesses-page');
    setTimeout(() => scrollListingToTop('.d68-businesses-page'), 0);
  };

  useEffect(() => {
    scrollListingToTop('.d68-businesses-page');
  }, [page]);

  const txDefs: { key: Tx; vi: string; en: string }[] = [
    { key: 'all', vi: 'Tất cả giao dịch', en: 'All transactions' },
    { key: 'sale', vi: 'Bán doanh nghiệp', en: 'Businesses for sale' },
    { key: 'invest', vi: 'Gọi vốn & Đầu tư', en: 'Investment opportunities' },
    { key: 'loan', vi: 'Vay vốn', en: 'Business loans' },
    { key: 'jv', vi: 'Liên doanh, đối tác', en: 'Joint ventures and partnerships' }
  ];

  return (
    <main className="d68-businesses-page">
      <section className="d68-businesses-title">
        <div className="d68-businesses-breadcrumb"><Link to={nav('/')}>{T(lang, 'Trang chủ', 'Home')}</Link> › <b>{T(lang, 'Doanh nghiệp', 'Businesses')}</b></div>
        <h1>{T(lang, 'Doanh nghiệp đang chào bán & gọi vốn', 'Businesses for Sale & Investment')}</h1>
        <p>{T(lang, 'Khám phá các cơ hội mua bán, gọi vốn và vay vốn của doanh nghiệp tại Việt Nam và quốc tế. Hồ sơ ẩn danh, thông tin nhạy cảm chỉ mở khi kết nối được chấp thuận.', 'Explore business sale, fundraising and lending opportunities from businesses in Vietnam and internationally. Profiles are anonymous, and sensitive information is unlocked only after an approved connection.')}</p>
      </section>

      <div className="d68-txbar"><div className="d68-txtabs" role="tablist">{txDefs.map((t) => <button key={t.key} role="tab" aria-selected={tx === t.key} className={tx === t.key ? 'active' : ''} onClick={() => { setTx(t.key); setPage(1); }}>{T(lang, t.vi, t.en)}{facets.length ? ` (${txCounts[t.key]})` : ''}</button>)}</div></div>

      <div className="d68-list-cols">
        <aside className="d68-sidebar">
          <div className="d68-filter-head"><span>{T(lang, 'Bộ lọc', 'Filters')}</span><button onClick={clearAll}>{T(lang, 'Xóa lọc', 'Clear all')}</button></div>
          <div className="d68-filter-scroll">
            <div className="d68-filter-title">{T(lang, 'Từ khóa', 'Keyword')}</div>
            <input className="d68-filter-select" value={query} placeholder={T(lang, 'Mã hồ sơ, ngành, tiêu đề...', 'Code, industry, title...')} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />

            <div className="d68-filter-title d68-filter-title--border">{T(lang, 'Địa điểm', 'Location')}</div>
            {cityFacets.length ? cityFacets.map(([cityKey, n]) => <label key={cityKey} className="d68-filter-check"><input type="checkbox" checked={cities.includes(cityKey)} onChange={() => { toggle(cities, setCities, cityKey); setPage(1); }} /><span>{labelLocation(cityKey, lang)}</span><em>{n}</em></label>) : <div className="d68-filter-check"><em>{T(lang, 'Đang cập nhật', 'Updating')}</em></div>}

            <div className="d68-filter-title d68-filter-title--border">{T(lang, 'Ngành', 'Industry')}</div>
            {industryFacets.length ? industryFacets.map(([ind, n]) => <label key={ind} className="d68-filter-check"><input type="checkbox" checked={industries.includes(ind)} onChange={() => { toggle(industries, setIndustries, ind); setPage(1); }} /><span>{labelIndustry(ind, lang)}</span><em>{n}</em></label>) : <div className="d68-filter-check"><em>{T(lang, 'Đang cập nhật', 'Updating')}</em></div>}

            <div className="d68-filter-title d68-filter-title--border">{T(lang, 'Doanh thu năm', 'Annual revenue')}</div>
            <select className="d68-filter-select" value={revenueBand} onChange={(e) => { setRevenueBand(e.target.value as RevenueBand); setPage(1); }}>
              <option value="">{T(lang, 'Tất cả mức doanh thu', 'Any revenue')}</option>
              <option value="small">{T(lang, 'Dưới 10 tỷ ₫', 'Under $400K')}</option>
              <option value="mid">{T(lang, '10 – 100 tỷ ₫', '$0.4M – $4M')}</option>
              <option value="large">{T(lang, 'Trên 100 tỷ ₫', 'Over $4M')}</option>
            </select>

            <div className="d68-filter-switches">
              <label className="d68-filter-check"><input type="checkbox" checked={quality70} onChange={(e) => { setQuality70(e.target.checked); setPage(1); }} /><span>{T(lang, 'Điểm chất lượng ≥ 70', 'Quality score ≥ 70')}</span></label>
              <label className="d68-filter-check"><input type="checkbox" checked={featuredOnly} onChange={(e) => { setFeaturedOnly(e.target.checked); setPage(1); }} /><span>{T(lang, 'Chỉ hồ sơ Nổi bật', 'Featured only')}</span></label>
            </div>
          </div>
          <div className="d68-filter-submit"><button onClick={() => setPage(1)}>{T(lang, 'Áp dụng bộ lọc', 'Apply filters')}</button></div>
        </aside>

        <section>
          <div className="d68-businesses-results-content">
          <div className="d68-businesses-toolbar">
            <div>{loading ? T(lang, 'Đang tải dữ liệu…', 'Loading data…') : resultRangeText}</div>
            <div className="d68-businesses-toolbar__actions">
              <label className="d68-sort-label"><span>{T(lang, 'Sắp xếp', 'Sort')}</span><select value={sort} onChange={(e) => { setSort(e.target.value as SortMode); setPage(1); }}><option value="featured">{T(lang, 'Phù hợp nhất', 'Best match')}</option><option value="created">{T(lang, 'Mới nhất', 'Newest')}</option><option value="ask">{T(lang, 'Nhu cầu vốn cao', 'Highest ask')}</option><option value="revenue">{T(lang, 'Doanh thu cao', 'Highest revenue')}</option></select></label>
              <div className="d68-view-toggle"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>▦ {T(lang, 'Lưới', 'Grid')}</button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>☰ {T(lang, 'Danh sách', 'List')}</button></div>
            </div>
          </div>

          {error ? <div className="d68-list-error" role="alert">{error}</div> : null}
          <div className={view === 'grid' ? 'd68-grid-view' : 'd68-business-list-view'}>{loading ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />) : rows.map((d, i) => <DealCard key={d.id} d={d} lang={lang} view={view} tintIndex={i} />)}</div>
          {!loading && !error && !rows.length ? <div className="d68-list-empty"><b>{T(lang, 'Chưa có hồ sơ phù hợp bộ lọc hiện tại.', 'No profiles match the current filters.')}</b><p>{T(lang, 'Thử xóa bớt bộ lọc hoặc quay lại sau — hồ sơ mới hiển thị ngay khi được Admin duyệt.', 'Try clearing filters or check back soon — new profiles appear as soon as Admin approves them.')}</p><button onClick={clearAll}>{T(lang, 'Xóa toàn bộ bộ lọc', 'Clear all filters')}</button></div> : null}

          {pageCount > 1 ? <div className="d68-pagination" style={{ justifyContent: 'center', marginTop: 24 }}><button disabled={page <= 1 || loading} onClick={() => goPage(page - 1)}>{T(lang, '< Trang trước', '< Previous')}</button>{Array.from({ length: pageCount }).map((_, i) => <button key={i} aria-current={page === i + 1} onClick={() => goPage(i + 1)}>{i + 1}</button>)}<button disabled={loading || page >= pageCount} onClick={() => goPage(page + 1)}>{T(lang, 'Trang tiếp >', 'Next >')}</button></div> : null}
          </div>
          <PromotionBanner placement="listing_promotion" lang={lang} className="d68-listing-promo" />
        </section>
      </div>
      <BusinessOnsiteContent lang={lang} />
    </main>
  );
}
