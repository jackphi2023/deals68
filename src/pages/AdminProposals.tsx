import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { proposalStatusLabel, updateProposalStatus, type ProposalStatus } from '../lib/proposals';

type Row = Record<string, any>;
const statuses: ProposalStatus[] = ['sent', 'approved', 'declined', 'request_data', 'connected'];
function text(v: any) { return String(v ?? '').trim(); }
function dt(v: any) { const d = v ? new Date(v) : new Date(); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN'); }

export default function AdminProposals() {
  const { profile, loading, signOut } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function load() {
    if (profile?.role !== 'admin') return;
    setBusy(true); setError('');
    const { data, error } = await supabase
      .from('proposals')
      .select('id,business_id,investor_id,message,status,sent_at,updated_at,businesses(id,slug,company_name_private,title_vi,title_en,public_code),investors(id,code,private_name,title_vi,title_en,private_email)')
      .order('sent_at', { ascending: false })
      .limit(1000);
    setRows(data || []);
    setError(error?.message || '');
    setBusy(false);
  }
  useEffect(() => { if (profile?.role === 'admin') load(); }, [profile?.role]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (status && row.status !== status) return false;
    const key = [row.status, row.businesses?.company_name_private, row.businesses?.title_vi, row.businesses?.title_en, row.businesses?.public_code, row.investors?.private_name, row.investors?.title_vi, row.investors?.title_en, row.investors?.code, row.investors?.private_email].join(' ').toLowerCase();
    return !search.trim() || key.includes(search.toLowerCase());
  }), [rows, status, search]);

  async function mark(row: Row, next: ProposalStatus) {
    try { await updateProposalStatus(row.id, next); setMsg('Proposal updated.'); await load(); }
    catch (e: any) { setError(e?.message || 'Could not update proposal.'); }
  }

  if (loading) return <section className="d68-admin-page"><div className="d68-admin-wrap"><div className="d68-admin-card">Loading admin...</div></div></section>;
  if (profile?.role !== 'admin') return <Navigate to="/login?next=/admin/proposals" replace />;

  return <section className="d68-admin-page"><header className="d68-admin-head"><div className="d68-admin-head__inner"><Link to="/"><img src="/assets/logo-nav.svg" alt="Deals68" /></Link><b>Admin Proposals</b><span>👤 {profile.email || 'admin'}</span><button onClick={() => signOut()}>Thoát</button></div></header><div className="d68-admin-wrap"><div className="d68-admin-cols"><nav className="d68-admin-side"><Link to="/admin">📊 Tổng quan</Link><Link to="/admin/proposals" className="active">📨 Proposal</Link><Link to="/admin/businesses">🏢 Doanh nghiệp</Link><Link to="/admin/investors">📈 Nhà đầu tư</Link><Link to="/admin/data-requests">📂 Yêu cầu data</Link></nav><main><div className="d68-admin-title"><div><h1>Proposal Business → Investor</h1><p>Theo dõi toàn bộ proposal, trạng thái và link hồ sơ liên quan.</p></div><button onClick={load} className="d68-admin-btn">{busy ? 'Loading...' : 'Refresh'}</button></div>{msg ? <div className="d68-admin-notice ok">{msg}</div> : null}{error ? <div className="d68-admin-notice err">{error}</div> : null}<div className="d68-admin-form4 d68-admin-form-gap"><input className="d68-admin-input d68-admin-span2" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search DN / Investor / email / status..."/><select className="d68-admin-input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{statuses.map((s) => <option key={s} value={s}>{proposalStatusLabel(s, 'vi').label}</option>)}</select></div><div className="d68-admin-table-wrap"><table className="d68-admin-table"><thead><tr><th>Thời gian</th><th>Doanh nghiệp</th><th>Investor</th><th>Email</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map((row) => { const st = proposalStatusLabel(row.status, 'vi'); return <tr key={row.id}><td>{dt(row.sent_at)}</td><td><b>{text(row.businesses?.company_name_private) || 'Tên thật chưa có'}</b><br/><span className="d68-admin-badge warn">{row.businesses?.public_code || row.business_id}</span><br/>{row.businesses?.slug ? <Link to={`/businesses/${row.businesses.slug}`}>Public DN ↗</Link> : null}</td><td><b>{text(row.investors?.private_name) || text(row.investors?.title_vi) || row.investors?.code || row.investor_id}</b><br/><span>{row.investors?.title_vi || row.investors?.title_en || 'Public investor'}</span><br/>{row.investors?.code ? <Link to={`/investors/${row.investors.code}`}>Public Investor ↗</Link> : null}</td><td>{row.investors?.private_email || '—'}</td><td><span className={`d68-admin-badge ${st.cls === 'green' ? 'ok' : st.cls === 'red' ? 'err' : 'warn'}`}>{st.label}</span></td><td><div className="d68-admin-actions"><button className="d68-admin-btn green" onClick={() => mark(row, 'approved')}>Duyệt</button><button className="d68-admin-btn red" onClick={() => mark(row, 'declined')}>Bỏ qua</button><button className="d68-admin-btn blue" onClick={() => mark(row, 'connected')}>Connected</button></div></td></tr>; })}</tbody></table>{!filtered.length ? <div className="d68-admin-empty">No proposals.</div> : null}</div></main></div></div></section>;
}
