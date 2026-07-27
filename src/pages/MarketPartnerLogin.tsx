import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import '../styles/pages/market-partner.css';

type Mode = 'login' | 'activate' | 'otp';

function isEmailNotConfirmed(error: { error?: string; code?: string; status?: number }) {
  const value = `${error.code || ''} ${error.error || ''}`.toLowerCase();
  return value.includes('email_not_confirmed') || value.includes('email not confirmed') || value.includes('not confirmed');
}

function normalizeOtp(value: string) {
  return value.replace(/\D/g, '').slice(0, 6);
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, '').slice(0, 32);
}

function activationNonce() {
  const first = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
  const second = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Math.random()}-${Date.now()}`;
  return `${first}-${second}`;
}

export default function MarketPartnerLogin() {
  const { signIn, signOut, profile, loading: authLoading, refreshProfile } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(params.get('activate') === '1' ? 'activate' : 'login');
  const [email, setEmail] = useState(params.get('email') || '');
  const [password, setPassword] = useState('');
  const [affiliateCode, setAffiliateCode] = useState(params.get('code') || '');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const next = params.get('next') || '/market-partner/dashboard';

  useEffect(() => {
    if (!authLoading && profile && String(profile.role) === 'market_partner') {
      navigate(next, { replace: true });
    }
  }, [authLoading, profile, navigate, next]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError('');
    setInfo('');
    setOtp('');
  }

  async function verifyPartnerProfile() {
    await refreshProfile().catch(() => undefined);
    const { data: authData } = await supabase.auth.getUser();
    const { data: partnerProfile, error: profileError } = authData.user?.id
      ? await supabase.from('profiles').select('role,status,dashboard_login_enabled').eq('id', authData.user.id).maybeSingle()
      : { data: null, error: null };

    if (
      profileError ||
      String(partnerProfile?.role || '') !== 'market_partner' ||
      partnerProfile?.dashboard_login_enabled !== true
    ) {
      await signOut();
      throw new Error('Tài khoản này chưa được liên kết với Market Partner đã được Admin duyệt.');
    }
    return partnerProfile;
  }

  async function login() {
    const result = await signIn(email.trim(), password);
    if (result.error) {
      if (isEmailNotConfirmed(result)) {
        setMode('otp');
        setInfo('Hãy nhập mã OTP đã gửi tới email. Kiểm tra cả Spam/Quảng cáo.');
        return;
      }
      throw new Error('Email hoặc mật khẩu không đúng.');
    }
    await verifyPartnerProfile();
    navigate(next, { replace: true });
  }

  async function activate() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = normalizeCode(affiliateCode);
    if (!cleanEmail.includes('@')) throw new Error('Vui lòng nhập email hợp lệ.');
    if (cleanCode.length < 4) throw new Error('Vui lòng nhập mã affiliate do Admin cấp.');
    if (password.length < 8) throw new Error('Mật khẩu cần tối thiểu 8 ký tự.');

    const { data: canClaim, error: preflightError } = await supabase.rpc(
      'd68_can_claim_market_partner_account',
      { p_email: cleanEmail, p_affiliate_code: cleanCode },
    );
    if (preflightError || canClaim !== true) {
      throw new Error('Email hoặc mã affiliate không khớp hồ sơ Partner đang hoạt động, hoặc tài khoản đã được kích hoạt.');
    }

    const nonce = activationNonce();
    const { data, error: signupError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          role: 'market_partner',
          display_name: cleanEmail,
          market_partner_activation_nonce: nonce,
          market_partner_affiliate_code: cleanCode,
        },
      },
    });
    if (signupError || !data.user?.id) {
      throw new Error(signupError?.message || 'Không thể tạo tài khoản Market Partner.');
    }

    const { error: claimError } = await supabase.rpc('d68_claim_market_partner_signup', {
      user_uuid: data.user.id,
      user_email: cleanEmail,
      affiliate_code: cleanCode,
      activation_nonce: nonce,
    });
    if (claimError) {
      await signOut().catch(() => undefined);
      throw new Error('Email hoặc mã affiliate không khớp hồ sơ Partner đang hoạt động.');
    }

    if (data.session?.user) {
      await verifyPartnerProfile();
      navigate(next, { replace: true });
      return;
    }

    setMode('otp');
    setInfo('Tài khoản đã được liên kết. Hãy nhập mã OTP đã gửi tới email để kích hoạt đăng nhập.');
  }

  async function verifyOtp() {
    const token = normalizeOtp(otp);
    if (token.length !== 6) throw new Error('Vui lòng nhập mã OTP 6 số.');
    const { error: otpError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: 'signup',
    });
    if (otpError) throw new Error('Mã OTP không đúng hoặc đã hết hạn.');
    await verifyPartnerProfile();
    navigate(next, { replace: true });
  }

  async function resendOtp() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      setError('Vui lòng nhập email hợp lệ.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: cleanEmail });
    setLoading(false);
    if (resendError) setError(resendError.message);
    else {
      setInfo('Đã gửi lại OTP. Vui lòng kiểm tra Inbox và Spam/Quảng cáo.');
      setCooldown(60);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (mode === 'activate') await activate();
      else if (mode === 'otp') await verifyOtp();
      else await login();
    } catch (actionError: any) {
      setError(actionError?.message || 'Không thể xử lý yêu cầu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="d68-mp-login-page">
      <section className="d68-mp-login-card">
        <div className="d68-mp-login-brand">Deals68</div>
        <span className="d68-mp-eyebrow">ĐỐI TÁC THỊ TRƯỜNG</span>
        <h1>{mode === 'activate' ? 'Kích hoạt tài khoản Partner' : mode === 'otp' ? 'Xác thực email Partner' : 'Đăng nhập Market Partner'}</h1>
        <p>
          {mode === 'activate'
            ? 'Chỉ kích hoạt được khi email và mã affiliate trùng hồ sơ Partner đã được Admin phê duyệt.'
            : mode === 'otp'
              ? 'Nhập OTP trong email để hoàn tất kích hoạt tài khoản.'
              : 'Truy cập Dashboard, mã giới thiệu, commission và thông tin thanh toán của riêng Anh/Chị.'}
        </p>

        {mode !== 'otp' ? (
          <div className="d68-mp-login-tabs">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Đăng nhập</button>
            <button type="button" className={mode === 'activate' ? 'active' : ''} onClick={() => switchMode('activate')}>Kích hoạt tài khoản</button>
          </div>
        ) : null}

        <form onSubmit={submit} className="d68-mp-login-form">
          <label>
            <span>Email</span>
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="partner@example.com" />
          </label>
          {mode === 'activate' ? (
            <label>
              <span>Mã affiliate do Admin cấp</span>
              <input required value={affiliateCode} onChange={(event) => setAffiliateCode(normalizeCode(event.target.value))} autoComplete="off" placeholder="D68PARTNER" />
            </label>
          ) : null}
          {mode !== 'otp' ? (
            <label>
              <span>Mật khẩu</span>
              <input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'activate' ? 'new-password' : 'current-password'} placeholder="••••••••" />
            </label>
          ) : (
            <label>
              <span>Mã OTP 6 số</span>
              <input required inputMode="numeric" pattern="[0-9]*" maxLength={6} value={otp} onChange={(event) => setOtp(normalizeOtp(event.target.value))} autoComplete="one-time-code" placeholder="123456" />
            </label>
          )}
          {info ? <div className="d68-mp-alert d68-mp-alert--success">{info}</div> : null}
          {error ? <div className="d68-mp-alert d68-mp-alert--error">{error}</div> : null}
          <button className="d68-mp-primary-btn" disabled={loading}>
            {loading ? 'Đang xử lý...' : mode === 'activate' ? 'Tạo tài khoản & gửi OTP' : mode === 'otp' ? 'Xác thực OTP & vào Dashboard' : 'Đăng nhập Dashboard'}
          </button>
          {mode === 'otp' ? (
            <button type="button" className="d68-mp-secondary-btn" onClick={resendOtp} disabled={loading || cooldown > 0}>
              {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã OTP'}
            </button>
          ) : null}
        </form>

        <div className="d68-mp-login-links">
          {mode === 'login' ? <Link to="/forgot-password?role=market_partner">Quên mật khẩu?</Link> : null}
          {mode === 'otp' ? <button type="button" onClick={() => switchMode('login')}>Quay lại đăng nhập</button> : null}
          <Link to="/market-partner">Đăng ký trở thành đối tác</Link>
        </div>
      </section>
    </main>
  );
}
