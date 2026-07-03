import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BusinessCard from '../components/BusinessCard';
import InvestorCard from '../components/InvestorCard';
import { listBusinesses, listInvestors, fallbackSeedBusinesses } from '../lib/data';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

const industries = (lang: Lang) => [
  { emoji:'🍽️', name:'F&B', grad:'linear-gradient(135deg,#f97316,#fb923c)', note:T(lang,'Nhà hàng · chuỗi · đồ uống','Restaurants · chains · beverages') },
  { emoji:'🩺', name:T(lang,'Y tế & Sức khỏe','Healthcare'), grad:'linear-gradient(135deg,#0ea5e9,#38bdf8)', note:T(lang,'Phòng khám · thẩm mỹ · dược','Clinics · aesthetics · pharma') },
  { emoji:'💻', name:T(lang,'Công nghệ','Technology'), grad:'linear-gradient(135deg,#6366f1,#818cf8)', note:T(lang,'SaaS · mobile app · AI','SaaS · mobile apps · AI') },
  { emoji:'🏭', name:T(lang,'Sản xuất & XK','Manufacturing'), grad:'linear-gradient(135deg,#0f766e,#14b8a6)', note:T(lang,'Chế biến · thủy sản · dệt may','Processing · seafood · textiles') },
  { emoji:'🛍️', name:T(lang,'Bán lẻ','Retail'), grad:'linear-gradient(135deg,#db2777,#f472b6)', note:T(lang,'Chuỗi · thời trang · đa kênh','Chains · fashion · omnichannel') },
  { emoji:'🚚', name:'Logistics', grad:'linear-gradient(135deg,#2563eb,#3b82f6)', note:T(lang,'Kho lạnh · vận tải · cold chain','Cold storage · freight · cold chain') },
  { emoji:'🏙️', name:T(lang,'Bất động sản','Real Estate'), grad:'linear-gradient(135deg,#b45309,#f59e0b)', note:T(lang,'Thương mại · nghỉ dưỡng','Commercial · hospitality') },
  { emoji:'🎓', name:T(lang,'Giáo dục','Education'), grad:'linear-gradient(135deg,#7c3aed,#a78bfa)', note:T(lang,'Trường · trung tâm · edtech','Schools · centers · edtech') }
];

const featuredInvestors = (lang: Lang) => [
  { icon:'🏦', type:T(lang,'Quỹ PE khu vực','Regional PE fund'), ticket:'USD 2–10M', focus:T(lang,'F&B · Bán lẻ · Sản xuất','F&B · Retail · Manufacturing'), geo:T(lang,'Đông Nam Á','Southeast Asia') },
  { icon:'🚀', type:T(lang,'Quỹ VC công nghệ','Tech VC'), ticket:'USD 0.5–3M', focus:T(lang,'SaaS · Mobile · AI','SaaS · Mobile · AI'), geo:T(lang,'Việt Nam · Singapore','Vietnam · Singapore') },
  { icon:'🏛️', type:T(lang,'Family Office','Family Office'), ticket:'USD 5–20M', focus:T(lang,'Y tế · Giáo dục · BĐS','Healthcare · Education · Real Estate'), geo:T(lang,'Singapore · Hong Kong','Singapore · Hong Kong') },
  { icon:'🌐', type:T(lang,'Người mua chiến lược','Strategic buyer'), ticket:T(lang,'Theo thương vụ','Deal-based'), focus:T(lang,'Thủy sản · Thực phẩm XK','Seafood · Food export'), geo:T(lang,'Hàn Quốc · Nhật · EU','Korea · Japan · EU') }
];

const roleCards = (lang: Lang) => [
  { icon:'🏢', bg:'#EAF0F6', title:T(lang,'Doanh nghiệp','Business'), desc:T(lang,'Gọi vốn, vay, bán một phần hoặc toàn bộ. Đăng hồ sơ ẩn danh và nhận định giá AI.','Raise capital, borrow, sell part or all. Post an anonymous profile and get an AI valuation.'), cta:T(lang,'Đăng ký doanh nghiệp','List a business'), link:'/register/business' },
  { icon:'📈', bg:'#FEF3D3', title:T(lang,'Nhà đầu tư','Investor'), desc:T(lang,'Angel, VC, PE, family office, người mua chiến lược hay bên cho vay tìm thương vụ đúng khẩu vị.','Angels, VC, PE, family offices, strategic buyers or lenders finding the right deals.'), cta:T(lang,'Tôi là Nhà đầu tư','I am an Investor'), link:'/register/investor' },
  { icon:'🤝', bg:'#E7F6FD', title:T(lang,'Cố vấn & Môi giới','Advisor & Broker'), desc:T(lang,'Cố vấn M&A, môi giới và tư vấn tài chính đại diện nhiều thương vụ và kết nối các bên.','M&A advisors, brokers and financial consultants representing deals and connecting parties.'), cta:T(lang,'Tham gia cố vấn','Join as advisor'), link:'/register/advisor' }
];

export default function Home({ lang }: { lang: Lang }) {
  const [tab, setTab] = useState<'business'|'investor'>('business');
  const [region, setRegion] = useState('all'); const [country,setCountry]=useState(''); const [industry,setIndustry]=useState('');
  const [businesses,setBusinesses]=useState<any[]>([]); const [investors,setInvestors]=useState<any[]>([]);
  const navigate = useNavigate();
  useEffect(()=>{ listBusinesses().then(d=>setBusinesses(d.slice(0,6))).catch(async()=>setBusinesses(await fallbackSeedBusinesses())); listInvestors({limit:6}).then(d=>setInvestors(d.slice(0,6))).catch(()=>setInvestors([])); },[]);
  const go = () => { const params = new URLSearchParams(); if(region && region !== 'all') params.set('region',region); if(country) params.set('country',country); if(industry) params.set('industry',industry); navigate(`/${tab === 'business' ? 'businesses' : 'investors'}?${params.toString()}`); };
  return <>
    <section className="hero"><div className="container">
      <div className="eyebrow"><span className="dot" />{T(lang,'Kết nối thương vụ, khai mở lộc phát','Connecting Deals, Unlocking Prosperity')}</div>
      <h1>{T(lang,'Nơi Doanh nghiệp gặp gỡ ','Where Businesses Meet ')}<strong>{T(lang,'Nhà đầu tư','Investors')}</strong></h1>
      <p>{T(lang,'Mua bán Doanh nghiệp, Sang nhượng cửa hàng, huy động vốn, cho vay và đầu tư xuyên biên giới — bảo mật, chọn lọc, dễ kết nối.','M&A, fundraising, lending and cross-border investment — confidential, curated, easy to connect.')}</p>
      <div className="searchbox d68-fade">
        <div className="tabs"><button className={`tab ${tab==='business'?'active':''}`} onClick={()=>setTab('business')}>{T(lang,'Tìm Doanh nghiệp','Find Businesses')}</button><button className={`tab ${tab==='investor'?'active':''}`} onClick={()=>setTab('investor')}>{T(lang,'Tìm Nhà đầu tư','Find Investors')}</button></div>
        <div className="searchgrid">
          <label className="search-label"><span>{T(lang,'Khu vực','Region')}</span><select className="select" value={region} onChange={e=>setRegion(e.target.value)}><option value="all">{T(lang,'Tất cả khu vực','All regions')}</option><option value="sea">{T(lang,'Đông Nam Á','Southeast Asia')}</option><option value="eastasia">{T(lang,'Đông Bắc Á','East Asia')}</option><option value="global">Global</option></select></label>
          <label className="search-label"><span>{T(lang,'Quốc gia','Country')}</span><select className="select" value={country} onChange={e=>setCountry(e.target.value)}><option value="">{T(lang,'Tất cả quốc gia','All countries')}</option><option value="VN">Vietnam</option><option value="SG">Singapore</option><option value="US">United States</option><option value="JP">Japan</option><option value="KR">Korea</option></select></label>
          <label className="search-label"><span>{T(lang,'Ngành','Industry')}</span><select className="select" value={industry} onChange={e=>setIndustry(e.target.value)}><option value="">{T(lang,'Tất cả ngành','All industries')}</option><option>F&B</option><option>{T(lang,'Y tế & Sức khỏe','Healthcare')}</option><option>{T(lang,'Bán lẻ','Retail')}</option><option>{T(lang,'Sản xuất','Manufacturing')}</option><option>{T(lang,'Công nghệ','Technology')}</option><option>Logistics</option></select></label>
          <button className="btn gold" style={{alignSelf:'flex-end',height:46}} onClick={go}>{T(lang,'Tìm kiếm','Search')}</button>
        </div>
      </div>
    </div></section>

    <section className="stats-band"><div className="container"><div className="stats-grid">
      <div className="stat-card"><b>{businesses.length || 6}</b><span>{T(lang,'Doanh nghiệp đang chào','Businesses on offer')}</span></div>
      <div className="stat-card"><b>624</b><span>{T(lang,'Nhà đầu tư hoạt động','Active investors')}</span></div>
      <div className="stat-card"><b>{T(lang,'54,9 triệu $','$54.9M')}</b><span>{T(lang,'Tổng giá trị thương vụ','Total deal value')}</span></div>
    </div></div></section>

    <section className="section"><div className="container">
      <div className="section-title center"><h2>{T(lang,'Bạn tham gia với vai trò nào?','Which role fits you?')}</h2><p>{T(lang,'Chọn vai trò để bắt đầu đăng tin, tìm thương vụ hoặc kết nối đúng đối tác.','Pick a role to list a deal, browse opportunities or connect with the right partner.')}</p></div>
      <div className="grid">{roleCards(lang).map((r)=><Link className="role-card" to={r.link} key={r.title}><div className="role-icon" style={{background:r.bg}}>{r.icon}</div><h3>{r.title}</h3><p className="muted">{r.desc}</p><span className="view-all">{r.cta} →</span></Link>)}</div>
    </div></section>

    <section className="section alt"><div className="container">
      <div className="section-title"><div><div className="badge-title gold">★ {T(lang,'Thương vụ nổi bật','Featured Deals')}</div><h2>{T(lang,'Cơ hội đang được chào','Opportunities on the market')}</h2></div><Link className="view-all" to="/businesses">{T(lang,'Xem tất cả','View all')} →</Link></div>
      <div className="grid">{businesses.map((b,i)=><BusinessCard key={b.id || b.slug} b={{...b, image_url:b.image_url || `/assets/deal${(i%6)+1}.png`}} lang={lang}/>)}</div>
    </div></section>

    <section className="section"><div className="container">
      <div className="section-title center"><h2>{T(lang,'Ngành nổi bật','Featured industries')}</h2><p>{T(lang,'Khám phá cơ hội theo từng ngành trọng điểm trên Deals68.','Explore opportunities across key industries on Deals68.')}</p></div>
      <div className="grid4">{industries(lang).map(it=><Link className="industry-card" to="/businesses" key={it.name}><div className="industry-hero" style={{background:it.grad}}><span>{it.emoji}</span></div><div><strong>{it.name}</strong><p className="muted" style={{fontSize:12.5,lineHeight:1.45,margin:'4px 0 0'}}>{it.note}</p></div></Link>)}</div>
    </div></section>

    <section className="section" style={{paddingTop:8}}><div className="container">
      <div className="section-title"><div><div className="badge-title blue">◆ {T(lang,'Nhà đầu tư tiêu biểu','Featured investors')}</div><h2>{T(lang,'Nhà đầu tư đang tìm thương vụ','Investors looking for deals')}</h2></div><Link className="view-all" to="/investors">{T(lang,'Xem tất cả','View all')} →</Link></div>
      <div className="grid4">{(investors.length ? investors.slice(0,4) : featuredInvestors(lang)).map((iv:any,idx:number)=> typeof iv.code === 'string' ? <InvestorCard key={iv.code} inv={iv} lang={lang}/> : <div className="investor-card" key={idx}><div className="investor-top"><div className="investor-icon">{iv.icon}</div><span className="pill green">✓ {T(lang,'Xác minh','Verified')}</span></div><h3>{iv.type}</h3><div className="info-row"><span>Ticket</span><span>{iv.ticket}</span></div><div className="info-row"><span>{T(lang,'Ngành','Focus')}</span><span>{iv.focus}</span></div><div className="info-row"><span>{T(lang,'Khu vực','Geography')}</span><span>{iv.geo}</span></div><Link className="btn secondary" style={{marginTop:18}} to="/investors">{T(lang,'Xem hồ sơ','View profile')}</Link></div>)}</div>
    </div></section>

    <section className="section how"><div className="container">
      <div className="section-title center"><h2>{T(lang,'Cách hoạt động','How it works')}</h2><p>{T(lang,'Danh tính được bảo mật. Hồ sơ đầy đủ và tài liệu chỉ mở sau khi hai bên chấp nhận kết nối.','Identities stay confidential. Full profiles and documents unlock only after both sides accept the connection.')}</p></div>
      <div className="grid">{[
        ['1',T(lang,'Đăng hồ sơ ẩn danh','Post an anonymous profile'),T(lang,'Doanh nghiệp tạo hồ sơ không lộ tên, nhận gợi ý định giá AI và chọn gói hiển thị theo tuần.','Businesses create a no-name profile, get an AI valuation and pick a weekly display package.')],
        ['2',T(lang,'Kết nối chọn lọc','Connect selectively'),T(lang,'Nhà đầu tư & cố vấn lọc theo khu vực, quốc gia, ngành rồi bày tỏ quan tâm kèm NDA nhẹ.','Investors & advisors filter by region, country and industry, then express interest with a light NDA.')],
        ['3',T(lang,'Mở khóa & thương lượng','Unlock & negotiate'),T(lang,'Khi hai bên chấp nhận, hồ sơ đầy đủ và tài liệu được mở, chat 1-1 bắt đầu.','Once both accept, the full profile and documents unlock and a 1-on-1 chat begins.')]
      ].map(s=><div className="step-card" key={s[0]}><div className="step-n">{s[0]}</div><h3>{s[1]}</h3><p>{s[2]}</p></div>)}</div>
    </div></section>

    <section className="section"><div className="container"><div className="valuation-cta"><div><div className="badge-title" style={{background:'rgba(255,255,255,.18)',color:'#fff'}}>{T(lang,'Miễn phí · Không cần đăng nhập','Free · No login needed')}</div><h2>{T(lang,'Định giá sơ bộ doanh nghiệp của bạn','Estimate your business valuation')}</h2><p>{T(lang,'Nhận khoảng định giá tham khảo theo ngành, quốc gia và tài chính chỉ trong một phút.','Get an indicative valuation range by industry, country and financials in under a minute.')}</p></div><Link className="btn gold" to="/valuation">{T(lang,'Định giá ngay','Estimate now')} →</Link></div></div></section>
  </>;
}
