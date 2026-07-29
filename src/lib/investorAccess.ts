import type { Lang } from './i18n';

const INVESTOR_MARKETPLACE_ROLES = new Set(['business', 'investor', 'admin']);

export function canViewInvestorMarketplace(role?: string | null) {
  return INVESTOR_MARKETPLACE_ROLES.has(String(role || ''));
}

export function investorMarketplaceTooltip(lang: Lang) {
  return lang === 'en'
    ? 'Only signed-in Business or Investor accounts can view this section.'
    : 'Chỉ doanh nghiệp hoặc nhà đầu tư đã đăng nhập mới được xem';
}
