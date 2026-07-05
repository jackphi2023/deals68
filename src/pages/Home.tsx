import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { countBusinesses, countInvestors, listBusinesses, listInvestors } from '../lib/data';
import { getPublicDealValueSummary, type PublicDealValueSummary } from '../lib/publicMetrics';
import { toLocalizedPath } from '../lib/i18nRoutes';
import { formatMoneyForLang, labelIndustry, labelInvestorType, labelCountry, T } from '../lib/labels';
import type { Lang } from '../lib/i18n';

type SearchMode = 'business' | 'investor';
type Deal = { id: string; slug: string; title: string; industry: string; city: string; revenue: string; ask: string; image: string | null; featured: boolean };

function normalizeDeal(b: any, lang: Lang): Deal {
  const title = T(lang, b.title_vi || b.public_code || 'Hồ sơ doanh nghiệp', b.title_en || b.title_vi || b.public_code || 'Business profile');
  const image = b.image_url || b.hero_image_url || (Array.isArray(b.business_images) && b.business_images[0]?.public_url) || null;
  return {
    id: String(b.id || b.slug),
    slug: String(b.slug || ''),
    title,
    industry: labelIndustry(b.industry, lang),
    city: labelCountry(b.city || b.country_iso2 || 'VN', lang),
    revenue: formatMoneyForLang(b.revenue_2025, b.revenue_currency || 'VND', lang),
    ask: formatMoneyForLang(b.ask_amount, b.ask_currency || b.revenue_currency || 'VND', lang, { stakePct: b.stake_pct }),
    image,
    featured: b.plan === 'featured'
  };
}

function buildPath(base: string, lang: Lang, params: Record<string, string>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v.trim()) qs.set(k, v.trim()); });
  const localizedBase = toLocalizedPath(base, lang);
  return `${localizedBase}${qs.toString() ? `?${qs.toString()}` : ''}`;
}

function dealValueText(lang: Lang, value: PublicDealValueSummary | null, loading: boolean) {
  if (!value) return loading ? '…' : T(lang, 'Đang cập nhật', 'Pending');
  if (lang === 'en') {
    if (value.totalUsd >= 1_000_000) return `$${(value.totalUsd / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`;
    return `$${Math.round(value.totalUsd).toLocaleString('en-US')}`;
  }
  return value.totalVnd >= 1_000_000_000
    ? `${(value.totalVnd / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ ₫`
    : `${Math.round(value.totalVnd / 1_000_000).toLocaleString('vi-VN')} triệu ₫`;
}

export default function Home({ lang }: { lang: Lang }) {
  const navigate = useNavigate();
  const [bizCount, setBizCount] = useState<number | null>(null);
  const [invCount, setInvCount] = useState<number | null>(null);
  const [dealValue, setDealValue] = useState<PublicDealValueSummary | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [investors, setInvestors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<SearchMode>('business');
  const [keyword, setKeyword] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [dealType, setDealType] = useState('');
  const [investorType, setInvestorType] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      const [bc, ic, dv, bs, invs] = await Promise.all([
        countBusinesses().catch(() => null),
        countInvestors().catch(() => null),
        getPublicDealValueSummary().catch(() => null),
        listBusinesses({ limit: 6, sort: 'featured' }).catch(() => []),
        listInvestors({ limit: 4 }).catch(() => [])
      ]);
      if (!live) return;
      setBizCount(bc); setInvCount(ic); setDealValue(dv);
      setDeals((bs || []).map((b: any) => normalizeDeal(b, lang)).filter((d) => d.slug));
      setInvestors(invs || []);
      setLoading(false);
    })();
    return () => { live = false; };
  }, [lang]);

  const promoImg = lang === 'en' ? '/assets/promo-en.png' : '/assets/promo-vn.png';
  const searchUrl = mode === 'business'
    ? buildPath('/businesses', lang, { search: keyword, industry, country, dealType })
    : buildPath('/investors', lang, { search: keyword, industry, country, type: investorType });
  const submitSearch = (e: React.FormEvent) => { e.preventDefault(); navigate(searchUrl); };
  const nav = (path: string) => toLocalizedPath(path, lang);

  const roleCards = [
    { icon: '🏢', bg: '#FEF3D3', color: '#B8860B',
      title: T(lang, 'Doanh nghiệp / Chủ doanh nghiệp', 'Businesses / Owners'),
      desc: T(lang, 'Gọi vốn, vay vốn, bán một phần hoặc toàn bộ. Đăng hồ sơ ẩn danh và được Admin duyệt trước khi hiển thị.', 'Raise capital, borrow, sell part or all. Post an anonymous profile approved by Admin before it goes live.'),
      cta: T(lang, 'Đăng hồ sơ doanh nghiệp', 'List your business'), to: '/register/business' },
    { icon: '💼', bg: '#E7F6FD', color: '#1596cc',
      title: T(lang, 'Nhà đầu tư / Người mua / Bên cho vay', 'Investors / Buyers / Lenders'),
      desc: T(lang, 'Lọc cơ hội theo ngành, quy mô, quốc gia và loại giao dịch; lưu deal và bày tỏ quan tâm.', 'Filter opportunities by industry, size, country and deal type; save deals and express interest.'),
      cta: T(lang, 'Khám phá cơ hội', 'Explore opportunities'), to: '/investors' },
    { icon: '🤝', bg: '#EAF7EF', color: '#16A34A',
      title: T(lang, 'Đối tác thị trường', 'Market Partners'),
      desc: T(lang, 'Kết nối doanh nghiệp cần vốn với nhà đầu tư, người mua chiến lược và bên cho vay tại thị trường của bạn.', 'Connect businesses seeking capital with investors, strategic buyers and lenders in your market.'),
      cta: T(lang, 'Trở thành đối tác', 'Become a partner'), to: '/partners' }
  ];

  const industries = [
    { emoji: '💰', vi: 'Tài chính', en: 'Finance', noteVi: 'Fintech, tín dụng, bảo hiểm', noteEn: 'Fintech, credit and insurance' },
    { emoji: '🏥', vi: 'Y tế & Sức khỏe', en: 'Healthcare', noteVi: 'Phòng khám, nha khoa, chăm sóc sức khỏe', noteEn: 'Clinics, dental and healthcare' },
    { emoji: '💻', vi: 'Công nghệ', en: 'Technology', noteVi: 'SaaS, AI, phần mềm, tự động hóa', noteEn: 'SaaS, AI, software, automation' },
    { emoji: '🍜', vi: 'F&B', en: 'F&B', noteVi: 'Nhà hàng, chuỗi, nhượng quyền', noteEn: 'Restaurants, chains, franchises' },
    { emoji: '🐟', vi: 'Thủy sản & Xuất khẩu', en: 'Seafood & Export', noteVi: 'Xuất khẩu, chế biến, kho lạnh', noteEn: 'Export, processing, cold storage' },
    { emoji: '🏭', vi: 'Sản xuất & Kho vận', en: 'Manufacturing & Logistics', noteVi: 'Nhà máy, logistics, tài sản vận hành', noteEn: 'Factories, logistics, operating assets' }
  ];

  const steps = [
    { n: '1', title: T(lang, 'Đăng hồ sơ ẩn danh', 'Create an anonymous profile'), desc: T(lang, 'Doanh nghiệp nhập dữ liệu thật; Admin biên tập bản công khai ẩn danh trước khi hiển thị.', 'Businesses submit real data; Admin edits an anonymous public snapshot before publishing.') },
    { n: '2', title: T(lang, 'Chuẩn hóa & duyệt', 'Structure & approve'), desc: T(lang, 'Hồ sơ được phân loại theo ngành, quy mô, nhu cầu vốn và được chấm điểm chất lượng.', 'Profiles are categorised by industry, size and capital need, then quality-scored.') },
    { n: '3', title: T(lang, 'Kết nối phù hợp', 'Connect with the right party'), desc: T(lang, 'Nhà đầu tư lọc, lưu, bày tỏ quan tâm; thông tin nhạy cảm mở sau khi kết nối được duyệt.', 'Investors filter, save and express interest; sensitive data unlocks after an approved connection.') }
  ];

  const dealValueLabel = useMemo(() => dealValueText(lang, dealValue, loading), [lang, dealValue, loading]);

  return (
    <main>
      <section className="d68-home-hero">
        <span className="d68-home-hero__orb" aria-hidden="true" />
        <div className="d68-home-container d68-home-hero__inner">
          <div className="d68-home-eyebrow"><span />{T(lang, 'Kết nối thương vụ, khai mở lộc phát', 'Connecting Deals, Unlocking Prosperity')}</div>
          <h1 className="d68-home-hero__title"><span>{T(lang, 'Nơi Doanh nghiệp gặp gỡ', 'Where Businesses Meet')}</span><strong>{T(lang, 'Nhà đầu tư', 'Investors')}</strong></h1>
          <p className="d68-home-hero__desc">{T(lang, 'Deals68 hiển thị hồ sơ ẩn danh với dữ liệu thật từ database, và chỉ mở thông tin nhạy cảm sau khi kết nối được duyệt.', 'Deals68 displays anonymous profiles with live database-backed data, unlocking sensitive information only after an approved connection.')}</p>

          <form className="d68-home-search" onSubmit={submitSearch}>
            <div className="d68-home-search__tabs">
              <button type="button" className={mode === 'business' ? 'active' : ''} onClick={() => setMode('business')}>{T(lang, 'Tìm Doanh nghiệp', 'Find Businesses')}</button>
              <button type="button" className={mode === 'investor' ? 'active' : ''} onClick={() => setMode('investor')}>{T(lang, 'Tìm Nhà đầu tư', 'Find Investors')}</button>
            </div>
            <div className="d68-home-search__row">
              <label><span>{T(lang, 'Từ khóa', 'Keyword')}</span><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={T(lang, 'Ngành, mã, địa điểm…', 'Industry, code, location…')} /></label>
              <label><span>{T(lang, 'Ngành', 'Industry')}</span><input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder={T(lang, 'Tất cả', 'All')} /></label>
              <label><span>{mode === 'business' ? T(lang, 'Loại giao dịch', 'Deal type') : T(lang, 'Loại nhà đầu tư', 'Investor type')}</span>
                {mode === 'business'
                  ? <select value={dealType} onChange={(e) => setDealType(e.target.value)}><option value="">{T(lang, 'Tất cả', 'All')}</option><option value="fundrais">{T(lang, 'Gọi vốn', 'Fundraise')}</option><option value="sale">{T(lang, 'Mua bán', 'Sale')}</option><option value="loan">{T(lang, 'Vay vốn', 'Loan')}</option><option value="partner">JV</option></select>
                  : <select value={investorType} onChange={(e) => setInvestorType(e.target.value)}><option value="">{T(lang, 'Tất cả', 'All')}</option><option>VC</option><option>PE</option><option>Family Office</option><option>Corporate/Strategic</option><option>Individual/Angel</option><option>Lender/Debt</option></select>}
              </label>
              <button type="submit">{T(lang, 'Tìm kiếm', 'Search')} →</button>
            </div>
          </form>
        </div>
      </section>

      <section className="d68-home-stats">
        <div className="d68-home-container">
          <div className="d68-home-stats__grid">
            <div><b>{bizCount ?? (loading ? '…' : deals.length)}</b><span>{T(lang, 'Doanh nghiệp đang hiển thị', 'Active business listings')}</span></div>
            <div><b>{invCount ?? (loading ? '…' : investors.length)}</b><span>{T(lang, 'Nhà đầu tư & người mua', 'Investors & buyers')}</span></div>
            <div className="d68-home-stat--dealvalue"><b>{dealValueLabel}</b><span>{T(lang, 'Tổng giá trị thương vụ', 'Total deal value')}</span></div>
          </div>
        </div>
      </section>

      <section className="d68-home-container d68-home-section d68-home-section--roles">
        <div className="d68-home-title d68-home-title--center"><h2>{T(lang, 'Bạn tham gia với vai trò nào?', 'Which role fits you?')}</h2><p>{T(lang, 'Deals68 phục vụ nhiều nhu cầu: gọi vốn, mua bán, cho vay và phát triển thị trường.', 'Deals68 serves many needs: fundraising, M&A, lending and market development.')}</p></div>
        <div className="d68-home-role-grid">{roleCards.map((r) => <div key={r.title} className="d68-home-role-card"><div style={{ background: r.bg, color: r.color }}>{r.icon}</div><h3>{r.title}</h3><p>{r.desc}</p><Link to={nav(r.to)}><span>{r.cta} →</span></Link></div>)}</div>
      </section>

      <section className="d68-home-promo d68-home-container"><Link to={nav('/pricing')}><img src={promoImg} alt={T(lang, 'Ưu đãi Beta Deals68', 'Deals68 Beta promotion')} /></Link></section>

      <section className="d68-home-container d68-home-section">
        <div className="d68-home-title d68-home-title--row"><div><span className="d68-home-badge d68-home-badge--gold">★ {T(lang, 'Thương vụ nổi bật', 'Featured Deals')}</span><h2>{T(lang, 'Cơ hội đang được chào', 'Opportunities on the market')}</h2></div><Link to={nav('/businesses')}>{T(lang, 'Xem tất cả', 'View all')} →</Link></div>
        {loading ? <div className="d68-home-deals">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="d68-home-business-card d68-home-business-card--loading"><div className="d68-home-business-card__media"/><div className="d68-home-business-card__body"/></div>)}</div> : deals.length ? <div className="d68-home-deals">{deals.map((d) => <Link key={d.id} to={nav(`/businesses/${d.slug}`)} className="d68-home-business-card"><div className="d68-home-business-card__media">{d.image ? <img src={d.image} alt={d.title} loading="lazy" /> : <span>{T(lang, 'Deals68 · Hồ sơ ẩn danh', 'Deals68 · Anonymous listing')}</span>}{d.featured ? <b>{T(lang, 'Nổi bật', 'Featured')}</b> : null}</div><div className="d68-home-business-card__body"><div className="d68-home-business-card__tags"><span>{d.industry}</span><span>📍 {d.city}</span></div><h3>{d.title}</h3><div className="d68-home-business-card__metrics"><div><span>{T(lang, 'Doanh thu', 'Revenue')}</span><strong>{d.revenue}</strong></div><div><span>{T(lang, 'Nhu cầu', 'Ask')}</span><strong>{d.ask}</strong></div></div></div></Link>)}</div> : <div className="d68-home-empty">{T(lang, 'Chưa có doanh nghiệp đang hiển thị.', 'No active business listings yet.')}</div>}
      </section>

      <section className="d68-home-industries">
        <div className="d68-home-container">
          <div className="d68-home-title d68-home-title--center"><h2>{T(lang, 'Ngành nổi bật', 'Featured industries')}</h2><p>{T(lang, 'Khám phá cơ hội theo từng ngành trọng điểm trên Deals68.', 'Explore opportunities across key industries on Deals68.')}</p></div>
          <div className="d68-home-industry-grid">{industries.map((it) => <Link key={it.vi} to={buildPath('/businesses', lang, { industry: T(lang, it.vi, it.en) })} className="d68-home-industry-card"><div><span>{it.emoji}</span></div><section><strong>{T(lang, it.vi, it.en)}</strong><p>{T(lang, it.noteVi, it.noteEn)}</p></section></Link>)}</div>
        </div>
      </section>

      <section className="d68-home-container d68-home-valuation"><div className="d68-home-valuation__box"><div><span>{T(lang, 'Miễn phí trong Beta', 'Free during Beta')}</span><h2>{T(lang, 'Định giá sơ bộ doanh nghiệp của bạn', 'Estimate your business valuation')}</h2><p>{T(lang, 'Nhập một vài chỉ số để nhận khoảng định giá tham khảo trước khi đăng hồ sơ gọi vốn hoặc chuyển nhượng.', 'Enter a few metrics to get a reference valuation range before listing to raise capital or transfer.')}</p></div><Link to={nav('/valuation')}>{T(lang, 'Định giá ngay', 'Value my business')} →</Link></div></section>

      <section className="d68-home-container d68-home-section"><div className="d68-home-title d68-home-title--row"><div><span className="d68-home-badge d68-home-badge--blue">◆ {T(lang, 'Nhà đầu tư tiêu biểu', 'Featured investors')}</span><h2>{T(lang, 'Nhà đầu tư đang tìm thương vụ', 'Investors looking for deals')}</h2></div><Link to={nav('/investors')}>{T(lang, 'Xem tất cả', 'View all')} →</Link></div>{loading ? <div className="d68-home-investor-grid">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="d68-home-investor-card" aria-hidden="true" />)}</div> : investors.length ? <div className="d68-home-investor-grid">{investors.map((i) => <article key={i.id || i.code} className="d68-home-investor-card"><div className="d68-home-investor-card__icon">💼</div><h3>{T(lang, i.title_vi || i.title_en || i.code, i.title_en || i.title_vi || i.code)}</h3><p>{labelInvestorType(i.type, lang)} · {labelCountry(i.country || i.country_iso2 || 'Global', lang)}</p><Link to={nav(`/investors/${i.code}`)}>{T(lang, 'Xem chi tiết', 'View detail')} →</Link></article>)}</div> : <div className="d68-home-empty">{T(lang, 'Chưa có nhà đầu tư đang hiển thị.', 'No active investor listings yet.')}</div>}</section>

      <section className="d68-home-how"><div className="d68-home-container"><div className="d68-home-title d68-home-title--center"><h2 style={{ color: '#0F2A4A' }}>{T(lang, 'Cách hoạt động', 'How it works')}</h2><p>{T(lang, 'Ba bước để bắt đầu một thương vụ trên Deals68.', 'Three steps to start a deal on Deals68.')}</p></div><div className="d68-home-steps">{steps.map((s) => <div key={s.n}><b>{s.n}</b><h3>{s.title}</h3><p>{s.desc}</p></div>)}</div></div></section>

      <section className="d68-home-partner"><div className="d68-home-container"><div><div className="d68-home-partner__flags">🇻🇳 🇺🇸 🇨🇦 🇦🇺 🇸🇬 🇯🇵 🇰🇷 🇩🇪</div><h2>{T(lang, 'Tham gia Đối tác thị trường cùng chúng tôi', 'Join our Market Partner network')}</h2><p>{T(lang, 'Phát triển mạng lưới doanh nghiệp và nhà đầu tư tại thị trường của bạn, cùng Deals68 mở rộng ra toàn cầu.', 'Grow the network of businesses and investors in your market as Deals68 expands globally.')}</p></div><Link to={nav('/partners')}>{T(lang, 'Tìm hiểu chương trình đối tác', 'Explore the partner program')} →</Link></div></section>
    </main>
  );
}
