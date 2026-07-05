import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { type CSSProperties } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { Lang } from '../lib/i18n';
import { stripLangPrefix, switchLanguagePath, toLocalizedPath } from '../lib/i18nRoutes';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
const buttonReset: CSSProperties = { border: 'none', cursor: 'pointer', fontFamily: 'inherit' };

function langBtnStyle(active: boolean): CSSProperties {
  return { ...buttonReset, padding: '7px 14px', fontWeight: 700, fontSize: 13, background: active ? '#0F2A4A' : 'transparent', color: active ? '#fff' : '#64748B' };
}

function dashboardPath(role?: string) {
  if (role === 'admin') return '/admin';
  if (role === 'business') return '/dashboard/business';
  if (role === 'investor') return '/dashboard/investor';
  if (role === 'affiliate') return '/dashboard/market-partner';
  return '/login';
}

export default function Header({ lang }: { lang: Lang }) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const basePath = stripLangPrefix(pathname);
  const maxWidth = basePath === '/' ? 1200 : 1240;
  const zIndex = basePath.startsWith('/businesses') || basePath.startsWith('/investors') ? 60 : 50;
  const nav = (path: string) => toLocalizedPath(path, lang);
  const isAuthed = Boolean(user);

  const navLinkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({ whiteSpace: 'nowrap', color: isActive ? '#1BADEA' : '#14315A', fontWeight: isActive ? 700 : 500 });
  const switchLang = (target: Lang) => navigate(switchLanguagePath(pathname, search, target));
  const logout = async () => { await signOut(); navigate(nav('/')); };
  const dash = dashboardPath(profile?.role);

  return <header style={{ position: 'sticky', top: 0, zIndex, background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #E7EDF3' }}>
    <div style={{ maxWidth, margin: '0 auto', padding: '0 24px', height: 70, display: 'flex', alignItems: 'center', gap: 28 }}>
      <Link to={nav('/')} className="d68-nav-logo" aria-label="Deals68.com">
        <img src="/assets/logo-nav.svg" alt="Deals68.com" />
      </Link>

      <nav className="d68-nav" style={{ display: 'flex', alignItems: 'center', gap: 26, marginLeft: 8, fontSize: 15, fontWeight: 500, color: '#14315A' }} aria-label="Main navigation">
        <NavLink to={nav('/businesses')} style={navLinkStyle}><span className="l-vi">Doanh nghiệp</span><span className="l-en">Businesses</span></NavLink>
        <NavLink to={nav('/investors')} style={navLinkStyle}><span className="l-vi">Nhà đầu tư</span><span className="l-en">Investors</span></NavLink>
        <NavLink to={nav('/valuation')} style={navLinkStyle}><span className="l-vi">Định giá</span><span className="l-en">Valuation</span></NavLink>
        <NavLink to={nav('/pricing')} style={navLinkStyle}><span className="l-vi">Bảng giá</span><span className="l-en">Pricing</span></NavLink>
      </nav>

      <input type="checkbox" id="d68burger" className="d68-burger-cb" style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} aria-label={T(lang, 'Mở menu', 'Open menu')} />
      <label htmlFor="d68burger" className="d68-burger" style={{ marginLeft: 'auto', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 22, color: '#14315A', cursor: 'pointer', flexShrink: 0, background: '#fff' }}>☰</label>

      <div className="d68-mdrawer" style={{ position: 'absolute', top: 70, left: 0, right: 0, flexDirection: 'column', gap: 2, background: '#fff', borderTop: '1px solid #E7EDF3', boxShadow: '0 18px 34px rgba(15,42,74,.14)', padding: '12px 20px 18px', maxHeight: 'calc(100vh - 70px)', overflowY: 'auto' }}>
        <Link to={nav('/businesses')} style={{ padding: '13px 6px', fontSize: 16, fontWeight: 600, color: '#14315A', borderBottom: '1px solid #F1F5F9' }}><span className="l-vi">Doanh nghiệp</span><span className="l-en">Businesses</span></Link>
        <Link to={nav('/investors')} style={{ padding: '13px 6px', fontSize: 16, fontWeight: 600, color: '#14315A', borderBottom: '1px solid #F1F5F9' }}><span className="l-vi">Nhà đầu tư</span><span className="l-en">Investors</span></Link>
        <Link to={nav('/valuation')} style={{ padding: '13px 6px', fontSize: 16, fontWeight: 600, color: '#14315A', borderBottom: '1px solid #F1F5F9' }}><span className="l-vi">Định giá</span><span className="l-en">Valuation</span></Link>
        <Link to={nav('/pricing')} style={{ padding: '13px 6px', fontSize: 16, fontWeight: 600, color: '#14315A', borderBottom: '1px solid #F1F5F9' }}><span className="l-vi">Bảng giá</span><span className="l-en">Pricing</span></Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 6px 8px' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#64748B' }}><span className="l-vi">Ngôn ngữ</span><span className="l-en">Language</span></span>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E2E8F0', borderRadius: 999, overflow: 'hidden', fontSize: 13, fontWeight: 700 }}><button type="button" onClick={() => switchLang('vi')} style={langBtnStyle(lang === 'vi')}>VI</button><button type="button" onClick={() => switchLang('en')} style={langBtnStyle(lang === 'en')}>EN</button></div>
        </div>
        {isAuthed ? <>
          <Link to={dash} style={{ padding: '13px 6px', fontSize: 16, fontWeight: 700, color: '#14315A' }}>Dashboard</Link>
          <button type="button" onClick={logout} style={{ ...buttonReset, textAlign: 'left', padding: '13px 6px', fontSize: 16, fontWeight: 800, color: '#DC2626', background: 'transparent' }}><span className="l-vi">Đăng xuất</span><span className="l-en">Log out</span></button>
        </> : <>
          <Link to={nav('/login')} style={{ padding: '13px 6px', fontSize: 16, fontWeight: 700, color: '#14315A' }}><span className="l-vi">Đăng nhập</span><span className="l-en">Log in</span></Link>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <Link to={nav('/register/business')} style={{ textAlign: 'center', background: '#1BADEA', color: '#fff', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 10 }}><span className="l-vi">Đăng ký Doanh nghiệp</span><span className="l-en">Register as Business</span></Link>
            <Link to={nav('/register/investor')} style={{ textAlign: 'center', border: '1px solid #E2E8F0', color: '#14315A', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 10 }}><span className="l-vi">Đăng ký Nhà đầu tư</span><span className="l-en">Register as Investor</span></Link>
          </div>
        </>}
      </div>

      <div className="d68-hdr-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E2E8F0', borderRadius: 999, overflow: 'hidden', fontSize: 13, fontWeight: 700 }}><button type="button" onClick={() => switchLang('vi')} style={langBtnStyle(lang === 'vi')}>VI</button><button type="button" onClick={() => switchLang('en')} style={langBtnStyle(lang === 'en')}>EN</button></div>
        {isAuthed ? <>
          <Link to={dash} style={{ fontSize: 15, fontWeight: 700, color: '#14315A', whiteSpace: 'nowrap' }}>Dashboard</Link>
          <button type="button" onClick={logout} style={{ ...buttonReset, background: '#EEF2F6', color: '#334155', fontWeight: 800, fontSize: 14.5, padding: '10px 16px', borderRadius: 10 }}><span className="l-vi">Đăng xuất</span><span className="l-en">Log out</span></button>
        </> : <>
          <Link to={nav('/login')} style={{ fontSize: 15, fontWeight: 600, color: '#14315A', whiteSpace: 'nowrap' }}><span className="l-vi">Đăng nhập</span><span className="l-en">Log in</span></Link>
          <div className="d68-reg-dd" style={{ position: 'relative' }}>
            <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1BADEA', color: '#fff', fontWeight: 700, fontSize: 15, padding: '11px 20px', borderRadius: 10, boxShadow: '0 6px 16px rgba(27,173,234,.28)', whiteSpace: 'nowrap', border: 'none', cursor: 'pointer' }}><span className="l-vi">Đăng ký</span><span className="l-en">Register</span> <span style={{ fontSize: 11 }}>▾</span></button>
            <div className="d68-reg-menu" style={{ display: 'none', position: 'absolute', top: '100%', right: 0, paddingTop: 8, minWidth: 230, flexDirection: 'column', zIndex: 80 }}>
              <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 12, boxShadow: '0 14px 34px rgba(15,42,74,.16)', padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Link to={nav('/register/business')} style={{ padding: '11px 14px', borderRadius: 8, fontSize: 14.5, fontWeight: 600, color: '#14315A' }}><span className="l-vi">Đăng ký Doanh nghiệp</span><span className="l-en">Register as Business</span></Link>
                <Link to={nav('/register/investor')} style={{ padding: '11px 14px', borderRadius: 8, fontSize: 14.5, fontWeight: 600, color: '#14315A' }}><span className="l-vi">Đăng ký Nhà đầu tư</span><span className="l-en">Register as Investor</span></Link>
              </div>
            </div>
          </div>
        </>}
      </div>
    </div>
  </header>;
}
