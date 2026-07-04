import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
type LoginRole = 'business' | 'investor' | 'advisor' | 'affiliate' | 'admin';

const roleDefs: { key: LoginRole; vi: string; en: string; register: string }[] = [
  { key: 'business', vi: 'Doanh nghiệp', en: 'Business', register: '/register/business' },
  { key: 'investor', vi: 'Nhà đầu tư', en: 'Investor', register: '/register/investor' },
  { key: 'advisor', vi: 'Cố vấn', en: 'Advisor', register: '/register/advisor' },
  { key: 'affiliate', vi: 'Đối tác thị trường', en: 'Market Partner', register: '/market-partner' }
];

function dashboardForRole(role?: string) {
  if (role === 'admin') return '/admin';
  if (role === 'business') return '/dashboard/business';
  if (role === 'investor') return '/dashboard/investor';
  if (role === 'advisor') return '/dashboard/advisor/profile';
  if (role === 'affiliate') return '/dashboard/market-partner';
  return '/';
}

function pillStyle(active: boolean): CSSProperties {
  return {
    flex: '1 1 auto',
    whiteSpace: 'nowrap',
    padding: '10px 8px',
    border: 'none',
    borderRadius: 9,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: active ? 700 : 500,
    background: active ? '#fff' : 'transparent',
    color: active ? '#0F2A4A' : '#64748B',
    boxShadow: active ? '0 1px 3px rgba(15,42,74,.12)' : 'none'
  };
}

const inputStyle: CSSProperties = {
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  padding: '12px 13px',
  fontSize: 15,
  color: '#0F2A4A',
  background: '#F7FAFC',
  fontWeight: 500,
  outline: 'none',
  width: '100%'
};

export default function Login({ lang = 'vi' }: { lang?: Lang }) {
  const { signIn, profile } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialRole = (params.get('role') || 'business') as LoginRole;
  const [role, setRole] = useState<LoginRole>(roleDefs.some((r) => r.key === initialRole) ? initialRole : 'business');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [gated, setGated] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState(false);
  const next = params.get('next');

  const currentRole = useMemo(() => roleDefs.find((r) => r.key === role) || roleDefs[0], [role]);
  const userFieldLabel = role === 'business' ? T(lang, 'Tên đăng nhập hoặc email', 'Username or email') : 'Email';
  const userFieldPlaceholder = role === 'business' ? T(lang, 'Tên đăng nhập / email', 'Username / email') : 'email@example.com';

  useEffect(() => {
    if (pendingRedirect && profile) navigate(next || dashboardForRole(profile.role), { replace: true });
  }, [pendingRedirect, profile, navigate, next]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    setGated(false);
    const r = await signIn(email.trim(), password);
    setLoading(false);
    if (r.error) { setErr(r.error); return; }
    if (next) navigate(next, { replace: true });
    else setPendingRedirect(true);
  }

  return <section style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: '#F7FAFC' }}>
    <div style={{ width: '100%', maxWidth: 480 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -.6, margin: '0 0 6px' }}>{T(lang, 'Đăng nhập Deals68', 'Log in to Deals68')}</h1>
        <p style={{ fontSize: 14.5, color: '#64748B', margin: 0 }}>{T(lang, 'Chọn vai trò và đăng nhập vào tài khoản của bạn.', 'Choose your role and sign in to your account.')}</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, background: '#EEF2F6', borderRadius: 12, padding: 4, marginBottom: 20 }}>
        {roleDefs.map((r) => <button type="button" key={r.key} onClick={() => { setRole(r.key); setErr(''); setGated(false); }} style={pillStyle(role === r.key)}>{T(lang, r.vi, r.en)}</button>)}
      </div>

      {gated ? <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 30, boxShadow: '0 1px 2px rgba(15,42,74,.04)', textAlign: 'center' }}>
        <div style={{ fontSize: 38, marginBottom: 12 }}>⏳</div>
        <h2 style={{ fontSize: 18.5, fontWeight: 800, margin: '0 0 10px' }}>{T(lang, 'Hồ sơ đang chờ Admin duyệt', 'Profile pending Admin review')}</h2>
        <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: '0 0 16px' }}>{T(lang, 'Dashboard sẽ mở sau khi thanh toán hoặc hồ sơ được Admin duyệt.', 'The dashboard opens after payment or Admin approval.')}</p>
        <button type="button" onClick={() => setGated(false)} style={{ background: '#EEF2F6', color: '#334155', fontWeight: 700, fontSize: 14, padding: '11px 22px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>{T(lang, 'Quay lại đăng nhập', 'Back to log in')}</button>
      </div> : <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 28, boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>{userFieldLabel}</span>
            <input required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={userFieldPlaceholder} style={inputStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>{T(lang, 'Mật khẩu', 'Password')}</span>
              <Link to={`/forgot-password?role=${role}`} style={{ fontSize: 12.5, fontWeight: 600, color: '#1596cc' }}>{T(lang, 'Quên mật khẩu?', 'Forgot password?')}</Link>
            </div>
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
          </label>
          {err ? <div style={{ background: '#FDECEC', border: '1px solid #F8B4B4', color: '#B91C1C', fontSize: 13, fontWeight: 600, padding: '11px 14px', borderRadius: 10 }}>⚠ {err}</div> : null}
          <button type="submit" disabled={loading} style={{ background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 15.5, padding: 13, borderRadius: 11, border: 'none', cursor: loading ? 'wait' : 'pointer', marginTop: 4 }}>{loading ? T(lang, 'Đang đăng nhập...', 'Logging in...') : T(lang, 'Đăng nhập', 'Log in')}</button>
        </form>
      </div>}

      <p style={{ textAlign: 'center', fontSize: 13.5, color: '#64748B', marginTop: 18 }}>
        {T(lang, 'Chưa có tài khoản?', 'No account yet?')} <Link to={currentRole.register} style={{ fontWeight: 700, color: '#1596cc' }}>{T(lang, `Đăng ký ${currentRole.vi}`, 'Register')}</Link>
      </p>
    </div>
  </section>;
}
