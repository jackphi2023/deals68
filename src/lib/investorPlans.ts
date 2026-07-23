export type InvestorPlan = 'standard' | 'premium';

export type InvestorEntitlement =
  | 'receive_proposals'
  | 'save_businesses'
  | 'express_interest'
  | 'request_documents'
  | 'dataroom_access'
  | 'investment_opportunity_report'
  | 'portfolio_management'
  | 'advanced_analytics';

export const INVESTOR_PREMIUM_MONTHLY_VND = 50_000_000;
export const INVESTOR_PREMIUM_MONTHLY_USD = 2_500;

export const INVESTOR_STANDARD_ENTITLEMENTS: readonly InvestorEntitlement[] = [
  'receive_proposals',
  'save_businesses',
  'express_interest',
  'request_documents',
  'dataroom_access',
];

export const INVESTOR_PREMIUM_ENTITLEMENTS: readonly InvestorEntitlement[] = [
  ...INVESTOR_STANDARD_ENTITLEMENTS,
  'investment_opportunity_report',
  'portfolio_management',
  'advanced_analytics',
];

export function effectiveInvestorPlan(
  investor: {
    plan?: string | null;
    membership_expires_at?: string | null;
  },
  at = Date.now(),
): InvestorPlan {
  if (investor.plan !== 'premium') return 'standard';
  if (!investor.membership_expires_at) return 'premium';
  const expiresAt = new Date(investor.membership_expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt > at ? 'premium' : 'standard';
}

export function investorHasEntitlement(
  investor: {
    plan?: string | null;
    membership_expires_at?: string | null;
  },
  entitlement: InvestorEntitlement,
  at = Date.now(),
) {
  const available = effectiveInvestorPlan(investor, at) === 'premium'
    ? INVESTOR_PREMIUM_ENTITLEMENTS
    : INVESTOR_STANDARD_ENTITLEMENTS;
  return available.includes(entitlement);
}
