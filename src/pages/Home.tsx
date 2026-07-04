import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

const taxonomy = [
  { key: 'asia', vi: 'Châu Á', en: 'Asia', countries: ['Vietnam', 'Singapore', 'South Korea', 'Hong Kong', 'Japan', 'China', 'Thailand', 'Indonesia', 'Malaysia', 'Philippines', 'India', 'Other Asia'] },
  { key: 'americas', vi: 'Châu Mỹ', en: 'Americas', countries: ['United States', 'Canada', 'Mexico', 'Brazil', 'Other Americas'] },
  { key: 'europe', vi: 'Châu Âu', en: 'Europe', countries: ['United Kingdom', 'Germany', 'France', 'Netherlands', 'Switzerland', 'Spain', 'Italy', 'Other Europe'] },
  { key: 'oceania', vi: 'Châu Úc', en: 'Oceania', countries: ['Australia', 'New Zealand', 'Other Oceania'] },
  { key: 'mideast', vi: 'Trung Đông', en: 'Middle East', countries: ['UAE', 'Saudi Arabia', 'Qatar', 'Other Middle East'] },
  { key: 'africa', vi: 'Châu Phi', en: 'Africa', countries: ['South Africa', 'Egypt', 'Nigeria', 'Other Africa'] }
];

const roleLinks = ['/register/business', '/register/investor', '/register/advisor'];

const roleCards = (lang: Lang) => [
  {
    iconChar: '🏢', iconBg: '#EAF0F6', iconColor: '#0F2A4A', ctaColor: '#0F2A4A',
    title: T(lang, 'Doanh nghiệp', 'Business'),
    desc: T(lang, 'Gọi vốn, vay, bán một phần hoặc toàn bộ. Đăng hồ sơ ẩn danh và nhận định giá AI.', 'Raise capital, borrow, sell part or all. Post an anonymous profile and get an AI valuation.'),
    cta: T(lang, 'Đăng ký doanh nghiệp', 'List a business')
  },
  {
    iconChar: '📈', iconBg: '#FEF3D3', iconColor: '#B8860B', ctaColor: '#B8860B',
    title: T(lang, 'Nhà đầu tư', 'Investor'),
    desc: T(lang, 'Angel, VC, PE, family office, người mua chiến lược hay bên cho vay tìm thương vụ đúng khẩu vị.', 'Angels, VC, PE, family offices, strategic buyers or lenders finding the right deals.'),
    cta: T(lang, 'Tôi là Nhà đầu tư', 'I am an Investor')
  },
  {
    iconChar: '🤝', iconBg: '#E7F6FD', iconColor: '#1596cc', ctaColor: '#1596cc',
    title: T(lang, 'Cố vấn & Môi giới', 'Advisor & Broker'),
    desc: T(lang, 'Cố vấn M&A, môi giới và tư vấn tài chính đại diện nhiều thương vụ và kết nối các bên.', 'M&A advisors, brokers and financial consultants representing deals and connecting parties.'),
    cta: T(lang, 'Tham gia cố vấn', 'Join as advisor')
  }
];

const deals = (lang: Lang) => [
  { bizid: 'hkmedi', image: '/assets/deal1.png', featured: true, industry: T(lang, 'Y tế & Làm đẹp', 'Healthcare & Beauty'), dealType: T(lang, 'Gọi vốn', 'Fundraise'), title: T(lang, 'Chuỗi phòng khám da liễu & thẩm mỹ 5 chi nhánh', '5-branch dermatology & aesthetics clinic chain'), revenue: T(lang, '164,3 tỷ ₫', 'USD 6.2M'), amount: 'USD 2.0M · ~17%' },
  { bizid: 'infinitytech', image: '/assets/deal2.png', featured: true, industry: T(lang, 'Công nghệ', 'Technology'), dealType: T(lang, 'Gọi vốn', 'Fundraise'), title: T(lang, 'Công ty mobile app global · 280+ ứng dụng', 'Global mobile app studio · 280+ apps'), revenue: T(lang, '318–371 tỷ ₫', 'USD 12–14M'), amount: 'USD 2.0M · 30%' },
  { bizid: 'dunnio', image: '/assets/deal3.png', featured: false, industry: 'Fashion Tech', dealType: 'Seed', title: T(lang, 'Nền tảng may đo cá nhân hóa · 6 cửa hàng', 'Custom-tailoring platform · 6 stores'), revenue: T(lang, '30,7 tỷ ₫', 'USD 1.16M'), amount: 'USD 300K · 22,6%' },
  { bizid: 'phongcua', image: '/assets/deal4.png', featured: false, industry: 'F&B', dealType: T(lang, 'Bán toàn bộ', 'Full sale'), title: T(lang, '2 nhà hàng hải sản tại TP.HCM', 'Two seafood restaurants in HCMC'), revenue: T(lang, '38–55 tỷ ₫', 'VND 38–55B'), amount: T(lang, '15 tỷ ₫', 'VND 15B') },
  { bizid: 'trongnhan', image: '/assets/deal5.png', featured: false, industry: T(lang, 'Thủy sản XK', 'Seafood export'), dealType: T(lang, 'Gọi vốn, Vay', 'Fundraise, Loan'), title: T(lang, 'Nhà máy chế biến thủy sản xuất khẩu quy mô lớn', 'Large seafood export processing plant'), revenue: T(lang, '3.180–4.505 tỷ ₫', 'USD 120–170M'), amount: T(lang, 'TBD sau NDA', 'TBD after NDA') },
  { bizid: 'coldstore', image: '/assets/deal6.png', featured: true, industry: 'Cold Chain', dealType: T(lang, 'Chuyển nhượng', 'Transfer'), title: T(lang, 'Kho lạnh tự động quy mô lớn tại TP.HCM', 'Large automated cold storage in HCMC'), revenue: T(lang, '318–477 tỷ ₫', 'USD 12–18M'), amount: 'USD 50M' }
];

const featuredInvestors = (lang: Lang) => [
  { icon: '🏦', type: T(lang, 'Quỹ PE khu vực', 'Regional PE fund'), ticket: 'USD 2–10M', focus: T(lang, 'F&B · Bán lẻ · Sản xuất', 'F&B · Retail · Manufacturing'), geo: T(lang, 'Đông Nam Á', 'Southeast Asia') },
  { icon: '🚀', type: T(lang, 'Quỹ VC công nghệ', 'Tech VC'), ticket: 'USD 0.5–3M', focus: T(lang, 'SaaS · Mobile · AI', 'SaaS · Mobile · AI'), geo: T(lang, 'Việt Nam · Singapore', 'Vietnam · Singapore') },
  { icon: '🏛️', type: T(lang, 'Family Office', 'Family Office'), ticket: 'USD 5–20M', focus: T(lang, 'Y tế · Giáo dục · BĐS', 'Healthcare · Education · Real Estate'), geo: T(lang, 'Singapore · Hong Kong', 'Singapore · Hong Kong') },
  { icon: '🌐', type: T(lang, 'Người mua chiến lược', 'Strategic buyer'), ticket: T(lang, 'Theo thương vụ', 'Deal-based'), focus: T(lang, 'Thủy sản · Thực phẩm XK', 'Seafood · Food export'), geo: T(lang, 'Hàn Quốc · Nhật · EU', 'Korea · Japan · EU') }
];

const industryTiles = (lang: Lang) => [
  { emoji: '🍽️', name: 'F&B', grad: 'linear-gradient(135deg,#f97316,#fb923c)', note: T(lang, 'Nhà hàng · chuỗi · đồ uống', 'Restaurants · chains · beverages') },
  { emoji: '🩺', name: T(lang, 'Y tế & Sức khỏe', 'Healthcare'), grad: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', note: T(lang, 'Phòng khám · thẩm mỹ · dược', 'Clinics · aesthetics · pharma') },
  { emoji: '💻', name: T(lang, 'Công nghệ', 'Technology'), grad: 'linear-gradient(135deg,#6366f1,#818cf8)', note: T(lang, 'SaaS · mobile app · AI', 'SaaS · mobile apps · AI') },
  { emoji: '🏭', name: T(lang, 'Sản xuất & XK', 'Manufacturing'), grad: 'linear-gradient(135deg,#0f766e,#14b8a6)', note: T(lang, 'Chế biến · thủy sản · dệt may', 'Processing · seafood · textiles') },
  { emoji: '🛍️', name: T(lang, 'Bán lẻ', 'Retail'), grad: 'linear-gradient(135deg,#db2777,#f472b6)', note: T(lang, 'Chuỗi · thời trang · đa kênh', 'Chains · fashion · omnichannel') },
  { emoji: '🚚', name: 'Logistics', grad: 'linear-gradient(135deg,#2563eb,#3b82f6)', note: T(lang, 'Kho lạnh · vận tải · cold chain', 'Cold storage · freight · cold chain') },
  { emoji: '🏙️', name: T(lang, 'Bất động sản', 'Real Estate'), grad: 'linear-gradient(135deg,#b45309,#f59e0b)', note: T(lang, 'Thương mại · nghỉ dưỡng', 'Commercial · hospitality') },
  { emoji: '🎓', name: T(lang, 'Giáo dục', 'Education'), grad: 'linear-gradient(135deg,#7c3aed,#a78bfa)', note: T(lang, 'Trường · trung tâm · edtech', 'Schools · centers · edtech') }
];

const steps = (lang: Lang) => [
  { n: '1', title: T(lang, 'Đăng hồ sơ ẩn danh', 'Post an anonymous profile'), desc: T(lang, 'Doanh nghiệp tạo hồ sơ không lộ tên, nhận gợi ý định giá AI và chọn gói hiển thị theo tuần.', 'Businesses create a no-name profile, get an AI valuation and pick a weekly display package.') },
  { n: '2', title: T(lang, 'Kết nối chọn lọc', 'Connect selectively'), desc: T(lang, 'Nhà đầu tư & cố vấn lọc theo khu vực, quốc gia, ngành rồi bày tỏ quan tâm.', 'Investors & advisors filter by region, country and industry, then express interest.') },
  { n: '3', title: T(lang, 'Mở khóa & thương lượng', 'Unlock & negotiate'), desc: T(lang, 'Khi hai bên chấp nhận, hồ sơ đầy đủ và tài liệu được mở, tiến hành trao đổi.', 'Once both accept, the full profile and documents unlock and direct discussion begins.') }
];

const tabStyle = (active: boolean): CSSProperties => ({
  flex: 1,
  padding: '14px 13px 11px',
  border: 'none',
  borderBottom: `3px solid ${active ? '#F2B51D' : 'transparent'}`,
  cursor: 'pointer',
  fontSize: 15,
  fontWeight: active ? 800 : 600,
  borderRadius: '10px 10px 0 0',
  background: active ? '#fff' : 'transparent',
  color: active ? '#0F2A4A' : '#64748B'
});

export default function Home({ lang }: { lang: Lang }) {
  const [tab, setTab] = useState<'business' | 'investor'>('business');
  const [region, setRegion] = useState('asia');
  const [animT, setAnimT] = useState(0);

  useEffect(() => {
    const duration = 1400;
    const start = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimT(eased);
      if (t >= 1) window.clearInterval(timer);
    }, 16);
    return () => window.clearInterval(timer);
  }, []);

  const activeRegion = taxonomy.find((r) => r.key === region) || taxonomy[0];
  const regionOptions = taxonomy.map((r) => ({ key: r.key, label: T(lang, r.vi, r.en) }));
  const countryOptions = activeRegion.countries;
  const industryOptions = lang === 'vi'
    ? ['Tất cả ngành', 'F&B', 'Y tế & Sức khỏe', 'Bán lẻ', 'Sản xuất', 'Công nghệ', 'Bất động sản', 'Logistics', 'Giáo dục', 'Làm đẹp', 'Năng lượng']
    : ['All industries', 'F&B', 'Healthcare', 'Retail', 'Manufacturing', 'Technology', 'Real Estate', 'Logistics', 'Education', 'Beauty', 'Energy'];

  const stats = useMemo(() => {
    const activeBizCount = 6;
    const bizVal = Math.round(activeBizCount * animT);
    const invVal = Math.round(624 * animT);
    const dealTotalUSD = (2000000 + 2000000 + 300000 + (15000000000 / 26500) + 50000000) * animT;
    const dealValVi = `${(dealTotalUSD / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu $`;
    const dealValEn = `$${(dealTotalUSD / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`;
    return [
      { value: bizVal.toLocaleString('vi-VN'), label: T(lang, 'Doanh nghiệp đang chào', 'Businesses on offer') },
      { value: invVal.toLocaleString('vi-VN'), label: T(lang, 'Nhà đầu tư hoạt động', 'Active investors') },
      { value: T(lang, dealValVi, dealValEn), label: T(lang, 'Tổng giá trị thương vụ', 'Total deal value') }
    ];
  }, [animT, lang]);

  return <>
    <section style={{ position: 'relative', background: 'radial-gradient(1100px 500px at 78% -10%, rgba(27,173,234,.22), transparent 60%), linear-gradient(180deg, #0F2A4A 0%, #14315A 100%)', color: '#fff', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -80, top: 40, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,181,29,.20), transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '74px 24px 120px', position: 'relative' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', padding: '7px 15px', borderRadius: 999, fontSize: 13, fontWeight: 600, color: '#cfe8f6', marginBottom: 22 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 0 4px rgba(22,163,74,.22)' }} />
          <span className="l-vi">Kết nối thương vụ, khai mở lộc phát</span>
          <span className="l-en">Connecting Deals, Unlocking Prosperity</span>
        </div>
        <h1 className="d68-hero-h1" style={{ fontSize: 58, lineHeight: 1.05, fontWeight: 800, letterSpacing: -1.5, margin: '0 0 20px', maxWidth: 820 }}>
          <span className="l-vi">Nơi Doanh nghiệp gặp gỡ <span style={{ color: '#F2B51D' }}>Nhà đầu tư</span></span>
          <span className="l-en">Where Businesses Meet <span style={{ color: '#F2B51D' }}>Investors</span></span>
        </h1>
        <p style={{ fontSize: 19, lineHeight: 1.55, color: '#c6d5e6', maxWidth: 640, margin: '0 0 8px', fontWeight: 400 }}>
          <span className="l-vi">Mua bán Doanh nghiệp, Sang nhượng cửa hàng, huy động vốn, cho vay và đầu tư xuyên biên giới — bảo mật, chọn lọc, dễ kết nối.</span>
          <span className="l-en">M&amp;A, fundraising, lending and cross-border investment — confidential, curated, easy to connect.</span>
        </p>

        <div className="d68-fade" style={{ marginTop: 38, background: '#fff', borderRadius: 18, padding: 10, boxShadow: '0 24px 60px rgba(6,20,40,.4)', maxWidth: 960 }}>
          <div style={{ display: 'flex', gap: 6, padding: '6px 6px 0' }}>
            <button onClick={() => setTab('business')} style={tabStyle(tab === 'business')}>
              <span className="l-vi">Tìm Doanh nghiệp</span><span className="l-en">Find Businesses</span>
            </button>
            <button onClick={() => setTab('investor')} style={tabStyle(tab === 'investor')}>
              <span className="l-vi">Tìm Nhà đầu tư</span><span className="l-en">Find Investors</span>
            </button>
          </div>
          <div className="d68-search-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, padding: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: '#64748B' }}><span className="l-vi">Khu vực</span><span className="l-en">Region</span></span>
              <select value={region} onChange={(e) => setRegion(e.target.value)} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '11px 12px', fontSize: 15, color: '#0F2A4A', background: '#F7FAFC', fontWeight: 500, cursor: 'pointer', outline: 'none' }}>
                {regionOptions.map((r) => <option value={r.key} key={r.key}>{r.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: '#64748B' }}><span className="l-vi">Quốc gia</span><span className="l-en">Country</span></span>
              <select style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '11px 12px', fontSize: 15, color: '#0F2A4A', background: '#F7FAFC', fontWeight: 500, cursor: 'pointer', outline: 'none' }}>
                {countryOptions.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: '#64748B' }}><span className="l-vi">Ngành</span><span className="l-en">Industry</span></span>
              <select style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '11px 12px', fontSize: 15, color: '#0F2A4A', background: '#F7FAFC', fontWeight: 500, cursor: 'pointer', outline: 'none' }}>
                {industryOptions.map((ind) => <option key={ind}>{ind}</option>)}
              </select>
            </label>
            <button style={{ alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, padding: '0 26px', background: '#F2B51D', color: '#0F2A4A', fontWeight: 800, fontSize: 15, border: 'none', borderRadius: 10, cursor: 'pointer', boxShadow: '0 8px 18px rgba(242,181,29,.35)', whiteSpace: 'nowrap' }}>
              <span className="l-vi">Tìm kiếm</span><span className="l-en">Search</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <section style={{ background: '#0F2A4A' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div className="d68-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'rgba(255,255,255,.08)', borderRadius: 16, overflow: 'hidden', transform: 'translateY(-40px)', boxShadow: '0 20px 50px rgba(6,20,40,.35)' }}>
          {stats.map((s) => <div key={s.label} style={{ background: '#14315A', padding: '28px 26px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', letterSpacing: -1, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 14, color: '#9db4cc', fontWeight: 500 }}>{s.label}</div>
          </div>)}
        </div>
      </div>
    </section>

    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '26px 24px 72px' }}>
      <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 40px' }}>
        <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -.8, margin: '0 0 12px' }}><span className="l-vi">Bạn tham gia với vai trò nào?</span><span className="l-en">Which role fits you?</span></h2>
        <p style={{ fontSize: 17, color: '#64748B', margin: 0, lineHeight: 1.5 }}><span className="l-vi">Chọn vai trò để bắt đầu đăng tin, tìm thương vụ hoặc kết nối đúng đối tác.</span><span className="l-en">Pick a role to list a deal, browse opportunities or connect with the right partner.</span></p>
      </div>
      <div className="d68-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>
        {roleCards(lang).map((rc, index) => <Link to={roleLinks[index]} key={rc.title} style={{ border: '1px solid #E7EDF3', borderRadius: 18, padding: 30, background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(15,42,74,.04)', transition: 'transform .18s, box-shadow .18s' }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, background: rc.iconBg, color: rc.iconColor, fontSize: 22, fontWeight: 800 }}>{rc.iconChar}</div>
          <h3 style={{ fontSize: 21, fontWeight: 700, margin: '0 0 10px' }}>{rc.title}</h3>
          <p style={{ fontSize: 15, color: '#64748B', lineHeight: 1.55, margin: '0 0 22px', flex: 1 }}>{rc.desc}</p>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: rc.ctaColor }}>{rc.cta} <span style={{ fontSize: 17 }}>→</span></span>
        </Link>)}
      </div>
    </section>

    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 72px' }}>
      <Link to="/pricing" style={{ display: 'block', borderRadius: 18, overflow: 'hidden', boxShadow: '0 12px 34px rgba(6,20,40,.14)', border: '1px solid #E7EDF3' }}>
        <img className="l-vi" src="/assets/promo-vn.png" alt="Khuyến mãi Deals68" style={{ width: '100%', height: 'auto', display: 'block' }} />
        <img className="l-en" src="/assets/promo-en.png" alt="Deals68 promotion" style={{ width: '100%', height: 'auto', display: 'block' }} />
      </Link>
    </section>

    <section style={{ background: '#F7FAFC', borderTop: '1px solid #E7EDF3', borderBottom: '1px solid #E7EDF3' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 34, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#FEF3D3', color: '#B8860B', fontWeight: 700, fontSize: 12, padding: '6px 12px', borderRadius: 999, marginBottom: 14, textTransform: 'uppercase', letterSpacing: .5 }}>★ <span className="l-vi">Thương vụ nổi bật</span><span className="l-en">Featured Deals</span></div>
            <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -.8, margin: 0 }}><span className="l-vi">Cơ hội đang được chào</span><span className="l-en">Opportunities on the market</span></h2>
          </div>
          <Link to="/businesses" style={{ fontWeight: 700, color: '#1BADEA', fontSize: 15, whiteSpace: 'nowrap' }}><span className="l-vi">Xem tất cả</span><span className="l-en">View all</span> →</Link>
        </div>
        <div className="d68-deals" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>
          {deals(lang).map((d) => <Link to={`/businesses/${d.bizid}`} key={d.bizid} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(15,42,74,.04)', transition: 'transform .18s, box-shadow .18s' }}>
            <div style={{ position: 'relative', height: 180, overflow: 'hidden', background: '#0F2A4A' }}>
              {d.image ? <img src={d.image} alt={d.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
              {d.featured ? <span style={{ position: 'absolute', top: 12, right: 12, background: '#F2B51D', color: '#0F2A4A', fontSize: 11, fontWeight: 800, padding: '5px 10px', borderRadius: 7 }}>★ Featured</span> : null}
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1596cc', background: '#E7F6FD', padding: '4px 10px', borderRadius: 6 }}>{d.industry}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', background: '#F1F5F9', padding: '4px 10px', borderRadius: 6 }}>{d.dealType}</span>
              </div>
              <h3 style={{ fontSize: 16.5, fontWeight: 700, lineHeight: 1.4, margin: '0 0 16px', flex: 1 }}>{d.title}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 16, borderTop: '1px solid #EEF2F6' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .4 }}><span className="l-vi">Doanh thu 2025E</span><span className="l-en">Revenue 2025E</span></div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0F2A4A' }}>{d.revenue}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .4 }}><span className="l-vi">Giá trị / Cổ phần</span><span className="l-en">Amount / Stake</span></div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1596cc' }}>{d.amount}</div>
                </div>
              </div>
              <span style={{ marginTop: 18, textAlign: 'center', background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 14, padding: 11, borderRadius: 10 }}><span className="l-vi">Xem chi tiết</span><span className="l-en">View details</span></span>
            </div>
          </Link>)}
        </div>
      </div>
    </section>

    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 40px' }}>
        <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -.8, margin: '0 0 12px' }}><span className="l-vi">Ngành nổi bật</span><span className="l-en">Featured industries</span></h2>
        <p style={{ fontSize: 17, color: '#64748B', margin: 0, lineHeight: 1.5 }}><span className="l-vi">Khám phá cơ hội theo từng ngành trọng điểm trên Deals68.</span><span className="l-en">Explore opportunities across key industries on Deals68.</span></p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 20 }}>
        {industryTiles(lang).map((it) => <Link to="/businesses" key={it.name} style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #E7EDF3', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(15,42,74,.04)', transition: 'transform .18s,box-shadow .18s' }}>
          <div style={{ height: 120, background: it.grad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 46, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.28))' }}>{it.emoji}</span>
          </div>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{it.name}</div>
            <div style={{ fontSize: 12.5, color: '#64748B', lineHeight: 1.45 }}>{it.note}</div>
          </div>
        </Link>)}
      </div>
    </section>

    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '8px 24px 72px' }}>
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, background: 'linear-gradient(120deg,#1BADEA 0%, #1596cc 100%)', padding: '52px 56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ position: 'absolute', right: -40, bottom: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(242,181,29,.25)' }} />
        <div style={{ position: 'relative', maxWidth: 620 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.18)', color: '#fff', fontWeight: 700, fontSize: 12, padding: '6px 13px', borderRadius: 999, marginBottom: 16, textTransform: 'uppercase', letterSpacing: .5 }}>
            <span className="l-vi">Miễn phí · Không cần đăng nhập</span><span className="l-en">Free · No login needed</span>
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: -.6, margin: '0 0 12px', lineHeight: 1.15 }}><span className="l-vi">Định giá sơ bộ doanh nghiệp của bạn</span><span className="l-en">Estimate your business valuation</span></h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,.9)', margin: 0, lineHeight: 1.5 }}><span className="l-vi">Nhận khoảng định giá tham khảo theo ngành, quốc gia và tài chính chỉ trong một phút.</span><span className="l-en">Get an indicative valuation range by industry, country and financials in under a minute.</span></p>
        </div>
        <Link to="/valuation" style={{ position: 'relative', flexShrink: 0, background: '#F2B51D', color: '#0F2A4A', fontWeight: 800, fontSize: 16, padding: '16px 30px', borderRadius: 12, boxShadow: '0 10px 26px rgba(15,42,74,.25)', whiteSpace: 'nowrap' }}><span className="l-vi">Định giá ngay</span><span className="l-en">Estimate now</span> →</Link>
      </div>
    </section>

    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 72px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 30, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#E7F6FD', color: '#1596cc', fontWeight: 700, fontSize: 12, padding: '6px 12px', borderRadius: 999, marginBottom: 14, textTransform: 'uppercase', letterSpacing: .5 }}>◆ <span className="l-vi">Nhà đầu tư tiêu biểu</span><span className="l-en">Featured investors</span></div>
          <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -.8, margin: 0 }}><span className="l-vi">Nhà đầu tư đang tìm thương vụ</span><span className="l-en">Investors looking for deals</span></h2>
        </div>
        <Link to="/investors" style={{ fontWeight: 700, color: '#1BADEA', fontSize: 15, whiteSpace: 'nowrap' }}><span className="l-vi">Xem tất cả</span><span className="l-en">View all</span> →</Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 20 }}>
        {featuredInvestors(lang).map((iv) => <div key={iv.type} style={{ border: '1px solid #E7EDF3', borderRadius: 16, padding: 24, background: '#fff', boxShadow: '0 1px 2px rgba(15,42,74,.04)', display: 'flex', flexDirection: 'column', transition: 'transform .18s,box-shadow .18s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: '#EAF0F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{iv.icon}</div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', background: '#E9F9EF', padding: '5px 10px', borderRadius: 7 }}>✓ <span className="l-vi">Xác minh</span><span className="l-en">Verified</span></span>
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 14px' }}>{iv.type}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: '#94A3B8', flexShrink: 0 }}>Ticket</span><span style={{ fontWeight: 700, textAlign: 'right' }}>{iv.ticket}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: '#94A3B8', flexShrink: 0 }}><span className="l-vi">Ngành</span><span className="l-en">Focus</span></span><span style={{ fontWeight: 600, textAlign: 'right', color: '#334155' }}>{iv.focus}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: '#94A3B8', flexShrink: 0 }}><span className="l-vi">Khu vực</span><span className="l-en">Geography</span></span><span style={{ fontWeight: 600, textAlign: 'right', color: '#334155' }}>{iv.geo}</span></div>
          </div>
          <Link to="/investors" style={{ marginTop: 18, textAlign: 'center', border: '1px solid #E2E8F0', color: '#334155', fontWeight: 700, fontSize: 14, padding: 10, borderRadius: 10, transition: 'background .16s,border-color .16s,color .16s' }}><span className="l-vi">Xem hồ sơ</span><span className="l-en">View profile</span></Link>
        </div>)}
      </div>
    </section>

    <section style={{ background: '#EEF2F6', color: '#0F2A4A' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '74px 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 48px' }}>
          <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -.8, margin: '0 0 12px', color: '#0F2A4A' }}><span className="l-vi">Cách hoạt động</span><span className="l-en">How it works</span></h2>
          <p style={{ fontSize: 17, color: '#64748B', margin: 0, lineHeight: 1.5 }}><span className="l-vi">Danh tính được bảo mật. Hồ sơ đầy đủ và tài liệu chỉ mở sau khi hai bên chấp nhận kết nối.</span><span className="l-en">Identities stay confidential. Full profiles and documents unlock only after both sides accept the connection.</span></p>
        </div>
        <div className="d68-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {steps(lang).map((st) => <div key={st.n} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: 30 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: '#E7F6FD', color: '#1596cc', fontWeight: 800, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>{st.n}</div>
            <h3 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 10px', color: '#0F2A4A' }}>{st.title}</h3>
            <p style={{ fontSize: 15, color: '#64748B', lineHeight: 1.55, margin: 0 }}>{st.desc}</p>
          </div>)}
        </div>
      </div>
    </section>

    <section style={{ background: '#FDF3DC', position: 'relative', overflow: 'hidden' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 24px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 660 }}>
          <div style={{ fontSize: 22, letterSpacing: 3, marginBottom: 14 }}>🇻🇳 🇺🇸 🇨🇦 🇦🇺 🇩🇪 🇸🇬 🇯🇵 🇰🇷</div>
          <h2 style={{ fontSize: 30, fontWeight: 800, color: '#0F2A4A', letterSpacing: -.6, margin: '0 0 10px', lineHeight: 1.2 }}><span className="l-vi">Tham gia Đối tác thị trường cùng chúng tôi</span><span className="l-en">Join our Market Partner network</span></h2>
          <p style={{ fontSize: 16, color: '#5c6b7d', margin: 0, lineHeight: 1.5 }}><span className="l-vi">Kết nối doanh nghiệp Việt, nhà đầu tư và đối tác chiến lược tại thị trường của bạn — Việt Nam, Mỹ, Canada, Úc, Đức, Singapore, Nhật Bản, Hàn Quốc và hơn thế nữa.</span><span className="l-en">Connect Vietnamese businesses, investors and strategic partners in your market — Vietnam, the US, Canada, Australia, Germany, Singapore, Japan, Korea and beyond.</span></p>
        </div>
        <Link to="/partners" style={{ position: 'relative', flexShrink: 0, background: '#0F2A4A', color: '#fff', fontWeight: 800, fontSize: 15.5, padding: '15px 28px', borderRadius: 11, boxShadow: '0 10px 26px rgba(15,42,74,.18)', whiteSpace: 'nowrap' }}><span className="l-vi">Trở thành Đối tác thị trường</span><span className="l-en">Become a Market Partner</span> →</Link>
      </div>
    </section>
  </>;
}
