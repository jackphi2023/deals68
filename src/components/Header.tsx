import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Lang } from '../lib/i18n';
import { t } from '../lib/i18n';

export default function Header({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const dashboardPath = profile?.role === 'admin' ? '/admin' : profile?.role === 'affiliate' ? '/dashboard/market-partner' : profile?.role ? `/dashboard/${profile.role}` : '/login';
  return <header className="topbar">
    <div className="container nav">
      <Link to="/"><img className="logo" src="/assets/logo-beta.png" alt="Deals68.com" /></Link>
      <nav className="navlinks">
        <NavLink to="/businesses">{t(lang,'businesses')}</NavLink>
        <NavLink to="/investors">{t(lang,'investors')}</NavLink>
        <NavLink to="/dashboard/advisor">{lang === 'en' ? 'Advisors' : 'Cố vấn'}</NavLink>
        <NavLink to="/valuation">{t(lang,'valuation')}</NavLink>
        <NavLink to="/pricing">{t(lang,'pricing')}</NavLink>
      </nav>
      <div className="actions">
        <div className="lang-toggle" aria-label="Language">
          <button className={lang==='vi'?'active':''} onClick={() => setLang('vi')}>VI</button>
          <button className={lang==='en'?'active':''} onClick={() => setLang('en')}>EN</button>
        </div>
        {profile ? <>
          <button className="btn secondary small" onClick={() => navigate(dashboardPath)}>{profile.role === 'admin' ? 'Admin' : 'Dashboard'}</button>
          <button className="btn blue small" onClick={async()=>{await signOut(); navigate('/');}}>{t(lang,'logout')}</button>
        </> : <>
          <Link className="btn secondary small" to="/login">{t(lang,'login')}</Link>
          <div className="reg-dd">
            <button className="btn blue small">{t(lang,'register')} <span style={{fontSize:11}}>▾</span></button>
            <div className="reg-menu"><div className="reg-menu-inner">
              <Link to="/register/business">{lang === 'en' ? 'Register as Business' : 'Đăng ký Doanh nghiệp'}</Link>
              <Link to="/register/investor">{lang === 'en' ? 'Register as Investor' : 'Đăng ký Nhà đầu tư'}</Link>
              <Link to="/register/advisor">{lang === 'en' ? 'Register as Advisor' : 'Đăng ký Cố vấn'}</Link>
              <Link to="/register/market-partner">{lang === 'en' ? 'Register as Market Partner' : 'Đăng ký Đối tác thị trường'}</Link>
            </div></div>
          </div>
        </>}
      </div>
    </div>
  </header>
}
