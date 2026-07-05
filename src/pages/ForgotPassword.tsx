import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toLocalizedPath } from '../lib/i18nRoutes';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
type Role = 'business' | 'investor' | 'advisor' | 'affiliate';
function roleLabel(lang: Lang, role: Role) { const map: Record<Role, [string,string]> = { business: ['Doanh nghiệp','Business'], investor: ['Nhà đầu tư','Investor'], advisor: ['Cố vấn','Advisor'], affiliate: ['Đối tác thị trường','Market Partner'] }; return T(lang, ...(map[role] || map.business)); }
export default function ForgotPassword({ lang = 'vi' }: { lang?: Lang }) {
  const [params] = useSearchParams();
  const initialRole = (params.get('role') || 'business') as Role;
  const role: Role = ['business','investor','advisor','affiliate'].includes(initialRole) ? initialRole : 'business';
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);
  const loginHref = useMemo(() => toLocalizedPath(`/login?role=${role}`, lang), [role, lang]);
  async function submit(e: FormEvent) { e.preventDefault(); setErr(''); const value = email.trim(); if (!value || !value.includes('@')) { setErr(T(lang, 'Vui lòng nhập email đăng nhập hợp lệ.', 'Please enter a valid login email.')); return; } setLoading(true); const siteUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, ''); const { error } = await supabase.auth.resetPasswordForEmail(value, { redirectTo: `${siteUrl}${toLocalizedPath('/reset-password', lang)}` }); setLoading(false); if (error) { setErr(error.message); return; } setSent(true); }
  return <main className="d68-auth-page"><section className="d68-auth-card"><div className="d68-auth-head"><span>Deals68</span><h1>{T(lang, 'Quên mật khẩu', 'Forgot password')}</h1><p>{T(lang, `Nhập email tài khoản ${roleLabel(lang, role)} để nhận liên kết đặt lại mật khẩu.`, `Enter the email of your ${roleLabel(lang, role)} account to receive a reset link.`)}</p></div>{!sent ? <form onSubmit={submit} className="d68-auth-form"><label><span>{T(lang, 'Email tài khoản', 'Account email')}</span><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" type="email" autoComplete="email" /></label>{err ? <div className="d68-auth-error">⚠ {err}</div> : null}<button className="d68-auth-submit" disabled={loading}>{loading ? T(lang, 'Đang gửi...', 'Sending...') : T(lang, 'Gửi liên kết đặt lại', 'Send reset link')}</button></form> : <div className="d68-auth-success"><b>📩</b><h2>{T(lang, 'Đã gửi liên kết đặt lại', 'Reset link sent')}</h2><p>{T(lang, `Nếu tài khoản ${email.trim()} tồn tại, email đặt lại mật khẩu đã được gửi.`, `If the account ${email.trim()} exists, a reset email has been sent.`)}</p></div>}<p className="d68-auth-bottom"><Link to={loginHref}>← {T(lang, 'Quay lại Đăng nhập', 'Back to log in')}</Link></p></section></main>;
}
