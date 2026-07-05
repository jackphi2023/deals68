import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toLocalizedPath } from '../lib/i18nRoutes';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
function dashboardForRole(role?: string) {
  if (role === 'admin') return '/admin';
  if (role === 'business') return '/dashboard/business';
  if (role === 'investor') return '/dashboard/investor';
  if (role === 'affiliate') return '/dashboard/market-partner';
  return '/login';
}
function normalizeOtp(value: string) { return value.replace(/\D/g, '').slice(0, 6); }

export default function ResetPassword({ lang = 'vi' }: { lang?: Lang }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(''); setMsg('');
    const value = email.trim();
    const code = normalizeOtp(token);
    if (!value || !value.includes('@')) { setErr(T(lang, 'Vui lòng nhập email hợp lệ.', 'Please enter a valid email.')); return; }
    if (code.length !== 6) { setErr(T(lang, 'Vui lòng nhập mã OTP 6 số.', 'Please enter the 6-digit OTP.')); return; }
    if (password.length < 8) { setErr(T(lang, 'Mật khẩu cần tối thiểu 8 ký tự.', 'Password must be at least 8 characters.')); return; }
    if (password !== confirm) { setErr(T(lang, 'Mật khẩu xác nhận không khớp.', 'Password confirmation does not match.')); return; }
    setLoading(true);
    const { data, error: otpErr } = await supabase.auth.verifyOtp({ email: value, token: code, type: 'recovery' });
    if (otpErr) { setLoading(false); setErr(T(lang, 'Mã đặt lại không đúng hoặc đã hết hạn.', 'The reset code is incorrect or expired.')); return; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setLoading(false); setErr(error.message); return; }
    const uid = data.user?.id;
    const { data: prof } = uid ? await supabase.from('profiles').select('role').eq('id', uid).maybeSingle() : { data: null } as any;
    setLoading(false);
    setMsg(T(lang, 'Đã cập nhật mật khẩu. Đang chuyển vào dashboard...', 'Password updated. Redirecting to dashboard...'));
    setTimeout(() => navigate(toLocalizedPath(dashboardForRole(prof?.role), lang), { replace: true }), 900);
  }

  return <main className="d68-auth-page"><section className="d68-auth-card"><div className="d68-auth-head"><span>Deals68</span><h1>{T(lang, 'Đặt lại mật khẩu', 'Reset password')}</h1><p>{T(lang, 'Nhập email, mã OTP trong email và mật khẩu mới.', 'Enter your email, the OTP from your email and a new password.')}</p></div><form onSubmit={submit} className="d68-auth-form"><label><span>Email</span><input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label><label><span>{T(lang, 'Mã OTP đặt lại', 'Reset OTP code')}</span><input required inputMode="numeric" pattern="[0-9]*" maxLength={6} value={token} onChange={e => setToken(normalizeOtp(e.target.value))} placeholder="123456" autoComplete="one-time-code" /></label><label><span>{T(lang, 'Mật khẩu mới', 'New password')}</span><input required type="password" value={password} onChange={e => setPassword(e.target.value)} /></label><label><span>{T(lang, 'Xác nhận mật khẩu', 'Confirm password')}</span><input required type="password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label><button className="d68-auth-submit" disabled={loading}>{loading ? T(lang, 'Đang cập nhật...', 'Updating...') : T(lang, 'Đặt lại mật khẩu', 'Reset password')}</button>{msg && <div className="d68-auth-success">{msg}</div>}{err && <div className="d68-auth-error">{err}</div>}</form><p className="d68-auth-bottom"><Link to={toLocalizedPath('/login', lang)}>{T(lang, 'Đăng nhập', 'Log in')}</Link></p></section></main>;
}
