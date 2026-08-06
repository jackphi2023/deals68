import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toLocalizedPath } from '../lib/i18nRoutes';
import {
  completeAdvisorEmailVerification,
  normalizeAdvisorOtp,
  safeAdvisorNext,
} from '../lib/advisorAuth';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

function isEmailNotConfirmed(error: { error?: string; code?: string }) {
  const text = `${error.code || ''} ${error.error || ''}`.toLowerCase();
  return text.includes('email_not_confirmed') || text.includes('email not confirmed') || text.includes('not confirmed');
}

export default function AdvisorLogin({ lang = 'vi' }: { lang?: Lang }) {
  const { signIn, signOut, refreshProfile } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(params.get('email') || '');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpMode, setOtpMode] = useState(params.get('otp') === '1' || params.get('verify') === 'signup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const next = safeAdvisorNext(params.get('next'), lang);
  const fromSignup = params.get('signup') === '1';

  useEffect(() => {
    if (fromSignup && otpMode) {
      setInfo(T(lang, 'Nhập mã OTP 6 số đã gửi tới email. Hãy kiểm tra cả Spam/Quảng cáo.', 'Enter the 6-digit OTP sent to your email. Please also check Spam/Promotions.'));
    }
  }, [fromSignup, otpMode, lang]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function assertAdvisorRole(userId: string) {
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('role,status,dashboard_login_enabled')
      .eq('id', userId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (data?.role !== 'advisor') {
      await signOut().catch(() => undefined);
      throw new Error('advisor_role_required');
    }
    return data;
  }

  async function submitOtp(event?: FormEvent) {
    event?.preventDefault();
    setError('');
    setInfo('');
    const normalizedEmail = email.trim().toLowerCase();
    const token = normalizeAdvisorOtp(otp);
    if (!normalizedEmail.includes('@')) {
      setError(T(lang, 'Vui lòng nhập email hợp lệ.', 'Please enter a valid email.'));
      return;
    }
    if (token.length !== 6) {
      setError(T(lang, 'Vui lòng nhập mã OTP 6 số.', 'Please enter the 6-digit OTP.'));
      return;
    }

    setLoading(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token,
        type: 'signup',
      });
      if (verifyError || !data.user?.id) {
        throw verifyError || new Error('OTP verification failed');
      }
      await assertAdvisorRole(data.user.id);
      await completeAdvisorEmailVerification();
      await refreshProfile();
      navigate(next, { replace: true });
    } catch (submitError: any) {
      if (submitError?.message === 'advisor_role_required') {
        setError(T(lang, 'Tài khoản này không phải tài khoản Advisor. Vui lòng sử dụng trang đăng nhập Deals68 phù hợp.', 'This is not an Advisor account. Please use the appropriate Deals68 login page.'));
      } else {
        setError(T(lang, 'Mã OTP không đúng hoặc đã hết hạn. Anh/Chị có thể gửi lại mã.', 'The OTP is incorrect or expired. You can resend a new code.'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes('@')) {
      setError(T(lang, 'Vui lòng nhập email để gửi lại mã.', 'Please enter your email to resend the code.'));
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: normalizedEmail });
    setLoading(false);
    if (resendError) setError(resendError.message);
    else {
      setInfo(T(lang, 'Đã gửi lại OTP. Vui lòng kiểm tra Inbox và Spam/Quảng cáo.', 'OTP resent. Please check your Inbox and Spam/Promotions.'));
      setCooldown(60);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (otpMode) return submitOtp(event);
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const result = await signIn(email.trim().toLowerCase(), password);
      if (result.error) {
        if (isEmailNotConfirmed(result)) {
          setOtpMode(true);
          setInfo(T(lang, 'Email chưa được xác thực. Nhập OTP đã gửi tới email để tiếp tục.', 'Your email is not verified. Enter the OTP sent to your email to continue.'));
          return;
        }
        throw new Error(result.error);
      }
      const { data } = await supabase.auth.getUser();
      if (!data.user?.id) throw new Error('No authenticated user');
      await assertAdvisorRole(data.user.id);
      await refreshProfile();
      navigate(next, { replace: true });
    } catch (submitError: any) {
      if (submitError?.message === 'advisor_role_required') {
        setError(T(lang, 'Tài khoản này không phải tài khoản Advisor. Vui lòng dùng trang đăng nhập Business/Investor.', 'This is not an Advisor account. Please use the Business/Investor login page.'));
      } else {
        setError(T(lang, 'Sai email hoặc mật khẩu.', 'Incorrect email or password.'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="d68-auth-page d68-advisor-auth-page">
      <section className="d68-auth-card d68-advisor-login-card">
        <div className="d68-auth-head">
          <span>{otpMode ? 'Advisor OTP' : 'Advisor / Broker'}</span>
          <h1>{otpMode ? T(lang, 'Xác thực email Advisor', 'Verify Advisor email') : T(lang, 'Đăng nhập Advisor', 'Advisor login')}</h1>
          <p>{otpMode
            ? T(lang, 'Xác thực email trước khi truy cập trang trạng thái tài khoản Advisor.', 'Verify your email before accessing the Advisor account status page.')
            : T(lang, 'Trang đăng nhập riêng dành cho Cố vấn và Môi giới đã đăng ký.', 'Separate login for registered Advisors and Brokers.')}</p>
        </div>

        <form onSubmit={submit} className="d68-auth-form">
          <label><span>Email</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="advisor@example.com" /></label>
          {!otpMode ? <label><span>{T(lang, 'Mật khẩu', 'Password')}</span><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="••••••••" /></label> : null}
          {otpMode ? <label className="d68-auth-otp-field"><span>{T(lang, 'Mã OTP trong email', 'Email OTP code')}</span><input required inputMode="numeric" pattern="[0-9]*" maxLength={6} value={otp} onChange={(event) => setOtp(normalizeAdvisorOtp(event.target.value))} autoComplete="one-time-code" placeholder="123456" /></label> : null}

          {!otpMode ? <div className="d68-auth-row"><Link to={toLocalizedPath('/forgot-password?role=advisor', lang)}>{T(lang, 'Quên mật khẩu?', 'Forgot password?')}</Link></div> : null}
          {info ? <div className="d68-auth-success d68-auth-success--inline">{info}</div> : null}
          {error ? <div className="d68-auth-error">⚠ {error}</div> : null}

          <button className="d68-auth-submit" disabled={loading}>{loading ? T(lang, 'Đang xử lý...', 'Processing...') : otpMode ? T(lang, 'Xác thực OTP', 'Verify OTP') : T(lang, 'Đăng nhập Advisor', 'Log in as Advisor')}</button>
          {otpMode ? <button type="button" className="d68-auth-ghost" onClick={resendOtp} disabled={loading || cooldown > 0}>{cooldown > 0 ? T(lang, `Gửi lại sau ${cooldown}s`, `Resend in ${cooldown}s`) : T(lang, 'Gửi lại mã OTP', 'Resend OTP')}</button> : null}
        </form>

        <p className="d68-auth-bottom">{T(lang, 'Chưa có hồ sơ Advisor?', 'No Advisor application yet?')} <Link to={toLocalizedPath('/advisor/register', lang)}>{T(lang, 'Đăng ký tại đây', 'Register here')}</Link></p>
        <p className="d68-auth-bottom d68-advisor-other-login"><Link to={toLocalizedPath('/login', lang)}>{T(lang, 'Đăng nhập Business / Investor', 'Business / Investor login')}</Link></p>
      </section>
    </main>
  );
}
