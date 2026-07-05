import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { countBusinesses, listBusinesses, listBusinessFacets } from '../lib/data';
import { formatCompactMoney, percent } from '../lib/format';
import type { Lang } from '../lib/i18n';
import { localizedPath } from '../lib/i18nRoutes';

/**
 * /businesses — port theo ui-reference/Deals68 Businesses.dc.html (SPEC v1.3 §15.1).
 * - UI: dùng class trong src/styles/pages/businesses.css (không inline redesign — B8).
 * - Data: 100% Supabase qua listBusinesses/countBusinesses/listBusinessFacets với
 *   CÙNG bộ filter public (visible + active + public_snapshot_json) — B7/15.6.
 * - Không mock, không hardcode count, không fabricate điểm/badge — B5.
 * - Fallback production-safe duy nhất: "Đang cập nhật" (được phép theo B8).
 */

const T = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);
const PAGE_SIZE = 9;

type Tx = 'all' | 'sale' | 'invest' | 'loan' | 'jv';
type ViewMode = 'grid' | 'list';
type RevenueBand = '' | 'small' | 'mid' | 'large';
type SortMode = 'featured' | 'created' | 'ask' | 'revenue';

type Deal = {
  id: string; slug: string; image: string | null;
  titleVi: string; titleEn: string; descVi: string; descEn: string;
  city: string; industry: string; group: Tx; dealTypeVi: string; dealTypeEn: string;
  revenue: string; ask: string; ebitda: string;
  quality: number | null; featured: boolean;
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

function dealTypeLabels(raw?: string | null) {
  const tokens = String(raw || '')
    .split(/[;,/|]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const vi: string[] = [];
  const en: string[] = [];
  const push = (v: string, e: string) => { if (!vi.includes(v)) vi.push(v); if (!en.includes(e)) en.push(e); };

  tokens.forEach((v) => {
    if (v.includes('asset') || v.includes('transfer') || v.includes('chuyển nhượng tài sản')) push('Chuyển nhượng tài sản', 'Asset transfer');
    else if (v.includes('fund') || v.includes('raise') || v.includes('invest') || v.includes('gọi') || v.includes('vốn')) push('Gọi vốn', 'Fundraise');
    else if (v.includes('loan') || v.includes('debt') || v.includes('vay')) push('Vay vốn', 'Debt financing');
    else if (v.includes('jv') || v.includes('joint') || v.includes('partner') || v.includes('đối tác')) push('JV / Đối tác', 'JV / Partnership');
    else if (v.includes('sale') || v.includes('m&a') || v.includes('acquisition') || v.includes('bán')) push('M&A / Chuyển nhượng', 'M&A / Sale');
  });

  if (!vi.length) return { vi: 'Đang cập nhật', en: raw ? String(raw).split(';')[0].trim() : 'Updating' };
  return { vi: vi.join(' / '), en: en.join(' / ') };
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
  const askNum = Number(b.ask_amount || 0);
  const dealLabels = dealTypeLabels(b.deal_type);
  return {
    id: String(b.id || b.slug || b.public_code),
    slug: String(b.slug || ''),
    image: b.image_url || b.hero_image_url || null,
    titleVi,
    titleEn: b.title_en || titleVi,
    descVi,
    descEn: b.description_en || arrText(b.highlights_en) || descVi,
    city: b.city || 'Việt Nam',
    industry: String(b.industry || 'Đang cập nhật').split(';')[0].trim(),
    group: normalizeGroup(b.deal_type),
    dealTypeVi: dealLabels.vi,
    dealTypeEn: dealLabels.en,
    revenue: Number(b.revenue_2025 || 0) > 0 ? formatCompactMoney(b.revenue_2025, b.revenue_currency || 'VND') : 'Đang cập nhật',
    ask: askNum > 0
      ? `${formatCompactMoney(askNum, b.ask_currency || b.revenue_currency || 'VND')}${Number(b.stake_pct || 0) ? ` · ${percent(b.stake_pct)}` : ''}`
      : 'Đang cập nhật',
    ebitda: b.ebitda_margin === null || b.ebitda_margin === undefined ? 'Đang cập nhật' : percent(b.ebitda_margin),
    quality: Number.isFinite(q) ? q : null,
    featured: b.plan === 'featured'
  };
}

function DealCard({ d, lang, view, tintIndex }: { d: Deal; lang: Lang; view: ViewMode; tintIndex: number }) {
  const title = T(lang, d.titleVi, d.titleEn);
  const desc = T(lang, d.descVi, d.descEn) || T(lang, 'Hồ sơ đang được doanh nghiệp/Admin cập nhật.', 'Profile is being updated by the business/Admin.');
  return (
    <Link to={localizedPath(`/businesses/${d.slug}`, lang)} className={`d68-business-card${view === 'list' ? ' d68-business-card--list' : ''}`}>
      <div className={`d68-business-card__media d68-business-card__media--${(tintIndex % 6) + 1}`}>
        {d.image
          ? <img src={d.image} alt={title} loading="lazy" />
          : <span className="d68-anon-badge">{T(lang, 'Deals68 · Hồ sơ ẩn danh', 'Deals68 · Anonymous listing')}</span>}
        {d.featured ? <span className="d68-featured-badge">★ {T(lang, 'Nổi bật', 'Featured')}</span> : null}
        {d.quality !== null ? <span className="d68-rating-badge"><span>◆</span>{d.quality}/100</span> : null}
      </div>
      <div className="d68-business-card__body">
        <div className="d68-business-card__tags"><span>{d.industry}</span><span>📍 {d.city}</span></div>
        <h3>{title}</h3>
        <p>{desc}</p>
        <div className="d68-business-card__metrics">
          <div><span>{T(lang, 'Doanh thu', 'Revenue')}</span><b>{d.revenue}</b></div>
          <div><span>EBITDA</span><b>{d.ebitda}</b></div>
          <div><span>{T(lang, 'Nhu cầu', 'Ask')}</span><b>{d.ask}</b></div>
        </div>
        <div className="d68-business-card__foot"><span>{T(lang, d.dealTypeVi, d.dealTypeEn)}</span><b>{T(lang, 'Xem chi tiết', 'View details')} →</b></div>
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
  const to = (path: string) => localizedPath(path, lang);

  const [rows, setRows] = useState<Deal[]>([]);
  const [facets, setFacets] = useState<{ city: string; industry: string; deal_type: string; plan: string; quality_score: number | null }[]>([]);
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
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  // Nhận filter từ URL (Home search bar trỏ về đây)
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    setQuery(p.get('search') || p.get('q') || '');
    setIndustries(p.get('industry') ? [p.get('industry') as string] : []);
    setTx(txFromQuery(p.get('dealType')));
    setPage(1);
  }, [location.search]);

  // Facets: cùng bộ public filter, để tab/sidebar count khớp list (B8/15.6)
  useEffect(() => {
    let live = true;
    listBusinessFacets({ search: query || undefined })
      .then((f) => { if (live) setFacets(f); })
      .catch(() => { if (live) setFacets([]); });
    return () => { live = false; };
  }, [query]);

  // List + count: server-side, cùng bộ filter
  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true); setError('');
      try {
        const filters: any = {
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          sort,
          search: query || undefined,
          city: cities[0] || undefined,
          industry: industries[0] || undefined,
          revenueBand: revenueBand || undefined,
          minQuality: quality70 ? 70 : undefined,
          featuredOnly: featuredOnly || undefined
        };
        if (tx !== 'all') filters.dealType = TX_DB[tx];
        const [data, count] = await Promise.all([listBusinesses(filters), countBusinesses(filters).catch(() => null)]);
        if (!live) return;
        setRows((data || []).map(normalizeBusiness).filter((d) => d.slug));
        setTotal(count);
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
    facets.forEach((f) => { const k = (f.city || 'Đang cập nhật').trim(); m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [facets]);
  const industryFacets = useMemo(() => {
    const m = new Map<string, number>();
    facets.forEach((f) => String(f.industry || '').split(';').map((x) => x.trim()).filter(Boolean)
      .forEach((k) => m.set(k, (m.get(k) || 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [facets]);

  const pageCount = useMemo(() => (total === null ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE))), [total]);
  const toggle = (list: string[], set: (v: string[]) => void, key: string) =>
    set(list.includes(key) ? list.filter((x) => x !== key) : [key]); // single-select: khớp filter server 1 giá trị
  const clearAll = () => { setTx('all'); setQuery(''); setCities([]); setIndustries([]); setRevenueBand(''); setQuality70(false); setFeaturedOnly(false); setPage(1); };

  const txDefs: { key: Tx; vi: string; en: string }[] = [
    { key: 'all', vi: 'Tất cả giao dịch', en: 'All transactions' },
    { key: 'sale', vi: 'Bán doanh nghiệp', en: 'Businesses for sale' },
    { key: 'invest', vi: 'Gọi vốn & Đầu tư', en: 'Investment opportunities' },
    { key: 'loan', vi: 'Vay vốn', en: 'Business loans' },
    { key: 'jv', vi: 'JV & Đối tác', en: 'JV & Partnership' }
  ];

  const faqs = [
    { q: T(lang, 'Deals68 hiển thị những doanh nghiệp nào?', 'Which businesses appear on Deals68?'), a: T(lang, 'Chỉ hồ sơ đang active, visible và đã có bản công khai được Admin duyệt (public snapshot) mới hiển thị. Số lượng trên trang là số đếm trực tiếp từ database.', 'Only active, visible profiles with an Admin-approved public snapshot are shown. Counts on this page are queried directly from the database.') },
    { q: T(lang, 'Vì sao hồ sơ được ẩn danh?', 'Why are listings anonymous?'), a: T(lang, 'Tiêu đề công khai do Admin biên soạn để bảo vệ danh tính doanh nghiệp. Tên pháp lý, thông tin liên hệ và tài liệu nhạy cảm chỉ mở theo quy trình kết nối được duyệt.', 'Public titles are edited by Admin to protect business identity. Legal names, contacts and sensitive documents unlock only through an approved connection process.') },
    { q: T(lang, 'Điểm chất lượng nghĩa là gì?', 'What does the quality score mean?'), a: T(lang, 'Điểm do Admin chấm theo bộ tiêu chí hồ sơ, mang tính tham khảo cho việc sàng lọc ban đầu và không thay thế thẩm định độc lập của nhà đầu tư.', 'Scores are assigned by Admin against profile criteria. They support initial screening only and do not replace independent due diligence.') },
    { q: T(lang, 'Làm sao liên hệ với doanh nghiệp?', 'How do I contact a business?'), a: T(lang, 'Đăng nhập bằng tài khoản nhà đầu tư, bày tỏ quan tâm hoặc gửi yêu cầu dữ liệu ngay trong trang chi tiết. Thông tin trao đổi chi tiết mở sau khi kết nối được chấp thuận.', 'Log in with an investor account, then express interest or request data from the detail page. Detailed exchanges open after the connection is approved.') }
  ];

  return (
    <main className="d68-businesses-page">
      <section className="d68-businesses-title">
        <div className="d68-businesses-breadcrumb"><Link to={to('/')}>{T(lang, 'Trang chủ', 'Home')}</Link> › <b>{T(lang, 'Doanh nghiệp', 'Businesses')}</b></div>
        <h1>{T(lang, 'Doanh nghiệp đang chào bán & gọi vốn tại Việt Nam', 'Businesses for Sale & Investment in Vietnam')}</h1>
        <p>{T(lang, 'Khám phá các cơ hội mua bán, gọi vốn và vay vốn đã được Admin duyệt hiển thị. Hồ sơ ẩn danh; thông tin nhạy cảm chỉ mở khi kết nối được chấp thuận.', 'Explore Admin-approved acquisition, fundraising and lending opportunities. Listings are anonymous; sensitive details unlock only after an approved connection.')}</p>
      </section>

      <div className="d68-txbar">
        <div className="d68-txtabs" role="tablist">
          {txDefs.map((t) => (
            <button key={t.key} role="tab" aria-selected={tx === t.key} className={tx === t.key ? 'active' : ''}
              onClick={() => { setTx(t.key); setPage(1); }}>
              {T(lang, t.vi, t.en)}{facets.length ? ` (${txCounts[t.key]})` : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="d68-list-cols">
        <aside className="d68-sidebar">
          <div className="d68-filter-head"><span>{T(lang, 'Bộ lọc', 'Filters')}</span><button onClick={clearAll}>{T(lang, 'Xóa lọc', 'Clear all')}</button></div>
          <div className="d68-filter-scroll">
            <div className="d68-filter-title">{T(lang, 'Từ khóa', 'Keyword')}</div>
            <input className="d68-filter-select" value={query} placeholder={T(lang, 'Mã hồ sơ, ngành, tiêu đề...', 'Code, industry, title...')}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }} />

            <div className="d68-filter-title d68-filter-title--border">{T(lang, 'Địa điểm', 'Location')}</div>
            {cityFacets.length ? cityFacets.map(([city, n]) => (
              <label key={city} className="d68-filter-check">
                <input type="checkbox" checked={cities.includes(city)} onChange={() => { toggle(cities, setCities, city); setPage(1); }} />
                <span>{city}</span><em>{n}</em>
              </label>
            )) : <div className="d68-filter-check"><em>{T(lang, 'Đang cập nhật', 'Updating')}</em></div>}

            <div className="d68-filter-title d68-filter-title--border">{T(lang, 'Ngành', 'Industry')}</div>
            {industryFacets.length ? industryFacets.map(([ind, n]) => (
              <label key={ind} className="d68-filter-check">
                <input type="checkbox" checked={industries.includes(ind)} onChange={() => { toggle(industries, setIndustries, ind); setPage(1); }} />
                <span>{ind}</span><em>{n}</em>
              </label>
            )) : <div className="d68-filter-check"><em>{T(lang, 'Đang cập nhật', 'Updating')}</em></div>}

            <div className="d68-filter-title d68-filter-title--border">{T(lang, 'Doanh thu năm', 'Annual revenue')}</div>
            <select className="d68-filter-select" value={revenueBand} onChange={(e) => { setRevenueBand(e.target.value as RevenueBand); setPage(1); }}>
              <option value="">{T(lang, 'Tất cả mức doanh thu', 'Any revenue')}</option>
              <option value="small">{T(lang, 'Dưới 10 tỷ ₫ (~$400K)', 'Under $400K (~10B ₫)')}</option>
              <option value="mid">{T(lang, '10 – 100 tỷ ₫ (~$0.4–4M)', '$0.4M – $4M')}</option>
              <option value="large">{T(lang, 'Trên 100 tỷ ₫ (~$4M+)', 'Over $4M')}</option>
            </select>

            <div className="d68-filter-switches">
              <label className="d68-filter-check">
                <input type="checkbox" checked={quality70} onChange={(e) => { setQuality70(e.target.checked); setPage(1); }} />
                <span>{T(lang, 'Điểm chất lượng ≥ 70', 'Quality score ≥ 70')}</span>
              </label>
              <label className="d68-filter-check">
                <input type="checkbox" checked={featuredOnly} onChange={(e) => { setFeaturedOnly(e.target.checked); setPage(1); }} />
                <span>{T(lang, 'Chỉ hồ sơ Nổi bật', 'Featured only')}</span>
              </label>
            </div>
          </div>
          <div className="d68-filter-submit"><button onClick={() => setPage(1)}>{T(lang, 'Áp dụng bộ lọc', 'Apply filters')}</button></div>
        </aside>

        <section>
          <div className="d68-businesses-toolbar">
            <div>{loading
              ? T(lang, 'Đang tải dữ liệu…', 'Loading data…')
              : `${T(lang, 'Hiển thị', 'Showing')} ${rows.length}${total !== null ? ` / ${total}` : ''} ${T(lang, 'hồ sơ', 'profiles')}`}</div>
            <div className="d68-businesses-toolbar__actions">
              <label>{T(lang, 'Sắp xếp', 'Sort')}
                <select value={sort} onChange={(e) => { setSort(e.target.value as SortMode); setPage(1); }}>
                  <option value="featured">{T(lang, 'Phù hợp nhất', 'Best match')}</option>
                  <option value="created">{T(lang, 'Mới nhất', 'Newest')}</option>
                  <option value="ask">{T(lang, 'Nhu cầu vốn cao', 'Highest ask')}</option>
                  <option value="revenue">{T(lang, 'Doanh thu cao', 'Highest revenue')}</option>
                </select>
              </label>
              <div className="d68-view-toggle">
                <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>▦ {T(lang, 'Lưới', 'Grid')}</button>
                <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>☰ {T(lang, 'Danh sách', 'List')}</button>
              </div>
            </div>
          </div>

          {error ? <div className="d68-list-error" role="alert">{error}</div> : null}

          <div className={view === 'grid' ? 'd68-grid-view' : 'd68-business-list-view'}>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              : rows.map((d, i) => <DealCard key={d.id} d={d} lang={lang} view={view} tintIndex={i} />)}
          </div>

          {!loading && !error && !rows.length ? (
            <div className="d68-list-empty">
              <b>{T(lang, 'Chưa có hồ sơ phù hợp bộ lọc hiện tại.', 'No profiles match the current filters.')}</b>
              <p>{T(lang, 'Thử xóa bớt bộ lọc hoặc quay lại sau — hồ sơ mới hiển thị ngay khi được Admin duyệt.', 'Try clearing filters or check back soon — new profiles appear as soon as Admin approves them.')}</p>
              <button onClick={clearAll}>{T(lang, 'Xóa toàn bộ bộ lọc', 'Clear all filters')}</button>
            </div>
          ) : null}

          {pageCount > 1 ? (
            <div className="d68-pagination" style={{ justifyContent: 'center', marginTop: 24 }}>
              <button disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>←</button>
              {Array.from({ length: pageCount }).map((_, i) => (
                <button key={i} aria-current={page === i + 1} onClick={() => setPage(i + 1)}>{i + 1}</button>
              ))}
              <button disabled={loading || page >= pageCount} onClick={() => setPage((p) => p + 1)}>→</button>
            </div>
          ) : null}
        </section>
      </div>

      <section className="d68-seo-band">
        <div className="d68-seo-inner">
          <h2>{T(lang, 'Khám phá doanh nghiệp đang chào bán tại Việt Nam', 'Exploring businesses for sale in Vietnam')}</h2>
          <div className="d68-seo-grid">
            <article>
              <h3>{T(lang, 'Vì sao đầu tư vào doanh nghiệp Việt Nam?', 'Why invest in Vietnamese businesses?')}</h3>
              <p>{T(lang, 'Việt Nam có nền kinh tế tăng trưởng nhanh với cộng đồng doanh nghiệp vừa và nhỏ năng động. Deals68 giúp chuẩn hóa hồ sơ theo ngành, quy mô và nhu cầu vốn để nhà đầu tư sàng lọc ban đầu nhanh hơn.', 'Vietnam is a fast-growing economy with a dynamic SME community. Deals68 standardises profiles by industry, size and capital need so investors can screen faster.')}</p>
            </article>
            <article>
              <h3>{T(lang, 'Ngành nổi bật', 'Popular sectors')}</h3>
              <p>{T(lang, 'Các nhóm ngành hiện có hồ sơ trên nền tảng gồm y tế & làm đẹp, công nghệ & ứng dụng di động, F&B, thủy sản xuất khẩu, thời trang và hạ tầng kho vận.', 'Sectors currently listed on the platform include healthcare & beauty, technology & mobile apps, F&B, seafood export, fashion and logistics infrastructure.')}</p>
            </article>
            <article>
              <h3>{T(lang, 'Cần lưu ý khi mua doanh nghiệp', 'What to consider when buying')}</h3>
              <p>{T(lang, 'Thông tin trên trang là teaser đã duyệt hiển thị, không thay thế thẩm định độc lập. Hãy yêu cầu dữ liệu, ký thỏa thuận bảo mật và dùng tư vấn chuyên môn trước khi quyết định.', 'Information on this page is an approved teaser and does not replace independent due diligence. Request data, sign an NDA and use professional advisors before deciding.')}</p>
            </article>
          </div>

          <div className="d68-browse-grid">
            <div>
              <h3>{T(lang, 'Duyệt doanh nghiệp theo địa điểm', 'Browse businesses by location')}</h3>
              <div className="d68-browse-links">
                {cityFacets.map(([city, n]) => (
                  <button key={city} onClick={() => { setCities([city]); setPage(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{city} ({n})</button>
                ))}
              </div>
            </div>
            <div>
              <h3>{T(lang, 'Duyệt doanh nghiệp theo ngành', 'Browse businesses by industry')}</h3>
              <div className="d68-browse-links">
                {industryFacets.map(([ind, n]) => (
                  <button key={ind} onClick={() => { setIndustries([ind]); setPage(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{ind} ({n})</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="d68-faq-band">
        <div className="d68-faq-inner">
          <h2>{T(lang, 'Câu hỏi thường gặp', 'Frequently asked questions')}</h2>
          {faqs.map((f, i) => (
            <div key={i} className={`d68-faq-item${faqOpen === i ? ' open' : ''}`}>
              <button onClick={() => setFaqOpen(faqOpen === i ? null : i)} aria-expanded={faqOpen === i}>
                {f.q}<span>{faqOpen === i ? '−' : '+'}</span>
              </button>
              {faqOpen === i ? <p>{f.a}</p> : null}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
