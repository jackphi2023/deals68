import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(''); setMsg('');
    const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${siteUrl}/reset-password` });
    setLoading(false);
    if (error) setErr(error.message);
    else setMsg('Nếu email tồn tại, hệ thống sẽ gửi link đặt lại mật khẩu. Vui lòng kiểm tra inbox/spam.');
  }
  return <section className="auth-page"><div className="auth-card card"><div className="card-body"><span className="badge-title blue">Deals68</span><h1>Quên mật khẩu</h1><p className="muted">Nhập email tài khoản để nhận link đặt lại mật khẩu.</p><form onSubmit={submit}><label>Email<input className="input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label><button className="btn blue block" disabled={loading}>{loading ? 'Đang gửi...' : 'Gửi link đặt lại'}</button>{msg&&<p className="notice ok">{msg}</p>}{err&&<p className="notice warn">{err}</p>}</form><div className="auth-links"><Link to="/login">Quay lại đăng nhập</Link></div></div></div></section>;
}
