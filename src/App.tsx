import { Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import Header from './components/Header';
import SeoManager from './components/SeoManager';
import Footer from './components/Footer';
import Home from './pages/Home';
import { useAuth } from './contexts/AuthContext';
import { langFromPath, stripLangPrefix, toLocalizedPath } from './lib/i18nRoutes';

type RouteLoader = () => Promise<unknown>;
type IdleCapableWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const loadBusinesses = () => import('./pages/Businesses');
const loadBusinessDetail = () => import('./pages/BusinessDetail');
const loadInvestors = () => import('./pages/Investors');
const loadInvestorDetail = () => import('./pages/InvestorDetail');
const loadPricing = () => import('./pages/Pricing');
const loadLogin = () => import('./pages/Login');
const loadForgotPassword = () => import('./pages/ForgotPassword');
const loadResetPassword = () => import('./pages/ResetPassword');
const loadRegister = () => import('./pages/Register');
const loadValuation = () => import('./pages/Valuation');
const loadModuleScreen = () => import('./pages/ModuleScreen');
const loadNotFound = () => import('./pages/NotFound');
const loadBusinessDashboard = () => import('./pages/BusinessDashboardWithReports');
const loadInvestorDashboard = () => import('./pages/InvestorDashboard');
const loadAdmin = () => import('./pages/Admin');
const loadAdminValuation = () => import('./pages/AdminValuation');
const loadStaticPages = () => import('./pages/StaticPages');

const Businesses = lazy(loadBusinesses);
const BusinessDetail = lazy(loadBusinessDetail);
const Investors = lazy(loadInvestors);
const InvestorDetail = lazy(loadInvestorDetail);
const Pricing = lazy(loadPricing);
const Login = lazy(loadLogin);
const ForgotPassword = lazy(loadForgotPassword);
const ResetPassword = lazy(loadResetPassword);
const Register = lazy(loadRegister);
const Valuation = lazy(loadValuation);
const ModuleScreen = lazy(loadModuleScreen);
const NotFound = lazy(loadNotFound);
const BusinessDashboard = lazy(loadBusinessDashboard);
const InvestorDashboard = lazy(loadInvestorDashboard);
const Admin = lazy(loadAdmin);
const AdminValuation = lazy(loadAdminValuation);
const About = lazy(() => loadStaticPages().then((m) => ({ default: m.About })));
const Terms = lazy(() => loadStaticPages().then((m) => ({ default: m.Terms })));
const Privacy = lazy(() => loadStaticPages().then((m) => ({ default: m.Privacy })));
const Contact = lazy(() => loadStaticPages().then((m) => ({ default: m.Contact })));
const MarketPartner = lazy(() => loadStaticPages().then((m) => ({ default: m.MarketPartner })));

function likelyNextRouteLoaders(pathname: string): RouteLoader[] {
  const path = stripLangPrefix(pathname);
  if (path === '/') return [loadBusinesses, loadInvestors, loadPricing];
  if (path === '/businesses') return [loadBusinessDetail];
  if (path.startsWith('/businesses/')) return [loadInvestors];
  if (path === '/investors') return [loadInvestorDetail];
  if (path.startsWith('/investors/')) return [loadBusinesses];
  if (path === '/pricing') return [loadRegister];
  if (path === '/login') return [loadForgotPassword];
  return [];
}

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

function RoutePrefetch() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (
      connection?.saveData ||
      connection?.effectiveType === 'slow-2g' ||
      connection?.effectiveType === '2g'
    ) {
      return undefined;
    }

    const loaders = likelyNextRouteLoaders(location.pathname);
    if (!loaders.length) return undefined;

    let cancelled = false;
    const timers: number[] = [];
    const run = () => {
      loaders.forEach((loader, index) => {
        timers.push(window.setTimeout(() => {
          if (!cancelled) void loader().catch(() => undefined);
        }, index * 700));
      });
    };

    const idleWindow = window as IdleCapableWindow;
    const idleHandle = idleWindow.requestIdleCallback
      ? idleWindow.requestIdleCallback(run, { timeout: 5000 })
      : undefined;
    if (idleHandle === undefined) {
      timers.push(window.setTimeout(run, 3500));
    }

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
    };
  }, [location.pathname]);

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
  const lang = langFromPath(location.pathname);
  if (loading) return <RouteFallback />;
  if (!profile) {
    const loginPath = toLocalizedPath('/login', lang);
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${loginPath}?next=${next}`} replace />;
  }
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
    <RoutePrefetch />
    <LanguageMemory />
    <SeoManager />
    <Header lang={lang}/>
    <Suspense fallback={<RouteFallback/>}>
      <Routes>
        <Route path="/" element={<Home lang="vi"/>}/>
        <Route path="/businesses" element={<Businesses lang="vi"/>}/>
        <Route path="/businesses/:slug" element={<BusinessDetail lang="vi"/>}/>
        <Route path="/investors" element={<Investors lang="vi"/>}/>
        <Route path="/investors/:code" element={<InvestorDetail lang="vi"/>}/>
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
        <Route path="/en/investors/:code" element={<InvestorDetail lang="en"/>}/>
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
        <Route path="/en/dashboard/investor" element={<DashboardGate role="investor"><InvestorDashboard/></DashboardGate>}/>
        <Route path="/en/dashboard/investor/*" element={<DashboardGate role="investor"><InvestorDashboard/></DashboardGate>}/>

        <Route path="/vi" element={<Navigate to="/" replace/>}/>
        <Route path="/vi/*" element={<LegacyViRedirect/>}/>

        <Route path="/admin/login" element={<Login lang={lang}/>}/>
        <Route path="/dashboard/business" element={<DashboardGate role="business"><BusinessDashboard/></DashboardGate>}/>
        <Route path="/dashboard/business/*" element={<DashboardGate role="business"><BusinessDashboard/></DashboardGate>}/>
        <Route path="/dashboard/investor" element={<DashboardGate role="investor"><InvestorDashboard/></DashboardGate>}/>
        <Route path="/dashboard/investor/*" element={<DashboardGate role="investor"><InvestorDashboard/></DashboardGate>}/>
        <Route path="/admin/valuation" element={<AdminValuation/>}/>
        <Route path="/admin/valuation-config" element={<AdminValuation/>}/>
        <Route path="/admin/proposals" element={<Admin/>}/>
        <Route path="/admin/promo" element={<Admin/>}/>
        <Route path="/admin/promos" element={<Admin/>}/>
        <Route path="/admin/banners" element={<Admin/>}/>
        <Route path="/admin/banner" element={<Admin/>}/>
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
