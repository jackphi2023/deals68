import {
  BarChart3,
  BriefcaseBusiness,
  CreditCard,
  FileText,
  Inbox,
  LayoutDashboard,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import type { Lang } from '../../lib/i18n';
import { toLocalizedPath } from '../../lib/i18nRoutes';
import { T } from '../../lib/labels';

type InvestorDashboardTab =
  | 'profile'
  | 'recommended'
  | 'watchlist'
  | 'proposals'
  | 'contacts'
  | 'billing';

// Exact menu labels, destinations, icons and markup inherited from main InvestorDashboard.
const investorDashboardTabs: {
  id: InvestorDashboardTab;
  Icon: typeof LayoutDashboard;
  vi: string;
  en: string;
  href: string;
}[] = [
  {
    id: 'profile',
    Icon: BriefcaseBusiness,
    vi: 'Hồ sơ',
    en: 'Profile',
    href: '/dashboard/investor/profile',
  },
  {
    id: 'recommended',
    Icon: LayoutDashboard,
    vi: 'Tiêu chí & Gợi ý',
    en: 'Criteria & Matches',
    href: '/dashboard/investor/matches',
  },
  {
    id: 'watchlist',
    Icon: FileText,
    vi: 'Đã lưu',
    en: 'Saved',
    href: '/dashboard/investor/saved',
  },
  {
    id: 'proposals',
    Icon: BarChart3,
    vi: 'Proposal',
    en: 'Proposals',
    href: '/dashboard/investor/proposals',
  },
  {
    id: 'contacts',
    Icon: Inbox,
    vi: 'Liên hệ & Bảo mật',
    en: 'Contact & Privacy',
    href: '/dashboard/investor/contact',
  },
  {
    id: 'billing',
    Icon: CreditCard,
    vi: 'Invoice/Thanh toán',
    en: 'Invoices/Payments',
    href: '/dashboard/investor/payments',
  },
];

const tabAliases: Record<string, InvestorDashboardTab> = {
  '': 'profile',
  profile: 'profile',
  criteria: 'recommended',
  matches: 'recommended',
  recommended: 'recommended',
  watchlist: 'watchlist',
  saved: 'watchlist',
  proposals: 'proposals',
  contact: 'contacts',
  contacts: 'contacts',
  privacy: 'contacts',
  payments: 'billing',
  invoices: 'billing',
  billing: 'billing',
};

function resolveTab(pathname: string): InvestorDashboardTab {
  const suffix = pathname
    .replace(/^\/en/, '')
    .replace('/dashboard/investor', '')
    .replace(/^\//, '')
    .split('/')[0];
  return tabAliases[suffix] || 'profile';
}

export default function InvestorDashboardNav({
  lang,
  publicInvestorPath,
}: {
  lang: Lang;
  publicInvestorPath?: string;
}) {
  const location = useLocation();
  const activeTab = resolveTab(location.pathname);

  return (
    <nav className="d68-dashboard-side" aria-label={T(lang, 'Menu Nhà đầu tư', 'Investor menu')}>
      {investorDashboardTabs.map((item) => (
        <Link
          key={item.id}
          to={toLocalizedPath(item.href, lang)}
          className={activeTab === item.id ? 'active' : ''}
        >
          <span className="d68-dashboard-nav-icon" aria-hidden="true">
            <item.Icon size={16} />
          </span>
          {T(lang, item.vi, item.en)}
        </Link>
      ))}
      {publicInvestorPath ? (
        <a
          className="d68-dashboard-public-link"
          href={publicInvestorPath}
          target="_blank"
          rel="noopener noreferrer"
        >
          {T(lang, 'Xem Hồ sơ hiển thị', 'View displayed profile')} ↗
        </a>
      ) : null}
    </nav>
  );
}
