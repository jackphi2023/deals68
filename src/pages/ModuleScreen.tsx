import { Link, useLocation } from 'react-router-dom';
import { screenByPath, screenRegistry } from '../config/screenRegistry';
import { useAuth } from '../contexts/AuthContext';

function findScreen(pathname: string) {
  return (screenByPath as any)[pathname] || screenRegistry.find((s) => pathname.startsWith(s.path.replace('/:businessId','')));
}

export default function ModuleScreen() {
  const { pathname } = useLocation();
  const screen = findScreen(pathname);
  const { profile } = useAuth();
  if (!screen) return <section className="section"><div className="container empty">Screen not configured.</div></section>;
  const allowed = !screen.roles.includes('admin') || profile?.role === 'admin';
  return <section className="section"><div className="container">
    <div className="section-title">
      <div><span className="pill gold">{screen.group}</span><h1>{screen.title_vi}</h1><p className="muted">{screen.title_en}</p></div>
      <Link className="btn secondary" to="/">Deals68 Home</Link>
    </div>
    {!allowed && <div className="notice warn">Trang này cần quyền phù hợp. This screen requires the right role and will be enforced by Supabase RLS in production.</div>}
    <div className="grid2">
      <div className="dash">
        <h2>Luồng nghiệp vụ / Workflow</h2>
        <p>{screen.intent}</p>
        <div className="kpis">
          <div className="kpi"><b>{screen.roles.join(', ')}</b><span className="muted">Allowed roles</span></div>
          <div className="kpi"><b>RLS</b><span className="muted">Database protected</span></div>
          <div className="kpi"><b>Audit</b><span className="muted">Logged for admin</span></div>
        </div>
      </div>
      <div className="dash">
        <h2>Yêu cầu chính / Features</h2>
        <ul>{screen.features.map((f) => <li key={f}>{f}</li>)}</ul>
      </div>
    </div>
    <div className="dash" style={{marginTop:18}}>
      <h2>Production notes</h2>
      <p className="muted">Màn hình này nằm trong production route map để dev mở rộng theo module. Các thao tác dữ liệu thật dùng Supabase tables, storage buckets, RLS policies và seed scripts đi kèm trong thư mục <code>supabase/</code> và <code>scripts/</code>.</p>
    </div>
  </div></section>;
}
