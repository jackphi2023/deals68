import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Lang } from '../lib/i18n';
import { stripLangPrefix, switchLanguagePath, toLocalizedPath } from '../lib/i18nRoutes';
import { useAuth } from '../contexts/AuthContext';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
const buttonReset: CSSProperties = { border: 'none', cursor: 'pointer', fontFamily: 'inherit' };

function langBtnStyle(active: boolean): CSSProperties {
  return { ...buttonReset, padding: '7px 14px', fontWeight: 700, fontSize: 13, background: active ? '#0F2A4A' : 'transparent', color: active ? '#fff' : '#64748B' };
}

function dashboardForRole(role?: string) {
  if (role === 'admin') return '/admin';
  if (role === 'investor') return '/dashboard/investor';
  if (role === 'affiliate') return '/dashboard/market-partner';
  return '/dashboard/business';
}

function menuForRole(role: string | undefined, lang: Lang) {
  if (role === 'admin') return [
    { label: T(lang, 'Dashboard', 'Dashboard'), to: '/admin' },
    { label: T(lang, 'Proposal', 'Proposals'), to: '/admin/proposals' },
    { label: T(lang, 'Doanh nghiệp', 'Businesses'), to: '/admin/businesses' },
    { label: T(lang, 'Nhà đầu tư', 'Investors'), to: '/admin/investors' },
    { label: T(lang, 'Yêu cầu tài liệu', 'Data requests'), to: '/admin/data-requests' },
  ];
  if (role === 'investor') return [
    { label: T(lang, 'Dashboard', 'Dashboard'), to: '/dashboard/investor' },
    { label: T(lang, 'Hồ sơ nhà đầu tư', 'Investor profile'), to: '/dashboard/investor/profile' },
    { label: T(lang, 'Proposal đã nhận', 'Received proposals'), to: '/dashboard/investor/proposals' },
    { label: T(lang, 'DN đã quan tâm / đã lưu', 'Saved businesses'), to: '/dashboard/investor/saved' },
    { label: T(lang, 'Yêu cầu tài liệu', 'Data requests'), to: '/dashboard/investor/alerts' },
    { label: T(lang, 'Invoices / Thanh toán', 'Invoices / Billing'), to: '/dashboard/investor/privacy' },
    { label: T(lang, 'Inbox / Tin nhắn', 'Inbox / Messages'), to: '/messages' },
    { label: T(lang, 'Notifications', 'Notifications'), to: '/notifications' },
  ];
  return [
    { label: T(lang, 'Dashboard', 'Dashboard'), to: '/dashboard/business' },
    { label: T(lang, 'Hồ sơ doanh nghiệp', 'Business profile'), to: '/dashboard/business/profile' },
    { label: T(lang, 'Proposal đã gửi', 'Sent proposals'), to: '/dashboard/business/proposals' },
    { label: T(lang, 'Nhà đầu tư quan tâm', 'Investor interests'), to: '/dashboard/business/proposals' },
    { label: T(lang, 'Yêu cầu tài liệu', 'Data requests'), to: '/dashboard/business/data-requests' },
    { label: T(lang, 'Invoices / Thanh toán', 'Invoices / Billing'), to: '/dashboard/business/payments' },
  ];
}

export default function Header({ lang }: { lang: Lang }) {
  const { pathname, search } = useLocation();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement | null>(null);
  const basePath = stripLangPrefix(pathname);
  const maxWidth = basePath === '/' ? 1200 : 1240;
  const zIndex = basePath.startsWith('/businesses') || basePath.startsWith('/investors') ? 60 : 50;
  const nav = (path: string) => toLocalizedPath(path, lang);
  const closeDrawer = () => setMobileOpen(false);
  const displayEmail = profile?.email || '';
  const displayName = displayEmail ? displayEmail.split('@')[0] : T(lang, 'Tài khoản', 'Account');
  const initial = (displayName || profile?.role || 'U').trim().charAt(0).toUpperCase();
  const roleMenu = menuForRole(profile?.role, lang);

  useEffect(() => {
    if (!avatarOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(event.target as Node)) setAvatarOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [avatarOpen]);

  const navLinkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({ whiteSpace: 'nowrap', color: isActive ? '#1BADEA' : '#14315A', fontWeight: isActive ? 700 : 500 });
  const switchLang = (target: Lang) => {
    closeDrawer();
    setAvatarOpen(false);
    if (typeof window !== 'undefined') window.localStorage.setItem('d68_lang', target);
    navigate(switchLanguagePath(pathname, search, target));
  };
  const logout = async () => {
    closeDrawer();
    setAvatarOpen(false);
    await signOut();
  };

  const authDesktop = profile
    ? <div ref={avatarRef} style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
        <Link to={nav(dashboardForRole(profile.role))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1BADEA', color: '#fff', fontWeight: 800, fontSize: 15, padding: '11px 18px', borderRadius: 10, boxShadow: '0 6px 16px rgba(27,173,234,.28)', whiteSpace: 'nowrap' }}>{T(lang, 'Dashboard', 'Dashboard')}</Link>
        <button type="button" aria-label={T(lang, 'Mở menu tài khoản', 'Open account menu')} aria-expanded={avatarOpen} onClick={() => setAvatarOpen((v) => !v)} style={{ width: 38, height: 38, borderRadius: '50%', border: '2px solid #E2E8F0', background: '#065F46', color: '#fff', fontWeight: 900, cursor: 'pointer', boxShadow: '0 8px 18px rgba(15,42,74,.14)' }}>{initial}</button>
        {avatarOpen ? <div style={{ position: 'absolute', right: 0, top: 48, width: 265, background: '#fff', border: '1px solid #E7EDF3', borderRadius: 14, boxShadow: '0 18px 40px rgba(15,42,74,.18)', zIndex: 120, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 14, borderBottom: '1px solid #EEF2F6' }}><div style={{ width: 48, height: 48, borderRadius: 10, background: '#065F46', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22 }}>{initial}</div><div style={{ minWidth: 0 }}><b style={{ display: 'block', color: '#0F2A4A' }}>{displayName}</b>{displayEmail ? <small style={{ display: 'block', color: '#1596cc', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayEmail}</small> : null}</div></div>
          <div style={{ padding: 6 }}>{roleMenu.map((item) => <Link key={item.to} to={nav(item.to)} onClick={() => setAvatarOpen(false)} style={{ display: 'block', padding: '11px 12px', borderRadius: 9, color: '#334155', fontSize: 14, fontWeight: 650 }}>{item.label}</Link>)}</div>
          <button type="button" onClick={logout} style={{ width: '100%', border: 0, borderTop: '1px solid #EEF2F6', background: '#F8FAFC', padding: '13px 14px', textAlign: 'left', color: '#475569', fontWeight: 800, cursor: 'pointer' }}>{T(lang, 'Thoát / Logout', 'Logout')}</button>
        </div> : null}
      </div>
    : <>
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
      </>;

  return <header style={{ position: 'sticky', top: 0, zIndex, background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #E7EDF3' }}>
    <div style={{ maxWidth, margin: '0 auto', padding: '0 24px', height: 70, display: 'flex', alignItems: 'center', gap: 28 }}>
      <Link to={nav('/')} onClick={closeDrawer} style={{ display: 'flex', alignItems: 'center', flexShrink: 0, background: 'transparent' }} aria-label="Deals68.com">
        <img src="/assets/logo-nav.png" alt="Deals68.com" style={{ height: 34, width: 'auto', display: 'block', background: 'transparent' }} />
      </Link>

      <nav className="d68-nav" style={{ display: 'flex', alignItems: 'center', gap: 26, marginLeft: 8, fontSize: 15, fontWeight: 500, color: '#14315A' }} aria-label="Main navigation">
        <NavLink to={nav('/businesses')} style={navLinkStyle}><span className="l-vi">Doanh nghiệp</span><span className="l-en">Businesses</span></NavLink>
        <NavLink to={nav('/investors')} style={navLinkStyle}><span className="l-vi">Nhà đầu tư</span><span className="l-en">Investors</span></NavLink>
        <NavLink to={nav('/valuation')} style={navLinkStyle}><span className="l-vi">Định giá</span><span className="l-en">Valuation</span></NavLink>
        <NavLink to={nav('/pricing')} style={navLinkStyle}><span className="l-vi">Bảng giá</span><span className="l-en">Pricing</span></NavLink>
      </nav>

      <button type="button" className="d68-burger" aria-label={mobileOpen ? T(lang, 'Đóng menu', 'Close menu') : T(lang, 'Mở menu', 'Open menu')} aria-expanded={mobileOpen} onClick={() => setMobileOpen((v) => !v)} style={{ marginLeft: 'auto', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 22, color: '#14315A', cursor: 'pointer', flexShrink: 0, background: '#fff' }}>{mobileOpen ? '×' : '☰'}</button>

      <div className={`d68-mdrawer${mobileOpen ? ' is-open' : ''}`} style={{ position: 'absolute', top: 70, left: 0, right: 0, flexDirection: 'column', gap: 2, background: '#fff', borderTop: '1px solid #E7EDF3', boxShadow: '0 18px 34px rgba(15,42,74,.14)', padding: '12px 20px 18px', maxHeight: 'calc(100vh - 70px)', overflowY: 'auto' }}>
        <Link to={nav('/businesses')} onClick={closeDrawer} style={{ padding: '13px 6px', fontSize: 16, fontWeight: 600, color: '#14315A', borderBottom: '1px solid #F1F5F9' }}><span className="l-vi">Doanh nghiệp</span><span className="l-en">Businesses</span></Link>
        <Link to={nav('/investors')} onClick={closeDrawer} style={{ padding: '13px 6px', fontSize: 16, fontWeight: 600, color: '#14315A', borderBottom: '1px solid #F1F5F9' }}><span className="l-vi">Nhà đầu tư</span><span className="l-en">Investors</span></Link>
        <Link to={nav('/valuation')} onClick={closeDrawer} style={{ padding: '13px 6px', fontSize: 16, fontWeight: 600, color: '#14315A', borderBottom: '1px solid #F1F5F9' }}><span className="l-vi">Định giá</span><span className="l-en">Valuation</span></Link>
        <Link to={nav('/pricing')} onClick={closeDrawer} style={{ padding: '13px 6px', fontSize: 16, fontWeight: 600, color: '#14315A', borderBottom: '1px solid #F1F5F9' }}><span className="l-vi">Bảng giá</span><span className="l-en">Pricing</span></Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 6px 8px' }}><span style={{ fontSize: 14, fontWeight: 600, color: '#64748B' }}><span className="l-vi">Ngôn ngữ</span><span className="l-en">Language</span></span><div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E2E8F0', borderRadius: 999, overflow: 'hidden', fontSize: 13, fontWeight: 700 }}><button type="button" onClick={() => switchLang('vi')} style={langBtnStyle(lang === 'vi')}>VI</button><button type="button" onClick={() => switchLang('en')} style={langBtnStyle(lang === 'en')}>EN</button></div></div>
        {profile ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 6px' }}><span style={{ width: 38, height: 38, borderRadius: '50%', background: '#065F46', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{initial}</span><div><b>{displayName}</b>{displayEmail ? <small style={{ display: 'block', color: '#1596cc' }}>{displayEmail}</small> : null}</div></div>{roleMenu.map((item) => <Link key={item.to} to={nav(item.to)} onClick={closeDrawer} style={{ padding: '11px 8px', borderBottom: '1px solid #F1F5F9', color: '#334155', fontWeight: 700 }}>{item.label}</Link>)}<button type="button" onClick={logout} style={{ ...buttonReset, padding: '13px 8px', background: '#F8FAFC', color: '#475569', fontWeight: 800, textAlign: 'left' }}>{T(lang, 'Thoát / Logout', 'Logout')}</button></div> : <><Link to={nav('/login')} onClick={closeDrawer} style={{ padding: '13px 6px', fontSize: 16, fontWeight: 700, color: '#14315A' }}><span className="l-vi">Đăng nhập</span><span className="l-en">Log in</span></Link><div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}><Link to={nav('/register/business')} onClick={closeDrawer} style={{ textAlign: 'center', background: '#1BADEA', color: '#fff', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 10 }}><span className="l-vi">Đăng ký Doanh nghiệp</span><span className="l-en">Register as Business</span></Link><Link to={nav('/register/investor')} onClick={closeDrawer} style={{ textAlign: 'center', border: '1px solid #E2E8F0', color: '#14315A', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 10 }}><span className="l-vi">Đăng ký Nhà đầu tư</span><span className="l-en">Register as Investor</span></Link></div></>}
      </div>

      <div className="d68-hdr-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E2E8F0', borderRadius: 999, overflow: 'hidden', fontSize: 13, fontWeight: 700 }}><button type="button" onClick={() => switchLang('vi')} style={langBtnStyle(lang === 'vi')}>VI</button><button type="button" onClick={() => switchLang('en')} style={langBtnStyle(lang === 'en')}>EN</button></div>
        {authDesktop}
      </div>
    </div>
  </header>;
}
