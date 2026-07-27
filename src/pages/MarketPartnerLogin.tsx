import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import '../styles/pages/market-partner.css';

export default function MarketPartnerLogin() {
  const { signIn, signOut, profile, loading: authLoading, refreshProfile } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(params.get('email') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const next = params.get('next') || '/market-partner/dashboard';

  useEffect(() => {
    if (!authLoading && profile && String(profile.role) === 'market_partner') {
      navigate(next, { replace: true });
    }
  }, [authLoading, profile, navigate, next]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn(email.trim(), password);
    if (result.error) {
      setLoading(false);
      setError('Email hoặc mật khẩu không đúng.');
      return;
    }

    await refreshProfile().catch(() => undefined);
    const { data: authData } = await supabase.auth.getUser();
    const { data: partnerProfile, error: profileError } = authData.user?.id
      ? await supabase.from('profiles').select('role,status').eq('id', authData.user.id).maybeSingle()
      : { data: null, error: null };

    if (profileError || String(partnerProfile?.role || '') !== 'market_partner') {
      await signOut();
      setLoading(false);
      setError('Tài khoản này không phải tài khoản Đối tác thị trường.');
      return;
    }

    setLoading(false);
    navigate(next, { replace: true });
  }

  return (
    <main className="d68-mp-login-page">
      <section className="d68-mp-login-card">
        <div className="d68-mp-login-brand">Deals68</div>
        <span className="d68-mp-eyebrow">ĐỐI TÁC THỊ TRƯỜNG</span>
        <h1>Đăng nhập Market Partner</h1>
        <p>Truy cập Dashboard, mã giới thiệu và thông tin thanh toán của riêng Anh/Chị.</p>

        <form onSubmit={submit} className="d68-mp-login-form">
          <label>
            <span>Email</span>
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="partner@example.com" />
          </label>
          <label>
            <span>Mật khẩu</span>
            <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="••••••••" />
          </label>
          {error ? <div className="d68-mp-alert d68-mp-alert--error">{error}</div> : null}
          <button className="d68-mp-primary-btn" disabled={loading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập Dashboard'}
          </button>
        </form>

        <div className="d68-mp-login-links">
          <Link to="/forgot-password?role=market_partner">Quên mật khẩu?</Link>
          <Link to="/market-partner">Đăng ký trở thành đối tác</Link>
        </div>
      </section>
    </main>
  );
}
