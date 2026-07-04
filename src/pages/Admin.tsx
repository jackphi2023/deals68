import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { listBusinesses } from '../lib/data';
import { supabase } from '../lib/supabase';
import { autoEnglishFromVietnamese } from '../lib/i18n';
import { formatCompactMoney } from '../lib/format';

type AdminTab = 'overview' | 'approvals' | 'businesses' | 'business_review' | 'investors' | 'investor_contacts' | 'payments' | 'promos' | 'quality' | 'requests' | 'market_partners' | 'logs' | 'settings';

const pathTabs: Record<string, AdminTab> = {
  '': 'overview', overview: 'overview', approvals: 'approvals', businesses: 'businesses', 'business-review': 'business_review', investors: 'investors', 'investor-imports': 'investor_contacts', contacts: 'investor_contacts', payments: 'payments', promo: 'promos', promos: 'promos', proposals: 'requests', 'data-requests': 'requests', 'quality-criteria': 'quality', 'valuation-rules': 'quality', affiliates: 'market_partners', 'market-partners': 'market_partners', audit: 'logs', logs: 'logs', settings: 'settings', seo: 'settings', imports: 'settings', security: 'settings'
};
const tabs: { id: AdminTab; label: string; icon: string; href: string }[] = [
  { id: 'overview', label: 'Tổng quan', icon: '📊', href: '/admin' },
  { id: 'approvals', label: 'Chờ duyệt', icon: '⏳', href: '/admin/approvals' },
  { id: 'businesses', label: 'Doanh nghiệp', icon: '🏢', href: '/admin/businesses' },
  { id: 'business_review', label: 'Duyệt DN', icon: '✅', href: '/admin/business-review' },
  { id: 'investors', label: 'Nhà đầu tư', icon: '📈', href: '/admin/investors' },
  { id: 'investor_contacts', label: 'Liên hệ NĐT', icon: '🔒', href: '/admin/investor-imports' },
  { id: 'payments', label: 'Thanh toán', icon: '💳', href: '/admin/payments' },
  { id: 'promos', label: 'Mã khuyến mãi', icon: '🎟️', href: '/admin/promo' },
  { id: 'quality', label: 'Quality', icon: '⭐', href: '/admin/quality-criteria' },
  { id: 'requests', label: 'Yêu cầu data', icon: '📂', href: '/admin/data-requests' },
  { id: 'market_partners', label: 'Đối tác', icon: '🌍', href: '/admin/market-partners' },
  { id: 'logs', label: 'Audit', icon: '🧾', href: '/admin/audit' },
  { id: 'settings', label: 'Cài đặt', icon: '⚙️', href: '/admin/settings' }
];

function resolveTab(pathname: string): AdminTab {
  const suffix = pathname.replace('/admin', '').replace(/^\//, '').split('/')[0];
  return pathTabs[suffix] || 'overview';
}
function filterRows(rows: any[], search: string, fields: string[]) {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => fields.some((f) => String(row?.[f] ?? '').toLowerCase().includes(q)));
}
function statusBadge(status?: string) {
  const s = String(status || 'active');
  if (s.includes('pending')) return { color: '#B8860B', background: '#FEF3D3' };
  if (s.includes('hidden') || s.includes('reject')) return { color: '#DC2626', background: '#FDECEC' };
  return { color: '#16A34A', background: '#E9F9EF' };
}
function inputStyle(extra: any = {}) { return { border: '1px solid #E2E8F0', borderRadius: 8, padding: '9px 11px', fontSize: 13.5, background: '#F7FAFC', color: '#0F2A4A', width: '100%', ...extra }; }

export default function Admin() {
  const { profile, loading, signOut } = useAuth();
  const location = useLocation();
  const [tab, setTab] = useState<AdminTab>(() => resolveTab(location.pathname));
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [investors, setInvestors] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => setTab(resolveTab(location.pathname)), [location.pathname]);

  async function load() {
    if (profile?.role !== 'admin') return;
    setBusy(true); setError('');
    try {
      const [biz, invRes, profRes, promoRes, criteriaRes, reqRes, payRes, logRes] = await Promise.all([
        listBusinesses({ includeHidden: true }).catch(() => []),
        supabase.from('investors').select('*').order('admin_priority', { ascending: false }).order('created_at', { ascending: false }).limit(2000),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(2000),
        supabase.from('promo_codes').select('*').order('created_at', { ascending: false }),
        supabase.from('quality_criteria').select('*').order('sort_order'),
        supabase.from('request_data').select('*, businesses(title_vi,title_en,public_code,slug), investors(title_en,code,type)').order('created_at', { ascending: false }),
        supabase.from('payment_orders').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(80)
      ]);
      setBusinesses(biz || []); setInvestors(invRes.data || []); setProfiles(profRes.data || []); setPromos(promoRes.data || []); setCriteria(criteriaRes.data || []); setRequests(reqRes.data || []); setPayments(payRes.data || []); setLogs(logRes.data || []);
      const firstErr = invRes.error || profRes.error || promoRes.error || criteriaRes.error || reqRes.error || payRes.error || logRes.error;
      if (firstErr) setError(firstErr.message);
    } catch (e: any) { setError(e?.message || 'Could not load admin data.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (profile?.role === 'admin') load(); }, [profile?.role]);

  if (loading) return <section style={{ padding: 60 }}><div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 24 }}>Loading admin...</div></section>;
  if (profile?.role !== 'admin') return <Navigate to="/login?next=/admin" replace />;

  const pendingBusinesses = businesses.filter((b) => b.status === 'pending_admin_review' || b.pending_changes_json);
  const hiddenBusinesses = businesses.filter((b) => !b.visible || b.status === 'hidden');
  const pendingProfiles = profiles.filter((p) => String(p.status || '').includes('pending') || p.dashboard_login_enabled === false);
  const marketPartners = profiles.filter((p) => p.role === 'affiliate');
  const filteredBusinesses = filterRows(businesses, search, ['title_vi', 'title_en', 'company_name_private', 'public_code', 'industry', 'status']);
  const filteredInvestors = filterRows(investors, search, ['title_vi', 'title_en', 'private_name', 'private_email', 'code', 'type', 'country']);

  async function logAction(action: string, entity_type: string, entity_id: string, detail: any = {}) {
    try { await supabase.from('audit_logs').insert({ actor_id: profile.id, action, entity_type, entity_id, detail }); } catch { /* non-blocking */ }
  }
  async function toggleBusiness(b: any) {
    const nextVisible = !b.visible;
    const { error } = await supabase.from('businesses').update({ visible: nextVisible, status: nextVisible ? 'active' : 'hidden' }).eq('id', b.id);
    if (!error) await logAction(nextVisible ? 'show_business' : 'hide_business', 'business', b.id, { public_code: b.public_code });
    setMsg(error ? error.message : 'Business visibility updated.'); load();
  }
  async function approvePending(b: any) {
    let patch = b.pending_changes_json || {};
    let { error } = await supabase.rpc('approve_business_pending', { business_uuid: b.id });
    if (error && Object.keys(patch).length) {
      const fallback = { ...patch, pending_changes_json: null, status: 'active', updated_at: new Date().toISOString() };
      const r = await supabase.from('businesses').update(fallback).eq('id', b.id); error = r.error;
    }
    if (!error) await logAction('approve_business_pending', 'business', b.id, { public_code: b.public_code });
    setMsg(error ? error.message : 'Pending changes approved.'); load();
  }
  async function saveBusiness(e: FormEvent, b: any) {
    e.preventDefault(); const fd = new FormData(e.currentTarget as HTMLFormElement);
    const patch: any = { title_vi: fd.get('title_vi'), title_en: autoEnglishFromVietnamese(String(fd.get('title_vi') || '')), industry: fd.get('industry'), deal_type: fd.get('deal_type'), revenue_2025: Number(fd.get('revenue_2025') || 0), ebitda_margin: Number(fd.get('ebitda_margin') || 0), ask_amount: Number(fd.get('ask_amount') || 0), stake_pct: Number(fd.get('stake_pct') || 0), quality_score: Number(fd.get('quality_score') || 0), data_confidence: Number(fd.get('data_confidence') || 0), visible: fd.get('visible') === 'on', plan: fd.get('plan'), status: fd.get('status') };
    const { error } = await supabase.from('businesses').update(patch).eq('id', b.id);
    if (!error) await logAction('save_business', 'business', b.id, { public_code: b.public_code });
    setMsg(error ? error.message : 'Business updated directly by admin.'); load();
  }
  async function toggleInvestor(i: any) {
    const nextVisible = !i.visible;
    const { error } = await supabase.from('investors').update({ visible: nextVisible, status: nextVisible ? 'active' : 'hidden' }).eq('id', i.id);
    if (!error) await logAction(nextVisible ? 'show_investor' : 'hide_investor', 'investor', i.id, { code: i.code });
    setMsg(error ? error.message : 'Investor visibility updated.'); load();
  }
  async function saveInvestor(e: FormEvent, i: any) {
    e.preventDefault(); const fd = new FormData(e.currentTarget as HTMLFormElement);
    const industries = String(fd.get('industries') || '').split(',').map(s => s.trim()).filter(Boolean);
    const deal_types = String(fd.get('deal_types') || '').split(',').map(s => s.trim()).filter(Boolean);
    const { error } = await supabase.from('investors').update({ title_en: fd.get('title_en'), title_vi: fd.get('title_vi'), desc_en: fd.get('desc_en'), desc_vi: fd.get('desc_vi'), type: fd.get('type'), country: fd.get('country'), country_iso2: fd.get('country_iso2'), industries, deal_types, ticket_min: Number(fd.get('ticket_min') || 0), ticket_max: Number(fd.get('ticket_max') || 0), verified: fd.get('verified') === 'on', admin_priority: fd.get('admin_priority') === 'on', private_name: fd.get('private_name'), private_website: fd.get('private_website'), private_email: fd.get('private_email'), private_phone: fd.get('private_phone'), visible: fd.get('visible') === 'on' }).eq('id', i.id);
    if (!error) await logAction('save_investor', 'investor', i.id, { code: i.code });
    setMsg(error ? error.message : 'Investor updated.'); load();
  }
  async function approveProfile(p: any) { const { error } = await supabase.from('profiles').update({ status: 'active', dashboard_login_enabled: true }).eq('id', p.id); if (!error) await logAction('approve_profile', 'profile', p.id, { role: p.role }); setMsg(error ? error.message : 'Profile approved and dashboard enabled.'); load(); }
  async function hideProfile(p: any) { const { error } = await supabase.from('profiles').update({ status: 'hidden', dashboard_login_enabled: false }).eq('id', p.id); if (!error) await logAction('hide_profile', 'profile', p.id, { role: p.role }); setMsg(error ? error.message : 'Profile hidden.'); load(); }
  async function createPromo(e: FormEvent) { e.preventDefault(); const fd = new FormData(e.currentTarget as HTMLFormElement); const { error } = await supabase.from('promo_codes').insert({ code: String(fd.get('code') || '').toUpperCase(), description: fd.get('description'), role: fd.get('role'), discount_pct: Number(fd.get('discount_pct') || 0), quota_total: Number(fd.get('quota_total') || 0), starts_at: fd.get('starts_at') || new Date().toISOString(), ends_at: fd.get('ends_at'), active: true, created_by: profile.id }); if (!error) await logAction('create_promo', 'promo', String(fd.get('code') || ''), {}); setMsg(error ? error.message : 'Promo created.'); load(); }
  async function saveCriterion(e: FormEvent, c: any) { e.preventDefault(); const fd = new FormData(e.currentTarget as HTMLFormElement); const { error } = await supabase.from('quality_criteria').update({ label_vi: fd.get('label_vi'), label_en: fd.get('label_en'), weight: Number(fd.get('weight') || 0), sort_order: Number(fd.get('sort_order') || 0), active: fd.get('active') === 'on' }).eq('id', c.id); if (!error) await logAction('save_quality_criterion', 'quality_criteria', c.id, {}); setMsg(error ? error.message : 'Criterion updated.'); load(); }
  async function markRequest(r: any, status: string) { const { error } = await supabase.from('request_data').update({ status }).eq('id', r.id); if (!error) await logAction('mark_data_request', 'request_data', r.id, { status }); setMsg(error ? error.message : 'Request updated.'); load(); }
  async function markPayment(row: any, status: string) { const { error } = await supabase.from('payment_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', row.id); if (!error) await logAction('mark_payment', 'payment_order', row.id, { status }); setMsg(error ? error.message : 'Payment updated.'); load(); }

  return <section style={{ background: '#F4F6F9', minHeight: '100vh', marginTop: -1 }}>
    <div style={{ background: '#0F2A4A', color: '#fff' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', gap: 20 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}><img src="/assets/logo-white.png" alt="Deals68.com" style={{ height: 26, display: 'block' }} /></Link>
        <span style={{ color: '#9db4cc', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .6, borderLeft: '1px solid rgba(255,255,255,.15)', paddingLeft: 16 }}>Admin Panel</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}><span style={{ color: '#c6d5e6', fontSize: 13.5 }}>👤 {profile.email || 'admin@deals68.com'}</span><button onClick={signOut} style={{ background: 'rgba(255,255,255,.1)', color: '#fff', fontWeight: 700, fontSize: 13.5, padding: '9px 15px', borderRadius: 9, border: 0, cursor: 'pointer' }}>Thoát</button></div>
      </div>
    </div>
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 24px 60px' }}>
      <div className="d68-adm-cols" style={{ display: 'grid', gridTemplateColumns: '220px minmax(0,1fr)', gap: 22, alignItems: 'start' }}>
        <nav className="d68-adm-side" style={{ position: 'sticky', top: 88, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tabs.map((item) => <Link key={item.id} to={item.href} onClick={() => setTab(item.id)} style={{ display: 'block', textAlign: 'left', width: '100%', padding: '11px 12px', borderRadius: 9, fontSize: 13.5, fontWeight: tab === item.id ? 800 : 600, color: tab === item.id ? '#0F2A4A' : '#64748B', background: tab === item.id ? '#EEF2F6' : 'transparent' }}>{item.icon} {item.label}</Link>)}
        </nav>
        <main>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}><div><h1 style={{ fontSize: 23, fontWeight: 800, margin: 0 }}>Deals68 Admin</h1><p style={{ color: '#64748B', fontSize: 13.5, margin: '4px 0 0' }}>Manage businesses, investors, payments, promo codes, quality criteria and requests.</p></div><button onClick={load} style={{ background: '#0F2A4A', color: '#fff', border: 0, borderRadius: 9, padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }}>{busy ? 'Loading...' : 'Refresh'}</button></div>
          {msg && <div style={{ background: '#E9F9EF', border: '1px solid #BBF0CE', color: '#16A34A', borderRadius: 10, padding: '11px 14px', marginBottom: 12, fontSize: 13.5, fontWeight: 600 }}>{msg}</div>}
          {error && <div style={{ background: '#FDECEC', border: '1px solid #F8B4B4', color: '#B91C1C', borderRadius: 10, padding: '11px 14px', marginBottom: 12, fontSize: 13.5, fontWeight: 600 }}>{error}</div>}
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search businesses/investors/profiles..." style={{ ...inputStyle(), marginBottom: 18 }} />

          {tab === 'overview' && <Overview businesses={businesses} investors={investors} profiles={profiles} payments={payments} logs={logs} pendingBusinesses={pendingBusinesses} hiddenBusinesses={hiddenBusinesses} pendingProfiles={pendingProfiles} />}
          {tab === 'approvals' && <Approvals pendingProfiles={pendingProfiles} pendingBusinesses={pendingBusinesses} approveProfile={approveProfile} hideProfile={hideProfile} approvePending={approvePending} />}
          {tab === 'businesses' && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{filteredBusinesses.map((b) => <BusinessEditor key={b.id} b={b} onSave={saveBusiness} onToggle={toggleBusiness} onApprove={approvePending} />)}</div>}
          {tab === 'business_review' && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{pendingBusinesses.length ? pendingBusinesses.map((b) => <BusinessEditor key={b.id} b={b} onSave={saveBusiness} onToggle={toggleBusiness} onApprove={approvePending} />) : <Empty text="No pending business changes." />}</div>}
          {tab === 'investors' && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{filteredInvestors.map((i) => <InvestorEditor key={i.id} i={i} onSave={saveInvestor} onToggle={toggleInvestor} />)}</div>}
          {tab === 'investor_contacts' && <InvestorContacts investors={filteredInvestors} />}
          {tab === 'payments' && <Payments payments={payments} markPayment={markPayment} />}
          {tab === 'promos' && <Promos promos={promos} createPromo={createPromo} />}
          {tab === 'quality' && <Quality criteria={criteria} saveCriterion={saveCriterion} />}
          {tab === 'requests' && <Requests requests={requests} markRequest={markRequest} />}
          {tab === 'market_partners' && <MarketPartners rows={marketPartners} approveProfile={approveProfile} hideProfile={hideProfile} />}
          {tab === 'logs' && <Logs logs={logs} />}
          {tab === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  </section>;
}

function Card({ children, style = {} }: { children: any; style?: any }) { return <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18, ...style }}>{children}</div>; }
function Empty({ text }: { text: string }) { return <div style={{ background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94A3B8' }}>{text}</div>; }
function Metric({ label, value, color = '#0F2A4A' }: { label: string; value: string; color?: string }) { return <Card><div style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{label}</div><div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, color }}>{value}</div></Card>; }
function Overview({ businesses, investors, profiles, payments, logs, pendingBusinesses, hiddenBusinesses, pendingProfiles }: any) { return <><div className="d68-adm-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 22 }}><Metric label="Businesses" value={String(businesses.length)} color="#1596cc" /><Metric label="Investors" value={String(investors.length)} color="#B8860B" /><Metric label="Pending" value={String(pendingProfiles.length + pendingBusinesses.length)} color="#DC2626" /><Metric label="Payments" value={String(payments.length)} color="#16A34A" /></div><Card><h3 style={{ fontSize: 15.5, fontWeight: 800, margin: '0 0 14px' }}>Hoạt động gần đây</h3>{logs.length ? logs.slice(0, 8).map((a: any) => <div key={a.id || a.created_at} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13.5 }}><span style={{ color: '#94A3B8', flexShrink: 0, width: 130 }}>{a.created_at ? new Date(a.created_at).toLocaleString('vi-VN') : '—'}</span><span style={{ fontWeight: 700, color: '#0F2A4A', flexShrink: 0 }}>{a.action || 'audit'}</span><span style={{ color: '#475569' }}>{a.entity_type || ''} {a.entity_id || ''}</span></div>) : <div style={{ color: '#94A3B8', fontSize: 13.5 }}>Chưa có hoạt động nào được ghi nhận.</div>}</Card><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}><Card><b>Release watch</b><ul style={{ color: '#475569', lineHeight: 1.65 }}><li>{pendingBusinesses.length} business pending review</li><li>{hiddenBusinesses.length} hidden businesses</li><li>Investor private contacts admin-only</li></ul></Card><Card><b>Payment gate</b><p style={{ color: '#64748B', lineHeight: 1.6 }}>Tài khoản mới phải được xác nhận thanh toán / duyệt hồ sơ trước khi mở dashboard.</p></Card></div></>; }
function Approvals({ pendingProfiles, pendingBusinesses, approveProfile, hideProfile, approvePending }: any) { return <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}><Card><h2 style={{ marginTop: 0 }}>Chờ duyệt thanh toán / tài khoản</h2>{pendingProfiles.length ? pendingProfiles.map((p: any) => <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 0', borderTop: '1px solid #F1F5F9' }}><span style={{ fontWeight: 800 }}>{p.email || p.username}</span><span style={{ ...statusBadge(p.status), fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 7 }}>{p.role} · {p.status || 'pending'}</span><button onClick={() => approveProfile(p)} style={smallBtn('#16A34A')}>Duyệt & Kích hoạt</button><button onClick={() => hideProfile(p)} style={smallBtn('#DC2626')}>Ẩn</button></div>) : <Empty text="Không có tài khoản đang chờ duyệt." />}</Card><Card><h2 style={{ marginTop: 0 }}>Doanh nghiệp chờ duyệt lại</h2>{pendingBusinesses.length ? pendingBusinesses.map((b: any) => <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 0', borderTop: '1px solid #F1F5F9' }}><span style={{ fontWeight: 800, flex: 1 }}>{b.title_vi || b.public_code}</span><span style={{ color: '#8a6300', fontSize: 12 }}>{b.public_code || 'D68'}</span><button onClick={() => approvePending(b)} style={smallBtn('#16A34A')}>Duyệt lại & Hiển thị</button></div>) : <Empty text="Không có hồ sơ nào đang chờ duyệt lại." />}</Card></div>; }
function smallBtn(color = '#0F2A4A') { return { background: color, color: '#fff', fontWeight: 700, fontSize: 12.5, padding: '8px 12px', borderRadius: 8, border: 0, cursor: 'pointer' } as const; }
function BusinessEditor({ b, onSave, onToggle, onApprove }: any) { return <Card><form onSubmit={(e) => onSave(e, b)}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap', marginBottom: 12 }}><div><div style={{ fontWeight: 800 }}>{b.public_code || 'D68'} · {b.company_name_private || b.title_vi}</div><div style={{ fontSize: 12.5, color: '#64748B' }}>{b.industry} · {b.city || b.country_iso2} · {formatCompactMoney(b.revenue_2025, b.revenue_currency)}</div></div><span style={{ ...statusBadge(b.status), fontSize: 12, fontWeight: 800, padding: '5px 10px', borderRadius: 7 }}>{b.status || 'active'}</span></div><div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: 10 }}><input name="title_vi" defaultValue={b.title_vi || ''} style={inputStyle()} /><input name="industry" defaultValue={b.industry || ''} style={inputStyle()} /><input name="deal_type" defaultValue={b.deal_type || ''} style={inputStyle()} /><select name="status" defaultValue={b.status || 'active'} style={inputStyle()}><option>active</option><option>pending_admin_review</option><option>hidden</option><option>draft</option></select><input name="revenue_2025" type="number" defaultValue={b.revenue_2025 || 0} style={inputStyle()} /><input name="ebitda_margin" type="number" defaultValue={b.ebitda_margin || 0} style={inputStyle()} /><input name="ask_amount" type="number" defaultValue={b.ask_amount || 0} style={inputStyle()} /><input name="stake_pct" type="number" defaultValue={b.stake_pct || 0} style={inputStyle()} /><input name="quality_score" type="number" defaultValue={b.quality_score || 0} style={inputStyle()} /><input name="data_confidence" type="number" defaultValue={b.data_confidence || 0} style={inputStyle()} /><select name="plan" defaultValue={b.plan || 'standard'} style={inputStyle()}><option value="standard">standard</option><option value="featured">featured</option></select><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}><input name="visible" type="checkbox" defaultChecked={!!b.visible} /> Visible</label></div><div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}><button style={smallBtn()}>Lưu</button><button type="button" onClick={() => onToggle(b)} style={smallBtn(b.visible ? '#DC2626' : '#16A34A')}>{b.visible ? 'Ẩn' : 'Hiện'}</button>{(b.pending_changes_json || b.status === 'pending_admin_review') && <button type="button" onClick={() => onApprove(b)} style={smallBtn('#16A34A')}>Duyệt pending</button>}<Link to={`/businesses/${b.slug}`} style={{ ...smallBtn('#1596cc'), textDecoration: 'none' }}>Public ↗</Link></div></form></Card>; }
function InvestorEditor({ i, onSave, onToggle }: any) { return <Card><form onSubmit={(e) => onSave(e, i)}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap', marginBottom: 12 }}><div><div style={{ fontWeight: 800 }}>{i.code || 'INV'} · {i.private_name || i.title_en || i.title_vi}</div><div style={{ fontSize: 12.5, color: '#64748B' }}>{i.type} · {i.country || i.country_iso2} · {Number(i.ticket_min || 0).toLocaleString()}–{Number(i.ticket_max || 0).toLocaleString()} USD</div></div><span style={{ ...statusBadge(i.status), fontSize: 12, fontWeight: 800, padding: '5px 10px', borderRadius: 7 }}>{String(i.visible ?? true) === 'true' ? 'visible' : 'hidden'}</span></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}><input name="title_en" defaultValue={i.title_en || ''} placeholder="Title EN" style={inputStyle()} /><input name="title_vi" defaultValue={i.title_vi || ''} placeholder="Title VI" style={inputStyle()} /><input name="type" defaultValue={i.type || ''} placeholder="Type" style={inputStyle()} /><input name="country" defaultValue={i.country || ''} placeholder="Country" style={inputStyle()} /><input name="country_iso2" defaultValue={i.country_iso2 || ''} placeholder="ISO2" style={inputStyle()} /><input name="industries" defaultValue={(i.industries || []).join(', ')} placeholder="Industries" style={inputStyle()} /><input name="deal_types" defaultValue={(i.deal_types || []).join(', ')} placeholder="Deal types" style={inputStyle()} /><input name="ticket_min" type="number" defaultValue={i.ticket_min || 0} style={inputStyle()} /><input name="ticket_max" type="number" defaultValue={i.ticket_max || 0} style={inputStyle()} /><input name="private_name" defaultValue={i.private_name || ''} placeholder="Private name" style={inputStyle()} /><input name="private_email" defaultValue={i.private_email || ''} placeholder="Private email" style={inputStyle()} /><input name="private_phone" defaultValue={i.private_phone || ''} placeholder="Private phone" style={inputStyle()} /><input name="private_website" defaultValue={i.private_website || ''} placeholder="Website" style={inputStyle()} /><textarea name="desc_en" defaultValue={i.desc_en || ''} placeholder="Description EN" style={inputStyle({ gridColumn: 'span 2', minHeight: 70 })} /><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}><input name="verified" type="checkbox" defaultChecked={!!i.verified} /> Verified</label><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}><input name="admin_priority" type="checkbox" defaultChecked={!!i.admin_priority} /> Priority</label><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}><input name="visible" type="checkbox" defaultChecked={i.visible !== false} /> Visible</label></div><div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button style={smallBtn()}>Lưu</button><button type="button" onClick={() => onToggle(i)} style={smallBtn(i.visible ? '#DC2626' : '#16A34A')}>{i.visible ? 'Ẩn' : 'Hiện'}</button><Link to={`/investors/${i.code}`} style={{ ...smallBtn('#1596cc'), textDecoration: 'none' }}>Public ↗</Link></div></form></Card>; }
function InvestorContacts({ investors }: any) { return <Card><h2 style={{ marginTop: 0 }}>Investor private contacts</h2><p style={{ background: '#FEF3D3', color: '#8a6400', padding: 12, borderRadius: 10, fontWeight: 600 }}>Admin-only. Không expose email, phone, website, real name ra public/business page nếu chưa qua privacy/connection rules.</p><div style={{ overflowX: 'auto' }}><table><thead><tr><th>Code</th><th>Private name</th><th>Email</th><th>Website</th><th>Phone</th><th>Visible</th></tr></thead><tbody>{investors.slice(0, 500).map((i: any) => <tr key={i.id}><td>{i.code}</td><td>{i.private_name || '-'}</td><td>{i.private_email || '-'}</td><td>{i.private_website || '-'}</td><td>{i.private_phone || '-'}</td><td>{String(i.visible)}</td></tr>)}</tbody></table></div></Card>; }
function Payments({ payments, markPayment }: any) { return <Card><h2 style={{ marginTop: 0 }}>Thanh toán</h2><p style={{ color: '#64748B' }}>Đơn chuyển khoản QR, SePay/PayPal/Stripe và duyệt/kích hoạt thủ công trong Beta.</p>{payments.length ? payments.map((p: any) => <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: '1px solid #F1F5F9', fontSize: 13.5 }}><b>{p.role || p.account_role || '-'}</b><span>{p.order_code || p.id}</span><span>{p.method || p.gateway || 'QR'}</span><span style={{ ...statusBadge(p.status), padding: '4px 10px', borderRadius: 7, fontWeight: 800, textAlign: 'center' }}>{p.status || 'pending'}</span><span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}><button onClick={() => markPayment(p, 'paid')} style={smallBtn('#16A34A')}>Xác nhận</button><button onClick={() => markPayment(p, 'rejected')} style={smallBtn('#DC2626')}>Từ chối</button></span></div>) : <Empty text="No payment orders." />}</Card>; }
function Promos({ promos, createPromo }: any) { return <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16 }}><Card><h2 style={{ marginTop: 0 }}>Tạo mã mới</h2><form onSubmit={createPromo} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><input name="code" placeholder="DEALS68BETA" required style={inputStyle()} /><input name="description" placeholder="Beta launch" style={inputStyle()} /><select name="role" defaultValue="business" style={inputStyle()}><option value="business">Business</option><option value="investor">Investor</option><option value="advisor">Advisor</option><option value="affiliate">Market Partner</option></select><input name="discount_pct" type="number" placeholder="20" required style={inputStyle()} /><input name="quota_total" type="number" placeholder="100" style={inputStyle()} /><input name="starts_at" type="date" style={inputStyle()} /><input name="ends_at" type="date" style={inputStyle()} /><button style={smallBtn()}>+ Tạo mã</button></form></Card><Card><h2 style={{ marginTop: 0 }}>Mã khuyến mãi</h2>{promos.map((p: any) => <div key={p.id || p.code} style={{ borderTop: '1px solid #F1F5F9', padding: '12px 0' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><b>{p.code}</b><span style={{ fontSize: 24, fontWeight: 800, color: '#F2B51D' }}>-{p.discount_pct || p.discountPercent || 0}%</span></div><div style={{ color: '#64748B', fontSize: 13 }}>{p.description || p.name} · {p.role || 'all'} · quota {p.quota_used || 0}/{p.quota_total || '∞'}</div></div>)}</Card></div>; }
function Quality({ criteria, saveCriterion }: any) { return <Card><h2 style={{ marginTop: 0 }}>Quality Criteria</h2>{criteria.length ? criteria.map((c: any) => <form key={c.id} onSubmit={(e) => saveCriterion(e, c)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px 90px 90px', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: '1px solid #F1F5F9' }}><input name="label_vi" defaultValue={c.label_vi || ''} style={inputStyle()} /><input name="label_en" defaultValue={c.label_en || ''} style={inputStyle()} /><input name="weight" type="number" defaultValue={c.weight || 0} style={inputStyle()} /><input name="sort_order" type="number" defaultValue={c.sort_order || 0} style={inputStyle()} /><label style={{ fontSize: 12, display: 'flex', gap: 5 }}><input name="active" type="checkbox" defaultChecked={c.active !== false} /> Active</label><button style={smallBtn()}>Save</button></form>) : <Empty text="No quality criteria." />}</Card>; }
function Requests({ requests, markRequest }: any) { return <Card><h2 style={{ marginTop: 0 }}>Data Requests</h2>{requests.length ? requests.map((r: any) => <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 0', borderTop: '1px solid #F1F5F9' }}><b style={{ flex: 1 }}>{r.businesses?.public_code || r.business_id} · {r.investors?.code || r.investor_id}</b><span style={{ color: '#64748B', fontSize: 13 }}>{Array.isArray(r.requested_items) ? r.requested_items.join(', ') : r.requested_items || 'IM/NDA'}</span><span style={{ ...statusBadge(r.status), padding: '4px 10px', borderRadius: 7, fontWeight: 800 }}>{r.status || 'requested'}</span><button onClick={() => markRequest(r, 'fulfilled')} style={smallBtn('#16A34A')}>Fulfilled</button><button onClick={() => markRequest(r, 'rejected')} style={smallBtn('#DC2626')}>Reject</button></div>) : <Empty text="No data requests." />}</Card>; }
function MarketPartners({ rows, approveProfile, hideProfile }: any) { return <Card><h2 style={{ marginTop: 0 }}>Market Partners</h2>{rows.length ? rows.map((p: any) => <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 0', borderTop: '1px solid #F1F5F9' }}><b style={{ flex: 1 }}>{p.display_name || p.email}</b><span style={{ ...statusBadge(p.status), padding: '4px 10px', borderRadius: 7, fontWeight: 800 }}>{p.status || 'pending'}</span><button onClick={() => approveProfile(p)} style={smallBtn('#16A34A')}>Approve</button><button onClick={() => hideProfile(p)} style={smallBtn('#DC2626')}>Hide</button></div>) : <Empty text="No Market Partner profiles." />}</Card>; }
function Logs({ logs }: any) { return <Card><h2 style={{ marginTop: 0 }}>Audit Logs</h2>{logs.length ? logs.map((a: any) => <div key={a.id || a.created_at} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr 2fr', gap: 12, padding: '10px 0', borderTop: '1px solid #F1F5F9', fontSize: 13 }}><span>{a.created_at ? new Date(a.created_at).toLocaleString('vi-VN') : '—'}</span><b>{a.action}</b><span>{a.entity_type}</span><span>{JSON.stringify(a.detail || {})}</span></div>) : <Empty text="No audit logs." />}</Card>; }
function Settings() { return <Card><h2 style={{ marginTop: 0 }}>Settings</h2><p style={{ color: '#64748B', lineHeight: 1.6 }}>SEO, imports, email queue, feature flags, security and system configuration will be connected to Supabase tables in the next implementation stage. This screen keeps the reference Admin layout and release checklist visible.</p><ul style={{ color: '#475569', lineHeight: 1.8 }}><li>Keep manual payment confirmation until webhooks are stable.</li><li>Keep investor private contacts admin-only.</li><li>Require admin review for sensitive business changes.</li></ul></Card>; }
