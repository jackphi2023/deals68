import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import InvestorAppetiteFormV10 from '../components/investor/InvestorAppetiteFormV10';
import InvestorProfileFormV10 from '../components/investor/InvestorProfileFormV10';
import { useAuth } from '../contexts/AuthContext';
import { getInvestorByOwner } from '../lib/data';
import type { InvestorRow } from '../lib/investorAdminV10';
import { langFromPath, toLocalizedPath } from '../lib/i18nRoutes';
import { T } from '../lib/labels';

const LINKS = [
  ['/dashboard/investor/profile', 'Hồ sơ', 'Profile'],
  ['/dashboard/investor/matches', 'Tiêu chí & Gợi ý', 'Criteria & Matches'],
  ['/dashboard/investor/saved', 'Đã lưu', 'Saved'],
  ['/dashboard/investor/proposals', 'Proposal', 'Proposals'],
  ['/dashboard/investor/contact', 'Liên hệ & Bảo mật', 'Contact & Privacy'],
  ['/dashboard/investor/payments', 'Invoice/Thanh toán', 'Invoices/Payments'],
] as const;

export default function InvestorProfileV10() {
  const { profile, loading } = useAuth();
  const location = useLocation();
  const lang = langFromPath(location.pathname);
  const [investor, setInvestor] = useState<InvestorRow | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  async function loadInvestor() {
    if (!profile?.id) return;
    const next = await getInvestorByOwner(profile.id);
    setInvestor(next || null);
    return next;
  }

  useEffect(() => {
    if (!profile?.id) return;
    setBusy(true);
    setError('');
    loadInvestor()
      .catch((loadError: any) => {
        setError(loadError?.message || T(lang, 'Không tải được hồ sơ.', 'Could not load profile.'));
      })
      .finally(() => setBusy(false));
  }, [profile?.id, lang]);

  if (loading || busy) {
    return <main className="d68-dashboard-page"><div className="d68-dashboard-wrap">{T(lang, 'Đang tải…', 'Loading…')}</div></main>;
  }
  if (!profile) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (profile.role !== 'investor' && profile.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  if (!investor) {
    return <main className="d68-dashboard-page"><div className="d68-dashboard-wrap"><div className="d68-dashboard-card"><h1>{T(lang, 'Không tìm thấy hồ sơ Nhà đầu tư', 'Investor profile not found')}</h1>{error ? <p>{error}</p> : null}</div></div></main>;
  }

  const privateName = String(
    investor.private_name ||
      profile.display_name ||
      profile.email?.split('@')[0] ||
      investor.title_vi ||
      investor.title_en ||
      T(lang, 'Nhà đầu tư', 'Investor'),
  ).trim();
  const publicPath = investor.code
    ? toLocalizedPath(`/investors/${investor.code}`, lang)
    : '';

  return (
    <main className="d68-dashboard-page d68-investor-dashboard-page">
      <div className="d68-dashboard-wrap">
        <header className="d68-dashboard-head">
          <div>
            <div className="d68-dashboard-kicker">Investor Dashboard</div>
            <div className="d68-investor-dashboard-title-row">
              <h1>{privateName}</h1>
              <span className="d68-investor-dashboard-id">{investor.code}</span>
            </div>
          </div>
        </header>

        <div className="d68-dashboard-cols">
          <nav className="d68-dashboard-side">
            {LINKS.map(([href, vi, en]) => (
              <Link
                key={href}
                to={toLocalizedPath(href, lang)}
                className={href.endsWith('/profile') ? 'active' : ''}
              >
                {T(lang, vi, en)}
              </Link>
            ))}
            {publicPath ? (
              <Link
                className="d68-dashboard-public-link"
                to={publicPath}
                target="_blank"
                rel="noopener noreferrer"
              >
                {T(lang, 'Xem Hồ sơ hiển thị', 'View displayed profile')} ↗
              </Link>
            ) : null}
          </nav>
          <section className="d68-v10-investor-profile-content">
            {error ? <div className="d68-dashboard-notice err">{error}</div> : null}
            <InvestorAppetiteFormV10
              investor={investor}
              lang={lang}
              onRefresh={async () => { await loadInvestor(); }}
            />
            <InvestorProfileFormV10
              investor={investor}
              lang={lang}
              onRefresh={async () => { await loadInvestor(); }}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
