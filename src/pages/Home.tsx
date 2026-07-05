import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { countBusinesses, countInvestors, listBusinesses, listInvestors } from '../lib/data';
import { formatCompactMoney } from '../lib/format';
import type { Lang } from '../lib/i18n';

/**
 * Home (/) — port theo ui-reference/Deals68 Home.dc.html (SPEC v1.3 §15.1).
 * - UI: dùng class trong src/styles/pages/home.css (không inline redesign — B8).
 * - Slot dữ liệu ĐỘNG gắn Supabase thật: stats (count), featured deals, investors.
 * - Nội dung TĨNH của reference (role cards, industries, how-it-works, valuation/partner CTA)
 *   giữ nguyên như thiết kế — không tự bịa số liệu (B5).
 * - Không mock/fallback demo; lỗi tải → ẩn/empty an toàn.
 */

const T = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);
type SearchMode = 'business' | 'investor';
type Deal = { id: string; slug: string; title: string; industry: string; city: string; revenue: string; ask: string; image: string | null; featured: boolean };

function normalizeDeal(b: any, lang: Lang): Deal {
  const title = T(lang, b.title_vi || b.public_code || 'Hồ sơ doanh nghiệp', b.title_en || b.title_vi || b.public_code || 'Business profile');
  const image = b.image_url || b.hero_image_url || (Array.isArray(b.business_images) && b.business_images[0]?.public_url) || null;
  return {
    id: String(b.id || b.slug),
    slug: String(b.slug || b.username || b.id),
    title,
    industry: String(b.industry || 'Đang cập nhật').split(';')[0].trim(),
    city: b.city || 'Việt Nam',
    revenue: Number(b.revenue_2025 || 0) > 0 ? formatCompactMoney(b.revenue_2025, b.revenue_currency || 'VND') : 'Đang cập nhật',
    ask: Number(b.ask_amount || 0) > 0 ? formatCompactMoney(b.ask_amount, b.ask_currency || b.revenue_currency || 'VND') : 'Đang cập nhật',
    image,
    featured: b.plan === 'featured'
  };
}

function buildPath(base: string, params: Record<string, string>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v.trim()) qs.set(k, v.trim()); });
  return `${base}${qs.toString() ? `?${qs.toString()}` : ''}`;
}

export default function Home({ lang }: { lang: Lang }) {
  const navigate = useNavigate();
  const [bizCount, setBizCount] = useState<number | null>(null);
  const [invCount, setInvCount] = useState<number | null>(null);
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
      const [bc, ic, bs, invs] = await Promise.all([
        countBusinesses().catch(() => null),
        countInvestors().catch(() => null),
        listBusinesses({ limit: 6, sort: 'featured' }).catch(() => []),
        listInvestors({ limit: 4 }).catch(() => [])
      ]);
      if (!live) return;
      setBizCount(bc); setInvCount(ic);
      setDeals((bs || []).map((b: any) => normalizeDeal(b, lang)));
      setInvestors(invs || []);
      setLoading(false);
    })();
    return () => { live = false; };
  }, [lang]);

  const promoImg = lang === 'en' ? '/assets/promo-en.png' : '/assets/promo-vn.png';
  const searchUrl = mode === 'business'
    ? buildPath('/businesses', { search: keyword, industry, country, dealType })
    : buildPath('/investors', { search: keyword, industry, country, type: investorType });
  const submitSearch = (e: React.FormEvent) => { e.preventDefault(); navigate(searchUrl); };

  const roleCards = [
    { badge: 'gold', icon: '🏢', bg: '#FEF3D3', color: '#B8860B',
      title: T(lang, 'Doanh nghiệp / Chủ business', 'Businesses / Owners'),
      desc: T(lang, 'Gọi vốn, vay vốn, bán một phần hoặc toàn bộ. Đăng hồ sơ ẩn danh và được Admin duyệt trước khi hiển thị.', 'Raise capital, borrow, sell part or all. Post an anonymous profile approved by Admin before it goes live.'),
      cta: T(lang, 'Đăng hồ sơ doanh nghiệp', 'List your business'), to: '/register/business' },
    { badge: 'blue', icon: '💼', bg: '#E7F6FD', color: '#1596cc',
      title: T(lang, 'Nhà đầu tư / Buyer / Lender', 'Investors / Buyers / Lenders'),
      desc: T(lang, 'Lọc cơ hội theo ngành, quy mô, quốc gia và loại giao dịch; lưu deal và bày tỏ quan tâm.', 'Filter opportunities by industry, size, country and deal type; save deals and express interest.'),
      cta: T(lang, 'Khám phá cơ hội', 'Explore opportunities'), to: '/investors' },
    { badge: 'gold', icon: '🤝', bg: '#EAF7EF', color: '#16A34A',
      title: T(lang, 'Đối tác thị trường', 'Market Partners'),
      desc: T(lang, 'Kết nối doanh nghiệp cần vốn với nhà đầu tư, buyer chiến lược và lender tại thị trường của bạn.', 'Connect businesses seeking capital with investors, strategic buyers and lenders in your market.'),
      cta: T(lang, 'Trở thành đối tác', 'Become a partner'), to: '/partners' }
  ];

  const industries = [
    { emoji: '🏥', grad: 'linear-gradient(135deg,#0ea5e9,#22d3ee)', vi: 'Y tế & Sức khỏe', en: 'Healthcare' },
    { emoji: '💻', grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)', vi: 'Công nghệ', en: 'Technology' },
    { emoji: '🍜', grad: 'linear-gradient(135deg,#f97316,#fb923c)', vi: 'F&B', en: 'F&B' },
    { emoji: '🐟', grad: 'linear-gradient(135deg,#0891b2,#06b6d4)', vi: 'Thủy sản XK', en: 'Seafood export' },
    { emoji: '👗', grad: 'linear-gradient(135deg,#db2777,#f472b6)', vi: 'Thời trang', en: 'Fashion' },
    { emoji: '🏭', grad: 'linear-gradient(135deg,#b45309,#f59e0b)', vi: 'Sản xuất & Kho vận', en: 'Manufacturing & Logistics' }
  ];

  const steps = [
    { n: '1', title: T(lang, 'Đăng hồ sơ ẩn danh', 'Create an anonymous profile'), desc: T(lang, 'Doanh nghiệp nhập dữ liệu thật; Admin biên tập bản công khai ẩn danh trước khi hiển thị.', 'Businesses submit real data; Admin edits an anonymous public snapshot before publishing.') },
    { n: '2', title: T(lang, 'Chuẩn hóa & duyệt', 'Structure & approve'), desc: T(lang, 'Hồ sơ được phân loại theo ngành, quy mô, nhu cầu vốn và được chấm điểm chất lượng.', 'Profiles are categorised by industry, size and capital need, then quality-scored.') },
    { n: '3', title: T(lang, 'Kết nối phù hợp', 'Connect with the right party'), desc: T(lang, 'Nhà đầu tư lọc, lưu, bày tỏ quan tâm; thông tin nhạy cảm mở sau khi kết nối được duyệt.', 'Investors filter, save and express interest; sensitive data unlocks after an approved connection.') }
  ];

  return (
    <main>
      {/* HERO + SEARCH */}
      <section className="d68-home-hero">
        <span className="d68-home-hero__orb" aria-hidden="true" />
        <div className="d68-home-container d68-home-hero__inner">
          <div className="d68-home-eyebrow"><span />{T(lang, 'Kết nối thương vụ, khai mở lộc phát', 'Connecting Deals, Unlocking Prosperity')}</div>
          <h1 className="d68-home-hero__title">{T(lang, 'Nơi Doanh nghiệp gặp gỡ ', 'Where Businesses Meet ')}<strong>{T(lang, 'Nhà đầu tư', 'Investors')}</strong></h1>
          <p className="d68-home-hero__desc">{T(lang, 'Deals68 hiển thị hồ sơ ẩn danh với dữ liệu thật từ database, và chỉ mở thông tin nhạy cảm sau khi kết nối được duyệt.', 'Deals68 displays anonymous profiles with live database-backed data, unlocking sensitive information only after an approved connection.')}</p>

          <form className="d68-home-search" onSubmit={submitSearch}>
            <div className="d68-home-search__tabs">
              <button type="button" className={mode === 'business' ? 'active' : ''} onClick={() => setMode('business')}>{T(lang, 'Tìm Doanh nghiệp', 'Find Businesses')}</button>
              <button type="button" className={mode === 'investor' ? 'active' : ''} onClick={() => setMode('investor')}>{T(lang, 'Tìm Nhà đầu tư', 'Find Investors')}</button>
            </div>
            <div className="d68-home-search__row">
              <label><span>{T(lang, 'Từ khóa', 'Keyword')}</span>
                <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={T(lang, 'Ngành, mã, địa điểm…', 'Industry, code, location…')} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '11px 12px', fontSize: 15, color: '#0F2A4A', background: '#F7FAFC', fontWeight: 500, outline: 'none', width: '100%' }} /></label>
              <label><span>{T(lang, 'Ngành', 'Industry')}</span>
                <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder={T(lang, 'Tất cả', 'All')} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '11px 12px', fontSize: 15, color: '#0F2A4A', background: '#F7FAFC', fontWeight: 500, outline: 'none', width: '100%' }} /></label>
              <label><span>{mode === 'business' ? T(lang, 'Loại giao dịch', 'Deal type') : T(lang, 'Loại nhà đầu tư', 'Investor type')}</span>
                {mode === 'business'
                  ? <select value={dealType} onChange={(e) => setDealType(e.target.value)}><option value="">{T(lang, 'Tất cả', 'All')}</option><option value="fundrais">{T(lang, 'Gọi vốn', 'Fundraise')}</option><option value="sale">{T(lang, 'Mua bán', 'Sale')}</option><option value="loan">{T(lang, 'Vay vốn', 'Loan')}</option><option value="partner">JV</option></select>
                  : <select value={investorType} onChange={(e) => setInvestorType(e.target.value)}><option value="">{T(lang, 'Tất cả', 'All')}</option><option>VC</option><option>PE</option><option>Family Office</option><option>Corporate</option><option>Angel</option><option>Lender</option></select>}
              </label>
              <button type="submit">{T(lang, 'Tìm kiếm', 'Search')} →</button>
            </div>
          </form>
        </div>
      </section>

      {/* STATS (real counts) */}
      <section className="d68-home-stats">
        <div className="d68-home-container">
          <div className="d68-home-stats__grid">
            <div><b>{bizCount ?? (loading ? '…' : deals.length)}</b><span>{T(lang, 'Doanh nghiệp đang hiển thị', 'Active business listings')}</span></div>
            <div><b>{invCount ?? (loading ? '…' : investors.length)}</b><span>{T(lang, 'Nhà đầu tư & buyer', 'Investors & buyers')}</span></div>
            <div><b>{T(lang, 'Ẩn danh', 'Anonymous')}</b><span>{T(lang, 'Hồ sơ duyệt trước khi public', 'Profiles approved before publishing')}</span></div>
          </div>
        </div>
      </section>

      {/* ROLE CARDS */}
      <section className="d68-home-container d68-home-section d68-home-section--roles">
        <div className="d68-home-title d68-home-title--center">
          <h2>{T(lang, 'Bạn tham gia với vai trò nào?', 'Which role fits you?')}</h2>
          <p>{T(lang, 'Deals68 phục vụ nhiều nhu cầu: gọi vốn, mua bán, cho vay và phát triển thị trường.', 'Deals68 serves many needs: fundraising, M&A, lending and market development.')}</p>
        </div>
        <div className="d68-home-role-grid">
          {roleCards.map((r) => (
            <div key={r.title} className="d68-home-role-card">
              <div style={{ background: r.bg, color: r.color }}>{r.icon}</div>
              <h3>{r.title}</h3>
              <p>{r.desc}</p>
              <Link to={r.to}><span style={{ color: '#1BADEA' }}>{r.cta} →</span></Link>
            </div>
          ))}
        </div>
      </section>

      {/* PROMO BANNER */}
      <section className="d68-home-container d68-home-promo">
        <Link to="/pricing"><img src={promoImg} alt={T(lang, 'Ưu đãi Beta Deals68', 'Deals68 Beta promotion')} loading="lazy" /></Link>
      </section>

      {/* FEATURED DEALS (real data) */}
      <section className="d68-home-container d68-home-section">
        <div className="d68-home-title d68-home-title--row">
          <div><span className="d68-home-badge d68-home-badge--blue">{T(lang, 'Cơ hội đang chào', 'On the market')}</span>
            <h2 style={{ fontSize: 30, margin: 0, color: '#0F2A4A' }}>{T(lang, 'Doanh nghiệp đang hiển thị', 'Currently listed businesses')}</h2></div>
          <Link to="/businesses">{T(lang, 'Xem tất cả', 'View all')} →</Link>
        </div>
        {loading
          ? <div className="d68-home-deals">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="d68-home-role-card" aria-hidden="true" style={{ minHeight: 260 }} />)}</div>
          : deals.length
            ? <div className="d68-home-deals">
              {deals.slice(0, 6).map((d) => (
                <Link key={d.id} to={`/businesses/${d.slug}`} className="d68-home-role-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ height: 160, background: '#EAF0F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontWeight: 700, margin: 0, borderRadius: 0, width: '100%' }}>
                    {d.image ? <img src={d.image} alt={d.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : T(lang, 'Ảnh đang cập nhật', 'Image pending')}
                  </div>
                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#1596cc', textTransform: 'uppercase' }}>{d.industry} · 📍 {d.city}</span>
                    <h3 style={{ fontSize: 16.5, lineHeight: 1.4, margin: '8px 0 12px', color: '#0F2A4A' }}>{d.title}</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: 13.5, marginTop: 'auto' }}>
                      <span>{T(lang, 'Doanh thu', 'Revenue')}: <b style={{ color: '#0F2A4A' }}>{d.revenue}</b></span>
                      <b style={{ color: '#1596cc' }}>{d.ask}</b>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            : <div style={{ background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 16, padding: 40, textAlign: 'center', color: '#64748B' }}>{T(lang, 'Chưa có doanh nghiệp đang hiển thị.', 'No active business listings yet.')}</div>}
      </section>

      {/* INDUSTRIES */}
      <section className="d68-home-section d68-home-section--alt">
        <div className="d68-home-container">
          <div className="d68-home-title d68-home-title--center"><h2>{T(lang, 'Ngành nổi bật', 'Featured industries')}</h2><p>{T(lang, 'Các nhóm ngành đang có hồ sơ trên nền tảng.', 'Sectors currently represented on the platform.')}</p></div>
          <div className="d68-home-industry-grid">
            {industries.map((it) => (
              <Link key={it.vi} to={`/businesses?industry=${encodeURIComponent(T(lang, it.vi, it.en))}`} className="d68-home-industry-card">
                <div style={{ background: it.grad }}><span>{it.emoji}</span></div>
                <section><strong>{T(lang, it.vi, it.en)}</strong><p>{T(lang, 'Xem doanh nghiệp trong ngành', 'Browse businesses in this sector')}</p></section>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* VALUATION CTA */}
      <section className="d68-home-container d68-home-valuation">
        <div className="d68-home-valuation__box">
          <div>
            <span>{T(lang, 'Miễn phí trong Beta', 'Free during Beta')}</span>
            <h2>{T(lang, 'Định giá sơ bộ doanh nghiệp của bạn', 'Estimate your business valuation')}</h2>
            <p>{T(lang, 'Nhập một vài chỉ số để nhận khoảng định giá tham khảo trước khi đăng hồ sơ gọi vốn hoặc chuyển nhượng.', 'Enter a few metrics to get a reference valuation range before listing to raise capital or transfer.')}</p>
          </div>
          <Link to="/valuation">{T(lang, 'Định giá ngay', 'Value my business')} →</Link>
        </div>
      </section>

      {/* INVESTORS (real data) */}
      <section className="d68-home-container d68-home-section">
        <div className="d68-home-title d68-home-title--row">
          <div><span className="d68-home-badge d68-home-badge--gold">{T(lang, 'Nhà đầu tư', 'Investors')}</span>
            <h2 style={{ fontSize: 30, margin: 0, color: '#0F2A4A' }}>{T(lang, 'Nhà đầu tư đang tìm thương vụ', 'Investors looking for deals')}</h2></div>
          <Link to="/investors">{T(lang, 'Xem tất cả', 'View all')} →</Link>
        </div>
        {loading
          ? <div className="d68-home-investor-grid">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="d68-home-role-card" aria-hidden="true" style={{ minHeight: 150 }} />)}</div>
          : investors.length
            ? <div className="d68-home-investor-grid">
              {investors.map((i) => (
                <Link key={i.id || i.code} to={`/investors/${i.code}`} className="d68-home-role-card" style={{ padding: 22 }}>
                  <div style={{ background: '#E7F6FD', color: '#1596cc', width: 44, height: 44, marginBottom: 14 }}>💼</div>
                  <h3 style={{ fontSize: 17, margin: '0 0 6px' }}>{T(lang, i.title_vi || i.title_en || i.code, i.title_en || i.title_vi || i.code)}</h3>
                  <p style={{ margin: 0, fontSize: 14, color: '#64748B' }}>{i.type || 'Investor'} · {i.country || i.country_iso2 || 'Global'}</p>
                </Link>
              ))}
            </div>
            : <div style={{ background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 16, padding: 40, textAlign: 'center', color: '#64748B' }}>{T(lang, 'Chưa có nhà đầu tư đang hiển thị.', 'No active investor listings yet.')}</div>}
      </section>

      {/* HOW IT WORKS */}
      <section className="d68-home-how">
        <div className="d68-home-container">
          <div className="d68-home-title d68-home-title--center"><h2 style={{ color: '#0F2A4A' }}>{T(lang, 'Cách hoạt động', 'How it works')}</h2><p>{T(lang, 'Ba bước để bắt đầu một thương vụ trên Deals68.', 'Three steps to start a deal on Deals68.')}</p></div>
          <div className="d68-home-steps">
            {steps.map((s) => <div key={s.n}><b>{s.n}</b><h3>{s.title}</h3><p>{s.desc}</p></div>)}
          </div>
        </div>
      </section>

      {/* PARTNER CTA */}
      <section className="d68-home-partner">
        <div className="d68-home-container">
          <div>
            <div className="d68-home-partner__flags">🇻🇳 🇺🇸 🇨🇦 🇦🇺 🇸🇬 🇯🇵 🇰🇷 🇩🇪</div>
            <h2>{T(lang, 'Tham gia Đối tác thị trường cùng chúng tôi', 'Join our Market Partner network')}</h2>
            <p>{T(lang, 'Phát triển mạng lưới doanh nghiệp và nhà đầu tư tại thị trường của bạn, cùng Deals68 mở rộng ra toàn cầu.', 'Grow the network of businesses and investors in your market as Deals68 expands globally.')}</p>
          </div>
          <Link to="/partners">{T(lang, 'Tìm hiểu chương trình đối tác', 'Explore the partner program')} →</Link>
        </div>
      </section>
    </main>
  );
}
