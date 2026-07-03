import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';
import type { Lang } from '../lib/i18n';
import { t } from '../lib/i18n';

export default function Header({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const dashboardPath = profile?.role === 'admin' ? '/admin' : profile?.role ? `/dashboard/${profile.role}` : '/login';
  return <header className="topbar">
    <div className="container nav">
      <Link to="/"><img className="logo" src="/assets/logo.svg" alt="Deals68" /></Link>
      <nav className="navlinks">
        <NavLink to="/businesses">{t(lang,'businesses')}</NavLink>
        <NavLink to="/investors">{t(lang,'investors')}</NavLink>
        <NavLink to="/valuation">{t(lang,'valuation')}</NavLink>
        <NavLink to="/pricing">{t(lang,'pricing')}</NavLink>
      </nav>
      <div className="actions">
        <select className="lang" value={lang} onChange={e=>setLang(e.target.value as Lang)}><option value="vi">VI</option><option value="en">EN</option></select>
        {profile ? <>
          <button className="btn secondary small" onClick={() => navigate(dashboardPath)}>{profile.role === 'admin' ? 'Admin' : 'Dashboard'}</button>
          <button className="btn small" onClick={async()=>{await signOut(); navigate('/');}}>{t(lang,'logout')}</button>
        </> : <>
          <Link className="btn secondary small" to="/login">{t(lang,'login')}</Link>
          <Link className="btn gold small" to="/pricing">{t(lang,'register')}</Link>
        </>}
      </div>
    </div>
  </header>
}
