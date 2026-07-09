import type { Lang } from './i18n';

export type BusinessPlanKey = 'standard' | 'featured';

export const BUSINESS_STANDARD_PROPOSAL_QUOTA = 50;
export const BUSINESS_FEATURED_PROPOSAL_QUOTA = 80;

export function normalizeBusinessPlan(plan: any): BusinessPlanKey {
  const value = String(plan || '').trim().toLowerCase();
  if (value.includes('featured') || value.includes('priority') || value.includes('ưu tiên') || value.includes('uu tien')) return 'featured';
  return 'standard';
}

export function businessProposalQuotaForPlan(plan: any): number {
  return normalizeBusinessPlan(plan) === 'featured' ? BUSINESS_FEATURED_PROPOSAL_QUOTA : BUSINESS_STANDARD_PROPOSAL_QUOTA;
}

export function businessProposalQuotaLabel(plan: any, lang: Lang = 'vi'): string {
  const quota = businessProposalQuotaForPlan(plan);
  return lang === 'en' ? `${quota} business profile sends` : `${quota} lượt gửi Hồ sơ doanh nghiệp`;
}
