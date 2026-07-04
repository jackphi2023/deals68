import type { CSSProperties } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Lang } from '../lib/i18n';
import { t } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

function navStyle(isActive: boolean): CSSProperties {
  return {
    whiteSpace: 'nowrap',
    color: isActive ? '#1BADEA' : '#14315A',
    fontWeight: isActive ? 700 : 500,
  };
}

export default function Header({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const dashboardPath = profile?.role === 'admin'
    ? '/admin'
    : profile?.role === 'affiliate'
      ? '/dashboard/market-partner'
      : profile?.role
        ? `/dashboard/${profile.role}`
        : '/login';

  const langBtn = (active: boolean): CSSProperties => ({
    border: 0,
    padding: '7px 10px',
    background: active ? '#0F2A4A' : '#fff',
    color: active ? '#fff' : '#64748B',
    fontWeight: 700,
    cursor: 'pointer',
  });

  const registerLinks = <>
    <Link to="/register/business">{T(lang, 'Đăng ký Doanh nghiệp', 'Register as Business')}</Link>
    <Link to="/register/investor">{T(lang, 'Đăng ký Nhà đầu tư', 'Register as Investor')}</Link>
    <Link to="/register/advisor">{T(lang, 'Đăng ký Cố vấn', 'Register as Advisor')}</Link>
  </>;

  const dashboardLabel = profile?.role === 'admin' ? T(lang, 'Quản trị', 'Admin') : T(lang, 'Bảng điều khiển', 'Dashboard');

  return <header className="d68-ref-header">
    <div className="d68-ref-header__inner">
      <Link to="/" className="d68-ref-logo"><img src="/assets/logo-beta-transparent.png" alt="Deals68.com" /></Link>
      <nav className="d68-nav d68-ref-nav">
        <NavLink to="/businesses" style={({isActive}) => navStyle(isActive)}>{t(lang, 'businesses')}</NavLink>
        <NavLink to="/investors" style={({isActive}) => navStyle(isActive)}>{t(lang, 'investors')}</NavLink>
        <NavLink to="/register/advisor" style={({isActive}) => navStyle(isActive)}>{T(lang, 'Cố vấn', 'Advisors')}</NavLink>
        <NavLink to="/valuation" style={({isActive}) => navStyle(isActive)}>{t(lang, 'valuation')}</NavLink>
        <NavLink to="/pricing" style={({isActive}) => navStyle(isActive)}>{t(lang, 'pricing')}</NavLink>
      </nav>

      <input id="d68burger" className="d68-burger-cb" type="checkbox" aria-label={T(lang, 'Mở menu', 'Open menu')} />
      <label htmlFor="d68burger" className="d68-burger">☰</label>
      <div className="d68-mdrawer">
        <Link to="/businesses">{t(lang, 'businesses')}</Link>
        <Link to="/investors">{t(lang, 'investors')}</Link>
        <Link to="/register/advisor">{T(lang, 'Cố vấn', 'Advisors')}</Link>
        <Link to="/valuation">{t(lang, 'valuation')}</Link>
        <Link to="/pricing">{t(lang, 'pricing')}</Link>
        <div className="d68-mdrawer__lang">
          <span>{T(lang, 'Ngôn ngữ', 'Language')}</span>
          <div className="d68-ref-lang"><button style={langBtn(lang === 'vi')} onClick={() => setLang('vi')}>VI</button><button style={langBtn(lang === 'en')} onClick={() => setLang('en')}>EN</button></div>
        </div>
        {profile ? <>
          <button onClick={() => navigate(dashboardPath)}>{dashboardLabel}</button>
          <button onClick={async()=>{await signOut(); navigate('/');}}>{t(lang, 'logout')}</button>
        </> : <>
          <Link to="/login">{t(lang, 'login')}</Link>
          <Link className="d68-mdrawer__primary" to="/register/business">{T(lang, 'Đăng ký Doanh nghiệp', 'Register as Business')}</Link>
          <Link className="d68-mdrawer__ghost" to="/register/investor">{T(lang, 'Đăng ký Nhà đầu tư', 'Register as Investor')}</Link>
          <Link className="d68-mdrawer__ghost" to="/register/advisor">{T(lang, 'Đăng ký Cố vấn', 'Register as Advisor')}</Link>
        </>}
      </div>

      <div className="d68-hdr-actions d68-ref-actions">
        <div className="d68-ref-lang"><button style={langBtn(lang === 'vi')} onClick={() => setLang('vi')}>VI</button><button style={langBtn(lang === 'en')} onClick={() => setLang('en')}>EN</button></div>
        {profile ? <>
          <button className="d68-ref-login" onClick={() => navigate(dashboardPath)}>{dashboardLabel}</button>
          <button className="d68-ref-register-btn" onClick={async()=>{await signOut(); navigate('/');}}>{t(lang, 'logout')}</button>
        </> : <>
          <Link className="d68-ref-login" to="/login">{t(lang, 'login')}</Link>
          <div className="d68-reg-dd d68-ref-reg-dd">
            <button className="d68-ref-register-btn">{t(lang, 'register')} <span style={{fontSize: 11}}>▾</span></button>
            <div className="d68-reg-menu d68-ref-reg-menu"><div>{registerLinks}</div></div>
          </div>
        </>}
      </div>
    </div>
  </header>;
}
