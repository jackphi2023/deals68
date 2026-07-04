import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Lang } from '../lib/i18n';
import { t } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

function navClass({ isActive }: { isActive: boolean }) {
  return `d68-public-nav__link${isActive ? ' active' : ''}`;
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

  const registerLinks = <>
    <Link to="/register/business">{T(lang, 'Đăng ký Doanh nghiệp', 'Register as Business')}</Link>
    <Link to="/register/investor">{T(lang, 'Đăng ký Nhà đầu tư', 'Register as Investor')}</Link>
    <Link to="/register/advisor">{T(lang, 'Đăng ký Cố vấn', 'Register as Advisor')}</Link>
  </>;

  return <header className="d68-public-header">
    <div className="d68-public-header__inner">
      <Link to="/" className="d68-public-logo" aria-label="Deals68.com">
        <img src="/assets/logo-beta-transparent.png" alt="Deals68.com" />
      </Link>

      <nav className="d68-nav d68-public-nav" aria-label="Main navigation">
        <NavLink to="/businesses" className={navClass}>{t(lang, 'businesses')}</NavLink>
        <NavLink to="/investors" className={navClass}>{t(lang, 'investors')}</NavLink>
        <NavLink to="/dashboard/advisor" className={navClass}>{T(lang, 'Cố vấn', 'Advisors')}</NavLink>
        <NavLink to="/valuation" className={navClass}>{t(lang, 'valuation')}</NavLink>
        <NavLink to="/pricing" className={navClass}>{t(lang, 'pricing')}</NavLink>
      </nav>

      <input id="d68burger" className="d68-burger-cb" type="checkbox" aria-label={T(lang, 'Mở menu', 'Open menu')} />
      <label htmlFor="d68burger" className="d68-burger">☰</label>
      <div className="d68-mdrawer d68-public-drawer">
        <Link to="/businesses">{t(lang, 'businesses')}</Link>
        <Link to="/investors">{t(lang, 'investors')}</Link>
        <Link to="/dashboard/advisor">{T(lang, 'Cố vấn', 'Advisors')}</Link>
        <Link to="/valuation">{t(lang, 'valuation')}</Link>
        <Link to="/pricing">{t(lang, 'pricing')}</Link>
        <div className="d68-mdrawer__lang">
          <span>{T(lang, 'Ngôn ngữ', 'Language')}</span>
          <div className="d68-public-lang">
            <button className={lang === 'vi' ? 'active' : ''} onClick={() => setLang('vi')}>VI</button>
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
          </div>
        </div>
        {profile ? <>
          <button onClick={() => navigate(dashboardPath)}>{profile.role === 'admin' ? T(lang, 'Quản trị', 'Admin') : T(lang, 'Bảng điều khiển', 'Dashboard')}</button>
          <button onClick={async()=>{await signOut(); navigate('/');}}>{t(lang, 'logout')}</button>
        </> : <>
          <Link to="/login">{t(lang, 'login')}</Link>
          <Link className="d68-mdrawer__primary" to="/register/business">{T(lang, 'Đăng ký Doanh nghiệp', 'Register as Business')}</Link>
          <Link className="d68-mdrawer__ghost" to="/register/investor">{T(lang, 'Đăng ký Nhà đầu tư', 'Register as Investor')}</Link>
          <Link className="d68-mdrawer__ghost" to="/register/advisor">{T(lang, 'Đăng ký Cố vấn', 'Register as Advisor')}</Link>
        </>}
      </div>

      <div className="d68-hdr-actions d68-public-actions">
        <div className="d68-public-lang">
          <button className={lang === 'vi' ? 'active' : ''} onClick={() => setLang('vi')}>VI</button>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
        </div>
        {profile ? <>
          <button className="d68-public-login" onClick={() => navigate(dashboardPath)}>{profile.role === 'admin' ? T(lang, 'Quản trị', 'Admin') : T(lang, 'Bảng điều khiển', 'Dashboard')}</button>
          <button className="d68-public-register-btn" onClick={async()=>{await signOut(); navigate('/');}}>{t(lang, 'logout')}</button>
        </> : <>
          <Link className="d68-public-login" to="/login">{t(lang, 'login')}</Link>
          <div className="d68-reg-dd d68-public-reg-dd">
            <button className="d68-public-register-btn">{t(lang, 'register')} <span>▾</span></button>
            <div className="d68-reg-menu d68-public-reg-menu"><div>{registerLinks}</div></div>
          </div>
        </>}
      </div>
    </div>
  </header>;
}
