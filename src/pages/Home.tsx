import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BusinessCard from '../components/BusinessCard';
import InvestorCard from '../components/InvestorCard';
import { listBusinesses, listInvestors, fallbackSeedBusinesses } from '../lib/data';
import type { Lang } from '../lib/i18n';

export default function Home({ lang }: { lang: Lang }) {
  const [tab, setTab] = useState<'business'|'investor'>('business');
  const [q, setQ] = useState(''); const [country,setCountry]=useState(''); const [industry,setIndustry]=useState('');
  const [businesses,setBusinesses]=useState<any[]>([]); const [investors,setInvestors]=useState<any[]>([]);
  const navigate = useNavigate();
  useEffect(()=>{ listBusinesses().then(d=>setBusinesses(d.slice(0,6))).catch(async()=>setBusinesses(await fallbackSeedBusinesses())); listInvestors({limit:6}).then(d=>setInvestors(d.slice(0,6))).catch(()=>setInvestors([])); },[]);
  const go = () => {
    const params = new URLSearchParams(); if(q) params.set('q',q); if(country) params.set('country',country); if(industry) params.set('industry',industry);
    navigate(`/${tab === 'business' ? 'businesses' : 'investors'}?${params.toString()}`);
  };
  return <>
    <section className="hero"><div className="container">
      <h1>{lang==='en'?'Where Businesses Meet Investors':'Nơi Doanh nghiệp gặp gỡ Nhà đầu tư'}</h1>
      <p>{lang==='en'?'Find businesses for sale, fundraising opportunities, strategic investors and lenders across Vietnam, Southeast Asia and global markets.':'Tìm doanh nghiệp gọi vốn, sang nhượng, M&A, vay vốn và nhà đầu tư phù hợp tại Việt Nam, Đông Nam Á và toàn cầu.'}</p>
      <div className="searchbox">
        <div className="tabs"><button className={`tab ${tab==='business'?'active':''}`} onClick={()=>setTab('business')}>{lang==='en'?'Search Businesses':'Tìm DN'}</button><button className={`tab ${tab==='investor'?'active':''}`} onClick={()=>setTab('investor')}>{lang==='en'?'Search Investors':'Tìm NĐT'}</button></div>
        <div className="searchgrid"><input className="input" placeholder={tab==='business'?'F&B, clinic, logistics...':'VC, PE, angel, strategic...'} value={q} onChange={e=>setQ(e.target.value)}/><select className="select" value={country} onChange={e=>setCountry(e.target.value)}><option value="">All countries</option><option value="VN">Vietnam</option><option value="SG">Singapore</option><option value="US">United States</option><option value="JP">Japan</option><option value="KR">Korea</option></select><input className="input" placeholder="Industry" value={industry} onChange={e=>setIndustry(e.target.value)}/><button className="btn" onClick={go}>{lang==='en'?'Search':'Tìm kiếm'}</button></div>
      </div>
    </div></section>
    <section className="section"><div className="container section-title"><div><h2>{lang==='en'?'Featured business deals':'6 cơ hội DN nổi bật'}</h2><p className="muted">{lang==='en'?'2025 revenue is displayed as a single exact operating estimate, not a broad range.':'Doanh thu 2025 hiển thị một con số ước tính phù hợp, không dùng khoảng A-B.'}</p></div><Link className="btn secondary" to="/businesses">View all</Link></div><div className="container grid">{businesses.map(b=><BusinessCard key={b.id || b.slug} b={b} lang={lang}/>)}</div></section>
    <section className="section" style={{paddingTop:0}}><div className="container section-title"><div><h2>{lang==='en'?'Investor network':'Mạng lưới nhà đầu tư'}</h2><p className="muted">Anonymous public criteria; private contacts unlock only by approval.</p></div><Link className="btn secondary" to="/investors">View investors</Link></div><div className="container grid">{investors.map(inv=><InvestorCard key={inv.id || inv.code} inv={inv} lang="en"/>)}</div></section>
  </>;
}
