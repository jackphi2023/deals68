import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function dashboardForRole(role?: string) {
  if (role === 'admin') return '/admin';
  if (role === 'business') return '/dashboard/business';
  if (role === 'investor') return '/dashboard/investor';
  if (role === 'advisor') return '/dashboard/advisor/profile';
  if (role === 'affiliate') return '/dashboard/market-partner';
  return '/';
}

export default function Login() {
  const { signIn, profile } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState(false);
  const next = params.get('next');

  useEffect(() => {
    if (pendingRedirect && profile) navigate(next || dashboardForRole(profile.role), { replace: true });
  }, [pendingRedirect, profile, navigate, next]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    const r = await signIn(email.trim(), password);
    setLoading(false);
    if (r.error) { setErr(r.error); return; }
    if (next) navigate(next, { replace: true });
    else setPendingRedirect(true);
  }

  return <section className="auth-page">
    <div className="auth-card card">
      <div className="card-body">
        <span className="badge-title blue">Deals68</span>
        <h1>Đăng nhập / Login</h1>
        <p className="muted">Dùng email hoặc username đã tạo. Admin sử dụng cùng trang đăng nhập nhưng được điều hướng về dashboard riêng.</p>
        <form onSubmit={submit}>
          <label>Email hoặc username<input className="input" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@deals68.com / hkmedi / inv_0001" /></label>
          <label>Mật khẩu<input className="input" required type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" /></label>
          <button className="btn blue block" type="submit" disabled={loading}>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
          {err && <p className="notice warn">{err}</p>}
        </form>
        <div className="auth-links">
          <Link to="/forgot-password">Quên mật khẩu?</Link>
          <Link to="/pricing">Tạo tài khoản mới</Link>
        </div>
        <div className="notice small-note">Test seed: admin@deals68.com / deals68Admin68!, hkmedi / deals687U8, inv_0001 / deals68MDE.</div>
      </div>
    </div>
  </section>;
}
