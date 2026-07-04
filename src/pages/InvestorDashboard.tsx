import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getInvestorByOwner, listBusinesses } from '../lib/data';
import { supabase } from '../lib/supabase';
import BusinessCard from '../components/BusinessCard';
import { computeFitScore } from '../lib/scoring';
import { formatCompactMoney, percent } from '../lib/format';

type Tab = 'overview' | 'profile' | 'criteria' | 'recommended' | 'saved' | 'proposals' | 'requests' | 'privacy' | 'alerts' | 'security';

const tabMap: Record<string, Tab> = {
  '': 'overview', profile:'profile', criteria:'criteria', recommended:'recommended', saved:'saved', proposals:'proposals', 'request-data':'requests', requests:'requests', privacy:'privacy', alerts:'alerts', contacts:'privacy', payments:'security', security:'security', audit:'security'
};
const tabs: {id: Tab; label: string; href: string}[] = [
  {id:'overview', label:'Overview', href:'/dashboard/investor'},
  {id:'profile', label:'Profile', href:'/dashboard/investor/profile'},
  {id:'criteria', label:'Investment criteria', href:'/dashboard/investor/criteria'},
  {id:'recommended', label:'Recommended', href:'/dashboard/investor/recommended'},
  {id:'saved', label:'Saved businesses', href:'/dashboard/investor/saved'},
  {id:'proposals', label:'Proposals', href:'/dashboard/investor/proposals'},
  {id:'requests', label:'Data requests', href:'/dashboard/investor/request-data'},
  {id:'privacy', label:'Privacy', href:'/dashboard/investor/privacy'},
  {id:'alerts', label:'Alerts', href:'/dashboard/investor/alerts'},
  {id:'security', label:'Security', href:'/dashboard/investor/security'}
];
function resolveTab(pathname:string):Tab { const suffix = pathname.replace('/dashboard/investor','').replace(/^\//,'').split('/')[0]; return tabMap[suffix] || 'overview'; }

export default function InvestorDashboard(){
  const {profile,loading}=useAuth();
  const navigate=useNavigate();
  const location = useLocation();
  const [tab,setTab]=useState<Tab>(()=>resolveTab(location.pathname));
  const [inv,setInv]=useState<any>();
  const [allBiz,setAllBiz]=useState<any[]>([]);
  const [saved,setSaved]=useState<any[]>([]);
  const [props,setProps]=useState<any[]>([]);
  const [requests,setRequests]=useState<any[]>([]);
  const [interests,setInterests]=useState<any[]>([]);
  const [countries,setCountries]=useState<any[]>([]);
  const [msg,setMsg]=useState('');
  const [busy,setBusy]=useState(false);
  const [loadError,setLoadError]=useState('');

  useEffect(()=>setTab(resolveTab(location.pathname)),[location.pathname]);

  async function load(){
    if(!profile)return;
    setBusy(true); setLoadError('');
    try {
      const i=await getInvestorByOwner(profile.id);
      setInv(i);
      const biz=await listBusinesses(); setAllBiz(biz);
      if(i){
        const [{data:s},{data:p},{data:r},{data:int}] = await Promise.all([
          supabase.from('saved_businesses').select('*, businesses(*)').eq('investor_id',i.id).order('created_at',{ascending:false}),
          supabase.from('proposals').select('*, businesses(*)').eq('investor_id',i.id).order('sent_at',{ascending:false}),
          supabase.from('request_data').select('*, businesses(public_code,title_vi,title_en,slug,quality_score)').eq('investor_id',i.id).order('created_at',{ascending:false}),
          supabase.from('investor_interests').select('*, businesses(public_code,title_vi,title_en,slug,quality_score,ask_amount,ask_currency,stake_pct)').eq('investor_id',i.id).order('created_at',{ascending:false})
        ]);
        setSaved(s||[]); setProps(p||[]); setRequests(r||[]); setInterests(int||[]);
      }
      const {data:c}=await supabase.from('country_calling_codes').select('*').order('top',{ascending:false}).order('display_order'); setCountries(c||[]);
    } catch(e:any){ setLoadError(e?.message || 'Could not load investor dashboard.'); }
    finally { setBusy(false); }
  }

  useEffect(()=>{ if(!loading&&!profile) navigate('/login?next=/dashboard/investor'); if(profile) load(); },[profile?.id,loading]);

  const recommended=useMemo(()=> inv ? allBiz.map(b=>({...b,fit:computeFitScore(b,inv)})).filter(b=>b.fit>=35).sort((a,b)=> b.fit-a.fit || new Date(b.created_at||0).getTime()-new Date(a.created_at||0).getTime()).slice(0,12) : [],[allBiz,inv]);
  const phoneOptions = countries.length?countries:[{iso2:'VN',dial_code:'+84',country:'Vietnam',example_format:'+84-XXXXXXXXX'},{iso2:'US',dial_code:'+1',country:'United States',example_format:'+1-XXXXXXXXXX'},{iso2:'SG',dial_code:'+65',country:'Singapore',example_format:'+65-XXXXXXXX'},{iso2:'KR',dial_code:'+82',country:'South Korea',example_format:'+82-XXXXXXXXX'},{iso2:'JP',dial_code:'+81',country:'Japan',example_format:'+81-XXXXXXXXXX'}];

  if(loading) return <section className="section"><div className="container empty">Loading investor dashboard...</div></section>;
  if(!profile) return <Navigate to="/login?next=/dashboard/investor" replace/>;
  if(profile.role !== 'investor' && profile.role !== 'admin') return <section className="section"><div className="container empty"><h2>Investor access only</h2><p className="muted">Role hiện tại: {profile.role}. Dashboard này dành cho nhà đầu tư.</p><Link className="btn secondary" to="/">Back home</Link></div></section>;
  if(!inv) return <section className="section"><div className="container empty"><h2>Investor profile not found</h2><p className="muted">Tài khoản này chưa có hồ sơ NĐT hoặc đang chờ admin duyệt.</p><Link className="btn" to="/register/investor">Create investor profile</Link></div></section>;

  async function saveProfile(e:FormEvent){
    e.preventDefault(); const fd = new FormData(e.currentTarget as HTMLFormElement);
    const {error}=await supabase.from('investors').update({title_en:fd.get('title_en'), title_vi:fd.get('title_vi'), desc_en:fd.get('desc_en'), desc_vi:fd.get('desc_vi'), type:fd.get('type'), country_iso2:fd.get('country_iso2'), country:fd.get('country')}).eq('id',inv.id);
    setMsg(error?error.message:'Investor profile updated.'); load();
  }
  async function saveCriteria(e:FormEvent){
    e.preventDefault(); const fd=new FormData(e.currentTarget as HTMLFormElement);
    const sectors=String(fd.get('sectors')||'').split(',').map(s=>s.trim()).filter(Boolean);
    const dealTypes=String(fd.get('deal_types')||'').split(',').map(s=>s.trim()).filter(Boolean);
    const criteria={sectors,dealTypes,revenueRange:fd.get('revenueRange'),ebitdaRange:fd.get('ebitdaRange'),notes:fd.get('notes')};
    const {error}=await supabase.from('investors').update({industries:sectors,deal_types:dealTypes,stage:fd.get('stage'),ticket_min:Number(fd.get('ticket_min')||0),ticket_max:Number(fd.get('ticket_max')||0),criteria}).eq('id',inv.id);
    setMsg(error?error.message:'Criteria updated. Matching grid refreshed.'); load();
  }
  async function savePrivacy(e:FormEvent){
    e.preventDefault(); const fd=new FormData(e.currentTarget as HTMLFormElement);
    const privacy={shareEmail:fd.get('shareEmail')==='on',email:fd.get('email'),sharePhone:fd.get('sharePhone')==='on',phoneCountry:fd.get('phoneCountry'),phone:fd.get('phone'),shareWebsite:fd.get('shareWebsite')==='on',website:fd.get('website')};
    const {error}=await supabase.from('investors').update({privacy}).eq('id',inv.id);
    setMsg(error?error.message:'Privacy settings updated. Contact details still unlock only after approved connection.'); load();
  }
  async function proposalStatus(row:any,status:string){const {error}=await supabase.from('proposals').update({status}).eq('id',row.id); setMsg(error?error.message:'Proposal updated.'); load();}
  async function requestMoreData(businessId:string){const {error}=await supabase.from('request_data').insert({business_id:businessId,investor_id:inv.id,requested_items:['IM','Financial statements','NDA'],note:'Investor requested more data from dashboard.',status:'requested'}); setMsg(error?error.message:'Data request sent to admin/business.'); load();}
  async function saveBusiness(businessId:string){const {error}=await supabase.from('saved_businesses').upsert({business_id:businessId,investor_id:inv.id},{onConflict:'investor_id,business_id'}); setMsg(error?error.message:'Saved business.'); load();}

  return <section className="dashboard-page investor-dashboard-page"><div className="container dashboard-shell">
    <aside className="dashboard-side"><div className="dash-brand"><span className="pill green">Investor</span><b>{inv.code}</b></div>{tabs.map(item=><Link key={item.id} to={item.href} onClick={()=>setTab(item.id)} className={`side-link ${tab===item.id?'active':''}`}>{item.label}</Link>)}<div className="supportbox"><b>Deal sourcing support</b><p>Update your criteria to get better recommended businesses and alerts.</p><Link to="/businesses">Browse businesses</Link></div></aside>
    <main className="dashboard-main"><div className="dashboard-top"><div><span className="badge-title blue">◆ Investor Dashboard</span><h1>{inv.title_en || inv.title_vi}</h1><p className="muted">{inv.type} · {inv.country || inv.country_iso2} · {inv.stage || 'Any stage'}</p></div><Link className="btn secondary" to={`/investors/${inv.code}`}>View public profile</Link></div>{loadError && <div className="notice warn">{loadError}</div>}{msg&&<div className="notice">{msg}</div>}{busy&&<div className="notice small-note">Loading data...</div>}

    {tab==='overview' && <div className="dashboard-grid"><Metric title="Recommended" value={String(recommended.length)} note="Businesses matching criteria"/><Metric title="Saved" value={String(saved.length)} note="Saved opportunities"/><Metric title="Proposals" value={String(props.length)} note="Sent/received proposals"/><Metric title="Privacy" value={inv.privacy?.shareEmail||inv.privacy?.sharePhone?'Opt-in':'Locked'} note="Contact sharing rules"/><div className="dash card-wide"><h2>Recommended businesses</h2>{recommended.length?<div className="grid2">{recommended.slice(0,4).map(b=><div key={b.id}><BusinessCard b={b} lang="en"/><p className="pill green">Fit Score {b.fit}/100</p></div>)}</div>:<div className="empty">No matching businesses yet. Update criteria.</div>}</div></div>}

    {tab==='profile' && <form onSubmit={saveProfile} className="dash formgrid"><label>Title EN<input className="input" name="title_en" defaultValue={inv.title_en}/></label><label>Title VI<input className="input" name="title_vi" defaultValue={inv.title_vi}/></label><label>Type<input className="input" name="type" defaultValue={inv.type}/></label><label>Country ISO2<input className="input" name="country_iso2" defaultValue={inv.country_iso2}/></label><label>Country name<input className="input" name="country" defaultValue={inv.country}/></label><label style={{gridColumn:'1/-1'}}>Description EN<textarea className="textarea" name="desc_en" defaultValue={inv.desc_en}/></label><label style={{gridColumn:'1/-1'}}>Description VI<textarea className="textarea" name="desc_vi" defaultValue={inv.desc_vi}/></label><button className="btn">Save profile</button></form>}

    {tab==='criteria' && <div className="dash"><h2>Investment criteria</h2><form onSubmit={saveCriteria} className="formgrid"><label style={{gridColumn:'1/-1'}}>Sectors, comma separated<input className="input" name="sectors" defaultValue={(inv.industries||[]).join(', ')}/></label><label style={{gridColumn:'1/-1'}}>Deal types, comma separated<input className="input" name="deal_types" defaultValue={(inv.deal_types||[]).join(', ')}/></label><label>Ticket min USD<input className="input" name="ticket_min" type="number" defaultValue={inv.ticket_min}/></label><label>Ticket max USD<input className="input" name="ticket_max" type="number" defaultValue={inv.ticket_max}/></label><label>Stage<input className="input" name="stage" defaultValue={inv.stage}/></label><label>Revenue range<select className="select" name="revenueRange" defaultValue={inv.criteria?.revenueRange||''}><option value="">Any</option><option value="0-1m">0–1M USD</option><option value="1-10m">1–10M USD</option><option value="10m+">10M+ USD</option></select></label><label>EBITDA range<select className="select" name="ebitdaRange" defaultValue={inv.criteria?.ebitdaRange||''}><option value="">Any</option><option value="0-10">0–10%</option><option value="10-20">10–20%</option><option value="20+">20%+</option></select></label><label style={{gridColumn:'1/-1'}}>Notes<textarea className="textarea" name="notes" defaultValue={inv.criteria?.notes||''}/></label><button className="btn">Update criteria</button></form></div>}

    {tab==='recommended' && <div className="dash"><h2>Recommended businesses</h2>{recommended.length?<div className="grid2">{recommended.map(b=><div key={b.id}><BusinessCard b={b} lang="en"/><div className="action-row"><span className="pill green">Fit {b.fit}/100</span><button className="btn small secondary" onClick={()=>saveBusiness(b.id)}>Save</button><button className="btn small" onClick={()=>requestMoreData(b.id)}>Request data</button></div></div>)}</div>:<div className="empty">No recommendations yet. Update investment criteria.</div>}</div>}

    {tab==='saved' && <div className="dash"><h2>Saved businesses</h2>{saved.length?<div className="grid2">{saved.map(s=><BusinessCard key={s.id} b={s.businesses} lang="en"/>)}</div>:<div className="empty">No saved businesses yet.</div>}</div>}

    {tab==='proposals' && <div className="dash"><h2>Proposal list</h2><table className="table"><thead><tr><th>Business</th><th>Investment proposal</th><th>EBITDA</th><th>Quality</th><th>Action</th></tr></thead><tbody>{props.map(p=><tr key={p.id}><td>{p.businesses?.title_en || p.businesses?.title_vi}</td><td>{formatCompactMoney(p.businesses?.ask_amount,p.businesses?.ask_currency)} for {percent(p.businesses?.stake_pct)}</td><td>{percent(p.businesses?.ebitda_margin)}</td><td>{p.businesses?.quality_score}/100</td><td><button className="btn small green" onClick={()=>proposalStatus(p,'approved')}>Approve</button> <button className="btn small secondary" onClick={()=>proposalStatus(p,'request_data')}>Request data</button> <button className="btn small danger" onClick={()=>proposalStatus(p,'declined')}>Decline</button></td></tr>)}</tbody></table>{!props.length && <div className="empty">No proposals yet.</div>}</div>}

    {tab==='requests' && <div className="dash"><h2>Data requests</h2><table className="table"><thead><tr><th>Business</th><th>Items</th><th>Status</th><th>Open</th></tr></thead><tbody>{requests.map(r=><tr key={r.id}><td>{r.businesses?.title_en || r.businesses?.title_vi}</td><td>{(r.requested_items||[]).join(', ')}</td><td>{r.status}</td><td><Link to={`/businesses/${r.businesses?.slug || ''}`}>View</Link></td></tr>)}</tbody></table>{!requests.length && <div className="empty">No data requests yet.</div>}</div>}

    {tab==='privacy' && <div className="dash"><h2>Privacy settings</h2><p className="notice warn">Email/phone/website only unlock after approved business connection and your opt-in below. They are not shown on public investor pages.</p><form onSubmit={savePrivacy} className="formgrid"><label style={{gridColumn:'1/-1'}}><input type="checkbox" name="shareEmail" defaultChecked={!!inv.privacy?.shareEmail}/> Share email after approved connection</label><label style={{gridColumn:'1/-1'}}>Email<input className="input" name="email" type="email" defaultValue={inv.privacy?.email || inv.private_email || profile?.email}/></label><label style={{gridColumn:'1/-1'}}><input type="checkbox" name="sharePhone" defaultChecked={!!inv.privacy?.sharePhone}/> Share WhatsApp/Zalo phone after approved connection</label><label>Country code<select className="select" name="phoneCountry" defaultValue={inv.privacy?.phoneCountry||'VN'}>{phoneOptions.map((c:any)=><option key={c.iso2} value={c.iso2}>{c.dial_code} — {c.country} ({c.example_format})</option>)}</select></label><label>Phone<input className="input" name="phone" defaultValue={inv.privacy?.phone||inv.private_phone||''}/></label><label style={{gridColumn:'1/-1'}}><input type="checkbox" name="shareWebsite" defaultChecked={!!inv.privacy?.shareWebsite}/> Share website after approved connection</label><label style={{gridColumn:'1/-1'}}>Website<input className="input" name="website" defaultValue={inv.privacy?.website||inv.private_website||''}/></label><button className="btn">Update privacy</button></form></div>}

    {tab==='alerts' && <div className="dash"><h2>Alerts</h2><p className="notice">Email alerts are in Beta. Criteria and saved businesses are already stored; automated matching email will be connected in a later phase.</p></div>}
    {tab==='security' && <div className="dash"><h2>Security</h2><p className="muted">Role: {profile.role}. Account status: {profile.status}. Dashboard write access: {String(profile.dashboard_login_enabled)}.</p><Link className="btn secondary" to="/forgot-password">Reset password</Link></div>}
    </main>
  </div></section>
}
function Metric({title,value,note}:{title:string;value:string;note:string}){ return <div className="dash metric-card"><span>{title}</span><b>{value}</b><p>{note}</p></div>; }
