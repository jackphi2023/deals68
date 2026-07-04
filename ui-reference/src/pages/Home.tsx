import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { countBusinesses, countInvestors, listBusinesses, listInvestors } from '../lib/data';
import { formatCompactMoney } from '../lib/format';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
type SearchMode = 'business' | 'investor';

type Deal = {
  id: string;
  slug: string;
  title: string;
  industry: string;
  dealType: string;
  revenue: string;
  amount: string;
  askUsd: number;
  image?: string | null;
  featured: boolean;
};

type InvestorRow = {
  id: string;
  code: string;
  title: string;
  type: string;
  country: string;
  industries: string;
  ticket: string;
  verified: boolean;
};

function buildPath(base: string, params: Record<string, string>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (String(v || '').trim()) qs.set(k, String(v).trim()); });
  return `${base}${qs.toString() ? `?${qs.toString()}` : ''}`;
}

function toUsd(value: any, currency: any) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const cur = String(currency || '').toUpperCase();
  if (cur === 'USD') return n;
  if (cur === 'VND') return n / 25000;
  return 0;
}

function formatUsdMillions(value: number, lang: Lang) {
  if (!Number.isFinite(value) || value <= 0) return '—';
  const m = value / 1_000_000;
  if (m >= 10) return `${m.toFixed(1).replace('.0', '')} ${T(lang, 'triệu $', 'M USD')}`;
  return `${m.toFixed(1)} ${T(lang, 'triệu $', 'M USD')}`;
}

function normalizeDeal(b: any, lang: Lang): Deal {
  const title = T(lang, b.title_vi || b.public_code || 'Hồ sơ doanh nghiệp ẩn danh', b.title_en || b.title_vi || b.public_code || 'Anonymous business profile');
  const image = b.image_url || b.hero_image_url || (Array.isArray(b.business_images) && b.business_images[0]?.public_url) || null;
  const amount = Number(b.ask_amount || 0) > 0
    ? `${formatCompactMoney(b.ask_amount, b.ask_currency || b.revenue_currency || 'VND')}${Number(b.stake_pct || 0) ? ` · ${Number(b.stake_pct).toString().replace('.', ',')}%` : ''}`
    : T(lang, 'Đang cập nhật', 'Pending');
  return {
    id: String(b.id || b.slug),
    slug: String(b.slug || b.username || b.id),
    title,
    industry: String(b.industry || T(lang, 'Đang cập nhật', 'Pending')).split(';')[0].trim(),
    dealType: String(b.deal_type || T(lang, 'Đang cập nhật', 'Pending')).split(';')[0].trim(),
    revenue: Number(b.revenue_2025 || 0) > 0 ? formatCompactMoney(b.revenue_2025, b.revenue_currency || 'VND') : T(lang, 'Đang cập nhật', 'Pending'),
    amount,
    askUsd: toUsd(b.ask_amount, b.ask_currency || b.revenue_currency),
    image,
    featured: b.plan === 'featured' || b.featured === true
  };
}

function normalizeInvestor(i: any, lang: Lang): InvestorRow {
  const industries = Array.isArray(i.industries) ? i.industries.slice(0, 2).join(', ') : String(i.industries || '').split(/[;,]/).slice(0, 2).join(', ');
  const min = Number(i.ticket_min || 0);
  const max = Number(i.ticket_max || 0);
  const ticket = min || max ? `${min ? formatCompactMoney(min, 'USD') : '—'} – ${max ? formatCompactMoney(max, 'USD') : '—'}` : T(lang, 'Theo từng thương vụ', 'Deal-by-deal');
  return {
    id: String(i.id || i.code),
    code: String(i.code || i.username || i.id),
    title: T(lang, i.title_vi || i.title_en || i.code || 'Nhà đầu tư ẩn danh', i.title_en || i.title_vi || i.code || 'Anonymous investor'),
    type: i.type || 'Investor',
    country: i.country || i.country_iso2 || 'Global',
    industries: industries || T(lang, 'Đa ngành', 'Multi-sector'),
    ticket,
    verified: i.verified === true
  };
}

const industryTiles = [
  { icon: '🍽️', vi: 'F&B', en: 'F&B', noteVi: 'Nhà hàng, chuỗi đồ uống', noteEn: 'Restaurants and beverage chains', grad: 'linear-gradient(135deg,#F97316,#FDBA74)' },
  { icon: '🩺', vi: 'Y tế & Sức khỏe', en: 'Healthcare', noteVi: 'Phòng khám, thẩm mỹ, nha khoa', noteEn: 'Clinics, aesthetics, dental', grad: 'linear-gradient(135deg,#06B6D4,#7DD3FC)' },
  { icon: '💻', vi: 'Công nghệ', en: 'Technology', noteVi: 'SaaS, mobile app, AI', noteEn: 'SaaS, mobile apps, AI', grad: 'linear-gradient(135deg,#6366F1,#A5B4FC)' },
  { icon: '🏭', vi: 'Sản xuất & Xuất khẩu', en: 'Manufacturing', noteVi: 'Nhà máy, xuất khẩu', noteEn: 'Factories and exports', grad: 'linear-gradient(135deg,#0D9488,#5EEAD4)' },
  { icon: '🛍️', vi: 'Bán lẻ', en: 'Retail', noteVi: 'Chuỗi cửa hàng, nhượng quyền', noteEn: 'Stores and franchise', grad: 'linear-gradient(135deg,#EC4899,#F9A8D4)' },
  { icon: '🚚', vi: 'Logistics', en: 'Logistics', noteVi: 'Kho vận, chuỗi lạnh', noteEn: 'Warehousing, cold chain', grad: 'linear-gradient(135deg,#2563EB,#60A5FA)' },
  { icon: '🏢', vi: 'Bất động sản', en: 'Real estate', noteVi: 'Tài sản vận hành', noteEn: 'Operating assets', grad: 'linear-gradient(135deg,#D97706,#FBBF24)' },
  { icon: '🎓', vi: 'Giáo dục', en: 'Education', noteVi: 'Trường, trung tâm', noteEn: 'Schools and centers', grad: 'linear-gradient(135deg,#7C3AED,#C4B5FD)' }
];

const roleCards = [
  { icon: '▦', vi: 'Doanh nghiệp', en: 'Business', descVi: 'Gọi vốn, bán/chuyển nhượng hoặc tìm đối tác chiến lược với hồ sơ được chuẩn hóa.', descEn: 'Raise capital, sell/transfer or find strategic partners with a structured profile.', ctaVi: 'Đăng ký doanh nghiệp', ctaEn: 'Register business', to: '/register/business', color: '#1596cc', bg: '#E7F6FD' },
  { icon: '↗', vi: 'Nhà đầu tư', en: 'Investor', descVi: 'Angel, VC, PE, family office, người mua chiến lược và lender tìm deal phù hợp.', descEn: 'Angel, VC, PE, family offices, strategic buyers and lenders browse relevant deals.', ctaVi: 'Tìm nhà đầu tư', ctaEn: 'Browse investors', to: '/investors', color: '#B8860B', bg: '#FEF3D3' },
  { icon: '🤝', vi: 'Cố vấn & Môi giới', en: 'Advisor & Partner', descVi: 'Cố vấn M&A, môi giới và đối tác thị trường có thể giới thiệu DN/NĐT phù hợp.', descEn: 'M&A advisors, brokers and market partners can source qualified businesses/investors.', ctaVi: 'Tìm hiểu thêm', ctaEn: 'Learn more', to: '/market-partner', color: '#16A34A', bg: '#E9F9EF' }
];

export default function Home({ lang }: { lang: Lang }) {
  const navigate = useNavigate();
  const [bizCount, setBizCount] = useState<number | null>(null);
  const [invCount, setInvCount] = useState<number | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<SearchMode>('business');
  const [keyword, setKeyword] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [dealType, setDealType] = useState('');
  const [investorType, setInvestorType] = useState('');

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true);
      try {
        const [bc, ic, bs, invs] = await Promise.all([
          countBusinesses().catch(() => null),
          countInvestors().catch(() => null),
          listBusinesses({ limit: 6, sort: 'featured' }).catch(() => []),
          listInvestors({ limit: 4, sort: 'ranking' }).catch(() => [])
        ]);
        if (!live) return;
        const normalizedDeals = (bs || []).map((b: any) => normalizeDeal(b, lang));
        setBizCount(bc);
        setInvCount(ic);
        setDeals(normalizedDeals);
        setInvestors((invs || []).map((i: any) => normalizeInvestor(i, lang)));
      } finally {
        if (live) setLoading(false);
      }
    }
    load();
    return () => { live = false; };
  }, [lang]);

  const totalAskUsd = useMemo(() => deals.reduce((sum, d) => sum + d.askUsd, 0), [deals]);
  const businessSearchUrl = buildPath('/businesses', { search: keyword, industry, country, dealType });
  const investorSearchUrl = buildPath('/investors', { search: keyword, industry, country, type: investorType });
  const searchUrl = mode === 'business' ? businessSearchUrl : investorSearchUrl;

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    navigate(searchUrl);
  }

  return <main>
    <section style={{ position: 'relative', background: 'radial-gradient(1100px 500px at 78% -10%, rgba(27,173,234,.22), transparent 60%), linear-gradient(180deg,#0F2A4A 0%,#14315A 100%)', color: '#fff', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -80, top: 40, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,181,29,.20), transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '74px 24px 120px', position: 'relative' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', padding: '7px 15px', borderRadius: 999, fontSize: 13, fontWeight: 600, color: '#cfe8f6', marginBottom: 22 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 0 4px rgba(22,163,74,.22)' }} />
          {T(lang, 'Kết nối thương vụ, khai mở lộc phát', 'Connecting Deals, Unlocking Prosperity')}
        </div>
        <h1 className="d68-hero-h1--v3" style={{ fontSize: 58, lineHeight: 1.05, fontWeight: 800, letterSpacing: -1.5, margin: '0 0 20px', maxWidth: 820 }}>
          {T(lang, 'Nơi Doanh nghiệp gặp gỡ', 'Where Businesses Meet')}<br />
          <span style={{ color: '#F2B51D' }}>{T(lang, 'Nhà đầu tư', 'Investors')}</span>
        </h1>
        <p style={{ fontSize: 19, lineHeight: 1.55, color: '#c6d5e6', maxWidth: 680, margin: '0 0 8px', fontWeight: 400 }}>
          {T(lang, 'Mua bán Doanh nghiệp, Sang nhượng cửa hàng, huy động vốn, cho vay và đầu tư xuyên biên giới — bảo mật, chọn lọc, dễ kết nối.', 'M&A, business transfer, fundraising, lending and cross-border investment — confidential, curated and easy to connect.')}
        </p>

        <form onSubmit={submitSearch} className="d68-fade" style={{ marginTop: 38, background: '#fff', borderRadius: 18, padding: 10, boxShadow: '0 24px 60px rgba(6,20,40,.4)', maxWidth: 960 }}>
          <div style={{ display: 'flex', gap: 6, padding: '6px 6px 0' }}>
            <button type="button" onClick={() => setMode('business')} style={tabStyle(mode === 'business')}>{T(lang, 'Tìm Doanh nghiệp', 'Find Businesses')}</button>
            <button type="button" onClick={() => setMode('investor')} style={tabStyle(mode === 'investor')}>{T(lang, 'Tìm Nhà đầu tư', 'Find Investors')}</button>
          </div>
          <div className="d68-search-row" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr auto', gap: 8, padding: 8, alignItems: 'end' }}>
            <label style={labelStyle}><span style={labelText}>{T(lang, 'Từ khóa', 'Keyword')}</span><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={mode === 'business' ? T(lang, 'Tên/mã, ngành, địa điểm...', 'Name/code, industry, location...') : T(lang, 'Quỹ, ngành, quốc gia...', 'Fund, sector, country...')} style={fieldStyle} /></label>
            <label style={labelStyle}><span style={labelText}>{T(lang, 'Loại', 'Type')}</span>{mode === 'business' ? <select value={dealType} onChange={(e) => setDealType(e.target.value)} style={fieldStyle}><option value="">{T(lang, 'Tất cả giao dịch', 'All deal types')}</option><option value="gọi vốn">{T(lang, 'Gọi vốn', 'Fundraising')}</option><option value="bán">{T(lang, 'Mua bán / chuyển nhượng', 'Sale / transfer')}</option><option value="vay">{T(lang, 'Vay vốn', 'Debt')}</option><option value="đối tác">JV / Partner</option></select> : <select value={investorType} onChange={(e) => setInvestorType(e.target.value)} style={fieldStyle}><option value="">{T(lang, 'Tất cả NĐT', 'All investors')}</option><option>VC</option><option>PE</option><option>Family Office</option><option>Corporate/Strategic</option><option>Individual/Angel</option><option>Lender/Debt</option></select>}</label>
            <label style={labelStyle}><span style={labelText}>{T(lang, 'Quốc gia', 'Country')}</span><input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} placeholder="VN, US, SG..." style={fieldStyle} /></label>
            <label style={labelStyle}><span style={labelText}>{T(lang, 'Ngành', 'Industry')}</span><input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder={T(lang, 'Chọn/Lọc ngành', 'Filter sector')} style={fieldStyle} /></label>
            <button type="submit" style={{ alignSelf: 'end', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, padding: '0 26px', background: '#F2B51D', color: '#0F2A4A', fontWeight: 800, fontSize: 15, border: 'none', borderRadius: 10, cursor: 'pointer', boxShadow: '0 8px 18px rgba(242,181,29,.35)', whiteSpace: 'nowrap' }}>{T(lang, 'Tìm kiếm', 'Search')}</button>
          </div>
        </form>
      </div>
    </section>

    <section style={{ background: '#0F2A4A' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div className="d68-grid-2--v5" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'rgba(255,255,255,.08)', borderRadius: 16, overflow: 'hidden', transform: 'translateY(-40px)', boxShadow: '0 20px 50px rgba(6,20,40,.35)' }}>
          <Stat value={String(bizCount ?? deals.length || 6)} label={T(lang, 'Doanh nghiệp đang chào', 'Active business deals')} />
          <Stat value={String(invCount ?? investors.length || 624)} label={T(lang, 'Nhà đầu tư & buyer', 'Investors & buyers')} />
          <Stat value={formatUsdMillions(totalAskUsd, lang)} label={T(lang, 'Tổng giá trị chào ước tính', 'Estimated total deal value')} />
        </div>
      </div>
    </section>

    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '26px 24px 52px' }}>
      <SectionHead center eyebrow="" title={T(lang, 'Bạn tham gia với vai trò nào?', 'Which role fits you?')} desc={T(lang, 'Chọn vai trò để bắt đầu đăng tin, tìm thương vụ hoặc kết nối đúng đối tác.', 'Pick a role to list a deal, browse opportunities or connect with the right partner.')} />
      <div className="d68-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>
        {roleCards.map((rc) => <Link key={rc.vi} to={rc.to} style={{ border: '1px solid #E7EDF3', borderRadius: 18, padding: 30, background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(15,42,74,.04)', color: '#0F2A4A' }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, background: rc.bg, color: rc.color, fontSize: 22, fontWeight: 800 }}>{rc.icon}</div>
          <h3 style={{ fontSize: 21, fontWeight: 700, margin: '0 0 10px' }}>{T(lang, rc.vi, rc.en)}</h3>
          <p style={{ fontSize: 15, color: '#64748B', lineHeight: 1.55, margin: '0 0 22px', flex: 1 }}>{T(lang, rc.descVi, rc.descEn)}</p>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: rc.color }}>{T(lang, rc.ctaVi, rc.ctaEn)} →</span>
        </Link>)}
      </div>
    </section>

    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 62px' }}>
      <div style={{ borderRadius: 18, overflow: 'hidden', boxShadow: '0 12px 34px rgba(6,20,40,.14)', border: '1px solid #E7EDF3', background: '#fff' }} aria-label={T(lang, 'Banner khuyến mãi Deals68', 'Deals68 promotion banner')}>
        <img className="l-vi" src="/assets/promo-vn.png" alt="Khuyến mãi Deals68" style={{ width: '100%', height: 'auto', display: 'block' }} />
        <img className="l-en" src="/assets/promo-en.png" alt="Deals68 promotion" style={{ width: '100%', height: 'auto', display: 'block' }} />
      </div>
    </section>

    <section style={{ background: '#F7FAFC', borderTop: '1px solid #E7EDF3', borderBottom: '1px solid #E7EDF3' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 34, flexWrap: 'wrap' }}>
          <div><div style={eyebrowStyle}>★ {T(lang, 'Thương vụ nổi bật', 'Featured Deals')}</div><h2 style={h2Style}>{T(lang, 'Cơ hội đang được chào', 'Opportunities on the market')}</h2></div>
          <Link to="/businesses" style={{ fontWeight: 700, color: '#1BADEA', fontSize: 15, whiteSpace: 'nowrap' }}>{T(lang, 'Xem tất cả', 'View all')} →</Link>
        </div>
        {loading ? <GridSkeleton /> : deals.length ? <div className="d68-deals" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>{deals.map((d) => <DealCard key={d.id} d={d} lang={lang} />)}</div> : <Empty text={T(lang, 'Chưa có doanh nghiệp active/visible.', 'No active/visible businesses yet.')} />}
      </div>
    </section>

    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 24px' }}>
      <SectionHead center eyebrow="" title={T(lang, 'Ngành nổi bật', 'Featured industries')} desc={T(lang, 'Khám phá cơ hội theo từng ngành trọng điểm trên Deals68.', 'Explore opportunities across key industries on Deals68.')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 20 }}>
        {industryTiles.map((it) => <Link key={it.vi} to={`/businesses?industry=${encodeURIComponent(it.vi)}`} style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #E7EDF3', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(15,42,74,.04)', color: '#0F2A4A' }}>
          <div style={{ height: 120, background: it.grad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 46, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.28))' }}>{it.icon}</span></div>
          <div style={{ padding: '16px 18px' }}><div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{T(lang, it.vi, it.en)}</div><div style={{ fontSize: 12.5, color: '#64748B', lineHeight: 1.45 }}>{T(lang, it.noteVi, it.noteEn)}</div></div>
        </Link>)}
      </div>
    </section>

    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '8px 24px 72px' }}>
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, background: 'linear-gradient(120deg,#1BADEA 0%, #1596cc 100%)', padding: '52px 56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ position: 'absolute', right: -40, bottom: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(242,181,29,.25)' }} />
        <div style={{ position: 'relative', maxWidth: 620 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.18)', color: '#fff', fontWeight: 700, fontSize: 12, padding: '6px 13px', borderRadius: 999, marginBottom: 16, textTransform: 'uppercase', letterSpacing: .5 }}>{T(lang, 'Miễn phí · Không cần đăng nhập', 'Free · No login required')}</div>
          <h2 style={{ fontSize: 30, fontWeight: 800, color: '#fff', margin: '0 0 10px' }}>{T(lang, 'Định giá sơ bộ doanh nghiệp của bạn', 'Estimate your business valuation')}</h2>
          <p style={{ color: '#dff5ff', lineHeight: 1.55, margin: 0 }}>{T(lang, 'Nhập doanh thu, biên lợi nhuận và ngành để xem khoảng định giá tham khảo trước khi đăng hồ sơ.', 'Enter revenue, margin and sector to see an indicative valuation range before listing.')}</p>
        </div>
        <Link to="/valuation" style={{ position: 'relative', background: '#F2B51D', color: '#0F2A4A', fontWeight: 800, padding: '14px 24px', borderRadius: 11, whiteSpace: 'nowrap' }}>{T(lang, 'Định giá ngay', 'Value now')} →</Link>
      </div>
    </section>

    <section style={{ background: '#F7FAFC', borderTop: '1px solid #E7EDF3' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '62px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
          <div><div style={{ color: '#1596cc', fontWeight: 800, fontSize: 12, textTransform: 'uppercase' }}>{T(lang, 'Nhà đầu tư đang tìm thương vụ', 'Investors looking for deals')}</div><h2 style={{ fontSize: 30, margin: '8px 0 0' }}>{T(lang, 'Nhà đầu tư đang hiển thị', 'Currently listed investors')}</h2></div>
          <Link to="/investors" style={{ color: '#1596cc', fontWeight: 800 }}>{T(lang, 'Xem tất cả', 'View all')} →</Link>
        </div>
        {investors.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 18 }}>{investors.map((i) => <InvestorCard key={i.id} inv={i} lang={lang} />)}</div> : <Empty text={T(lang, 'Chưa có nhà đầu tư active/visible.', 'No active/visible investors yet.')} />}
      </div>
    </section>

    <section style={{ background: '#EEF4FA' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '66px 24px' }}>
        <SectionHead center eyebrow="" title={T(lang, 'Cách hoạt động', 'How it works')} desc={T(lang, 'Deals68 chuẩn hóa hồ sơ, kết nối đúng vai trò và giữ workflow bảo mật trước khi mở dữ liệu chi tiết.', 'Deals68 structures profiles, connects the right roles and keeps a controlled workflow before unlocking details.')} />
        <div className="d68-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>
          <Step n="1" title={T(lang, 'Đăng hồ sơ ẩn danh', 'Create an anonymous profile')} desc={T(lang, 'Doanh nghiệp tạo hồ sơ thật; Admin biên tập thành snapshot ẩn danh trước khi public.', 'Businesses submit real data; Admin edits an anonymous public snapshot before publishing.')} />
          <Step n="2" title={T(lang, 'Kết nối chọn lọc', 'Curated matching')} desc={T(lang, 'Nhà đầu tư lọc theo ngành, quốc gia, ticket size và gửi quan tâm/proposal qua hệ thống.', 'Investors filter by sector, country and ticket size, then express interest/propose through the platform.')} />
          <Step n="3" title={T(lang, 'Mở khóa dữ liệu', 'Unlock data safely')} desc={T(lang, 'Thông tin nhạy cảm, tài liệu và liên hệ chỉ mở sau khi workflow duyệt kết nối đạt điều kiện.', 'Sensitive data, documents and contacts unlock only after the connection workflow is approved.')} />
        </div>
      </div>
    </section>

    <section style={{ background: '#FEF3D3' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '44px 24px', display: 'flex', justifyContent: 'space-between', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 720 }}>
          <div style={{ fontSize: 26, letterSpacing: 5, marginBottom: 14 }}>🇻🇳 🇺🇸 🇸🇬 🇦🇺 🇯🇵 🇰🇷 🇨🇦</div>
          <h2 style={{ fontSize: 26, margin: '0 0 8px' }}>{T(lang, 'Tham gia Đối tác thị trường cùng chúng tôi', 'Join us as a market partner')}</h2>
          <p style={{ color: '#64748B', lineHeight: 1.6, margin: 0 }}>{T(lang, 'Kết nối doanh nghiệp Việt, nhà đầu tư và đối tác ở các thị trường toàn cầu.', 'Connect Vietnamese businesses, investors and partners across global markets.')}</p>
        </div>
        <Link to="/market-partner" style={{ background: '#0F2A4A', color: '#fff', fontWeight: 800, padding: '14px 24px', borderRadius: 11, whiteSpace: 'nowrap' }}>{T(lang, 'Trở thành Đối tác thị trường', 'Become a market partner')} →</Link>
      </div>
    </section>
  </main>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div style={{ background: '#14315A', padding: '28px 26px', display: 'flex', flexDirection: 'column', gap: 6 }}><div style={{ fontSize: 34, fontWeight: 800, color: '#fff', letterSpacing: -1, lineHeight: 1 }}>{value}</div><div style={{ fontSize: 14, color: '#9db4cc', fontWeight: 500 }}>{label}</div></div>;
}

function SectionHead({ title, desc, center, eyebrow }: { title: string; desc?: string; center?: boolean; eyebrow?: string }) {
  return <div style={{ textAlign: center ? 'center' : 'left', maxWidth: 680, margin: center ? '0 auto 40px' : '0 0 34px' }}>
    {eyebrow ? <div style={eyebrowStyle}>{eyebrow}</div> : null}
    <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -.8, margin: '0 0 12px' }}>{title}</h2>
    {desc ? <p style={{ fontSize: 17, color: '#64748B', margin: 0, lineHeight: 1.5 }}>{desc}</p> : null}
  </div>;
}

function DealCard({ d, lang }: { d: Deal; lang: Lang }) {
  return <Link to={`/businesses/${d.slug}`} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(15,42,74,.04)', color: '#0F2A4A' }}>
    <div style={{ position: 'relative', height: 180, overflow: 'hidden', background: '#0F2A4A' }}>
      {d.image ? <img src={d.image} alt={d.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9db4cc', fontWeight: 700 }}>{T(lang, 'Ảnh đang cập nhật', 'Image pending')}</div>}
      {d.featured ? <span style={{ position: 'absolute', top: 12, right: 12, background: '#F2B51D', color: '#0F2A4A', fontSize: 11, fontWeight: 800, padding: '5px 10px', borderRadius: 7 }}>★ Featured</span> : null}
    </div>
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}><span style={{ fontSize: 12, fontWeight: 600, color: '#1596cc', background: '#E7F6FD', padding: '4px 10px', borderRadius: 6 }}>{d.industry}</span><span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', background: '#F1F5F9', padding: '4px 10px', borderRadius: 6 }}>{d.dealType}</span></div>
      <h3 style={{ fontSize: 16.5, fontWeight: 700, lineHeight: 1.4, margin: '0 0 16px', flex: 1 }}>{d.title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 16, borderTop: '1px solid #EEF2F6' }}>
        <Metric label={T(lang, 'Doanh thu 2025E', 'Revenue 2025E')} value={d.revenue} />
        <Metric label={T(lang, 'Giá trị / Cổ phần', 'Amount / Stake')} value={d.amount} accent />
      </div>
      <span style={{ marginTop: 18, textAlign: 'center', background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 14, padding: 11, borderRadius: 10 }}>{T(lang, 'Xem chi tiết', 'View details')}</span>
    </div>
  </Link>;
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div><div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .4 }}>{label}</div><div style={{ fontSize: 15, fontWeight: 800, color: accent ? '#1596cc' : '#0F2A4A' }}>{value}</div></div>;
}

function InvestorCard({ inv, lang }: { inv: InvestorRow; lang: Lang }) {
  return <Link to={`/investors/${inv.code}`} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: 18, boxShadow: '0 1px 2px rgba(15,42,74,.04)', color: '#0F2A4A' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}><span style={{ fontSize: 12, fontWeight: 800, color: '#1596cc', background: '#E7F6FD', borderRadius: 999, padding: '4px 9px' }}>{inv.type}</span>{inv.verified ? <span style={{ fontSize: 11, fontWeight: 800, color: '#16A34A' }}>✓ {T(lang, 'Xác minh', 'Verified')}</span> : null}</div>
    <h3 style={{ fontSize: 15.5, lineHeight: 1.35, margin: '0 0 8px' }}>{inv.title}</h3>
    <p style={{ color: '#64748B', fontSize: 13, lineHeight: 1.45, margin: '0 0 12px' }}>{inv.industries} · {inv.country}</p>
    <div style={{ borderTop: '1px solid #EEF2F6', paddingTop: 12, fontSize: 12.5, color: '#64748B' }}>Ticket: <b style={{ color: '#0F2A4A' }}>{inv.ticket}</b></div>
  </Link>;
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: 24, boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}><div style={{ width: 28, height: 28, borderRadius: 8, background: '#E7F6FD', color: '#1596cc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: 16 }}>{n}</div><h3 style={{ margin: '0 0 8px' }}>{title}</h3><p style={{ color: '#64748B', lineHeight: 1.55, margin: 0 }}>{desc}</p></div>;
}

function GridSkeleton() {
  return <div className="d68-deals" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>{Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, overflow: 'hidden' }}><div style={{ height: 180, background: 'linear-gradient(90deg,#EEF2F6,#F8FAFC,#EEF2F6)' }} /><div style={{ padding: 20 }}><div style={{ height: 14, width: '40%', background: '#EEF2F6', borderRadius: 999, marginBottom: 16 }} /><div style={{ height: 18, width: '90%', background: '#EEF2F6', borderRadius: 8, marginBottom: 10 }} /><div style={{ height: 42, background: '#EEF2F6', borderRadius: 10 }} /></div></div>)}</div>;
}

function Empty({ text }: { text: string }) { return <div style={{ background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 16, padding: 34, color: '#64748B', textAlign: 'center' }}>{text}</div>; }

const labelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const labelText: CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: '#64748B' };
const fieldStyle: CSSProperties = { border: '1px solid #E2E8F0', borderRadius: 10, padding: '11px 12px', fontSize: 15, color: '#0F2A4A', background: '#F7FAFC', fontWeight: 500, cursor: 'pointer', outline: 'none', width: '100%' };
const h2Style: CSSProperties = { fontSize: 34, fontWeight: 800, letterSpacing: -.8, margin: 0 };
const eyebrowStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, background: '#FEF3D3', color: '#B8860B', fontWeight: 700, fontSize: 12, padding: '6px 12px', borderRadius: 999, marginBottom: 14, textTransform: 'uppercase', letterSpacing: .5 };
function tabStyle(active: boolean): CSSProperties { return { flex: 1, border: 'none', borderBottom: `3px solid ${active ? '#F2B51D' : 'transparent'}`, background: active ? '#F7FAFC' : 'transparent', color: active ? '#0F2A4A' : '#64748B', padding: '13px 16px', borderRadius: '10px 10px 0 0', fontSize: 14, fontWeight: 800, cursor: 'pointer' }; }
