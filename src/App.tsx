import { Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import Header from './components/Header';
import SeoManager from './components/SeoManager';
import Footer from './components/Footer';
import Home from './pages/Home';
import Businesses from './pages/Businesses';
import BusinessDetail from './pages/BusinessDetail';
import Investors from './pages/Investors';
import InvestorDetailV10 from './pages/InvestorDetailV10';
import Pricing from './pages/Pricing';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Register from './pages/Register';
import Valuation from './pages/Valuation';
import ModuleScreen from './pages/ModuleScreen';
import NotFound from './pages/NotFound';
import { useAuth } from './contexts/AuthContext';
import { langFromPath, stripLangPrefix, toLocalizedPath } from './lib/i18nRoutes';

const BusinessDashboard = lazy(() => import('./pages/BusinessDashboard'));
const InvestorDashboard = lazy(() => import('./pages/InvestorDashboard'));
const InvestorProfileV10 = lazy(() => import('./pages/InvestorProfileV10'));
const Admin = lazy(() => import('./pages/Admin'));
const AdminBannersV10 = lazy(() => import('./pages/AdminBannersV10'));
const AdminValuation = lazy(() => import('./pages/AdminValuation'));
const About = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.About })));
const Terms = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.Terms })));
const Privacy = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.Privacy })));
const Contact = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.Contact })));
const MarketPartner = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.MarketPartner })));

function RouteFallback() {
  return <section style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px', color: '#64748B' }}>Loading...</section>;
}

function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);
  return null;
}

function LanguageMemory() {
  const location = useLocation();
  const navigate = useNavigate();
  const lang = langFromPath(location.pathname);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = location.pathname;
    const privatePrefix = ['/dashboard', '/admin', '/checkout', '/payment', '/data-room', '/messages', '/notifications', '/support'];
    const isPrivate = privatePrefix.some((p) => path === p || path.startsWith(`${p}/`));
    if (path === '/vi' || path.startsWith('/vi/')) return;
    if (isPrivate) return;

    if (path === '/en' || path.startsWith('/en/')) {
      window.localStorage.setItem('d68_lang', 'en');
      return;
    }

    const preferred = window.localStorage.getItem('d68_lang');
    if (preferred === 'en') {
      navigate(`${toLocalizedPath(stripLangPrefix(path), 'en')}${location.search || ''}`, { replace: true });
      return;
    }

    window.localStorage.setItem('d68_lang', lang);
  }, [location.pathname, location.search, lang, navigate]);

  return null;
}

function LegacyViRedirect() {
  const location = useLocation();
  return <Navigate to={`${stripLangPrefix(location.pathname)}${location.search || ''}`} replace />;
}

function DashboardGate({ role, children }: { role: 'business' | 'investor'; children: ReactNode }) {
  const { profile, loading } = useAuth();
  const location = useLocation();
  if (loading) return <RouteFallback />;
  if (!profile) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (profile.role !== role && profile.role !== 'admin') {
    return <section style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px' }}><div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: 24 }}><h2>Access restricted</h2><p>Role hiện tại: {profile.role}. Dashboard này dành cho {role}.</p></div></section>;
  }
  if (profile.role !== 'admin' && !profile.dashboard_login_enabled) {
    return <main className="d68-auth-page"><section className="d68-auth-card"><div className="d68-auth-head"><span>🔒 Payment pending</span><h1>Dashboard đang chờ mở khóa</h1><p>Tài khoản đã được tạo nhưng dashboard chỉ mở sau khi Admin xác nhận thanh toán hoặc kích hoạt theo quy trình beta.</p></div><div className="d68-auth-banner">Profile status: {profile.status || 'payment_pending'}</div><a className="d68-auth-submit" href="/pricing">Xem bảng giá / thanh toán</a></section></main>;
  }
  return <>{children}</>;
}

export default function App(){
  const location = useLocation();
  const lang = langFromPath(location.pathname);

  return <div data-lang={lang}>
    <ScrollToTop />
    <LanguageMemory />
    <SeoManager />
    <Header lang={lang}/>
    <Suspense fallback={<RouteFallback/>}>
      <Routes>
        <Route path="/" element={<Home lang="vi"/>}/>
        <Route path="/businesses" element={<Businesses lang="vi"/>}/>
        <Route path="/businesses/:slug" element={<BusinessDetail lang="vi"/>}/>
        <Route path="/investors" element={<Investors lang="vi"/>}/>
        <Route path="/investors/:code" element={<InvestorDetailV10 lang="vi"/>}/>
        <Route path="/pricing" element={<Pricing lang="vi"/>}/>
        <Route path="/valuation" element={<Valuation lang="vi"/>}/>
        <Route path="/login" element={<Login lang="vi"/>}/>
        <Route path="/forgot-password" element={<ForgotPassword lang="vi"/>}/>
        <Route path="/reset-password" element={<ResetPassword lang="vi"/>}/>
        <Route path="/register/:role" element={<Register lang="vi"/>}/>
        <Route path="/register" element={<Navigate to="/pricing" replace/>}/>
        <Route path="/about" element={<About lang="vi"/>}/>
        <Route path="/terms" element={<Terms lang="vi"/>}/>
        <Route path="/privacy" element={<Privacy lang="vi"/>}/>
        <Route path="/contact" element={<Contact lang="vi"/>}/>
        <Route path="/partners" element={<MarketPartner lang="vi"/>}/>
        <Route path="/market-partner" element={<MarketPartner lang="vi"/>}/>

        <Route path="/en" element={<Home lang="en"/>}/>
        <Route path="/en/businesses" element={<Businesses lang="en"/>}/>
        <Route path="/en/businesses/:slug" element={<BusinessDetail lang="en"/>}/>
        <Route path="/en/investors" element={<Investors lang="en"/>}/>
        <Route path="/en/investors/:code" element={<InvestorDetailV10 lang="en"/>}/>
        <Route path="/en/pricing" element={<Pricing lang="en"/>}/>
        <Route path="/en/valuation" element={<Valuation lang="en"/>}/>
        <Route path="/en/login" element={<Login lang="en"/>}/>
        <Route path="/en/forgot-password" element={<ForgotPassword lang="en"/>}/>
        <Route path="/en/reset-password" element={<ResetPassword lang="en"/>}/>
        <Route path="/en/register/:role" element={<Register lang="en"/>}/>
        <Route path="/en/register" element={<Navigate to="/en/pricing" replace/>}/>
        <Route path="/en/about" element={<About lang="en"/>}/>
        <Route path="/en/terms" element={<Terms lang="en"/>}/>
        <Route path="/en/privacy" element={<Privacy lang="en"/>}/>
        <Route path="/en/contact" element={<Contact lang="en"/>}/>
        <Route path="/en/partners" element={<MarketPartner lang="en"/>}/>
        <Route path="/en/market-partner" element={<MarketPartner lang="en"/>}/>
        <Route path="/en/dashboard/business" element={<DashboardGate role="business"><BusinessDashboard/></DashboardGate>}/>
        <Route path="/en/dashboard/business/*" element={<DashboardGate role="business"><BusinessDashboard/></DashboardGate>}/>
        <Route path="/en/dashboard/investor" element={<DashboardGate role="investor"><InvestorProfileV10/></DashboardGate>}/>
        <Route path="/en/dashboard/investor/profile" element={<DashboardGate role="investor"><InvestorProfileV10/></DashboardGate>}/>
        <Route path="/en/dashboard/investor/*" element={<DashboardGate role="investor"><InvestorDashboard/></DashboardGate>}/>

        <Route path="/vi" element={<Navigate to="/" replace/>}/>
        <Route path="/vi/*" element={<LegacyViRedirect/>}/>

        <Route path="/admin/login" element={<Login lang={lang}/>}/>
        <Route path="/dashboard/business" element={<DashboardGate role="business"><BusinessDashboard/></DashboardGate>}/>
        <Route path="/dashboard/business/*" element={<DashboardGate role="business"><BusinessDashboard/></DashboardGate>}/>
        <Route path="/dashboard/investor" element={<DashboardGate role="investor"><InvestorProfileV10/></DashboardGate>}/>
        <Route path="/dashboard/investor/profile" element={<DashboardGate role="investor"><InvestorProfileV10/></DashboardGate>}/>
        <Route path="/dashboard/investor/*" element={<DashboardGate role="investor"><InvestorDashboard/></DashboardGate>}/>
        <Route path="/admin/valuation" element={<AdminValuation/>}/>
        <Route path="/admin/valuation-config" element={<AdminValuation/>}/>
        <Route path="/admin/proposals" element={<Admin/>}/>
        <Route path="/admin/banners" element={<AdminBannersV10/>}/>
        <Route path="/admin" element={<Admin/>}/>
        <Route path="/admin/*" element={<Admin/>}/>

        <Route path="/how-it-works" element={<ModuleScreen/>}/>
        <Route path="/businesses/featured" element={<ModuleScreen/>}/>
        <Route path="/businesses/fundraising" element={<ModuleScreen/>}/>
        <Route path="/businesses/sale" element={<ModuleScreen/>}/>
        <Route path="/businesses/debt" element={<ModuleScreen/>}/>
        <Route path="/investors/active" element={<ModuleScreen/>}/>
        <Route path="/investors/funds" element={<ModuleScreen/>}/>
        <Route path="/investors/strategic" element={<ModuleScreen/>}/>
        <Route path="/pricing/business" element={<ModuleScreen/>}/>
        <Route path="/pricing/investor" element={<ModuleScreen/>}/>
        <Route path="/valuation/rules" element={<ModuleScreen/>}/>
        <Route path="/faq" element={<ModuleScreen/>}/>
        <Route path="/localization" element={<ModuleScreen/>}/>
        <Route path="/market-intelligence" element={<ModuleScreen/>}/>
        <Route path="/dashboard/advisor/profile" element={<ModuleScreen/>}/>
        <Route path="/dashboard/advisor/clients" element={<ModuleScreen/>}/>
        <Route path="/dashboard/advisor/opportunities" element={<ModuleScreen/>}/>
        <Route path="/dashboard/advisor/settings" element={<ModuleScreen/>}/>
        <Route path="/dashboard/market-partner" element={<ModuleScreen/>}/>
        <Route path="/dashboard/market-partner/register" element={<ModuleScreen/>}/>
        <Route path="/dashboard/market-partner/links" element={<ModuleScreen/>}/>
        <Route path="/dashboard/market-partner/conversions" element={<ModuleScreen/>}/>
        <Route path="/dashboard/market-partner/payouts" element={<ModuleScreen/>}/>
        <Route path="/dashboard/market-partner/settings" element={<ModuleScreen/>}/>
        <Route path="/dashboard/affiliate/register" element={<Navigate to="/dashboard/market-partner/register" replace/>}/>
        <Route path="/dashboard/affiliate/links" element={<Navigate to="/dashboard/market-partner/links" replace/>}/>
        <Route path="/dashboard/affiliate/conversions" element={<Navigate to="/dashboard/market-partner/conversions" replace/>}/>
        <Route path="/dashboard/affiliate/payouts" element={<Navigate to="/dashboard/market-partner/payouts" replace/>}/>
        <Route path="/dashboard/affiliate/settings" element={<Navigate to="/dashboard/market-partner/settings" replace/>}/>
        <Route path="/checkout" element={<ModuleScreen/>}/>
        <Route path="/payment/pending" element={<ModuleScreen/>}/>
        <Route path="/payment/success" element={<ModuleScreen/>}/>
        <Route path="/data-room/:businessId" element={<ModuleScreen/>}/>
        <Route path="/messages" element={<ModuleScreen/>}/>
        <Route path="/notifications" element={<ModuleScreen/>}/>
        <Route path="/support" element={<ModuleScreen/>}/>
        <Route path="*" element={<NotFound/>}/>
      </Routes>
    </Suspense>
    <Footer lang={lang}/>
  </div>;
}