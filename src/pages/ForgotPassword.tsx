import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toLocalizedPath } from '../lib/i18nRoutes';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
type Role = 'business' | 'investor' | 'advisor' | 'affiliate';
function roleLabel(lang: Lang, role: Role) {
  const map: Record<Role, [string, string]> = { business: ['Doanh nghiệp', 'Business'], investor: ['Nhà đầu tư', 'Investor'], advisor: ['Cố vấn', 'Advisor'], affiliate: ['Đối tác thị trường', 'Market Partner'] };
  return T(lang, ...(map[role] || map.business));
}

export default function ForgotPassword({ lang = 'vi' }: { lang?: Lang }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialRole = (params.get('role') || 'business') as Role;
  const role: Role = ['business', 'investor', 'advisor', 'affiliate'].includes(initialRole) ? initialRole : 'business';
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const loginHref = useMemo(() => toLocalizedPath(`/login?role=${role}`, lang), [role, lang]);
  const resetHref = useMemo(() => toLocalizedPath(`/reset-password?role=${role}&email=${encodeURIComponent(email.trim())}`, lang), [role, email, lang]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const value = email.trim();
    if (!value || !value.includes('@')) { setErr(T(lang, 'Vui lòng nhập email đăng nhập hợp lệ.', 'Please enter a valid login email.')); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(value);
    setLoading(false);
    if (error) { setErr(error.message); return; }
    setSent(true);
  }

  return <main className="d68-auth-page"><section className="d68-auth-card"><div className="d68-auth-head"><span>Deals68</span><h1>{T(lang, 'Quên mật khẩu', 'Forgot password')}</h1><p>{T(lang, `Nhập email tài khoản ${roleLabel(lang, role)} để nhận mã OTP đặt lại mật khẩu.`, `Enter the email of your ${roleLabel(lang, role)} account to receive a password reset OTP.`)}</p></div>{!sent ? <form onSubmit={submit} className="d68-auth-form"><label><span>{T(lang, 'Email tài khoản', 'Account email')}</span><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" type="email" autoComplete="email" /></label>{err ? <div className="d68-auth-error">⚠ {err}</div> : null}<button className="d68-auth-submit" disabled={loading}>{loading ? T(lang, 'Đang gửi...', 'Sending...') : T(lang, 'Gửi mã đặt lại', 'Send reset code')}</button></form> : <div className="d68-auth-success"><b>📩</b><h2>{T(lang, 'Đã gửi mã đặt lại', 'Reset code sent')}</h2><p>{T(lang, `Nếu tài khoản ${email.trim()} tồn tại, mã đặt lại mật khẩu đã được gửi. Hãy kiểm tra cả hòm thư Spam/Quảng cáo nếu email không vào trực tiếp Inbox.`, `If the account ${email.trim()} exists, a reset code has been sent. Please also check your Spam/Promotions folder if the email does not arrive in your Inbox.`)}</p><button type="button" className="d68-auth-submit" onClick={() => navigate(resetHref)}>{T(lang, 'Nhập mã & đặt mật khẩu mới', 'Enter code & set new password')}</button></div>}<p className="d68-auth-bottom"><Link to={loginHref}>← {T(lang, 'Quay lại Đăng nhập', 'Back to log in')}</Link></p></section></main>;
}
