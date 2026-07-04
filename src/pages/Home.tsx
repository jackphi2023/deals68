import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BusinessCard from '../components/BusinessCard';
import InvestorCard from '../components/InvestorCard';
import { listBusinesses, listInvestors, fallbackSeedBusinesses } from '../lib/data';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

const industries = (lang: Lang) => [
  { emoji:'🍽️', name:'F&B', grad:'linear-gradient(135deg,#f97316,#fb923c)', note:T(lang,'Nhà hàng · chuỗi · đồ uống','Restaurants · chains · beverages') },
  { emoji:'🩺', name:T(lang,'Y tế & Sức khỏe','Healthcare'), grad:'linear-gradient(135deg,#0ea5e9,#38bdf8)', note:T(lang,'Phòng khám · thẩm mỹ · dược','Clinics · aesthetics · pharma') },
  { emoji:'💻', name:T(lang,'Công nghệ','Technology'), grad:'linear-gradient(135deg,#6366f1,#818cf8)', note:T(lang,'SaaS · ứng dụng · AI','SaaS · mobile apps · AI') },
  { emoji:'🏭', name:T(lang,'Sản xuất & xuất khẩu','Manufacturing'), grad:'linear-gradient(135deg,#0f766e,#14b8a6)', note:T(lang,'Chế biến · thủy sản · dệt may','Processing · seafood · textiles') },
  { emoji:'🛍️', name:T(lang,'Bán lẻ','Retail'), grad:'linear-gradient(135deg,#db2777,#f472b6)', note:T(lang,'Chuỗi · thời trang · đa kênh','Chains · fashion · omnichannel') },
  { emoji:'🚚', name:'Logistics', grad:'linear-gradient(135deg,#2563eb,#3b82f6)', note:T(lang,'Kho lạnh · vận tải · chuỗi lạnh','Cold storage · freight · cold chain') },
  { emoji:'🏙️', name:T(lang,'Bất động sản','Real Estate'), grad:'linear-gradient(135deg,#b45309,#f59e0b)', note:T(lang,'Thương mại · nghỉ dưỡng','Commercial · hospitality') },
  { emoji:'🎓', name:T(lang,'Giáo dục','Education'), grad:'linear-gradient(135deg,#7c3aed,#a78bfa)', note:T(lang,'Trường · trung tâm · công nghệ giáo dục','Schools · centers · edtech') }
];

const featuredInvestors = (lang: Lang) => [
  { icon:'🏦', type:T(lang,'Quỹ đầu tư tư nhân khu vực','Regional PE fund'), ticket:'USD 2–10M', focus:T(lang,'F&B · Bán lẻ · Sản xuất','F&B · Retail · Manufacturing'), geo:T(lang,'Đông Nam Á','Southeast Asia') },
  { icon:'🚀', type:T(lang,'Quỹ đầu tư mạo hiểm công nghệ','Tech VC'), ticket:'USD 0.5–3M', focus:T(lang,'SaaS · Ứng dụng · AI','SaaS · Mobile · AI'), geo:T(lang,'Việt Nam · Singapore','Vietnam · Singapore') },
  { icon:'🏛️', type:T(lang,'Văn phòng gia đình','Family Office'), ticket:'USD 5–20M', focus:T(lang,'Y tế · Giáo dục · Bất động sản','Healthcare · Education · Real Estate'), geo:T(lang,'Singapore · Hong Kong','Singapore · Hong Kong') },
  { icon:'🌐', type:T(lang,'Người mua chiến lược','Strategic buyer'), ticket:T(lang,'Theo thương vụ','Deal-based'), focus:T(lang,'Thủy sản · Thực phẩm xuất khẩu','Seafood · Food export'), geo:T(lang,'Hàn Quốc · Nhật · EU','Korea · Japan · EU') }
];

const roleCards = (lang: Lang) => [
  { icon:'🏢', iconBg:'#EAF0F6', iconColor:'#0F2A4A', title:T(lang,'Doanh nghiệp','Business'), desc:T(lang,'Gọi vốn, vay, bán một phần hoặc toàn bộ. Đăng hồ sơ ẩn danh và nhận định giá sơ bộ.','Raise capital, borrow, sell part or all. Post an anonymous profile and get an indicative valuation.'), cta:T(lang,'Đăng ký doanh nghiệp','List a business'), link:'/register/business', ctaColor:'#1BADEA' },
  { icon:'📈', iconBg:'#FEF3D3', iconColor:'#B8860B', title:T(lang,'Nhà đầu tư','Investor'), desc:T(lang,'Nhà đầu tư cá nhân, quỹ, văn phòng gia đình, người mua chiến lược hoặc bên cho vay tìm thương vụ phù hợp.','Angels, funds, family offices, strategic buyers or lenders finding the right deals.'), cta:T(lang,'Tôi là nhà đầu tư','I am an Investor'), link:'/register/investor', ctaColor:'#B8860B' },
  { icon:'🤝', iconBg:'#E7F6FD', iconColor:'#1596cc', title:T(lang,'Cố vấn & Môi giới','Advisor & Broker'), desc:T(lang,'Cố vấn M&A, môi giới và tư vấn tài chính đại diện thương vụ và kết nối các bên.','M&A advisors, brokers and financial consultants representing deals and connecting parties.'), cta:T(lang,'Tham gia cố vấn','Join as advisor'), link:'/register/advisor', ctaColor:'#1596cc' }
];

const regionOptions = [
  { key:'all', vi:'Tất cả khu vực', en:'All regions' },
  { key:'sea', vi:'Đông Nam Á', en:'Southeast Asia' },
  { key:'eastasia', vi:'Đông Bắc Á', en:'East Asia' },
  { key:'global', vi:'Toàn cầu', en:'Global' }
];
const countryOptions = [
  { key:'', vi:'Tất cả quốc gia', en:'All countries' },
  { key:'VN', vi:'Việt Nam', en:'Vietnam' },
  { key:'SG', vi:'Singapore', en:'Singapore' },
  { key:'US', vi:'Mỹ', en:'United States' },
  { key:'JP', vi:'Nhật Bản', en:'Japan' },
  { key:'KR', vi:'Hàn Quốc', en:'Korea' }
];
const industryOptions = [
  { key:'', vi:'Tất cả ngành', en:'All industries' },
  { key:'F&B', vi:'F&B', en:'F&B' },
  { key:'Y tế & Sức khỏe', vi:'Y tế & Sức khỏe', en:'Healthcare' },
  { key:'Bán lẻ', vi:'Bán lẻ', en:'Retail' },
  { key:'Sản xuất', vi:'Sản xuất', en:'Manufacturing' },
  { key:'Công nghệ', vi:'Công nghệ', en:'Technology' },
  { key:'Logistics', vi:'Logistics', en:'Logistics' }
];

export default function Home({ lang }: { lang: Lang }) {
  const [tab, setTab] = useState<'business'|'investor'>('business');
  const [region, setRegion] = useState('all');
  const [country,setCountry]=useState('');
  const [industry,setIndustry]=useState('');
  const [businesses,setBusinesses]=useState<any[]>([]);
  const [investors,setInvestors]=useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(()=>{
    listBusinesses().then(d=>setBusinesses(d.slice(0,6))).catch(async()=>setBusinesses(await fallbackSeedBusinesses()));
    listInvestors({limit:6}).then(d=>setInvestors(d.slice(0,6))).catch(()=>setInvestors([]));
  },[]);

  const stats = useMemo(() => [
    { value: String(businesses.length || 6), label: T(lang,'Doanh nghiệp đang chào','Businesses on offer') },
    { value: '624', label: T(lang,'Nhà đầu tư hoạt động','Active investors') },
    { value: T(lang,'54,9 triệu USD','USD 54.9M'), label: T(lang,'Tổng giá trị thương vụ','Total deal value') },
  ], [businesses.length, lang]);

  const go = () => {
    const params = new URLSearchParams();
    if(region && region !== 'all') params.set('region',region);
    if(country) params.set('country',country);
    if(industry) params.set('industry',industry);
    navigate(`/${tab === 'business' ? 'businesses' : 'investors'}?${params.toString()}`);
  };

  return <>
    <section className="d68-home-hero">
      <div className="d68-home-hero__orb" />
      <div className="d68-home-container d68-home-hero__inner">
        <div className="d68-home-eyebrow"><span />{T(lang,'Kết nối thương vụ, khai mở lộc phát','Connecting Deals, Unlocking Prosperity')}</div>
        <h1 className="d68-home-hero__title">{T(lang,'Nơi Doanh nghiệp gặp gỡ ','Where Businesses Meet ')}<strong>{T(lang,'Nhà đầu tư','Investors')}</strong></h1>
        <p className="d68-home-hero__desc">{T(lang,'Mua bán Doanh nghiệp, Sang nhượng cửa hàng, huy động vốn, cho vay và đầu tư xuyên biên giới — bảo mật, chọn lọc, dễ kết nối.','M&A, fundraising, lending and cross-border investment — confidential, curated, easy to connect.')}</p>

        <div className="d68-home-search d68-fade">
          <div className="d68-home-search__tabs">
            <button className={tab==='business'?'active':''} onClick={()=>setTab('business')}>{T(lang,'Tìm Doanh nghiệp','Find Businesses')}</button>
            <button className={tab==='investor'?'active':''} onClick={()=>setTab('investor')}>{T(lang,'Tìm Nhà đầu tư','Find Investors')}</button>
          </div>
          <div className="d68-home-search__row">
            <label><span>{T(lang,'Khu vực','Region')}</span><select value={region} onChange={e=>setRegion(e.target.value)}>{regionOptions.map(r=><option key={r.key} value={r.key}>{lang==='en'?r.en:r.vi}</option>)}</select></label>
            <label><span>{T(lang,'Quốc gia','Country')}</span><select value={country} onChange={e=>setCountry(e.target.value)}>{countryOptions.map(c=><option key={c.key || 'all'} value={c.key}>{lang==='en'?c.en:c.vi}</option>)}</select></label>
            <label><span>{T(lang,'Ngành','Industry')}</span><select value={industry} onChange={e=>setIndustry(e.target.value)}>{industryOptions.map(i=><option key={i.key || 'all'} value={i.key}>{lang==='en'?i.en:i.vi}</option>)}</select></label>
            <button onClick={go}>{T(lang,'Tìm kiếm','Search')}</button>
          </div>
        </div>
      </div>
    </section>

    <section className="d68-home-stats"><div className="d68-home-container"><div className="d68-home-stats__grid">{stats.map(s=><div key={s.label}><b>{s.value}</b><span>{s.label}</span></div>)}</div></div></section>

    <section className="d68-home-section d68-home-section--roles">
      <div className="d68-home-container">
        <div className="d68-home-title d68-home-title--center"><h2>{T(lang,'Bạn tham gia với vai trò nào?','Which role fits you?')}</h2><p>{T(lang,'Chọn vai trò để bắt đầu đăng tin, tìm thương vụ hoặc kết nối đúng đối tác.','Pick a role to list a deal, browse opportunities or connect with the right partner.')}</p></div>
        <div className="d68-home-role-grid">{roleCards(lang).map(r=><Link className="d68-home-role-card" to={r.link} key={r.title}><div style={{background:r.iconBg,color:r.iconColor}}>{r.icon}</div><h3>{r.title}</h3><p>{r.desc}</p><span style={{color:r.ctaColor}}>{r.cta} <b>→</b></span></Link>)}</div>
      </div>
    </section>

    <section className="d68-home-promo"><div className="d68-home-container"><Link to="/pricing"><img className="l-vi" src="/assets/promo-vn.png" alt="Khuyến mãi Deals68"/><img className="l-en" src="/assets/promo-en.png" alt="Deals68 promotion"/></Link></div></section>

    <section className="d68-home-section d68-home-section--alt">
      <div className="d68-home-container">
        <div className="d68-home-title d68-home-title--row"><div><span className="d68-home-badge d68-home-badge--gold">★ {T(lang,'Thương vụ nổi bật','Featured Deals')}</span><h2>{T(lang,'Cơ hội đang được chào','Opportunities on the market')}</h2></div><Link to="/businesses">{T(lang,'Xem tất cả','View all')} →</Link></div>
        <div className="d68-home-deals">{businesses.map((b,i)=><BusinessCard key={b.id || b.slug} b={{...b, image_url:b.image_url || `/assets/deal${(i%6)+1}.png`}} lang={lang} index={i}/>)}</div>
      </div>
    </section>

    <section className="d68-home-section d68-home-section--industries"><div className="d68-home-container">
      <div className="d68-home-title d68-home-title--center"><h2>{T(lang,'Ngành nổi bật','Featured industries')}</h2><p>{T(lang,'Khám phá cơ hội theo từng ngành trọng điểm trên Deals68.','Explore opportunities across key industries on Deals68.')}</p></div>
      <div className="d68-home-industry-grid">{industries(lang).map(it=><Link className="d68-home-industry-card" to="/businesses" key={it.name}><div style={{background:it.grad}}><span>{it.emoji}</span></div><section><strong>{it.name}</strong><p>{it.note}</p></section></Link>)}</div>
    </div></section>

    <section className="d68-home-valuation"><div className="d68-home-container"><div className="d68-home-valuation__box"><div><span>{T(lang,'Miễn phí · Không cần đăng nhập','Free · No login needed')}</span><h2>{T(lang,'Định giá sơ bộ doanh nghiệp của bạn','Estimate your business valuation')}</h2><p>{T(lang,'Nhận khoảng định giá tham khảo theo ngành, quốc gia và tài chính chỉ trong một phút.','Get an indicative valuation range by industry, country and financials in under a minute.')}</p></div><Link to="/valuation">{T(lang,'Định giá ngay','Estimate now')} →</Link></div></div></section>

    <section className="d68-home-section d68-home-section--investors"><div className="d68-home-container">
      <div className="d68-home-title d68-home-title--row"><div><span className="d68-home-badge d68-home-badge--blue">◆ {T(lang,'Nhà đầu tư tiêu biểu','Featured investors')}</span><h2>{T(lang,'Nhà đầu tư đang tìm thương vụ','Investors looking for deals')}</h2></div><Link to="/investors">{T(lang,'Xem tất cả','View all')} →</Link></div>
      <div className="d68-home-investor-grid">{(investors.length ? investors.slice(0,4) : featuredInvestors(lang)).map((iv:any,idx:number)=> typeof iv.code === 'string' ? <InvestorCard key={iv.code} inv={iv} lang={lang}/> : <div className="investor-card" key={idx}><div className="investor-top"><div className="investor-icon">{iv.icon}</div><span className="pill green">✓ {T(lang,'Xác minh','Verified')}</span></div><h3>{iv.type}</h3><div className="info-row"><span>Ticket</span><span>{iv.ticket}</span></div><div className="info-row"><span>{T(lang,'Ngành','Focus')}</span><span>{iv.focus}</span></div><div className="info-row"><span>{T(lang,'Khu vực','Geography')}</span><span>{iv.geo}</span></div><Link className="btn secondary" style={{marginTop:18}} to="/investors">{T(lang,'Xem hồ sơ','View profile')}</Link></div>)}</div>
    </div></section>

    <section className="d68-home-how"><div className="d68-home-container">
      <div className="d68-home-title d68-home-title--center"><h2>{T(lang,'Cách hoạt động','How it works')}</h2><p>{T(lang,'Danh tính được bảo mật. Hồ sơ đầy đủ và tài liệu chỉ mở sau khi hai bên chấp nhận kết nối.','Identities stay confidential. Full profiles and documents unlock only after both sides accept the connection.')}</p></div>
      <div className="d68-home-steps">{[
        ['1',T(lang,'Đăng hồ sơ ẩn danh','Post an anonymous profile'),T(lang,'Doanh nghiệp tạo hồ sơ không lộ tên, nhận gợi ý định giá và chọn gói hiển thị.','Businesses create a no-name profile, get valuation guidance and pick a visibility package.')],
        ['2',T(lang,'Kết nối chọn lọc','Connect selectively'),T(lang,'Nhà đầu tư và cố vấn lọc theo khu vực, quốc gia, ngành rồi bày tỏ quan tâm.','Investors and advisors filter by region, country and industry, then express interest.')],
        ['3',T(lang,'Mở khóa & thương lượng','Unlock & negotiate'),T(lang,'Khi hai bên chấp nhận, hồ sơ đầy đủ và tài liệu được mở để bắt đầu trao đổi.','Once both accept, the full profile and documents unlock so discussions can begin.')]
      ].map(s=><div key={s[0]}><b>{s[0]}</b><h3>{s[1]}</h3><p>{s[2]}</p></div>)}</div>
    </div></section>

    <section className="d68-home-partner"><div className="d68-home-container"><div><div className="d68-home-partner__flags">🇻🇳 🇺🇸 🇨🇦 🇦🇺 🇩🇪 🇸🇬 🇯🇵 🇰🇷</div><h2>{T(lang,'Tham gia Đối tác thị trường cùng chúng tôi','Join our Market Partner network')}</h2><p>{T(lang,'Kết nối doanh nghiệp Việt, nhà đầu tư và đối tác chiến lược tại thị trường của bạn — Việt Nam, Mỹ, Canada, Úc, Đức, Singapore, Nhật Bản, Hàn Quốc và hơn thế nữa.','Connect Vietnamese businesses, investors and strategic partners in your market — Vietnam, the US, Canada, Australia, Germany, Singapore, Japan, Korea and beyond.')}</p></div><Link to="/partners">{T(lang,'Trở thành Đối tác thị trường','Become a Market Partner')} →</Link></div></section>
  </>;
}
