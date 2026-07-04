import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(''); setMsg('');
    if (password.length < 8) { setErr('Mật khẩu cần tối thiểu 8 ký tự.'); return; }
    if (password !== confirm) { setErr('Mật khẩu xác nhận không khớp.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setErr(error.message);
    else { setMsg('Đã cập nhật mật khẩu. Đang chuyển về đăng nhập...'); setTimeout(()=>navigate('/login'), 900); }
  }
  return <section className="auth-page"><div className="auth-card card"><div className="card-body"><span className="badge-title blue">Deals68</span><h1>Đặt lại mật khẩu</h1><p className="muted">Nhập mật khẩu mới sau khi mở link từ email.</p><form onSubmit={submit}><label>Mật khẩu mới<input className="input" required type="password" value={password} onChange={e=>setPassword(e.target.value)} /></label><label>Xác nhận mật khẩu<input className="input" required type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} /></label><button className="btn blue block" disabled={loading}>{loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}</button>{msg&&<p className="notice ok">{msg}</p>}{err&&<p className="notice warn">{err}</p>}</form><div className="auth-links"><Link to="/login">Đăng nhập</Link></div></div></div></section>;
}
