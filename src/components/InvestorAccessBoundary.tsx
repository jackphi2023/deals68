import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { langFromPath, stripLangPrefix, toLocalizedPath } from '../lib/i18nRoutes';

const ALLOWED_ROLES = new Set(['business', 'investor', 'admin']);
const TOOLTIP_VI = 'Chỉ doanh nghiệp hoặc nhà đầu tư đã đăng nhập mới được xem';
const TOOLTIP_EN = 'Only signed-in businesses or investors can view this section';

function isInvestorRoute(pathname: string) {
  const path = stripLangPrefix(pathname);
  return path === '/investors' || path.startsWith('/investors/');
}

export default function InvestorAccessBoundary({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  const location = useLocation();
  const lang = langFromPath(location.pathname);
  const allowed = !!profile && ALLOWED_ROLES.has(String(profile.role));
  const restrictedRoute = isInvestorRoute(location.pathname);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const tooltip = lang === 'en' ? TOOLTIP_EN : TOOLTIP_VI;
    const locked = !allowed;
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href="/investors"], a[href^="/investors/"], a[href="/en/investors"], a[href^="/en/investors/"]'),
    );

    const cleanups = links.map((link) => {
      if (!locked) {
        link.removeAttribute('title');
        link.removeAttribute('aria-disabled');
        link.removeAttribute('data-investor-access-locked');
        return () => undefined;
      }

      const handleClick = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const loginPath = toLocalizedPath('/login', lang);
        const next = encodeURIComponent(link.getAttribute('href') || toLocalizedPath('/investors', lang));
        window.location.assign(`${loginPath}?next=${next}`);
      };

      link.setAttribute('title', tooltip);
      link.setAttribute('aria-disabled', 'true');
      link.setAttribute('data-investor-access-locked', 'true');
      link.addEventListener('click', handleClick, true);

      return () => {
        link.removeEventListener('click', handleClick, true);
        link.removeAttribute('title');
        link.removeAttribute('aria-disabled');
        link.removeAttribute('data-investor-access-locked');
      };
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [allowed, lang, location.pathname]);

  if (!restrictedRoute) return <>{children}</>;
  if (loading) {
    return <main style={{ maxWidth: 960, margin: '0 auto', padding: '56px 24px', color: '#64748B' }}>Loading...</main>;
  }
  if (!profile) {
    const loginPath = toLocalizedPath('/login', lang);
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${loginPath}?next=${next}`} replace />;
  }
  if (!allowed) {
    return (
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px' }}>
        <section style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: 24 }}>
          <h1 style={{ marginTop: 0, color: '#0F2A4A' }}>{lang === 'en' ? 'Access restricted' : 'Quyền truy cập bị giới hạn'}</h1>
          <p style={{ color: '#475569', marginBottom: 0 }}>
            {lang === 'en'
              ? 'Only signed-in Business, Investor, or Admin accounts can view investor profiles.'
              : 'Chỉ tài khoản Doanh nghiệp, Nhà đầu tư hoặc Admin đã đăng nhập mới được xem danh sách và hồ sơ Nhà đầu tư.'}
          </p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
