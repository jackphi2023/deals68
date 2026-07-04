import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
type Role = 'business' | 'investor' | 'advisor' | 'affiliate';

const inputStyle = {
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  padding: '12px 13px',
  fontSize: 15,
  color: '#0F2A4A',
  background: '#F7FAFC',
  fontWeight: 500,
  outline: 'none',
  width: '100%'
} as const;

function roleLabel(lang: Lang, role: Role) {
  const map: Record<Role, [string, string]> = {
    business: ['Doanh nghiệp', 'Business'],
    investor: ['Nhà đầu tư', 'Investor'],
    advisor: ['Cố vấn', 'Advisor'],
    affiliate: ['Đối tác thị trường', 'Market Partner']
  };
  const item = map[role] || map.business;
  return T(lang, item[0], item[1]);
}

export default function ForgotPassword({ lang = 'vi' }: { lang?: Lang }) {
  const [params] = useSearchParams();
  const initialRole = (params.get('role') || 'business') as Role;
  const role: Role = ['business', 'investor', 'advisor', 'affiliate'].includes(initialRole) ? initialRole : 'business';
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const loginHref = useMemo(() => `/login?role=${role}`, [role]);
  const label = T(lang, 'Email tài khoản', 'Account email');
  const description = T(
    lang,
    `Nhập email tài khoản ${roleLabel(lang, role)} để nhận liên kết đặt lại mật khẩu.`,
    `Enter the email of your ${roleLabel(lang, role)} account to receive a reset link.`
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const value = email.trim();
    if (!value) { setErr(T(lang, 'Vui lòng nhập email.', 'Please enter your email.')); return; }
    if (!value.includes('@')) { setErr(T(lang, 'Vui lòng nhập email đăng nhập để nhận liên kết đặt lại mật khẩu.', 'Please enter the login email to receive a reset link.')); return; }
    setLoading(true);
    const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(value, { redirectTo: `${siteUrl}/reset-password` });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    setSent(true);
  }

  return <section style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: '#F7FAFC' }}>
    <div style={{ width: '100%', maxWidth: 440 }}>
      {!sent ? <>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -.6, margin: '0 0 6px' }}>{T(lang, 'Quên mật khẩu', 'Forgot password')}</h1>
          <p style={{ fontSize: 14.5, color: '#64748B', margin: 0 }}>{description}</p>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 28, boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>{label}</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" type="email" autoComplete="email" style={inputStyle} />
            </label>
            {err ? <div style={{ background: '#FDECEC', border: '1px solid #F8B4B4', color: '#B91C1C', fontSize: 13, fontWeight: 600, padding: '11px 14px', borderRadius: 10 }}>⚠ {err}</div> : null}
            <button disabled={loading} style={{ background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 15.5, padding: 13, borderRadius: 11, border: 'none', cursor: loading ? 'wait' : 'pointer' }}>
              {loading ? T(lang, 'Đang gửi...', 'Sending...') : T(lang, 'Gửi liên kết đặt lại', 'Send reset link')}
            </button>
          </form>
        </div>
      </> : <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 32, textAlign: 'center', boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}>
        <div style={{ fontSize: 38, marginBottom: 14 }}>📩</div>
        <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 8px' }}>{T(lang, 'Đã gửi liên kết đặt lại', 'Reset link sent')}</h2>
        <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: '0 0 20px' }}>{T(lang, `Nếu tài khoản ${email.trim()} tồn tại, một email chứa liên kết đặt lại mật khẩu đã được gửi đi. Vui lòng kiểm tra hộp thư và thư rác.`, `If the account ${email.trim()} exists, an email with a password reset link has been sent. Please check your inbox and spam folder.`)}</p>
        <Link to={loginHref} style={{ fontSize: 13.5, fontWeight: 600, color: '#334155' }}>← {T(lang, 'Quay lại Đăng nhập', 'Back to log in')}</Link>
      </div>}
      {!sent ? <p style={{ textAlign: 'center', fontSize: 13.5, color: '#64748B', marginTop: 18 }}><Link to={loginHref} style={{ fontWeight: 700, color: '#1596cc' }}>← {T(lang, 'Quay lại Đăng nhập', 'Back to log in')}</Link></p> : null}
    </div>
  </section>;
}
