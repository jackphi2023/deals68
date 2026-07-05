import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DEFAULT_VALUATION_CONFIG, getActiveValuationConfig } from '../lib/valuationEngine';
import { INDUSTRY_TAXONOMY } from '../lib/industryTaxonomy';

type Row = Record<string, any>;

function pretty(obj: any) { return JSON.stringify(obj, null, 2); }
function parseJson(raw: string, fallback: any) { try { return JSON.parse(raw); } catch { return fallback; } }

export default function AdminValuation() {
  const { profile, loading, signOut } = useAuth();
  const [active, setActive] = useState<any>(null);
  const [history, setHistory] = useState<Row[]>([]);
  const [params, setParams] = useState(pretty(DEFAULT_VALUATION_CONFIG.params));
  const [industry, setIndustry] = useState(pretty(DEFAULT_VALUATION_CONFIG.industry));
  const [country, setCountry] = useState(pretty(DEFAULT_VALUATION_CONFIG.country));
  const [growthCurve, setGrowthCurve] = useState(pretty(DEFAULT_VALUATION_CONFIG.growth_curve));
  const [sizeBands, setSizeBands] = useState(pretty(DEFAULT_VALUATION_CONFIG.size_bands));
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const taxonomyRows = useMemo(() => INDUSTRY_TAXONOMY.map((x) => ({ ...x, multiple: (parseJson(industry, DEFAULT_VALUATION_CONFIG.industry) || {})[x.key] || DEFAULT_VALUATION_CONFIG.industry[x.key] })), [industry]);

  async function load() {
    setBusy(true); setErr('');
    try {
      const cfg = await getActiveValuationConfig();
      setActive(cfg);
      setParams(pretty(cfg.params));
      setIndustry(pretty(cfg.industry));
      setCountry(pretty(cfg.country));
      setGrowthCurve(pretty(cfg.growth_curve));
      setSizeBands(pretty(cfg.size_bands));
      const { data } = await supabase.from('valuation_config').select('id,version,is_active,updated_at,updated_by').order('version', { ascending: false }).limit(20);
      setHistory(data || []);
    } catch (e: any) { setErr(e?.message || 'Không tải được valuation config.'); }
    finally { setBusy(false); }
  }

  useEffect(() => { if (profile?.role === 'admin') load(); }, [profile?.role]);

  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr(''); setMsg('');
    const payload = {
      params: parseJson(params, null),
      industry: parseJson(industry, null),
      country: parseJson(country, null),
      growth_curve: parseJson(growthCurve, null),
      size_bands: parseJson(sizeBands, null)
    };
    if (!payload.params || !payload.industry || !payload.country || !payload.growth_curve || !payload.size_bands) {
      setErr('JSON chưa hợp lệ. Vui lòng kiểm tra các ô cấu hình.'); setBusy(false); return;
    }
    try {
      const rpc = await supabase.rpc('save_valuation_config', { config_payload: payload });
      if (rpc.error) throw rpc.error;
      setMsg('Đã lưu valuation_config version mới. Các benchmark mới sẽ dùng version active này.');
      await load();
    } catch (e: any) { setErr(e?.message || 'Không lưu được valuation config.'); }
    finally { setBusy(false); }
  }

  if (loading) return <section className="d68-admin-page"><div className="d68-admin-wrap"><div className="d68-admin-card">Loading...</div></div></section>;
  if (profile?.role !== 'admin') return <Navigate to="/login?next=/admin/valuation" replace />;

  return <section className="d68-admin-page">
    <header className="d68-admin-head"><div className="d68-admin-head__inner"><Link to="/"><img src="/assets/logo-nav.svg" alt="Deals68" /></Link><b>Admin · Valuation Config</b><span>👤 {profile.email || 'admin'}</span><button onClick={() => signOut()}>Thoát</button></div></header>
    <div className="d68-admin-wrap"><div className="d68-admin-title"><div><h1>Cấu hình định giá doanh nghiệp</h1><p>Admin chỉnh hệ số EV/EBITDA, EV/Revenue, quốc gia, tăng trưởng, quy mô và spread. Mỗi lần lưu tạo version mới để rollback.</p></div><div className="d68-admin-actions"><Link className="d68-admin-btn light" to="/admin">← Admin</Link><button className="d68-admin-btn" onClick={load}>{busy ? 'Loading...' : 'Refresh'}</button></div></div>
      {msg ? <div className="d68-admin-notice ok">{msg}</div> : null}{err ? <div className="d68-admin-notice err">{err}</div> : null}
      <div className="d68-admin-grid4"><div className="d68-admin-card"><div className="d68-admin-metric-label">Active version</div><div className="d68-admin-metric-value">v{active?.version || 1}</div></div><div className="d68-admin-card"><div className="d68-admin-metric-label">Industries</div><div className="d68-admin-metric-value">23</div></div><div className="d68-admin-card"><div className="d68-admin-metric-label">USD/VND</div><div className="d68-admin-metric-value">{active?.params?.usd_vnd || 25000}</div></div><div className="d68-admin-card"><div className="d68-admin-metric-label">Spread</div><div className="d68-admin-metric-value">±{Math.round((active?.params?.spread_high || 0.15) * 100)}%</div></div></div>

      <form onSubmit={save} className="d68-admin-card d68-admin-valuation-form"><h3>JSON cấu hình active</h3><p>Không hard-code benchmark trong frontend. Frontend chỉ preview; giá trị lưu nên tính bằng backend/RPC theo version active.</p><div className="d68-admin-form2"><label>Params<textarea className="d68-admin-input textarea" value={params} onChange={(e) => setParams(e.target.value)} /></label><label>Country factors<textarea className="d68-admin-input textarea" value={country} onChange={(e) => setCountry(e.target.value)} /></label><label>Growth curve<textarea className="d68-admin-input textarea" value={growthCurve} onChange={(e) => setGrowthCurve(e.target.value)} /></label><label>Size bands<textarea className="d68-admin-input textarea" value={sizeBands} onChange={(e) => setSizeBands(e.target.value)} /></label></div><label>Industry multiples<textarea className="d68-admin-input textarea d68-admin-valuation-textarea" value={industry} onChange={(e) => setIndustry(e.target.value)} /></label><button className="d68-admin-btn green" disabled={busy}>Lưu version mới</button></form>

      <div className="d68-admin-card"><h3>Chuẩn hóa ngành nghề/lĩnh vực</h3><p>Danh sách 23 nhóm ngành dùng chung cho Business, Investor, filter/list và SEO content.</p><div className="d68-admin-table-wrap"><table className="d68-admin-table"><thead><tr><th>Key</th><th>VI</th><th>EN</th><th>EV/EBITDA</th><th>EV/Revenue</th><th>SEO VI</th></tr></thead><tbody>{taxonomyRows.map((x) => <tr key={x.key}><td><code>{x.key}</code></td><td>{x.vi}</td><td>{x.en}</td><td>{x.multiple?.ebitda}</td><td>{x.multiple?.revenue}</td><td>{x.seoVi}</td></tr>)}</tbody></table></div></div>

      <div className="d68-admin-card"><h3>Version history</h3>{history.length ? <div className="d68-admin-table-wrap"><table className="d68-admin-table"><tbody>{history.map((h) => <tr key={h.id}><td>v{h.version}</td><td>{h.is_active ? 'active' : 'inactive'}</td><td>{h.updated_at ? new Date(h.updated_at).toLocaleString() : '—'}</td></tr>)}</tbody></table></div> : <p>Chưa có history hoặc migration chưa chạy.</p>}</div>
    </div>
  </section>;
}
