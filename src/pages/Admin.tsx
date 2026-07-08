import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getBusinessFiles, getBusinessImages, listBusinesses, updateBusinessFile, updateBusinessImage } from '../lib/data';
import { supabase } from '../lib/supabase';
import { proposalStatusLabel, updateProposalStatus, type ProposalStatus } from '../lib/proposals';
import { AdminBannerManager } from '../components/SiteBanners';
import { industryOptions, industryKeyFromLabel } from '../lib/industryTaxonomy';

type AdminTab = 'overview' | 'payments' | 'proposals' | 'banners' | 'businesses' | 'business_review' | 'assets' | 'investors' | 'promos' | 'requests' | 'leads' | 'logs' | 'settings';

type Row = Record<string, any>;

const pathTabs: Record<string, AdminTab> = {
  '': 'overview', overview: 'overview', payments: 'payments', approvals: 'payments', proposals: 'proposals', banners: 'banners', banner: 'banners', businesses: 'businesses',
  'business-review': 'business_review', assets: 'assets', investors: 'investors', promo: 'promos', promos: 'promos',
  'data-requests': 'requests', requests: 'requests', leads: 'leads', 'market-partners': 'leads', contacts: 'leads',
  audit: 'logs', logs: 'logs', settings: 'settings'
};

const tabs: { id: AdminTab; label: string; icon: string; href: string }[] = [
  { id: 'overview', label: 'Tổng quan', icon: '📊', href: '/admin' },
  { id: 'payments', label: 'Thanh toán', icon: '💳', href: '/admin/payments' },
  { id: 'proposals', label: 'Proposal', icon: '📨', href: '/admin/proposals' },
  { id: 'banners', label: 'Banner', icon: '🖼️', href: '/admin/banners' },
  { id: 'business_review', label: 'Duyệt public DN', icon: '✅', href: '/admin/business-review' },
  { id: 'businesses', label: 'Doanh nghiệp', icon: '🏢', href: '/admin/businesses' },
  { id: 'assets', label: 'Ảnh/File DN', icon: '🖼️', href: '/admin/assets' },
  { id: 'investors', label: 'Nhà đầu tư', icon: '📈', href: '/admin/investors' },
  { id: 'promos', label: 'Mã KM', icon: '🎟️', href: '/admin/promo' },
  { id: 'requests', label: 'Yêu cầu data', icon: '📂', href: '/admin/data-requests' },
  { id: 'leads', label: 'Liên hệ/Đối tác', icon: '📨', href: '/admin/leads' },
  { id: 'logs', label: 'Audit', icon: '🧾', href: '/admin/audit' },
  { id: 'settings', label: 'Cài đặt', icon: '⚙️', href: '/admin/settings' }
];

function resolveTab(pathname: string): AdminTab {
  const suffix = pathname.replace('/admin', '').replace(/^\//, '').split('/')[0];
  return pathTabs[suffix] || 'overview';
}
function text(v: any) { return String(v ?? '').trim(); }
function lines(raw: any) { if (Array.isArray(raw)) return raw.join('\n'); return String(raw || ''); }
function arrFromText(raw: any) { if (Array.isArray(raw)) return raw.map(String).filter(Boolean); return String(raw || '').split(/[;,\n]/).map((x) => x.trim()).filter(Boolean); }
function sourceOf(b: Row) { return { ...b, ...(b.pending_changes_json && typeof b.pending_changes_json === 'object' ? b.pending_changes_json : {}) }; }
function publicOf(b: Row) { return b.public_snapshot_json && typeof b.public_snapshot_json === 'object' ? b.public_snapshot_json : b; }
function autoEn(vi: string) {
  return text(vi).replace(/Doanh nghiệp/gi, 'Business').replace(/Công ty/gi, 'Company').replace(/Gọi vốn/gi, 'Fundraising').replace(/Bán/gi, 'Sale').replace(/Chuyển nhượng/gi, 'Transfer').replace(/Nhà đầu tư/gi, 'Investor').replace(/Sản xuất/gi, 'Manufacturing').replace(/Công nghệ/gi, 'Technology').replace(/Y tế/gi, 'Healthcare').replace(/Thủy sản/gi, 'Seafood');
}

const investorTypeFilterOptions = [
  { value: 'Individual/Angel', label: 'Nhà đầu tư cá nhân / Thiên thần' },
  { value: 'VC', label: 'Quỹ đầu tư mạo hiểm' },
  { value: 'PE', label: 'Quỹ đầu tư tư nhân' },
  { value: 'Institutional', label: 'Nhà đầu tư tổ chức' },
  { value: 'Corporate/Strategic', label: 'Nhà đầu tư chiến lược' },
  { value: 'Family Office', label: 'Văn phòng gia đình' },
  { value: 'Lender/Debt', label: 'Tổ chức cho vay / Nợ' }
];
const investorCountryFilterOptions = [
  ['VN', 'Việt Nam'], ['US', 'Mỹ'], ['SG', 'Singapore'], ['JP', 'Nhật Bản'], ['KR', 'Hàn Quốc'],
  ['IN', 'Ấn Độ'], ['HK', 'Hồng Kông'], ['CN', 'Trung Quốc'], ['AU', 'Úc'], ['CA', 'Canada'],
  ['DE', 'Đức'], ['GB', 'Anh'], ['AE', 'UAE'], ['ID', 'Indonesia'], ['TH', 'Thái Lan'],
  ['MY', 'Malaysia'], ['PH', 'Philippines'], ['BR', 'Brazil'], ['IL', 'Israel']
];
function investorTargetCountriesAdmin(i: Row): string[] {
  const criteria = i.criteria && typeof i.criteria === 'object' ? i.criteria : {};
  const raw = Array.isArray(criteria.targetCountries)
    ? criteria.targetCountries
    : Array.isArray(criteria.targetCountriesCache)
      ? criteria.targetCountriesCache
      : Array.isArray(criteria.preferredCountries)
        ? criteria.preferredCountries
        : [];
  const values = raw.length ? raw : [i.country_iso2 || i.country].filter(Boolean);
  return Array.from(new Set(values.map((x: any) => String(x || '').trim().toUpperCase()).filter(Boolean)));
}
function investorIndustryMatchesAdmin(i: Row, rawIndustry: string) {
  const wantedKey = industryKeyFromLabel(rawIndustry);
  if (!wantedKey) return true;
  const criteria = i.criteria && typeof i.criteria === 'object' ? i.criteria : {};
  const values = [...arrFromText(i.industries), ...arrFromText(criteria.sectors)];
  return values.some((value) => industryKeyFromLabel(value) === wantedKey);
}
function investorNeedsReview(i: Row) {
  return ['draft', 'payment_pending', 'pending_admin_review'].includes(String(i.status || '')) || !!i.privacy?.pending_profile_changes;
}

export default function Admin() {
  const { profile, loading, signOut } = useAuth();
  const location = useLocation();
  const [tab, setTab] = useState<AdminTab>(() => resolveTab(location.pathname));
  const [businesses, setBusinesses] = useState<Row[]>([]);
  const [investors, setInvestors] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [promos, setPromos] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [proposals, setProposals] = useState<Row[]>([]);
  const [payments, setPayments] = useState<Row[]>([]);
  const [logs, setLogs] = useState<Row[]>([]);
  const [contactMessages, setContactMessages] = useState<Row[]>([]);
  const [partnerLeads, setPartnerLeads] = useState<Row[]>([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [investorVisibilityFilter, setInvestorVisibilityFilter] = useState('');
  const [investorTypeFilter, setInvestorTypeFilter] = useState('');
  const [investorCountryFilter, setInvestorCountryFilter] = useState('');
  const [investorIndustryFilter, setInvestorIndustryFilter] = useState('');

  useEffect(() => setTab(resolveTab(location.pathname)), [location.pathname]);

  async function load() {
    if (profile?.role !== 'admin') return;
    setBusy(true); setError('');
    try {
      const [biz, invRes, profRes, promoRes, reqRes, propRes, payRes, logRes, cmRes, leadRes] = await Promise.all([
        listBusinesses({ includeHidden: true }).catch(() => []),
        supabase.from('investors').select('*').order('created_at', { ascending: false }).limit(2000),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(2000),
        supabase.from('promo_codes').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('request_data').select('*, businesses(title_vi,title_en,public_code,slug), investors(title_en,title_vi,code,type)').order('created_at', { ascending: false }).limit(500),
        supabase.from('proposals').select('id,business_id,investor_id,message,status,sent_at,updated_at,businesses(id,slug,company_name_private,title_vi,title_en,public_code),investors(id,code,private_name,title_vi,title_en,private_email)').order('sent_at', { ascending: false }).limit(1000),
        supabase.from('payment_orders').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(120),
        supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('partner_leads').select('*').order('created_at', { ascending: false }).limit(300)
      ]);
      setBusinesses(biz || []);
      setInvestors(invRes.data || []);
      setProfiles(profRes.data || []);
      setPromos(promoRes.data || []);
      setRequests(reqRes.data || []);
      setProposals(propRes.data || []);
      setPayments(payRes.data || []);
      setLogs(logRes.data || []);
      setContactMessages(cmRes.data || []);
      setPartnerLeads(leadRes.data || []);
      const firstErr = invRes.error || profRes.error || promoRes.error || reqRes.error || propRes.error || payRes.error || logRes.error || cmRes.error || leadRes.error;
      if (firstErr) setError(firstErr.message);
    } catch (e: any) { setError(e?.message || 'Could not load admin data.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (profile?.role === 'admin') load(); }, [profile?.role]);

  if (loading) return <section className="d68-admin-page"><div className="d68-admin-wrap"><div className="d68-admin-card">Loading admin...</div></div></section>;
  if (profile?.role !== 'admin') return <Navigate to="/login?next=/admin" replace />;

  const pendingBusinesses = businesses.filter((b) => b.status === 'pending_admin_review' || b.pending_changes_json || b.moderation_status === 'pending_admin_review' || !b.public_snapshot_json);
  const pendingInvestors = investors.filter(investorNeedsReview);
  const filteredBusinesses = businesses.filter((b) => !search.trim() || [b.title_vi, b.title_en, b.company_name_private, b.public_code, b.industry, b.status].some((v) => String(v || '').toLowerCase().includes(search.toLowerCase())));
  const filteredInvestors = investors
    .filter((i) => {
      const keyword = search.trim().toLowerCase();
      if (keyword && ![i.title_vi, i.title_en, i.private_name, i.private_email, i.code, i.type, i.country, i.country_iso2, i.status].some((v) => String(v || '').toLowerCase().includes(keyword))) return false;
      if (investorVisibilityFilter === 'visible' && !i.visible) return false;
      if (investorVisibilityFilter === 'hidden' && i.visible) return false;
      if (investorTypeFilter && i.type !== investorTypeFilter) return false;
      if (investorCountryFilter && !investorTargetCountriesAdmin(i).includes(investorCountryFilter)) return false;
      if (investorIndustryFilter && !investorIndustryMatchesAdmin(i, investorIndustryFilter)) return false;
      return true;
    })
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  async function logAction(action: string, entity_type: string, entity_id: string, detail: any = {}) {
    try { await supabase.from('audit_logs').insert({ actor_id: profile.id, action, entity_type, entity_id, detail }); } catch { /* non-blocking */ }
  }
  async function markPayment(row: Row, status: string) {
    const { error: payErr } = await supabase.from('payment_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', row.id);
    if (!payErr && status === 'confirmed') {
      if (row.profile_id || row.created_by) await supabase.from('profiles').update({ status: 'active', dashboard_login_enabled: true }).eq('id', row.profile_id || row.created_by);
      if (row.business_id) await supabase.from('businesses').update({ status: 'pending_admin_review', visible: false }).eq('id', row.business_id);
      if (row.investor_id) await supabase.from('investors').update({ status: 'pending_admin_review', visible: false }).eq('id', row.investor_id);
      await logAction('confirm_payment_open_dashboard', 'payment_order', row.id, { profile_id: row.profile_id, business_id: row.business_id, investor_id: row.investor_id });
    }
    setError(payErr?.message || ''); setMsg(payErr ? '' : 'Payment updated. Dashboard can be tested if profile is active.'); load();
  }
  async function toggleBusiness(b: Row) {
    const nextVisible = !b.visible;
    const { error: err } = await supabase.from('businesses').update({ visible: nextVisible, status: nextVisible ? 'active' : 'hidden' }).eq('id', b.id);
    if (!err) await logAction(nextVisible ? 'show_business' : 'hide_business', 'business', b.id, { public_code: b.public_code });
    setError(err?.message || ''); setMsg(err ? '' : 'Business visibility updated.'); load();
  }
  async function approveBusiness(e: FormEvent, b: Row) {
    e.preventDefault(); const fd = new FormData(e.currentTarget as HTMLFormElement);
    const snapshot = { title_vi: text(fd.get('title_vi')), title_en: text(fd.get('title_en')) || autoEn(text(fd.get('title_vi'))), description_vi: text(fd.get('description_vi')), description_en: text(fd.get('description_en')) || autoEn(text(fd.get('description_vi'))), highlights_vi: text(fd.get('highlights_vi')), highlights_en: text(fd.get('highlights_en')) || autoEn(text(fd.get('highlights_vi'))), investment_reason_vi: text(fd.get('investment_reason_vi')), investment_reason_en: text(fd.get('investment_reason_en')) || autoEn(text(fd.get('investment_reason_vi'))), industry: text(fd.get('industry')), deal_type: text(fd.get('deal_type')), city: text(fd.get('city')), country_iso2: text(fd.get('country_iso2')) || 'VN', revenue_2025: Number(fd.get('revenue_2025') || 0), revenue_currency: text(fd.get('revenue_currency')) || 'VND', ebitda_margin: Number(fd.get('ebitda_margin') || 0), ask_amount: Number(fd.get('ask_amount') || 0), ask_currency: text(fd.get('ask_currency')) || text(fd.get('revenue_currency')) || 'VND', stake_pct: Number(fd.get('stake_pct') || 0), quality_score: Number(fd.get('quality_score') || 0), data_confidence: Number(fd.get('data_confidence') || 0), hero_image_url: text(fd.get('hero_image_url')), image_url: text(fd.get('hero_image_url')), approved_at: new Date().toISOString() };
    const patch = { public_snapshot_json: snapshot, title_vi: snapshot.title_vi, title_en: snapshot.title_en, description_vi: snapshot.description_vi, description_en: snapshot.description_en, highlights_vi: snapshot.highlights_vi, highlights_en: snapshot.highlights_en, investment_reason_vi: snapshot.investment_reason_vi, investment_reason_en: snapshot.investment_reason_en, industry: snapshot.industry, deal_type: snapshot.deal_type, city: snapshot.city, country_iso2: snapshot.country_iso2, revenue_2025: snapshot.revenue_2025, revenue_currency: snapshot.revenue_currency, ebitda_margin: snapshot.ebitda_margin, ask_amount: snapshot.ask_amount, ask_currency: snapshot.ask_currency, stake_pct: snapshot.stake_pct, quality_score: Math.max(0, Math.min(100, snapshot.quality_score)), quality_score_manual_override: fd.get('quality_score_manual_override') === 'on', data_confidence: snapshot.data_confidence, hero_image_url: snapshot.hero_image_url || null, image_url: snapshot.image_url || null, visible: true, status: 'active', pending_changes_json: null, pending_submitted_at: null, pending_submitted_by: null, moderation_status: 'approved', last_approved_at: new Date().toISOString(), last_approved_by: profile.id, public_version: Number(b.public_version || 0) + 1 };
    const { error: err } = await supabase.from('businesses').update(patch).eq('id', b.id);
    if (!err) await logAction('approve_business_public_snapshot', 'business', b.id, { public_code: b.public_code, snapshot });
    setError(err?.message || ''); setMsg(err ? '' : 'Đã duyệt snapshot public ẩn danh.'); load();
  }
  async function saveInvestor(e: FormEvent, i: Row, mode: 'save' | 'approve' = 'save') {
    e.preventDefault(); const fd = new FormData(e.currentTarget as HTMLFormElement);
    const patch: any = { title_en: fd.get('title_en'), title_vi: fd.get('title_vi'), desc_en: fd.get('desc_en'), desc_vi: fd.get('desc_vi'), type: fd.get('type'), country: fd.get('country'), country_iso2: fd.get('country_iso2'), region: fd.get('region'), industries: arrFromText(fd.get('industries')), deal_types: arrFromText(fd.get('deal_types')), stage: fd.get('stage'), ticket_min: Number(fd.get('ticket_min') || 0), ticket_max: Number(fd.get('ticket_max') || 0), verified: fd.get('verified') === 'on', admin_priority: fd.get('admin_priority') === 'on', private_name: fd.get('private_name'), private_website: fd.get('private_website'), private_email: fd.get('private_email'), private_phone: fd.get('private_phone') };
    if (mode === 'approve') patch.privacy = { ...(i.privacy || {}), pending_profile_changes: null, pending_submitted_at: null };
    patch.visible = mode === 'approve' ? true : fd.get('visible') === 'on';
    patch.status = patch.visible ? 'active' : 'hidden';
    const { error: err } = await supabase.from('investors').update(patch).eq('id', i.id);
    if (!err) await logAction(mode === 'approve' ? 'approve_investor_public_profile' : 'save_investor', 'investor', i.id, { code: i.code });
    setError(err?.message || ''); setMsg(err ? '' : 'Investor updated.'); load();
  }
  async function toggleInvestor(i: Row) {
    const nextVisible = !i.visible;
    const { error: err } = await supabase.from('investors').update({ visible: nextVisible, status: nextVisible ? 'active' : 'hidden' }).eq('id', i.id);
    if (!err) await logAction(nextVisible ? 'show_investor' : 'hide_investor', 'investor', i.id, { code: i.code });
    setError(err?.message || ''); setMsg(err ? '' : 'Investor visibility updated.'); load();
  }
  async function markRequest(r: Row, status: string) {
    const { error: err } = await supabase.from('request_data').update({ status }).eq('id', r.id);
    if (!err) await logAction('mark_data_request', 'request_data', r.id, { status });
    setError(err?.message || ''); setMsg(err ? '' : 'Request updated.'); load();
  }
  async function markProposal(row: Row, status: ProposalStatus) {
    try {
      await updateProposalStatus(row.id, status);
      await logAction('mark_proposal', 'proposal', row.id, { status });
      setError(''); setMsg('Đã cập nhật trạng thái Proposal.'); load();
    } catch (e: any) { setError(e?.message || 'Could not update proposal.'); setMsg(''); }
  }
  async function createPromo(e: FormEvent) {
    e.preventDefault(); const fd = new FormData(e.currentTarget as HTMLFormElement);
    const { error: err } = await supabase.from('promo_codes').insert({ code: String(fd.get('code') || '').toUpperCase(), description: fd.get('description'), role: fd.get('role'), discount_pct: Number(fd.get('discount_pct') || 0), quota_total: Number(fd.get('quota_total') || 0), starts_at: fd.get('starts_at') || new Date().toISOString(), ends_at: fd.get('ends_at') || null, active: true, created_by: profile.id });
    setError(err?.message || ''); setMsg(err ? '' : 'Promo created.'); load();
  }
  async function markLead(table: 'contact_messages' | 'partner_leads', row: Row, status: string) {
    const { error: err } = await supabase.from(table).update({ status, updated_at: new Date().toISOString() }).eq('id', row.id);
    if (!err) await logAction('mark_lead', table, row.id, { status });
    setError(err?.message || ''); setMsg(err ? '' : 'Lead updated.'); load();
  }

  return <section className="d68-admin-page">
    <header className="d68-admin-head"><div className="d68-admin-head__inner"><Link to="/"><img src="/assets/logo-nav.svg" alt="Deals68" /></Link><b>Admin Panel</b><span>👤 {profile.email || 'admin'}</span><button onClick={() => signOut()}>Thoát</button></div></header>
    <div className="d68-admin-wrap"><div className="d68-admin-cols"><nav className="d68-admin-side">{tabs.map((item) => <Link key={item.id} to={item.href} onClick={() => setTab(item.id)} className={tab === item.id ? 'active' : ''}>{item.icon} {item.label}</Link>)}</nav><main>
      <div className="d68-admin-title"><div><h1>Deals68 Admin</h1><p>Admin duyệt thanh toán, public snapshot, ảnh/file, profile investor và lead tĩnh.</p></div><button onClick={load} className="d68-admin-btn">{busy ? 'Loading...' : 'Refresh'}</button></div>
      {msg ? <div className="d68-admin-notice ok">{msg}</div> : null}{error ? <div className="d68-admin-notice err">{error}</div> : null}
      <input className="d68-admin-input d68-admin-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search businesses/investors/profiles..." />
      {tab === 'overview' && <Overview businesses={businesses} investors={investors} profiles={profiles} payments={payments} pendingBusinesses={pendingBusinesses} pendingInvestors={pendingInvestors} leads={contactMessages.length + partnerLeads.length}/>} 
      {tab === 'payments' && <Payments payments={payments} profiles={profiles} markPayment={markPayment} />}
      {tab === 'proposals' && <ProposalList proposals={proposals} markProposal={markProposal} />}
      {tab === 'banners' && <AdminBannerManager />}
      {tab === 'business_review' && <BusinessReviewList rows={pendingBusinesses} approveBusiness={approveBusiness} toggleBusiness={toggleBusiness} />}
      {tab === 'businesses' && <BusinessReviewList rows={filteredBusinesses} approveBusiness={approveBusiness} toggleBusiness={toggleBusiness} />}
      {tab === 'assets' && <div>{filteredBusinesses.map((b) => <AssetEditor key={b.id} b={b} />)}</div>}
      {tab === 'investors' && <>
        <Card>
          <div className="d68-admin-row-head">
            <div>
              <h3>Quản trị Nhà đầu tư</h3>
              <div className="d68-admin-subtle">Sắp xếp mới tạo lên đầu · Kết quả {filteredInvestors.length}/{investors.length}</div>
            </div>
            {pendingInvestors.length ? <span className="d68-admin-badge warn">⚠️ {pendingInvestors.length} cần duyệt</span> : <span className="d68-admin-badge ok">Không có hồ sơ cần duyệt</span>}
          </div>
          {pendingInvestors.length ? <div className="d68-admin-notice err">Có {pendingInvestors.length} nhà đầu tư mới tạo hoặc có thay đổi từ dashboard cần Admin kiểm tra/duyệt.</div> : null}
          <div className="d68-admin-form4">
            <label>Trạng thái<select value={investorVisibilityFilter} onChange={(e) => setInvestorVisibilityFilter(e.target.value)} className="d68-admin-input"><option value="">Tất cả</option><option value="visible">Hiển thị</option><option value="hidden">Ẩn</option></select></label>
            <label>Loại nhà đầu tư<select value={investorTypeFilter} onChange={(e) => setInvestorTypeFilter(e.target.value)} className="d68-admin-input"><option value="">Tất cả</option>{investorTypeFilterOptions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
            <label>Quốc gia đầu tư<select value={investorCountryFilter} onChange={(e) => setInvestorCountryFilter(e.target.value)} className="d68-admin-input"><option value="">Tất cả</option>{investorCountryFilterOptions.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
            <label>Ngành quan tâm<select value={investorIndustryFilter} onChange={(e) => setInvestorIndustryFilter(e.target.value)} className="d68-admin-input"><option value="">Tất cả</option>{industryOptions.map((x) => <option key={x.key} value={x.key}>{x.vi}</option>)}</select></label>
          </div>
        </Card>
        <div>{filteredInvestors.map((i) => <InvestorEditor key={i.id} i={i} onSave={saveInvestor} onToggle={toggleInvestor} />)}</div>
        {!filteredInvestors.length ? <Empty text="Không có nhà đầu tư phù hợp bộ lọc."/> : null}
      </>}
      {tab === 'promos' && <Promos promos={promos} createPromo={createPromo} />}
      {tab === 'requests' && <Requests requests={requests} markRequest={markRequest} />}
      {tab === 'leads' && <Leads contactMessages={contactMessages} partnerLeads={partnerLeads} markLead={markLead} />}
      {tab === 'logs' && <Logs logs={logs} />}
      {tab === 'settings' && <Settings />}
    </main></div></div>
  </section>;
}

function Card({ children }: { children: React.ReactNode }) { return <div className="d68-admin-card">{children}</div>; }
function Empty({ text }: { text: string }) { return <div className="d68-admin-empty">{text}</div>; }
function Metric({ label, value, color = '#0F2A4A' }: { label: string; value: string; color?: string }) { return <Card><div className="d68-admin-metric-label">{label}</div><div className="d68-admin-metric-value" style={{ color }}>{value}</div></Card>; }
function Overview({ businesses, investors, profiles, payments, pendingBusinesses, pendingInvestors, leads }: any) { return <><div className="d68-admin-grid4"><Metric label="Businesses" value={String(businesses.length)} color="#1596cc"/><Metric label="Investors" value={String(investors.length)} color="#B8860B"/><Metric label="Pending DN" value={String(pendingBusinesses.length)} color="#DC2626"/><Metric label="Leads" value={String(leads || 0)} color="#16A34A"/></div><Card><h3>Baseline workflow test</h3><ol className="d68-admin-steps"><li>User đăng ký Business/Investor → tạo profile + listing ẩn + payment_order pending.</li><li>Admin xác nhận payment → mở dashboard_login_enabled cho user.</li><li>Business tự sửa dashboard → pending_changes_json, public snapshot cũ vẫn giữ.</li><li>Admin duyệt snapshot → visible=true, status=active, public_snapshot_json cập nhật.</li><li>Investor tự sửa profile → lưu vào privacy.pending_profile_changes, public profile cũ không đổi; Admin duyệt mới public.</li></ol><p>Profiles: {profiles.length} · Payments: {payments.length} · Pending investors: {pendingInvestors.length}</p></Card></>; }
function ProposalList({ proposals, markProposal }: any) { return <Card><h3>Proposal Business → Investor</h3><div className="d68-admin-table-wrap"><table className="d68-admin-table"><thead><tr><th>Thời gian</th><th>Doanh nghiệp</th><th>Nhà đầu tư</th><th>Trạng thái</th><th>Action</th></tr></thead><tbody>{proposals.map((row: Row) => { const st = proposalStatusLabel(row.status, 'vi'); const b = row.businesses || {}; const i = row.investors || {}; return <tr key={row.id}><td>{new Date(row.sent_at || row.updated_at || Date.now()).toLocaleString('vi-VN')}</td><td>{b.slug ? <a href={`/businesses/${b.slug}`} target="_blank" rel="noreferrer"><b>{b.company_name_private || b.title_vi || b.title_en || b.public_code || row.business_id}</b></a> : <b>{b.company_name_private || b.title_vi || b.title_en || row.business_id}</b>}<br/><span className="d68-admin-badge warn">{b.public_code || 'Business'}</span></td><td>{i.code ? <a href={`/investors/${i.code}`} target="_blank" rel="noreferrer"><b>{i.private_name || i.title_vi || i.title_en || i.code}</b></a> : <b>{i.private_name || i.title_vi || i.title_en || row.investor_id}</b>}<br/><span>{i.private_email || i.code || 'Investor'}</span></td><td><span className={`d68-admin-badge ${st.cls === 'green' ? 'ok' : st.cls === 'red' ? 'err' : 'warn'}`}>{st.label}</span></td><td><div className="d68-admin-actions"><button className="d68-admin-btn green" onClick={() => markProposal(row, 'approved')}>Duyệt</button><button className="d68-admin-btn red" onClick={() => markProposal(row, 'declined')}>Từ chối</button><button className="d68-admin-btn blue" onClick={() => markProposal(row, 'connected')}>Connected</button></div></td></tr>; })}</tbody></table></div>{!proposals.length ? <Empty text="No proposals."/> : null}</Card>; }
function Payments({ payments, profiles, markPayment }: any) { return <Card><h3>Thanh toán / mở dashboard</h3>{payments.length ? <div className="d68-admin-table-wrap"><table className="d68-admin-table"><thead><tr><th>Order</th><th>Status</th><th>Profile</th><th>Amount</th><th>Action</th></tr></thead><tbody>{payments.map((p: Row) => { const prof = profiles.find((x: Row) => x.id === (p.profile_id || p.created_by)); const amount = p.payload?.price?.total || p.payload?.total || ''; const cur = p.payload?.price?.currency || p.payload?.currency || ''; return <tr key={p.id}><td><b>{p.title || p.id}</b><br/><span className="d68-admin-badge warn">{new Date(p.created_at).toLocaleString()}</span></td><td>{p.status}</td><td>{prof?.email || p.profile_id || p.created_by || '—'}<br/>{prof?.role}</td><td>{amount} {cur}</td><td><button className="d68-admin-btn green" onClick={() => markPayment(p, 'confirmed')}>Xác nhận thanh toán & mở dashboard</button> <button className="d68-admin-btn red" onClick={() => markPayment(p, 'rejected')}>Từ chối</button></td></tr>; })}</tbody></table></div> : <Empty text="No payment orders."/>}</Card>; }
function BusinessReviewList({ rows, approveBusiness, toggleBusiness }: any) { return <div>{rows.length ? rows.map((b: Row) => <BusinessPublicEditor key={b.id} b={b} onApprove={approveBusiness} onToggle={toggleBusiness} />) : <Empty text="No business pending review."/>}</div>; }
function BusinessPublicEditor({ b, onApprove, onToggle }: any) { const src = sourceOf(b); const pub = publicOf(b); return <Card><form onSubmit={(e) => onApprove(e, b)}><div className="d68-admin-row-head"><div><b>{b.public_code || 'D68'} · {b.company_name_private || src.company_name_private || 'Private name pending'}</b><div className="d68-admin-subtle">{b.status || 'pending'} · public v{b.public_version || 0} · {b.public_snapshot_json ? 'has snapshot' : 'no snapshot'}</div></div><span className={`d68-admin-badge ${b.visible ? 'ok' : 'warn'}`}>{b.visible ? 'visible' : 'not public'}</span></div><div className="d68-admin-notice err">Nguồn user/pending chỉ để tham khảo. Chỉ các field Admin duyệt dưới đây mới được public.</div><details className="d68-admin-source"><summary>Xem dữ liệu user gửi/pending</summary><pre>{JSON.stringify(src, null, 2)}</pre></details><div className="d68-admin-form4"><input name="title_vi" defaultValue={pub.title_vi || src.title_vi || 'Hồ sơ doanh nghiệp ẩn danh'} placeholder="Tên ẩn danh VI" required className="d68-admin-input"/><input name="title_en" defaultValue={pub.title_en || autoEn(pub.title_vi || src.title_vi || '')} placeholder="Anonymous title EN" className="d68-admin-input"/><input name="industry" defaultValue={pub.industry || src.industry || ''} placeholder="Industry" className="d68-admin-input"/><input name="deal_type" defaultValue={pub.deal_type || src.deal_type || ''} placeholder="Deal type" className="d68-admin-input"/><input name="city" defaultValue={pub.city || src.city || ''} placeholder="City" className="d68-admin-input"/><input name="country_iso2" defaultValue={pub.country_iso2 || src.country_iso2 || 'VN'} placeholder="Country ISO2" className="d68-admin-input"/><input name="revenue_2025" type="number" defaultValue={pub.revenue_2025 || src.revenue_2025 || 0} placeholder="Revenue" className="d68-admin-input"/><select name="revenue_currency" defaultValue={pub.revenue_currency || src.revenue_currency || 'VND'} className="d68-admin-input"><option>VND</option><option>USD</option></select><input name="ebitda_margin" type="number" defaultValue={pub.ebitda_margin ?? src.ebitda_margin ?? 0} placeholder="EBITDA %" className="d68-admin-input"/><input name="ask_amount" type="number" defaultValue={pub.ask_amount || src.ask_amount || 0} placeholder="Ask amount" className="d68-admin-input"/><select name="ask_currency" defaultValue={pub.ask_currency || src.ask_currency || src.revenue_currency || 'VND'} className="d68-admin-input"><option>VND</option><option>USD</option></select><input name="stake_pct" type="number" defaultValue={pub.stake_pct ?? src.stake_pct ?? 0} placeholder="Stake %" className="d68-admin-input"/><input name="quality_score" type="number" defaultValue={pub.quality_score ?? b.quality_score ?? 0} placeholder="Business Quality Score 0-100" min="0" max="100" className="d68-admin-input"/><label className="d68-admin-check"><input name="quality_score_manual_override" type="checkbox" defaultChecked={!!b.quality_score_manual_override}/> Giữ điểm Admin nhập</label><input name="data_confidence" type="number" defaultValue={pub.data_confidence ?? b.data_confidence ?? 0} placeholder="Data confidence" className="d68-admin-input"/><input name="hero_image_url" defaultValue={pub.hero_image_url || pub.image_url || ''} placeholder="Approved hero image URL" className="d68-admin-input d68-admin-span2"/><textarea name="description_vi" defaultValue={pub.description_vi || src.description_vi || ''} placeholder="Mô tả public VI" className="d68-admin-input textarea d68-admin-span2"/><textarea name="description_en" defaultValue={pub.description_en || autoEn(pub.description_vi || src.description_vi || '')} placeholder="Description EN" className="d68-admin-input textarea d68-admin-span2"/><textarea name="highlights_vi" defaultValue={lines(pub.highlights_vi || src.highlights_vi)} placeholder="Điểm nổi bật VI" className="d68-admin-input textarea d68-admin-span2"/><textarea name="highlights_en" defaultValue={lines(pub.highlights_en) || autoEn(lines(pub.highlights_vi || src.highlights_vi))} placeholder="Highlights EN" className="d68-admin-input textarea d68-admin-span2"/><textarea name="investment_reason_vi" defaultValue={pub.investment_reason_vi || src.investment_reason_vi || ''} placeholder="Lý do giao dịch VI" className="d68-admin-input textarea d68-admin-span2"/><textarea name="investment_reason_en" defaultValue={pub.investment_reason_en || autoEn(pub.investment_reason_vi || src.investment_reason_vi || '')} placeholder="Reason EN" className="d68-admin-input textarea d68-admin-span2"/></div><div className="d68-admin-actions"><button className="d68-admin-btn green">Duyệt & hiển thị public snapshot</button><button type="button" onClick={() => onToggle(b)} className={`d68-admin-btn ${b.visible ? 'red' : ''}`}>{b.visible ? 'Ẩn public' : 'Bật visible'}</button>{b.slug ? <Link to={`/businesses/${b.slug}`} className="d68-admin-btn blue">Public ↗</Link> : null}</div></form></Card>; }
function InvestorEditor({ i, onSave, onToggle }: any) { const pending = i.privacy?.pending_profile_changes; const needsReview = investorNeedsReview(i); const src = pending || i; return <Card><form onSubmit={(e) => onSave(e, i, pending ? 'approve' : 'save')}><div className="d68-admin-row-head"><div><b>{i.code} · {i.private_name || i.title_vi || i.title_en}</b><div className="d68-admin-subtle">{i.status} · {i.visible ? 'visible' : 'not public'} · {pending ? 'has pending dashboard changes' : 'no pending changes'}</div></div><span className={`d68-admin-badge ${i.visible ? 'ok' : 'warn'}`}>{i.visible ? 'visible' : 'not public'}</span>{needsReview ? <span className="d68-admin-badge warn">Cần duyệt</span> : null}</div>{pending ? <details className="d68-admin-source" open><summary>Pending changes from Investor Dashboard</summary><pre>{JSON.stringify(pending, null, 2)}</pre></details> : null}<div className="d68-admin-form4"><input name="title_vi" defaultValue={src.title_vi || ''} placeholder="Title VI" className="d68-admin-input"/><input name="title_en" defaultValue={src.title_en || ''} placeholder="Title EN" className="d68-admin-input"/><input name="type" defaultValue={src.type || ''} placeholder="Type" className="d68-admin-input"/><input name="country" defaultValue={src.country || ''} placeholder="Country" className="d68-admin-input"/><input name="country_iso2" defaultValue={src.country_iso2 || i.country_iso2 || ''} placeholder="ISO2" className="d68-admin-input"/><input name="region" defaultValue={src.region || i.region || ''} placeholder="Region" className="d68-admin-input"/><input name="ticket_min" type="number" defaultValue={src.ticket_min || 0} placeholder="Ticket min" className="d68-admin-input"/><input name="ticket_max" type="number" defaultValue={src.ticket_max || 0} placeholder="Ticket max" className="d68-admin-input"/><input name="stage" defaultValue={src.stage || ''} placeholder="Stage" className="d68-admin-input"/><input name="industries" defaultValue={arrFromText(src.industries).join(', ')} placeholder="Industries" className="d68-admin-input"/><input name="deal_types" defaultValue={arrFromText(src.deal_types).join(', ')} placeholder="Deal types" className="d68-admin-input"/><label className="d68-admin-check"><input name="verified" type="checkbox" defaultChecked={!!i.verified}/> Verified</label><label className="d68-admin-check"><input name="admin_priority" type="checkbox" defaultChecked={!!i.admin_priority}/> Priority</label><label className="d68-admin-check"><input name="visible" type="checkbox" defaultChecked={!!i.visible}/> Visible</label><input name="private_name" defaultValue={i.private_name || ''} placeholder="Private name" className="d68-admin-input"/><input name="private_email" defaultValue={i.private_email || i.privacy?.email || ''} placeholder="Private email" className="d68-admin-input"/><input name="private_phone" defaultValue={i.private_phone || i.privacy?.phone || ''} placeholder="Private phone" className="d68-admin-input"/><input name="private_website" defaultValue={i.private_website || i.privacy?.website || ''} placeholder="Private website" className="d68-admin-input"/><textarea name="desc_vi" defaultValue={src.desc_vi || ''} placeholder="Desc VI" className="d68-admin-input textarea d68-admin-span2"/><textarea name="desc_en" defaultValue={src.desc_en || ''} placeholder="Desc EN" className="d68-admin-input textarea d68-admin-span2"/></div><div className="d68-admin-actions"><button className="d68-admin-btn green">{pending ? 'Duyệt thay đổi & public' : 'Lưu investor'}</button><button type="button" onClick={() => onToggle(i)} className={`d68-admin-btn ${i.visible ? 'red' : ''}`}>{i.visible ? 'Ẩn public' : 'Bật visible'}</button>{i.code ? <Link to={`/investors/${i.code}`} className="d68-admin-btn blue">Public ↗</Link> : null}</div></form></Card>; }
function AssetEditor({ b }: { b: Row }) { const [files, setFiles] = useState<Row[]>([]); const [images, setImages] = useState<Row[]>([]); const [msg, setMsg] = useState(''); async function loadAssets() { const [f, im] = await Promise.all([getBusinessFiles(b.id).catch(() => []), getBusinessImages(b.id).catch(() => [])]); setFiles(f); setImages(im); } useEffect(() => { loadAssets(); }, [b.id]); async function saveImage(img: Row, patch: Row) { try { await updateBusinessImage(img.id, patch); setMsg('Image updated.'); loadAssets(); } catch (e: any) { setMsg(e?.message || 'Image update failed.'); } } async function saveFile(file: Row, patch: Row) { try { await updateBusinessFile(file.id, patch); setMsg('File updated.'); loadAssets(); } catch (e: any) { setMsg(e?.message || 'File update failed.'); } } return <Card><h3>{b.public_code || b.slug} · Ảnh/File duyệt public</h3>{msg ? <div className="d68-admin-notice ok">{msg}</div> : null}<div className="d68-admin-asset-grid"><div><h4>Ảnh</h4>{images.length ? images.map((img) => <div key={img.id} className="d68-admin-asset-row"><img src={img.public_url} alt=""/><div><input defaultValue={img.display_title || img.title || ''} onBlur={(e) => saveImage(img, { display_title: e.target.value })} placeholder="Tên ảnh public" className="d68-admin-input"/><label className="d68-admin-check"><input type="checkbox" defaultChecked={!!img.is_sanitized} onChange={(e) => saveImage(img, { is_sanitized: e.target.checked })}/> Đã làm mờ logo/tên DN</label><label className="d68-admin-check"><input type="checkbox" defaultChecked={!!img.public_visible} onChange={(e) => saveImage(img, { public_visible: e.target.checked })}/> Cho hiển thị public</label><label className="d68-admin-check"><input type="checkbox" defaultChecked={!!img.is_hero} onChange={(e) => saveImage(img, { is_hero: e.target.checked })}/> Ảnh hero</label></div></div>) : <Empty text="No images."/>}</div><div><h4>Files</h4>{files.length ? files.map((f) => <div key={f.id} className="d68-admin-card"><input defaultValue={f.display_name || f.file_name || ''} onBlur={(e) => saveFile(f, { display_name: e.target.value })} className="d68-admin-input"/><label className="d68-admin-check"><input type="checkbox" defaultChecked={!!f.public_visible} onChange={(e) => saveFile(f, { public_visible: e.target.checked })}/> Public visible</label><select defaultValue={f.privacy_level || 'locked'} onChange={(e) => saveFile(f, { privacy_level: e.target.value })} className="d68-admin-input"><option value="locked">locked</option><option value="public">public</option></select></div>) : <Empty text="No files."/>}</div></div></Card>; }
function Promos({ promos, createPromo }: any) { return <Card><h3>Mã khuyến mãi</h3><form onSubmit={createPromo} className="d68-admin-form4 d68-admin-form-gap"><input required name="code" placeholder="CODE" className="d68-admin-input"/><input name="description" placeholder="Description" className="d68-admin-input"/><select name="role" className="d68-admin-input"><option value="business">business</option><option value="investor">investor</option><option value="advisor">advisor</option><option value="affiliate">affiliate</option></select><input name="discount_pct" type="number" placeholder="%" className="d68-admin-input"/><input name="quota_total" type="number" placeholder="Quota" className="d68-admin-input"/><input name="starts_at" type="datetime-local" className="d68-admin-input"/><input name="ends_at" type="datetime-local" className="d68-admin-input"/><button className="d68-admin-btn green">Tạo mã</button></form>{promos.map((p: Row) => <div key={p.id} className="d68-admin-card"><b>{p.code}</b> · {p.discount_pct}% · {p.role} · {p.active ? 'active' : 'inactive'}</div>)}</Card>; }
function Requests({ requests, markRequest }: any) { return <Card><h3>Yêu cầu data</h3>{requests.length ? requests.map((r: Row) => <div key={r.id} className="d68-admin-card"><b>{r.businesses?.public_code || r.business_id}</b> ← {r.investors?.code || r.investor_id}<p>{r.note}</p><span>{r.status}</span><div className="d68-admin-actions"><button className="d68-admin-btn blue" onClick={() => markRequest(r, 'forwarded')}>Forwarded</button><button className="d68-admin-btn green" onClick={() => markRequest(r, 'fulfilled')}>Fulfilled</button><button className="d68-admin-btn red" onClick={() => markRequest(r, 'rejected')}>Rejected</button></div></div>) : <Empty text="No data requests."/>}</Card>; }
function Leads({ contactMessages, partnerLeads, markLead }: any) { return <div><Card><h3>Contact messages</h3>{contactMessages.length ? contactMessages.map((m: Row) => <div key={m.id} className="d68-admin-card"><b>{m.name}</b> · <a href={`mailto:${m.email}`}>{m.email}</a><p>{m.message}</p><span className="d68-admin-badge warn">{m.status}</span><div className="d68-admin-actions"><button className="d68-admin-btn green" onClick={() => markLead('contact_messages', m, 'handled')}>Handled</button><button className="d68-admin-btn blue" onClick={() => markLead('contact_messages', m, 'follow_up')}>Follow up</button></div></div>) : <Empty text="No contact messages."/>}</Card><Card><h3>Market Partner leads</h3>{partnerLeads.length ? partnerLeads.map((l: Row) => <div key={l.id} className="d68-admin-card"><b>{l.full_name}</b> · <a href={`mailto:${l.email}`}>{l.email}</a> · {l.country}<p>{l.phone}</p><p>{l.intro}</p><span className="d68-admin-badge warn">{l.status}</span><div className="d68-admin-actions"><button className="d68-admin-btn green" onClick={() => markLead('partner_leads', l, 'approved')}>Approved</button><button className="d68-admin-btn blue" onClick={() => markLead('partner_leads', l, 'follow_up')}>Follow up</button><button className="d68-admin-btn red" onClick={() => markLead('partner_leads', l, 'rejected')}>Rejected</button></div></div>) : <Empty text="No partner leads."/>}</Card></div>; }
function Logs({ logs }: { logs: Row[] }) { return <Card><h3>Audit logs</h3>{logs.length ? <div className="d68-admin-table-wrap"><table className="d68-admin-table"><tbody>{logs.map((l) => <tr key={l.id}><td>{new Date(l.created_at).toLocaleString()}</td><td><b>{l.action}</b></td><td>{l.entity_type}</td><td><pre>{JSON.stringify(l.detail || {}, null, 2)}</pre></td></tr>)}</tbody></table></div> : <Empty text="No audit logs."/>}</Card>; }
function Settings() { return <Card><h3>Cài đặt & kiểm thử baseline</h3><p>Không có secret/service_role key trong frontend. Admin chạy bằng Supabase RLS + profile.role=admin.</p><ul className="d68-admin-steps"><li>Public Business phải có visible=true, status=active, public_snapshot_json.</li><li>Business user edit chỉ vào pending_changes_json.</li><li>Investor user edit chỉ vào privacy.pending_profile_changes.</li><li>Admin duyệt mới public.</li><li>Contact và Market Partner leads lưu vào bảng riêng, Admin xem tại /admin/leads.</li></ul></Card>; }
