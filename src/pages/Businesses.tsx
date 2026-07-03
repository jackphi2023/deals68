import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BusinessCard from '../components/BusinessCard';
import { fallbackSeedBusinesses, listBusinesses } from '../lib/data';
import type { Lang } from '../lib/i18n';

export default function Businesses({ lang }: { lang: Lang }) {
  const [params] = useSearchParams();
  const [filters,setFilters]=useState({ search: params.get('q')||'', country: params.get('country')||'', industry: params.get('industry')||''});
  const [items,setItems]=useState<any[]>([]); const [loading,setLoading]=useState(true);
  async function load(){setLoading(true); try{setItems(await listBusinesses(filters));}catch{setItems((await fallbackSeedBusinesses()).filter((b:any)=>!filters.search || `${b.title_vi} ${b.title_en} ${b.industry}`.toLowerCase().includes(filters.search.toLowerCase())));} setLoading(false)}
  useEffect(()=>{load()},[]);
  return <section className="section"><div className="container"><div className="section-title"><div><h2>{lang==='en'?'Businesses for Sale & Investment':'Doanh nghiệp đang chào bán & gọi vốn'}</h2><p className="muted">{items.length} {lang==='en'?'public profiles':'hồ sơ đang hiển thị'}</p></div></div><div className="filters"><input className="input" value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})} placeholder="Search"/><select className="select" value={filters.country} onChange={e=>setFilters({...filters,country:e.target.value})}><option value="">All countries</option><option value="VN">Vietnam</option><option value="SG">Singapore</option><option value="US">USA</option></select><input className="input" value={filters.industry} onChange={e=>setFilters({...filters,industry:e.target.value})} placeholder="Industry"/><button className="btn" onClick={load}>Filter</button></div>{loading?<div className="empty">Loading...</div>:<div className="grid">{items.map(b=><BusinessCard key={b.id || b.slug} b={b} lang={lang}/>)}</div>}</div></section>
}
