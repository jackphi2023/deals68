import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toLocalizedPath } from '../lib/i18nRoutes';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
type LoginRole = 'business' | 'investor' | 'affiliate' | 'admin';
const publicRoleDefs: { key: LoginRole; vi: string; en: string; register?: string }[] = [
  { key: 'business', vi: 'Doanh nghiệp', en: 'Business', register: '/register/business' },
  { key: 'investor', vi: 'Nhà đầu tư', en: 'Investor', register: '/register/investor' },
  { key: 'affiliate', vi: 'Đối tác thị trường', en: 'Market Partner', register: '/market-partner' }
];
const adminRole = { key: 'admin' as LoginRole, vi: 'Admin', en: 'Admin' };

function dashboardForRole(role?: string) {
  if (role === 'admin') return '/admin';
  if (role === 'business') return '/dashboard/business';
  if (role === 'investor') return '/dashboard/investor';
  if (role === 'affiliate') return '/dashboard/market-partner';
  return '/';
}

export default function Login({ lang = 'vi' }: { lang?: Lang }) {
  const { signIn, profile } = useAuth();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminLogin = location.pathname.includes('/admin/login');
  const roleDefs = isAdminLogin ? [adminRole] : publicRoleDefs;
  const initialRole = (isAdminLogin ? 'admin' : (params.get('role') || 'business')) as LoginRole;
  const [role, setRole] = useState<LoginRole>(roleDefs.some((r) => r.key === initialRole) ? initialRole : roleDefs[0].key);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState(false);
  const next = params.get('next');
  const currentRole = useMemo(() => roleDefs.find((r) => r.key === role) || roleDefs[0], [role, roleDefs]);
  const userFieldLabel = role === 'business' ? T(lang, 'Tên đăng nhập hoặc email', 'Username or email') : 'Email';
  const userFieldPlaceholder = role === 'business' ? T(lang, 'Tên đăng nhập / email', 'Username / email') : 'email@example.com';

  useEffect(() => { if (pendingRedirect && profile) navigate(next || dashboardForRole(profile.role), { replace: true }); }, [pendingRedirect, profile, navigate, next]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setErr('');
    const r = await signIn(email.trim(), password);
    setLoading(false);
    if (r.error) { setErr(r.error); return; }
    if (next) navigate(next, { replace: true }); else setPendingRedirect(true);
  }

  return <main className="d68-auth-page"><section className="d68-auth-card">
    <div className="d68-auth-head"><span>{isAdminLogin ? 'Admin' : 'Deals68'}</span><h1>{isAdminLogin ? 'Admin Login' : T(lang, 'Đăng nhập Deals68', 'Log in to Deals68')}</h1><p>{isAdminLogin ? 'Admin truy cập qua URL riêng.' : T(lang, 'Đăng nhập vào tài khoản Doanh nghiệp, Nhà đầu tư hoặc Đối tác thị trường.', 'Sign in to your Business, Investor or Market Partner account.')}</p></div>
    {!isAdminLogin ? <div className="d68-auth-tabs">{roleDefs.map((r) => <button type="button" key={r.key} onClick={() => { setRole(r.key); setErr(''); }} className={role === r.key ? 'active' : ''}>{T(lang, r.vi, r.en)}</button>)}</div> : null}
    <form onSubmit={submit} className="d68-auth-form"><label><span>{userFieldLabel}</span><input required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={userFieldPlaceholder} autoComplete="email" /></label><label><span>{T(lang, 'Mật khẩu', 'Password')}</span><input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" /></label><div className="d68-auth-row"><Link to={toLocalizedPath(`/forgot-password?role=${role}`, lang)}>{T(lang, 'Quên mật khẩu?', 'Forgot password?')}</Link></div>{err ? <div className="d68-auth-error">⚠ {err}</div> : null}<button className="d68-auth-submit" disabled={loading}>{loading ? T(lang, 'Đang đăng nhập...', 'Logging in...') : T(lang, 'Đăng nhập', 'Log in')}</button></form>
    {!isAdminLogin && currentRole.register ? <p className="d68-auth-bottom">{T(lang, 'Chưa có tài khoản?', 'No account yet?')} <Link to={toLocalizedPath(currentRole.register, lang)}>{T(lang, `Đăng ký ${currentRole.vi}`, 'Register')}</Link></p> : null}
  </section></main>;
}
