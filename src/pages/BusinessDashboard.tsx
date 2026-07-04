import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getMyBusiness, uploadBusinessFile, uploadBusinessImage } from '../lib/data';
import { supabase } from '../lib/supabase';
import { autoEnglishFromVietnamese } from '../lib/i18n';
import { formatCompactMoney, percent } from '../lib/format';

type Tab = 'overview' | 'profile' | 'financials' | 'files' | 'images' | 'interests' | 'requests' | 'quality' | 'plan' | 'settings';

const tabMap: Record<string, Tab> = {
  '': 'overview',
  profile: 'profile',
  financials: 'financials',
  valuation: 'financials',
  files: 'files',
  images: 'images',
  'investor-interest': 'interests',
  interests: 'interests',
  proposals: 'interests',
  'data-requests': 'requests',
  requests: 'requests',
  quality: 'quality',
  payments: 'plan',
  plan: 'plan',
  settings: 'settings',
  audit: 'settings'
};

const tabs: { id: Tab; vi: string; en: string; href: string }[] = [
  { id: 'overview', vi: 'Tổng quan', en: 'Overview', href: '/dashboard/business' },
  { id: 'profile', vi: 'Hồ sơ', en: 'Profile', href: '/dashboard/business/profile' },
  { id: 'financials', vi: 'Tài chính', en: 'Financials', href: '/dashboard/business/financials' },
  { id: 'files', vi: 'Tài liệu', en: 'Files', href: '/dashboard/business/files' },
  { id: 'images', vi: 'Hình ảnh', en: 'Images', href: '/dashboard/business/images' },
  { id: 'interests', vi: 'NĐT quan tâm', en: 'Investor interest', href: '/dashboard/business/investor-interest' },
  { id: 'requests', vi: 'Yêu cầu dữ liệu', en: 'Data requests', href: '/dashboard/business/data-requests' },
  { id: 'quality', vi: 'Chất lượng', en: 'Quality', href: '/dashboard/business/quality' },
  { id: 'plan', vi: 'Gói & quota', en: 'Plan', href: '/dashboard/business/payments' },
  { id: 'settings', vi: 'Cài đặt', en: 'Settings', href: '/dashboard/business/settings' }
];

function resolveTab(pathname: string): Tab {
  const suffix = pathname.replace('/dashboard/business', '').replace(/^\//, '').split('/')[0];
  return tabMap[suffix] || 'overview';
}

export default function BusinessDashboard(){
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(() => resolveTab(location.pathname));
  const [b, setB] = useState<any>();
  const [files, setFiles] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [interests, setInterests] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => setTab(resolveTab(location.pathname)), [location.pathname]);

  async function load(){
    if(!profile) return;
    setBusy(true); setLoadError('');
    try {
      const biz = await getMyBusiness(profile.id);
      setB(biz);
      if(biz){
        const [{data:f}, {data:im}, {data:req}, {data:int}] = await Promise.all([
          supabase.from('business_files').select('*').eq('business_id',biz.id).order('created_at',{ascending:false}),
          supabase.from('business_images').select('*').eq('business_id',biz.id).order('created_at',{ascending:false}),
          supabase.from('request_data').select('*, investors(code,title_en,title_vi,type,country,privacy)').eq('business_id',biz.id).order('created_at',{ascending:false}),
          supabase.from('investor_interests').select('*, investors(id,code,title_en,title_vi,type,country,industries,deal_types,ticket_min,ticket_max,privacy)').eq('business_id',biz.id).order('created_at',{ascending:false})
        ]);
        setFiles(f||[]); setImages(im||[]); setRequests(req||[]); setInterests(int||[]);
      }
    } catch (e:any) {
      setLoadError(e?.message || 'Could not load dashboard data.');
    } finally { setBusy(false); }
  }

  useEffect(()=>{ if(!loading && !profile) navigate('/login?next=/dashboard/business'); if(profile) load(); },[profile?.id,loading]);

  if(loading) return <DashboardLoading />;
  if(!profile) return <Navigate to="/login?next=/dashboard/business" replace/>;
  if(profile.role !== 'business' && profile.role !== 'admin') return <Forbidden role={profile.role} />;
  if(!b) return <section className="section"><div className="container empty"><h2>Business profile not found</h2><p className="muted">Tài khoản này chưa có hồ sơ DN hoặc đang chờ admin kích hoạt.</p><Link className="btn" to="/register/business">Tạo hồ sơ DN</Link></div></section>;

  const stats = {
    quotaLeft: Math.max(0, Number(b.quota_total || 0) - Number(b.quota_used || 0)),
    score: Number(b.quality_score || 0),
    status: String(b.status || 'pending'),
    plan: String(b.plan || 'standard')
  };

  async function saveProfile(e:FormEvent){
    e.preventDefault(); if(!b) return;
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    const pending:any = {
      title_vi: fd.get('title_vi'),
      title_en: autoEnglishFromVietnamese(String(fd.get('title_vi') || '')),
      description_vi: fd.get('description_vi'),
      description_en: autoEnglishFromVietnamese(String(fd.get('description_vi') || '')),
      industry: fd.get('industry'),
      deal_type: fd.get('deal_type'),
      city: fd.get('city'),
      highlights_vi: fd.get('highlights_vi'),
      highlights_en: autoEnglishFromVietnamese(String(fd.get('highlights_vi') || '')),
      investment_reason_vi: fd.get('investment_reason_vi'),
      investment_reason_en: autoEnglishFromVietnamese(String(fd.get('investment_reason_vi') || ''))
    };
    const {error}=await supabase.from('businesses').update({pending_changes_json:pending,status:'pending_admin_review'}).eq('id',b.id);
    setMsg(error?error.message:'Đã lưu thay đổi ở trạng thái chờ admin duyệt. Public profile chưa đổi.');
    load();
  }

  async function saveFinancials(e:FormEvent){
    e.preventDefault(); if(!b) return;
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const pending = {
      ...(b.pending_changes_json || {}),
      revenue_2025: Number(fd.get('revenue_2025') || 0),
      ebitda_margin: Number(fd.get('ebitda_margin') || 0),
      ask_amount: Number(fd.get('ask_amount') || 0),
      stake_pct: Number(fd.get('stake_pct') || 0),
      data_confidence: Number(fd.get('data_confidence') || 70)
    };
    const {error}=await supabase.from('businesses').update({pending_changes_json:pending,status:'pending_admin_review'}).eq('id',b.id);
    setMsg(error?error.message:'Đã lưu số liệu tài chính ở trạng thái chờ duyệt.');
    load();
  }

  async function fileChange(e:any){
    const file=e.target.files?.[0]; if(!file||!b||!profile)return;
    setBusy(true);
    try { await uploadBusinessFile(b.id,profile.id,file,'financials','locked'); setMsg('File uploaded successfully.'); await load(); }
    catch(err:any){ setMsg(err?.message || 'Upload failed.'); }
    finally { setBusy(false); e.target.value=''; }
  }

  async function imageChange(e:any){
    const file=e.target.files?.[0]; if(!file||!b||!profile)return;
    setBusy(true);
    try { await uploadBusinessImage(b.id,profile.id,file,file.name); setMsg('Image uploaded successfully.'); await load(); }
    catch(err:any){ setMsg(err?.message || 'Upload failed.'); }
    finally { setBusy(false); e.target.value=''; }
  }

  async function acceptInterest(row:any){
    const {error}=await supabase.from('investor_interests').update({status:'connected'}).eq('id',row.id);
    setMsg(error?error.message:'Đã đồng ý kết nối. Quyền xem hồ sơ đầy đủ sẽ theo rule admin/RLS.'); load();
  }

  async function rejectInterest(row:any){
    const {error}=await supabase.from('investor_interests').update({status:'rejected'}).eq('id',row.id);
    setMsg(error?error.message:'Đã từ chối kết nối.'); load();
  }

  async function fulfillRequest(row:any){
    const {error}=await supabase.from('request_data').update({status:'fulfilled'}).eq('id',row.id);
    setMsg(error?error.message:'Marked as fulfilled.'); load();
  }

  return <section className="dashboard-page">
    <div className="container dashboard-shell">
      <aside className="dashboard-side">
        <div className="dash-brand"><span className="pill gold">Business</span><b>{b.public_code || 'D68'}</b></div>
        {tabs.map(item=><Link key={item.id} to={item.href} onClick={()=>setTab(item.id)} className={`side-link ${tab===item.id?'active':''}`}>{item.vi}<small>{item.en}</small></Link>)}
        <div className="supportbox"><b>Bạn cần hỗ trợ hồ sơ gọi vốn?</b><p>VCPC có thể hỗ trợ IM, valuation, data room và làm việc với nhà đầu tư.</p><a href="https://vietcapitalpartners.com" target="_blank">vietcapitalpartners.com</a></div>
      </aside>
      <main className="dashboard-main">
        <div className="dashboard-top">
          <div><span className="badge-title blue">◆ Business Dashboard</span><h1>{b.company_name_private || b.title_vi}</h1><p className="muted">{b.title_vi} · {b.city || b.country_iso2} · {b.industry}</p></div>
          <Link className="btn secondary" to={`/businesses/${b.slug}`}>View public profile</Link>
        </div>
        {b.pending_changes_json && <div className="notice warn"><b>Pending review:</b> thay đổi nhạy cảm đang chờ admin duyệt, public profile chưa cập nhật.</div>}
        {loadError && <div className="notice warn">{loadError}</div>}
        {msg && <div className="notice">{msg}</div>}
        {busy && <div className="notice small-note">Đang xử lý dữ liệu...</div>}

        {tab==='overview' && <div className="dashboard-grid">
          <Metric title="Status" value={stats.status} note={b.visible ? 'Public visible' : 'Hidden'} />
          <Metric title="Plan" value={stats.plan} note={`${stats.quotaLeft} proposals left`} />
          <Metric title="Quality Score" value={`${stats.score}/100`} note="Investor-gated breakdown" />
          <Metric title="Investor interest" value={String(interests.length)} note="Pending/connected" />
          <div className="dash card-wide"><h2>Deal snapshot</h2><div className="kpis"><div className="kpi"><span>Revenue 2025E</span><b>{formatCompactMoney(b.revenue_2025,b.revenue_currency)}</b></div><div className="kpi"><span>EBITDA</span><b>{percent(b.ebitda_margin)}</b></div><div className="kpi"><span>Ask / Stake</span><b>{formatCompactMoney(b.ask_amount,b.ask_currency)} / {percent(b.stake_pct)}</b></div><div className="kpi"><span>Files / Images</span><b>{files.length} / {images.length}</b></div></div></div>
          <div className="dash"><h2>Next best actions</h2><ul className="check-list"><li>Upload financials, teaser IM and key legal docs.</li><li>Keep 2025 revenue and EBITDA updated.</li><li>Review investor interests weekly and approve only qualified connections.</li></ul></div>
        </div>}

        {tab==='profile' && <form onSubmit={saveProfile} className="dash formgrid"><label style={{gridColumn:'1/-1'}}>Tên hiển thị ẩn danh<input name="title_vi" className="input" defaultValue={b.title_vi}/></label><label>Ngành<input name="industry" className="input" defaultValue={b.industry}/></label><label>Thành phố<input name="city" className="input" defaultValue={b.city}/></label><label>Deal type<input name="deal_type" className="input" defaultValue={b.deal_type}/></label><label style={{gridColumn:'1/-1'}}>Mô tả ngắn<textarea name="description_vi" className="textarea" defaultValue={b.description_vi}/></label><label style={{gridColumn:'1/-1'}}>Điểm nổi bật<textarea name="highlights_vi" className="textarea" defaultValue={b.highlights_vi}/></label><label style={{gridColumn:'1/-1'}}>Lý do gọi vốn/bán<textarea name="investment_reason_vi" className="textarea" defaultValue={b.investment_reason_vi}/></label><button className="btn">Save pending changes</button></form>}

        {tab==='financials' && <form onSubmit={saveFinancials} className="dash formgrid"><label>2025 Revenue<input name="revenue_2025" className="input" type="number" defaultValue={b.revenue_2025}/></label><label>EBITDA %<input name="ebitda_margin" className="input" type="number" defaultValue={b.ebitda_margin}/></label><label>Ask amount<input name="ask_amount" className="input" type="number" defaultValue={b.ask_amount}/></label><label>Stake %<input name="stake_pct" className="input" type="number" defaultValue={b.stake_pct}/></label><label>Data confidence<input name="data_confidence" className="input" type="number" defaultValue={b.data_confidence || 70}/></label><button className="btn">Save financials for review</button></form>}

        {tab==='files' && <div className="dash"><h2>Data room files</h2><p className="muted">Word, Excel, PPT, PDF và CSV được lưu private. Investor chỉ xem khi có connection/proposal được duyệt.</p><div className="filedrop"><b>Upload Word, Excel, PPT, PDF</b><input type="file" accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.csv" onChange={fileChange}/></div><table className="table"><thead><tr><th>File</th><th>Category</th><th>Review</th><th>Size</th></tr></thead><tbody>{files.map(f=><tr key={f.id}><td>{f.file_name}</td><td>{f.category}</td><td>{f.review_status || f.privacy_level || 'locked'}</td><td>{f.size_bytes ? `${Math.round(f.size_bytes/1024)} KB` : '-'}</td></tr>)}</tbody></table>{!files.length && <div className="empty">No files uploaded yet.</div>}</div>}

        {tab==='images' && <div className="dash"><h2>Business images</h2><p className="muted">Ảnh public nên được admin kiểm tra ẩn danh trước khi hiện ra listing.</p><div className="filedrop"><b>Upload images</b><input type="file" accept="image/*" onChange={imageChange}/></div><div className="grid2">{images.map(i=><div className="card" key={i.id}><img src={i.public_url} className="deal-img"/><div className="card-body"><b>{i.title || 'Business image'}</b><span className="muted">{i.review_status || 'uploaded'}</span></div></div>)}</div>{!images.length && <div className="empty">No images uploaded yet.</div>}</div>}

        {tab==='interests' && <div className="dash"><h2>Interested investors</h2><table className="table"><thead><tr><th>Investor</th><th>Ticket</th><th>Focus</th><th>Contact privacy</th><th>Status</th><th>Action</th></tr></thead><tbody>{interests.map(row=><tr key={row.id}><td><b>{row.investors?.title_en || row.investors?.code}</b><br/><span className="muted">{row.investors?.type} · {row.investors?.country}</span></td><td>{formatCompactMoney(row.investors?.ticket_min,'USD')}–{formatCompactMoney(row.investors?.ticket_max,'USD')}</td><td>{(row.investors?.industries||[]).slice(0,3).join(', ')}</td><td>{row.status==='connected' && row.investors?.privacy?.shareEmail ? row.investors?.privacy?.email : 'Hidden until approved'}<br/>{row.status==='connected' && row.investors?.privacy?.sharePhone ? row.investors?.privacy?.phone : 'Phone hidden'}</td><td><span className="pill gray">{row.status}</span></td><td>{row.status!=='connected'&&<button className="btn small" onClick={()=>acceptInterest(row)}>Approve</button>} {row.status!=='rejected'&&<button className="btn small secondary" onClick={()=>rejectInterest(row)}>Reject</button>}</td></tr>)}</tbody></table>{!interests.length && <div className="empty">No investor interests yet.</div>}</div>}

        {tab==='requests' && <div className="dash"><h2>Data requests</h2><table className="table"><thead><tr><th>Investor</th><th>Items</th><th>Note</th><th>Status</th><th></th></tr></thead><tbody>{requests.map(r=><tr key={r.id}><td>{r.investors?.title_en || r.investors?.code}</td><td>{(r.requested_items||[]).join(', ')}</td><td>{r.note || '-'}</td><td>{r.status}</td><td><button className="btn small secondary" onClick={()=>fulfillRequest(r)}>Mark fulfilled</button></td></tr>)}</tbody></table>{!requests.length && <div className="empty">No data requests.</div>}</div>}

        {tab==='quality' && <div className="dash"><h2>Business Quality Score</h2><div className="quality-dial"><strong>{stats.score}</strong><span>/100</span></div><div className="score"><span style={{width:`${Math.min(100,stats.score)}%`}}/></div><p className="muted">Full breakdown is investor-gated on public pages. Admin can revise criteria in Admin → Quality.</p><pre className="json-preview">{JSON.stringify(b.quality_breakdown || {}, null, 2)}</pre></div>}

        {tab==='plan' && <div className="dash"><h2>Plan & quota</h2><div className="kpis"><div className="kpi"><span>Plan</span><b>{stats.plan}</b></div><div className="kpi"><span>Quota used</span><b>{b.quota_used || 0}/{b.quota_total || 0}</b></div><div className="kpi"><span>Status</span><b>{b.status}</b></div><div className="kpi"><span>Visible</span><b>{b.visible ? 'Yes' : 'No'}</b></div></div><Link className="btn gold" to="/pricing">Upgrade / renew plan</Link></div>}

        {tab==='settings' && <div className="dash"><h2>Settings & audit</h2><p className="notice warn">Sensitive settings are admin-controlled in Beta. Contact admin for legal name, tax code, visibility and plan changes.</p><p className="muted">Owner ID: {b.owner_id || 'unassigned'} · Business ID: {b.id}</p></div>}
      </main>
    </div>
  </section>
}

function DashboardLoading(){ return <section className="section"><div className="container empty">Loading dashboard...</div></section>; }
function Forbidden({role}:{role?:string}){ return <section className="section"><div className="container empty"><h2>Không có quyền truy cập</h2><p className="muted">Role hiện tại: {role || 'guest'}. Dashboard này chỉ dành cho Business.</p><Link className="btn secondary" to="/">Back home</Link></div></section>; }
function Metric({title,value,note}:{title:string;value:string;note:string}){ return <div className="dash metric-card"><span>{title}</span><b>{value}</b><p>{note}</p></div>; }
