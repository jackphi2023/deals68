import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toLocalizedPath } from '../lib/i18nRoutes';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

type LoginRole = 'business' | 'investor' | 'affiliate' | 'admin';
type LoginRoleDef = { key: LoginRole; vi: string; en: string; register?: string };

const publicRoleDefs: LoginRoleDef[] = [
  { key: 'business', vi: 'Doanh nghiệp', en: 'Business', register: '/register/business' },
  { key: 'investor', vi: 'Nhà đầu tư', en: 'Investor', register: '/register/investor' },
  { key: 'affiliate', vi: 'Đối tác thị trường', en: 'Market Partner', register: '/market-partner' }
];
const adminRole: LoginRoleDef = { key: 'admin', vi: 'Admin', en: 'Admin' };

function dashboardForRole(role?: string) {
  if (role === 'admin') return '/admin';
  if (role === 'business') return '/dashboard/business';
  if (role === 'investor') return '/dashboard/investor';
  if (role === 'affiliate') return '/dashboard/market-partner';
  return '/';
}
function isEmailNotConfirmed(error: { error?: string; code?: string; status?: number }) {
  const text = `${error.code || ''} ${error.error || ''}`.toLowerCase();
  return text.includes('email_not_confirmed') || text.includes('email not confirmed') || text.includes('not confirmed');
}
function normalizeOtp(value: string) {
  return value.replace(/\D/g, '').slice(0, 6);
}

export default function Login({ lang = 'vi' }: { lang?: Lang }) {
  const { signIn, profile, refreshProfile } = useAuth();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdminLogin = location.pathname.includes('/admin/login');
  const roleDefs = useMemo<LoginRoleDef[]>(() => isAdminLogin ? [adminRole] : publicRoleDefs, [isAdminLogin]);
  const initialRole = (isAdminLogin ? 'admin' : (params.get('role') || 'business')) as LoginRole;
  const initialEmail = params.get('email') || '';
  const signupOtp = params.get('otp') === '1' || params.get('verify') === 'signup';
  const fromSignup = params.get('signup') === '1';

  const [role, setRole] = useState<LoginRole>(roleDefs.some((r) => r.key === initialRole) ? initialRole : roleDefs[0].key);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpMode, setOtpMode] = useState(signupOtp && !isAdminLogin);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const next = params.get('next');
  const currentRole = useMemo(() => roleDefs.find((r) => r.key === role) || roleDefs[0], [role, roleDefs]);
  const userFieldLabel = role === 'business' ? T(lang, 'Tên đăng nhập hoặc email', 'Username or email') : 'Email';
  const userFieldPlaceholder = role === 'business' ? T(lang, 'Tên đăng nhập / email', 'Username / email') : 'email@example.com';

  useEffect(() => {
    if (fromSignup && signupOtp) {
      setInfo(T(lang, 'Hãy nhập mã OTP đã gửi đến Email của Anh/Chị dưới đây.', 'Enter the OTP code sent to your email below.'));
    }
  }, [fromSignup, signupOtp, lang]);

  useEffect(() => {
    if (!cooldown) return;
    const t = window.setTimeout(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (pendingRedirect && profile) navigate(next || dashboardForRole(profile.role), { replace: true });
  }, [pendingRedirect, profile, navigate, next]);

  useEffect(() => {
    if (!roleDefs.some((r) => r.key === role)) setRole(roleDefs[0].key);
  }, [roleDefs, role]);

  async function activateDashboardAfterOtp(userId: string) {
    const patch = { dashboard_login_enabled: true, status: 'pending_admin_review' };
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('*').maybeSingle();
    if (error) {
      await supabase.from('profiles').update({ dashboard_login_enabled: true }).eq('id', userId).catch(() => undefined);
    }
    await refreshProfile();
    return data as any;
  }

  async function submitOtp(e?: FormEvent) {
    e?.preventDefault();
    setErr(''); setInfo('');
    const value = email.trim();
    const token = normalizeOtp(otp);
    if (!value || !value.includes('@')) { setErr(T(lang, 'Vui lòng nhập email hợp lệ.', 'Please enter a valid email.')); return; }
    if (token.length !== 6) { setErr(T(lang, 'Vui lòng nhập mã OTP 6 số đã gửi tới email.', 'Please enter the 6-digit OTP sent to your email.')); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({ email: value, token, type: 'signup' });
    if (error) {
      setLoading(false);
      setErr(T(lang, 'Mã OTP không đúng hoặc đã hết hạn. Anh/Chị có thể bấm Gửi lại mã.', 'The OTP is incorrect or expired. You can resend a new code.'));
      return;
    }
    const row = data.user?.id ? await activateDashboardAfterOtp(data.user.id).catch(() => null) : null;
    setLoading(false);
    navigate(next || dashboardForRole(row?.role || role), { replace: true });
  }

  async function resendOtp() {
    const value = email.trim();
    if (!value || !value.includes('@')) { setErr(T(lang, 'Vui lòng nhập email để gửi lại mã.', 'Please enter your email to resend the code.')); return; }
    setErr(''); setInfo(''); setLoading(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email: value });
    setLoading(false);
    if (error) setErr(error.message);
    else { setInfo(T(lang, 'Đã gửi lại mã OTP. Vui lòng kiểm tra email.', 'OTP resent. Please check your email.')); setCooldown(60); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (otpMode) return submitOtp(e);
    setLoading(true); setErr(''); setInfo('');
    const result = await signIn(email.trim(), password);
    setLoading(false);
    if (result.error) {
      if (!isAdminLogin && isEmailNotConfirmed(result)) {
        setOtpMode(true);
        setInfo(T(lang, 'Hãy nhập mã OTP đã gửi đến Email của Anh/Chị dưới đây.', 'Enter the OTP code sent to your email below.'));
        return;
      }
      setErr(T(lang, 'Sai email hoặc mật khẩu.', 'Incorrect email or password.'));
      return;
    }
    if (next) navigate(next, { replace: true });
    else setPendingRedirect(true);
  }

  return (
    <main className="d68-auth-page">
      <section className="d68-auth-card">
        <div className="d68-auth-head">
          <span>{isAdminLogin ? 'Admin' : otpMode ? 'Email OTP' : 'Deals68'}</span>
          <h1>{isAdminLogin ? 'Admin Login' : otpMode ? T(lang, 'Xác thực email để vào Dashboard', 'Verify email to enter Dashboard') : T(lang, 'Đăng nhập Deals68', 'Log in to Deals68')}</h1>
          <p>
            {isAdminLogin
              ? 'Admin truy cập qua URL riêng.'
              : otpMode
                ? T(lang, 'Hãy nhập mã OTP đã gửi đến Email của Anh/Chị dưới đây.', 'Enter the OTP code sent to your email below.')
                : T(lang, 'Đăng nhập vào tài khoản Doanh nghiệp, Nhà đầu tư hoặc Đối tác thị trường.', 'Sign in to your Business, Investor or Market Partner account.')}
          </p>
        </div>

        {!isAdminLogin ? (
          <div className="d68-auth-tabs">
            {roleDefs.map((r) => (
              <button type="button" key={r.key} onClick={() => { setRole(r.key); setErr(''); }} className={role === r.key ? 'active' : ''}>
                {T(lang, r.vi, r.en)}
              </button>
            ))}
          </div>
        ) : null}

        <form onSubmit={submit} className="d68-auth-form">
          <label>
            <span>{userFieldLabel}</span>
            <input required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={userFieldPlaceholder} autoComplete="email" />
          </label>

          <label>
            <span>{T(lang, 'Mật khẩu', 'Password')}</span>
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </label>

          {otpMode ? <label className="d68-auth-otp-field"><span>{T(lang, 'Mã OTP trong email', 'Email OTP code')}</span><input required inputMode="numeric" pattern="[0-9]*" maxLength={6} value={otp} onChange={(e) => setOtp(normalizeOtp(e.target.value))} placeholder="123456" autoComplete="one-time-code" /></label> : null}

          <div className="d68-auth-row">
            <Link to={toLocalizedPath(`/forgot-password?role=${role}`, lang)}>{T(lang, 'Quên mật khẩu?', 'Forgot password?')}</Link>
          </div>

          {info ? <div className="d68-auth-success d68-auth-success--inline">{info}</div> : null}
          {err ? <div className="d68-auth-error">⚠ {err}</div> : null}

          <button className="d68-auth-submit" disabled={loading}>
            {loading ? T(lang, 'Đang xử lý...', 'Processing...') : otpMode ? T(lang, 'Xác thực OTP & vào Dashboard', 'Verify OTP & enter Dashboard') : T(lang, 'Đăng nhập', 'Log in')}
          </button>

          {otpMode ? <button type="button" className="d68-auth-ghost" onClick={resendOtp} disabled={loading || cooldown > 0}>{cooldown > 0 ? T(lang, `Gửi lại sau ${cooldown}s`, `Resend in ${cooldown}s`) : T(lang, 'Gửi lại mã OTP', 'Resend OTP')}</button> : null}
        </form>

        {!isAdminLogin && currentRole.register ? (
          <p className="d68-auth-bottom">
            {T(lang, 'Chưa có tài khoản?', 'No account yet?')}{' '}
            <Link to={toLocalizedPath(currentRole.register, lang)}>{T(lang, `Đăng ký ${currentRole.vi}`, 'Register')}</Link>
          </p>
        ) : null}
      </section>
    </main>
  );
}
