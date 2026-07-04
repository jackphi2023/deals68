import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { countBusinesses, listBusinesses } from '../lib/data';
import { formatCompactMoney, percent } from '../lib/format';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
const PAGE_SIZE = 12;
type Tx = 'all' | 'sale' | 'invest' | 'loan' | 'jv';
type Deal = {
  id: string;
  slug: string;
  image?: string | null;
  titleVi: string;
  titleEn: string;
  descVi: string;
  descEn: string;
  city: string;
  country: string;
  industry: string;
  group: Tx;
  dealType: string;
  revenue: string;
  ask: string;
  ebitda: string;
  quality: number | null;
  featured: boolean;
  raw: any;
};

function arrText(value: any) {
  if (Array.isArray(value)) return value.filter(Boolean).join('\n');
  return String(value || '');
}

function normalizeGroup(raw?: string | null): Tx {
  const v = String(raw || '').toLowerCase();
  if (v.includes('loan') || v.includes('debt') || v.includes('vay')) return 'loan';
  if (v.includes('jv') || v.includes('partner') || v.includes('đối tác')) return 'jv';
  if (v.includes('sale') || v.includes('transfer') || v.includes('m&a') || v.includes('bán') || v.includes('chuyển nhượng')) return 'sale';
  return 'invest';
}

function txFromQuery(raw: string | null): Tx {
  const v = String(raw || '').toLowerCase();
  if (!v) return 'all';
  if (v.includes('loan') || v.includes('debt') || v.includes('vay')) return 'loan';
  if (v.includes('sale') || v.includes('bán') || v.includes('transfer')) return 'sale';
  if (v.includes('jv') || v.includes('partner') || v.includes('đối tác')) return 'jv';
  if (v.includes('invest') || v.includes('fund') || v.includes('gọi')) return 'invest';
  return 'all';
}

function normalizeBusiness(b: any): Deal {
  const titleVi = b.title_vi || b.public_code || 'Hồ sơ doanh nghiệp đang cập nhật';
  const descVi = b.description_vi || arrText(b.highlights_vi) || b.investment_reason_vi || '';
  const ask = Number(b.ask_amount || 0) > 0
    ? `${formatCompactMoney(b.ask_amount, b.ask_currency || b.revenue_currency || 'VND')}${Number(b.stake_pct || 0) ? ` · ${percent(b.stake_pct)}` : ''}`
    : 'TBD';
  const q = b.quality_score === null || b.quality_score === undefined ? null : Number(b.quality_score);
  return {
    id: String(b.id || b.slug || b.public_code),
    slug: String(b.slug || ''),
    image: b.image_url || b.hero_image_url || null,
    titleVi,
    titleEn: b.title_en || titleVi,
    descVi,
    descEn: b.description_en || b.highlights_en || descVi,
    city: b.city || b.country_iso2 || 'Việt Nam',
    country: b.country_iso2 || 'VN',
    industry: b.industry || 'Đang cập nhật',
    group: normalizeGroup(b.deal_type),
    dealType: b.deal_type || 'Đang cập nhật',
    revenue: Number(b.revenue_2025 || 0) > 0 ? formatCompactMoney(b.revenue_2025, b.revenue_currency || 'VND') : 'Đang cập nhật',
    ask,
    ebitda: b.ebitda_margin === null || b.ebitda_margin === undefined ? 'Đang cập nhật' : percent(b.ebitda_margin),
    quality: Number.isFinite(q) ? q : null,
    featured: b.plan === 'featured' || b.featured === true,
    raw: b
  };
}

function SkeletonCard() {
  return <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, overflow: 'hidden' }}><div style={{ height: 176, background: 'linear-gradient(90deg,#EEF2F6,#F8FAFC,#EEF2F6)' }} /><div style={{ padding: 18 }}><div style={{ height: 14, width: '40%', background: '#EEF2F6', borderRadius: 999, marginBottom: 14 }} /><div style={{ height: 18, width: '88%', background: '#EEF2F6', borderRadius: 8, marginBottom: 10 }} /><div style={{ height: 18, width: '64%', background: '#EEF2F6', borderRadius: 8, marginBottom: 18 }} /><div style={{ height: 42, background: '#EEF2F6', borderRadius: 10 }} /></div></div>;
}

function DealCard({ d, lang }: { d: Deal; lang: Lang }) {
  const title = T(lang, d.titleVi, d.titleEn);
  const desc = T(lang, d.descVi, d.descEn);
  const detailPath = d.slug ? `/businesses/${d.slug}` : '/businesses';

  return <article style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,42,74,.04)', display: 'flex', flexDirection: 'column' }}><div style={{ position: 'relative', height: 176, background: '#EAF0F6', overflow: 'hidden' }}>{d.image ? <img src={d.image} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontWeight: 700 }}>{T(lang, 'Ảnh đang cập nhật', 'Image pending')}</div>}{d.featured ? <span style={{ position: 'absolute', top: 10, left: 10, background: '#F2B51D', color: '#0F2A4A', fontSize: 11, fontWeight: 800, padding: '5px 9px', borderRadius: 7 }}>★ Featured</span> : null}</div><div style={{ padding: 18, display: 'flex', flexDirection: 'column', flex: 1 }}><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}><span style={{ fontSize: 12, fontWeight: 700, color: '#1596cc', background: '#E7F6FD', padding: '4px 9px', borderRadius: 6 }}>{d.industry}</span><span style={{ fontSize: 12, fontWeight: 700, color: '#64748B', background: '#F1F5F9', padding: '4px 9px', borderRadius: 6 }}>📍 {d.city}</span>{d.quality !== null ? <span style={{ fontSize: 12, fontWeight: 700, color: '#334155', background: '#F8FAFC', padding: '4px 9px', borderRadius: 6 }}>Quality {d.quality}/100</span> : <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', background: '#F8FAFC', padding: '4px 9px', borderRadius: 6 }}>{T(lang, 'Điểm đang cập nhật', 'Score pending')}</span>}</div><h3 style={{ fontSize: 16, lineHeight: 1.35, margin: '0 0 8px', color: '#0F2A4A' }}>{title}</h3><p style={{ fontSize: 13.5, lineHeight: 1.55, color: '#64748B', margin: '0 0 14px', flex: 1 }}>{desc || T(lang, 'Hồ sơ đang được doanh nghiệp/Admin cập nhật.', 'Profile is being updated by the business/Admin.')}</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, borderTop: '1px solid #EEF2F6', paddingTop: 12, marginBottom: 14 }}><div><div style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Revenue</div><b>{d.revenue}</b></div><div><div style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>{d.dealType}</div><b style={{ color: '#1596cc' }}>{d.ask}</b></div></div><Link to={detailPath} style={{ textAlign: 'center', background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 14, padding: 11, borderRadius: 10 }}>{T(lang, 'Xem chi tiết', 'View details')}</Link></div></article>;
}

export default function Businesses({ lang }: { lang: Lang }) {
  const location = useLocation();
  const url = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [rows, setRows] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [tx, setTx] = useState<Tx>(() => txFromQuery(url.get('dealType')));
  const [query, setQuery] = useState(() => url.get('search') || url.get('q') || '');
  const [industry, setIndustry] = useState(() => url.get('industry') || '');
  const [country, setCountry] = useState(() => url.get('country') || '');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setQuery(params.get('search') || params.get('q') || '');
    setIndustry(params.get('industry') || '');
    setCountry(params.get('country') || '');
    setTx(txFromQuery(params.get('dealType')));
    setPage(1);
  }, [location.search]);

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const filters: any = {
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          search: query || undefined,
          industry: industry || undefined,
          country: country || undefined
        };
        if (tx !== 'all') filters.dealType = tx === 'loan' ? 'vay' : tx === 'sale' ? 'bán' : tx === 'jv' ? 'đối tác' : 'gọi vốn';
        const [data, count] = await Promise.all([listBusinesses(filters), countBusinesses(filters).catch(() => null)]);
        if (!live) return;
        const normalized = (data || []).map(normalizeBusiness).filter((d) => d.slug);
        setRows(normalized);
        setTotal(count);
      } catch (e: any) {
        if (!live) return;
        setRows([]);
        setTotal(0);
        setError(e?.message || T(lang, 'Không tải được dữ liệu doanh nghiệp.', 'Could not load businesses.'));
      } finally {
        if (live) setLoading(false);
      }
    }
    load();
    return () => { live = false; };
  }, [page, tx, query, industry, country, lang]);

  const pageCount = useMemo(() => total === null ? null : Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return <main style={{ background: '#F7FAFC', minHeight: '70vh' }}><section style={{ maxWidth: 1240, margin: '0 auto', padding: '34px 24px 18px' }}><div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 12 }}><Link to="/">{T(lang, 'Trang chủ', 'Home')}</Link> › <b style={{ color: '#475569' }}>{T(lang, 'Doanh nghiệp', 'Businesses')}</b></div><h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -.8, margin: '0 0 8px' }}>{T(lang, 'Doanh nghiệp trên Deals68', 'Businesses on Deals68')}</h1><p style={{ color: '#64748B', fontSize: 15.5, maxWidth: 840, lineHeight: 1.6, margin: 0 }}>{T(lang, 'Danh sách chỉ hiển thị hồ sơ đang active/visible trong database.', 'This page only shows active/visible profiles from the database.')}</p></section>
    <section style={{ maxWidth: 1240, margin: '0 auto', padding: '0 24px 44px' }}><div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: 16, display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) 140px 150px 150px', gap: 12, alignItems: 'center', marginBottom: 18 }} className="d68-form-2"><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={T(lang, 'Tìm theo mã, ngành, tiêu đề...', 'Search code, industry, title...')} style={filterStyle} /><select value={tx} onChange={(e) => { setTx(e.target.value as Tx); setPage(1); }} style={filterStyle}><option value="all">{T(lang, 'Tất cả', 'All')}</option><option value="invest">{T(lang, 'Gọi vốn', 'Fundraise')}</option><option value="sale">{T(lang, 'Mua bán', 'Sale')}</option><option value="loan">{T(lang, 'Vay vốn', 'Debt')}</option><option value="jv">JV</option></select><input value={industry} onChange={(e) => { setIndustry(e.target.value); setPage(1); }} placeholder={T(lang, 'Ngành', 'Industry')} style={filterStyle} /><input value={country} onChange={(e) => { setCountry(e.target.value.toUpperCase()); setPage(1); }} placeholder="VN, US, SG..." style={filterStyle} /></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, color: '#64748B', fontSize: 14 }}><span>{loading ? T(lang, 'Đang tải dữ liệu thật...', 'Loading live data...') : `${rows.length}${total !== null ? ` / ${total}` : ''} ${T(lang, 'hồ sơ', 'profiles')}`}</span><span>{T(lang, 'Nguồn: Supabase active + visible', 'Source: Supabase active + visible')}</span></div>{error ? <div style={{ background: '#FDECEC', border: '1px solid #FCA5A5', color: '#991B1B', padding: 14, borderRadius: 12, marginBottom: 12 }}>{error}</div> : null}<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 18 }}>{loading ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />) : rows.map((d) => <DealCard key={d.id} d={d} lang={lang} />)}</div>{!loading && !error && !rows.length ? <div style={{ background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 16, padding: 44, textAlign: 'center', color: '#64748B', marginTop: 18 }}><b>{T(lang, 'Chưa có doanh nghiệp phù hợp.', 'No matching business profiles.')}</b></div> : null}<div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 24 }}><button disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} style={pageBtn}>←</button><span style={{ padding: '10px 4px', fontWeight: 700 }}>{page}{pageCount ? ` / ${pageCount}` : ''}</span><button disabled={loading || (pageCount !== null && page >= pageCount)} onClick={() => setPage((p) => p + 1)} style={pageBtn}>→</button></div></section></main>;
}

const filterStyle: CSSProperties = { border: '1px solid #E2E8F0', borderRadius: 10, padding: '11px 12px', background: '#fff', width: '100%' };
const pageBtn: CSSProperties = { padding: '10px 14px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff' };
