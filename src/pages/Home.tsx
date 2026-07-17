import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { countBusinesses, countInvestors, listHomepageBusinesses, listInvestors, investorTargetCountries } from '../lib/data';
import { getPublicDealValueSummary, type PublicDealValueSummary } from '../lib/publicMetrics';
import { toLocalizedPath } from '../lib/i18nRoutes';
import { formatMoneyForLang, labelIndustry, labelInvestorType, labelCountry, T } from '../lib/labels';
import type { Lang } from '../lib/i18n';
import { PromotionBanner } from '../components/SiteBanners';
import HomepageHeroSlider from '../components/HomepageHeroSlider';

const PUBLIC_INVESTOR_UI_STYLE_ID = 'd68-public-investor-ui-v1';
const PUBLIC_INVESTOR_UI_CSS = String.raw`
/* Release-safe Public Investor UI V1.
   Every selector is route-scoped; no grid/card primitive is redefined globally. */
.d68-home-page .d68-home-hero{min-height:560px;isolation:isolate}
.d68-home-page .d68-home-hero:after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(90deg,rgba(6,25,48,.78) 0%,rgba(6,25,48,.52) 46%,rgba(6,25,48,.10) 78%,rgba(6,25,48,.02) 100%)}
.d68-home-page .d68-hero-slider{position:absolute!important;inset:0!important;z-index:0!important;width:100%!important;height:100%!important;overflow:hidden!important}
.d68-home-page .d68-hero-slide{position:absolute!important;inset:0!important;display:block!important;width:100%!important;height:100%!important;opacity:0!important;pointer-events:none!important;transition:opacity .42s ease!important}
.d68-home-page .d68-hero-slide.is-active{opacity:1!important;pointer-events:auto!important}
.d68-home-page .d68-hero-media,.d68-home-page .d68-hero-media img{display:block!important;width:100%!important;height:100%!important}
.d68-home-page .d68-hero-media img{object-fit:cover!important;object-position:var(--d68-hero-position,50% 50%)!important}
.d68-home-page .d68-home-hero-media,.d68-home-page .d68-home-hero-media img{display:block!important;width:100%!important;height:100%!important}
.d68-home-page .d68-home-hero__inner{z-index:2!important}
.d68-home-page .d68-home-hero-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;max-width:790px;margin-top:30px}
.d68-home-page .d68-home-hero-stats>div{min-width:0;padding:15px 17px;border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(8,36,66,.58);backdrop-filter:blur(7px);box-shadow:0 10px 28px rgba(0,0,0,.16)}
.d68-home-page .d68-home-hero-stats b{display:block;color:#fff;font-size:clamp(22px,2.5vw,34px);font-weight:900;line-height:1.08;letter-spacing:-.7px}
.d68-home-page .d68-home-hero-stats span{display:block;margin-top:5px;color:#d8e8f4;font-size:12.5px;font-weight:700;line-height:1.35}
.d68-home-page .d68-home-role-card{background:#f8fdfa!important;border-color:#dfeee5!important;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease!important}
.d68-home-page .d68-home-role-card:hover{transform:none!important;border-color:#dfeee5!important;box-shadow:0 2px 8px rgba(15,42,74,.08)!important}
.d68-home-page .d68-home-role-card h3,.d68-home-page .d68-home-business-card h3,.d68-home-page .d68-home-investor-title-link,.d68-businesses-page .d68-business-card h3{transition:color .18s ease}
.d68-home-page .d68-home-role-card:hover h3,.d68-home-page .d68-home-business-card:hover h3,.d68-home-page .d68-home-investor-card:hover .d68-home-investor-title-link,.d68-businesses-page .d68-business-card:hover h3{color:#0f2a4a!important}
.d68-home-page .d68-home-investor-card{background:#fffef8!important;border-color:#eee9cf!important;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease!important}
.d68-home-page .d68-home-investor-card:hover{transform:none!important;border-color:#eee9cf!important;box-shadow:0 2px 8px rgba(15,42,74,.08)!important}
.d68-home-page .d68-home-investor-card h3{margin:0 0 8px}
.d68-home-page .d68-home-investor-title-link{display:inline!important;padding:0!important;border-radius:0!important;background:transparent!important;color:#0f2a4a!important;font-size:inherit!important;font-weight:inherit!important;line-height:inherit!important;text-align:left!important}
.d68-home-page .d68-home-investor-title-link:hover{background:transparent!important;color:rgb(27,173,234)!important}
.d68-home-page .d68-home-investor-card__meta{display:flex;flex-direction:column;gap:8px;margin:0 0 18px;color:#475569;font-size:12.5px;line-height:1.45}
.d68-home-page .d68-home-investor-card__meta span{min-width:0}
.d68-home-page .d68-home-investor-card__meta span:last-child{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2}
@media(max-width:700px){
  .d68-home-page .d68-home-hero{min-height:0!important;aspect-ratio:3/4!important;background:linear-gradient(180deg,#0f2a4a,#14315a)!important}
  .d68-home-page .d68-home-hero:after{background:linear-gradient(180deg,rgba(6,25,48,.46) 0%,rgba(6,25,48,.08) 48%,rgba(6,25,48,.70) 100%)}
  .d68-home-page .d68-home-hero-media--mobile img{object-fit:contain!important;background:#0f2a4a}
  .d68-home-page .d68-home-hero__orb{display:none!important}
  .d68-home-page .d68-home-hero__inner{position:absolute!important;inset:0!important;display:flex!important;flex-direction:column!important;width:100%!important;max-width:none!important;padding:24px 16px 18px!important;pointer-events:none}
  .d68-home-page .d68-home-eyebrow{align-self:flex-start;margin:0 0 12px!important;padding:6px 10px!important;font-size:11px!important;line-height:1.25!important}
  .d68-home-page .d68-home-hero__title{max-width:92%!important;margin:0!important;font-size:clamp(27px,8.2vw,34px)!important;line-height:1.06!important;letter-spacing:-.8px!important;text-shadow:0 3px 16px rgba(0,0,0,.44)}
  .d68-home-page .d68-home-hero__title strong{margin-top:3px!important}
  .d68-home-page .d68-home-hero-stats{grid-template-columns:minmax(68px,.82fr) minmax(68px,.82fr) minmax(150px,1.7fr)!important;gap:6px!important;width:100%!important;max-width:none!important;margin:auto 0 0!important;pointer-events:auto}
  .d68-home-page .d68-home-hero-stats>div{padding:9px 7px!important;border-radius:10px!important;text-align:center!important;background:rgba(8,36,66,.72)!important}
  .d68-home-page .d68-home-hero-stats b{font-size:clamp(16px,4.8vw,22px)!important;letter-spacing:-.4px!important;white-space:nowrap!important}
  .d68-home-page .d68-home-hero-stats>div:last-child b{font-size:clamp(12.5px,3.8vw,17px)!important}
  .d68-home-page .d68-home-hero-stats span{font-size:clamp(9px,2.5vw,11px)!important;line-height:1.2!important}
  .d68-home-page .d68-home-container{padding-left:16px;padding-right:16px}
  .d68-home-page .d68-home-role-grid,.d68-home-page .d68-home-investor-grid{grid-template-columns:1fr!important}
}
`;

function installPublicInvestorUiV1Styles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PUBLIC_INVESTOR_UI_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PUBLIC_INVESTOR_UI_STYLE_ID;
  style.textContent = PUBLIC_INVESTOR_UI_CSS;
  document.head.appendChild(style);
}

installPublicInvestorUiV1Styles();

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

function arrHome(value: any): string[] { if (Array.isArray(value)) return value.filter(Boolean).map(String); if (!value) return []; return String(value).split(/[;,]/).map((x) => x.trim()).filter(Boolean); }
function homeInvestorTicket(lang: Lang, i: any) { const min = Number(i.ticket_min || 0), max = Number(i.ticket_max || 0); if (!min && !max) return T(lang, 'Đang cập nhật', 'Updating'); if (min && max) return `${formatMoneyForLang(min, 'USD', lang)} – ${formatMoneyForLang(max, 'USD', lang)}`; return max ? `≤ ${formatMoneyForLang(max, 'USD', lang)}` : `≥ ${formatMoneyForLang(min, 'USD', lang)}`; }
function homeInvestorIndustries(lang: Lang, i: any) { const values = arrHome(i.industries).slice(0, 3).map((x) => labelIndustry(x, lang)); return values.join(', ') || T(lang, 'Đang cập nhật', 'Updating'); }
function shuffleHome<T>(items: T[]) { return [...items].sort(() => Math.random() - 0.5); }
function IndustryLineIcon({ type }: { type: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.15, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'finance':
      return <svg viewBox="0 0 36 36" aria-hidden="true"><path {...common} d="M7 27h22" /><path {...common} d="M10 27V15l8-5 8 5v12" /><path {...common} d="M14 27v-7M18 27v-9M22 27v-7" /></svg>;
    case 'healthcare':
      return <svg viewBox="0 0 36 36" aria-hidden="true"><path {...common} d="M18 29s-10-6.2-10-14a6 6 0 0 1 10-4.4A6 6 0 0 1 28 15c0 7.8-10 14-10 14Z" /><path {...common} d="M18 13v8M14 17h8" /></svg>;
    case 'technology':
      return <svg viewBox="0 0 36 36" aria-hidden="true"><rect {...common} x="9" y="10" width="18" height="14" rx="3" /><path {...common} d="M13 28h10M18 24v4M14 16l-3 3 3 3M22 16l3 3-3 3" /></svg>;
    case 'food':
      return <svg viewBox="0 0 36 36" aria-hidden="true"><path {...common} d="M11 8v20M15 8v7a4 4 0 0 1-8 0V8" /><path {...common} d="M22 8c4 2 6 5 6 10 0 4-2 7-5 9V8Z" /></svg>;
    case 'real_estate':
      return <svg viewBox="0 0 36 36" aria-hidden="true"><path {...common} d="M8 28h20M10 28V12l8-5 8 5v16" /><path {...common} d="M15 28v-8h6v8M14 14h2M20 14h2M14 18h2M20 18h2" /></svg>;
    case 'education':
      return <svg viewBox="0 0 36 36" aria-hidden="true"><path {...common} d="m6 14 12-6 12 6-12 6-12-6Z" /><path {...common} d="M11 17v6c3.5 3 10.5 3 14 0v-6" /><path {...common} d="M30 14v8" /></svg>;
    case 'seafood':
      return <svg viewBox="0 0 36 36" aria-hidden="true"><path {...common} d="M7 18c5-6 13-6 18 0-5 6-13 6-18 0Z" /><path {...common} d="m25 18 5-4v8l-5-4Z" /><path {...common} d="M13 17h.1M16 12c2 2 2 10 0 12" /></svg>;
    case 'manufacturing':
      return <svg viewBox="0 0 36 36" aria-hidden="true"><path {...common} d="M7 28V15l7 4v-4l7 4v-7h8v16H7Z" /><path {...common} d="M12 28v-5h5v5M22 14h4M22 18h4" /></svg>;
    default:
      return <svg viewBox="0 0 36 36" aria-hidden="true"><circle {...common} cx="18" cy="18" r="10" /><path {...common} d="M18 8v20M8 18h20" /></svg>;
  }
}

function dealValueText(lang: Lang, value: PublicDealValueSummary | null, loading: boolean) {
  if (!value) return loading ? '…' : T(lang, 'Đang cập nhật', 'Pending');
  if (lang === 'en') {
    if (value.totalUsd >= 1_000_000) {
      return `$${Math.floor(value.totalUsd / 1_000_000).toLocaleString('en-US')}M`;
    }
    return `$${Math.round(value.totalUsd).toLocaleString('en-US')}`;
  }
  return value.totalVnd >= 1_000_000_000
    ? `${Math.floor(value.totalVnd / 1_000_000_000).toLocaleString('vi-VN')} tỷ ₫`
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
        listHomepageBusinesses(6).catch(() => []),
        listInvestors({ limit: 80 }).catch(() => [])
      ]);
      if (!live) return;
      setBizCount(bc); setInvCount(ic); setDealValue(dv);
      setDeals((bs || []).map((b: any) => normalizeDeal(b, lang)).filter((d) => d.slug));
      const adminFeatured = (invs || []).filter((i: any) => i.admin_priority === true);
      const investorPool = adminFeatured.length ? adminFeatured : (invs || []);
      setInvestors(shuffleHome(investorPool).slice(0, 4));
      setLoading(false);
    })();
    return () => { live = false; };
  }, [lang]);

  const searchUrl = mode === 'business'
    ? buildPath('/businesses', lang, { search: keyword, industry, country, dealType })
    : buildPath('/investors', lang, { search: keyword, industry, country, type: investorType });
  const submitSearch = (e: React.FormEvent) => { e.preventDefault(); navigate(searchUrl); };
  const nav = (path: string) => toLocalizedPath(path, lang);

  const roleCards = [
    { icon: '🏢', bg: '#FEF3D3', color: '#B8860B',
      title: T(lang, 'Doanh nghiệp / Chủ doanh nghiệp', 'Businesses / Owners'),
      desc: T(lang, 'Gọi vốn, vay vốn, bán một phần hoặc toàn bộ. Đăng hồ sơ ẩn danh và kết nối với nhà đầu tư.', 'Raise capital, borrow, sell part or all. Post an anonymous profile and connect with investors.'),
      cta: T(lang, 'Đăng hồ sơ doanh nghiệp', 'List your business'), to: '/register/business' },
    { icon: '💼', bg: '#E7F6FD', color: '#1596cc',
      title: T(lang, 'Nhà đầu tư / Người mua / Bên cho vay', 'Investors / Buyers / Lenders'),
      desc: T(lang, 'Lọc cơ hội theo ngành, quy mô, lĩnh vực và kết nối với doanh nghiệp.', 'Filter opportunities by industry, size and focus area, then connect with businesses.'),
      cta: T(lang, 'Khám phá cơ hội', 'Explore opportunities'), to: '/investors' },
    { icon: '🤝', bg: '#EAF7EF', color: '#16A34A',
      title: T(lang, 'Đối tác thị trường', 'Market Partners'),
      desc: T(lang, 'Kết nối doanh nghiệp cần vốn với nhà đầu tư, người mua chiến lược và bên cho vay tại thị trường của bạn.', 'Connect businesses seeking capital with investors, strategic buyers and lenders in your market.'),
      cta: T(lang, 'Trở thành đối tác', 'Become a partner'), to: '/partners' }
  ];

  const industries = [
    { key: 'finance', icon: 'finance', vi: 'Tài chính', en: 'Finance', noteVi: 'Fintech, tín dụng, bảo hiểm', noteEn: 'Fintech, credit and insurance' },
    { key: 'healthcare', icon: 'healthcare', vi: 'Y tế & Chăm sóc sức khỏe', en: 'Health Care', noteVi: 'Phòng khám, nha khoa, chăm sóc sức khỏe', noteEn: 'Clinics, dental and healthcare' },
    { key: 'it_software', icon: 'technology', vi: 'CNTT & Phần mềm', en: 'IT & Software / Technology', noteVi: 'SaaS, AI, phần mềm, tự động hóa', noteEn: 'SaaS, AI, software and automation' },
    { key: 'food_beverage', icon: 'food', vi: 'Thực phẩm & Đồ uống (F&B)', en: 'Food & Beverage', noteVi: 'Nhà hàng, chuỗi, nhượng quyền', noteEn: 'Restaurants, chains and franchises' },
    { key: 'real_estate', icon: 'real_estate', vi: 'Bất động sản', en: 'Real Estate', noteVi: 'Tòa nhà, khách sạn, bất động sản vận hành', noteEn: 'Buildings, hotels and operating real estate' },
    { key: 'education_training', icon: 'education', vi: 'Giáo dục & Đào tạo', en: 'Education & Training', noteVi: 'Trường học, trung tâm đào tạo, EdTech', noteEn: 'Schools, training centres and EdTech' },
    { key: 'seafood_export', icon: 'seafood', vi: 'Thủy sản & Xuất khẩu', en: 'Seafood & Export', noteVi: 'Xuất khẩu, chế biến, kho lạnh', noteEn: 'Export, processing and cold storage' },
    { key: 'manufacturing', icon: 'manufacturing', vi: 'Sản xuất', en: 'Manufacturing', noteVi: 'Nhà máy, công nghiệp, tài sản vận hành', noteEn: 'Factories, industrial and operating assets' }
  ];

  const steps = [
    { n: '1', title: T(lang, 'Đăng hồ sơ ẩn danh', 'Create an anonymous profile'), desc: T(lang, 'Doanh nghiệp nhập dữ liệu thật; đội ngũ Deals68 duyệt thông tin công khai ẩn danh trước khi hiển thị.', 'Businesses submit real data; the Deals68 team reviews the anonymous public information before publishing.') },
    { n: '2', title: T(lang, 'Chuẩn hóa & duyệt', 'Structure & approve'), desc: T(lang, 'Hồ sơ được phân loại theo ngành, quy mô, nhu cầu vốn và được chấm điểm chất lượng.', 'Profiles are categorised by industry, size and capital need, then quality-scored.') },
    { n: '3', title: T(lang, 'Kết nối phù hợp', 'Connect with the right party'), desc: T(lang, 'Nhà đầu tư lọc, lưu, bày tỏ quan tâm; thông tin nhạy cảm mở sau khi kết nối được duyệt.', 'Investors filter, save and express interest; sensitive data unlocks after an approved connection.') }
  ];

  const dealValueLabel = useMemo(() => dealValueText(lang, dealValue, loading), [lang, dealValue, loading]);

  return (
    <main className="d68-home-page">
      <section className="d68-home-hero">
        <HomepageHeroSlider lang={lang} />
        <span className="d68-home-hero__orb" aria-hidden="true" />
        <div className="d68-home-container d68-home-hero__inner">
          <div className="d68-home-eyebrow"><span />{T(lang, 'Kết nối thương vụ, khai mở lộc phát', 'Connecting Deals, Unlocking Prosperity')}</div>
          <h1 className="d68-home-hero__title"><span>{T(lang, 'Nơi Doanh nghiệp gặp gỡ', 'Where Businesses Meet')}</span><strong>{T(lang, 'Nhà đầu tư', 'Investors')}</strong></h1>
          <div className="d68-home-hero-stats">
            <div><b>{bizCount ?? (loading ? '…' : deals.length)}</b><span>{T(lang, 'Doanh nghiệp đang chào', 'Active business listings')}</span></div>
            <div><b>{invCount ?? (loading ? '…' : investors.length)}</b><span>{T(lang, 'Nhà đầu tư hoạt động', 'Active investors')}</span></div>
            <div><b>{dealValueLabel}</b><span>{T(lang, 'Tổng giá trị thương vụ', 'Total deal value')}</span></div>
          </div>
        </div>
      </section>

      <section className="d68-home-container d68-home-section d68-home-section--roles">
        <div className="d68-home-title d68-home-title--center"><h2>{T(lang, 'Bạn tham gia với vai trò nào?', 'Which role fits you?')}</h2><p>{T(lang, 'Deals68 phục vụ nhiều nhu cầu: gọi vốn, mua bán, cho vay và phát triển thị trường.', 'Deals68 serves many needs: fundraising, M&A, lending and market development.')}</p></div>
        <div className="d68-home-role-grid">{roleCards.map((r) => <div key={r.title} className="d68-home-role-card"><div style={{ background: r.bg, color: r.color }}>{r.icon}</div><h3>{r.title}</h3><p>{r.desc}</p><Link to={nav(r.to)}><span>{r.cta} →</span></Link></div>)}</div>
      </section>

      <PromotionBanner placement="home_promotion" lang={lang} className="d68-home-container" />

      <section className="d68-home-container d68-home-section">
        <div className="d68-home-title d68-home-title--row"><div><span className="d68-home-badge d68-home-badge--gold">★ {T(lang, 'Thương vụ nổi bật', 'Featured Deals')}</span><h2>{T(lang, 'Cơ hội đang được chào', 'Opportunities on the market')}</h2></div><Link to={nav('/businesses')}>{T(lang, 'Xem tất cả', 'View all')} →</Link></div>
        {loading ? <div className="d68-home-deals">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="d68-home-business-card d68-home-business-card--loading"><div className="d68-home-business-card__media"/><div className="d68-home-business-card__body"/></div>)}</div> : deals.length ? <div className="d68-home-deals">{deals.map((d) => <Link key={d.id} to={nav(`/businesses/${d.slug}`)} className="d68-home-business-card"><div className="d68-home-business-card__media">{d.image ? <img src={d.image} alt={d.title} loading="lazy" /> : <span>{T(lang, 'Deals68 · Hồ sơ ẩn danh', 'Deals68 · Anonymous listing')}</span>}{d.featured ? <b>{T(lang, 'Nổi bật', 'Featured')}</b> : null}</div><div className="d68-home-business-card__body"><div className="d68-home-business-card__tags"><span>{d.industry}</span><span>📍 {d.city}</span></div><h3>{d.title}</h3><div className="d68-home-business-card__metrics"><div><span>{T(lang, 'Doanh thu', 'Revenue')}</span><strong>{d.revenue}</strong></div><div><span>{T(lang, 'Nhu cầu', 'Ask')}</span><strong>{d.ask}</strong></div></div></div></Link>)}</div> : <div className="d68-home-empty">{T(lang, 'Chưa có doanh nghiệp đang hiển thị.', 'No active business listings yet.')}</div>}
      </section>

      <section className="d68-home-industries">
        <div className="d68-home-container">
          <div className="d68-home-title d68-home-title--center"><h2>{T(lang, 'Ngành nổi bật', 'Featured industries')}</h2><p>{T(lang, 'Khám phá cơ hội theo từng ngành trọng điểm trên Deals68.', 'Explore opportunities across key industries on Deals68.')}</p></div>
          <div className="d68-home-industry-grid">{industries.map((it) => <Link key={it.vi} to={buildPath('/businesses', lang, { industry: it.key })} className="d68-home-industry-card"><div><IndustryLineIcon type={it.icon} /></div><section><strong>{T(lang, it.vi, it.en)}</strong><p>{T(lang, it.noteVi, it.noteEn)}</p></section></Link>)}</div>
        </div>
      </section>

      <section className="d68-home-container d68-home-valuation"><div className="d68-home-valuation__box"><div><span>{T(lang, 'Miễn phí - Không cần đăng nhập', 'Free - No login required')}</span><h2>{T(lang, 'Định giá sơ bộ doanh nghiệp của bạn', 'Estimate your business valuation')}</h2><p>{T(lang, 'Nhập một vài chỉ số để nhận khoảng định giá tham khảo trước khi đăng hồ sơ gọi vốn hoặc chuyển nhượng.', 'Enter a few metrics to get a reference valuation range before listing to raise capital or transfer.')}</p></div><Link to={nav('/valuation')}>{T(lang, 'Định giá ngay', 'Value my business')} →</Link></div></section>

      <section className="d68-home-container d68-home-section d68-home-investor-band"><div className="d68-home-title d68-home-title--row"><div><span className="d68-home-badge d68-home-badge--blue">◆ {T(lang, 'Nhà đầu tư tiêu biểu', 'Featured investors')}</span><h2>{T(lang, 'Nhà đầu tư đang tìm thương vụ', 'Investors looking for deals')}</h2></div><Link to={nav('/investors')}>{T(lang, 'Xem tất cả', 'View all')} →</Link></div>{loading ? <div className="d68-home-investor-grid">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="d68-home-investor-card" aria-hidden="true" />)}</div> : investors.length ? <div className="d68-home-investor-grid">{investors.map((i) => <article key={i.id || i.code} className="d68-home-investor-card"><div className="d68-home-investor-card__icon">$</div><h3><Link className="d68-home-investor-title-link" to={nav(`/investors/${i.code}`)}>{T(lang, i.title_vi || i.title_en || i.code, i.title_en || i.title_vi || i.code)}</Link></h3><p>{labelInvestorType(i.type, lang)} · {investorTargetCountries(i).slice(0, 3).map((c) => labelCountry(c, lang)).join(', ')}</p><div className="d68-home-investor-card__meta"><span><b>{T(lang, 'Quy mô đầu tư', 'Investment size')}:</b> {homeInvestorTicket(lang, i)}</span><span><b>{T(lang, 'Ngành', 'Industries')}:</b> {homeInvestorIndustries(lang, i)}</span></div><Link className="d68-home-investor-cta" to={nav(`/investors/${i.code}`)}>{T(lang, 'Xem chi tiết', 'View detail')} →</Link></article>)}</div> : <div className="d68-home-empty">{T(lang, 'Chưa có nhà đầu tư đang hiển thị.', 'No active investor listings yet.')}</div>}</section>

      <section className="d68-home-how"><div className="d68-home-container"><div className="d68-home-title d68-home-title--center"><h2 style={{ color: '#0F2A4A' }}>{T(lang, 'Cách hoạt động', 'How it works')}</h2><p>{T(lang, 'Ba bước để bắt đầu một thương vụ trên Deals68.', 'Three steps to start a deal on Deals68.')}</p></div><div className="d68-home-steps">{steps.map((s) => <div key={s.n}><b>{s.n}</b><h3>{s.title}</h3><p>{s.desc}</p></div>)}</div></div></section>
    </main>
  );
}
