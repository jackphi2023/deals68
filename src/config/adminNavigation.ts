/* Single source of truth for Admin menu groups, routes and aliases.
   New management modules should register here and render inside the Admin shell. */
export type AdminTab =
  | 'overview'
  | 'payments'
  | 'proposals'
  | 'banners'
  | 'businesses'
  | 'business_review'
  | 'assets'
  | 'investors'
  | 'promos'
  | 'requests'
  | 'leads'
  | 'logs'
  | 'settings';

export type AdminNavItem = {
  id: AdminTab;
  label: string;
  icon: string;
  href: string;
  aliases: string[];
};

export type AdminNavSection = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    id: 'operations',
    label: 'Vận hành',
    items: [
      { id: 'overview', label: 'Tổng quan', icon: '📊', href: '/admin', aliases: ['', 'overview'] },
      { id: 'payments', label: 'Thanh toán', icon: '💳', href: '/admin/payments', aliases: ['payments', 'approvals'] },
      { id: 'proposals', label: 'Proposal', icon: '📨', href: '/admin/proposals', aliases: ['proposals'] },
      { id: 'requests', label: 'Yêu cầu data', icon: '📂', href: '/admin/data-requests', aliases: ['data-requests', 'requests'] },
      { id: 'leads', label: 'Liên hệ/Đối tác', icon: '📨', href: '/admin/leads', aliases: ['leads', 'market-partners', 'contacts'] },
    ],
  },
  {
    id: 'profiles',
    label: 'Hồ sơ',
    items: [
      { id: 'business_review', label: 'Duyệt public DN', icon: '✅', href: '/admin/business-review', aliases: ['business-review'] },
      { id: 'businesses', label: 'Doanh nghiệp', icon: '🏢', href: '/admin/businesses', aliases: ['businesses'] },
      { id: 'assets', label: 'Ảnh/File DN', icon: '🖼️', href: '/admin/assets', aliases: ['assets'] },
      { id: 'investors', label: 'Nhà đầu tư', icon: '📈', href: '/admin/investors', aliases: ['investors'] },
    ],
  },
  {
    id: 'growth',
    label: 'Nội dung & tăng trưởng',
    items: [
      { id: 'banners', label: 'Banner', icon: '🖼️', href: '/admin/banners', aliases: ['banners', 'banner'] },
      { id: 'promos', label: 'Mã KM', icon: '🎟️', href: '/admin/promo', aliases: ['promo', 'promos'] },
    ],
  },
  {
    id: 'system',
    label: 'Hệ thống',
    items: [
      { id: 'logs', label: 'Audit', icon: '🧾', href: '/admin/audit', aliases: ['audit', 'logs'] },
      { id: 'settings', label: 'Cài đặt', icon: '⚙️', href: '/admin/settings', aliases: ['settings'] },
    ],
  },
];

const ADMIN_NAV_ITEMS = ADMIN_NAV_SECTIONS.flatMap((section) => section.items);

export function resolveAdminTab(pathname: string): AdminTab {
  const suffix = pathname
    .replace(/^\/admin\/?/, '')
    .split('/')[0];

  return (
    ADMIN_NAV_ITEMS.find((item) => item.aliases.includes(suffix))?.id ||
    'overview'
  );
}

const GLOBAL_SEARCH_TABS = new Set<AdminTab>([
  'businesses',
  'business_review',
  'assets',
  'investors',
]);

export function adminTabUsesGlobalSearch(tab: AdminTab) {
  return GLOBAL_SEARCH_TABS.has(tab);
}
