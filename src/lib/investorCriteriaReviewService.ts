import { INVESTOR_APPETITE_MAX_LENGTH } from './investorProfileService';
import { supabase } from './supabase';

export const INVESTOR_REVIEW_CRITERIA_KEYS = [
  'investment_appetite',
  'riskAppetite',
  'returnExpectation',
  'revenueRange',
] as const;

export type InvestorReviewCriteriaKey =
  (typeof INVESTOR_REVIEW_CRITERIA_KEYS)[number];

export type InvestorReviewCriteria = Record<InvestorReviewCriteriaKey, string>;

type AnyRow = Record<string, any>;

function objectOf(value: unknown): AnyRow {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as AnyRow)
    : {};
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

export function approvedInvestorReviewCriteria(
  investor: unknown,
): InvestorReviewCriteria {
  const criteria = objectOf(objectOf(investor).criteria);
  return {
    investment_appetite: clean(criteria.investment_appetite),
    riskAppetite: clean(criteria.riskAppetite),
    returnExpectation: clean(criteria.returnExpectation),
    revenueRange: clean(criteria.revenueRange || criteria.revenueBand),
  };
}

export function pendingInvestorReviewCriteria(
  investor: unknown,
): Partial<InvestorReviewCriteria> {
  const privacy = objectOf(objectOf(investor).privacy);
  const pending = objectOf(privacy.pending_profile_changes);
  const criteria = objectOf(pending.criteria);
  const result: Partial<InvestorReviewCriteria> = {};

  for (const key of INVESTOR_REVIEW_CRITERIA_KEYS) {
    if (Object.prototype.hasOwnProperty.call(criteria, key)) {
      result[key] = clean(criteria[key]);
    }
  }

  return result;
}

export function investorReviewCriteriaDraft(
  investor: unknown,
): InvestorReviewCriteria {
  const approved = approvedInvestorReviewCriteria(investor);
  const pending = pendingInvestorReviewCriteria(investor);
  return { ...approved, ...pending };
}

export function pendingInvestorReviewKeys(investor: unknown) {
  const pending = pendingInvestorReviewCriteria(investor);
  return INVESTOR_REVIEW_CRITERIA_KEYS.filter((key) =>
    Object.prototype.hasOwnProperty.call(pending, key),
  );
}

export function changedInvestorReviewKeys(investor: unknown) {
  const approved = approvedInvestorReviewCriteria(investor);
  const pending = pendingInvestorReviewCriteria(investor);
  return pendingInvestorReviewKeys(investor).filter(
    (key) => clean(pending[key]) !== clean(approved[key]),
  );
}

function normalizePatch(
  patch: Partial<InvestorReviewCriteria>,
): Partial<InvestorReviewCriteria> {
  const next: Partial<InvestorReviewCriteria> = {};
  for (const key of INVESTOR_REVIEW_CRITERIA_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    const value = clean(patch[key]);
    if (key === 'investment_appetite' && value.length > INVESTOR_APPETITE_MAX_LENGTH) {
      throw new Error('Khẩu vị đầu tư không được vượt quá 5.000 ký tự.');
    }
    if (key !== 'investment_appetite' && value.length > 160) {
      throw new Error('Giá trị tiêu chí không được vượt quá 160 ký tự.');
    }
    next[key] = value;
  }
  return next;
}

export async function submitMyInvestorCriteriaReview(
  patch: Partial<InvestorReviewCriteria>,
) {
  const normalized = normalizePatch(patch);
  const { data, error } = await supabase.rpc(
    'submit_my_investor_criteria_review',
    { criteria_patch: normalized },
  );
  if (error) throw error;
  return objectOf(data);
}

export async function approveInvestorCriteriaReview(
  investorId: string,
  patch: Partial<InvestorReviewCriteria>,
) {
  const id = clean(investorId);
  if (!id) throw new Error('Thiếu Investor ID.');
  const normalized = normalizePatch(patch);
  const { data, error } = await supabase.rpc(
    'admin_approve_investor_criteria',
    {
      investor_uuid: id,
      criteria_patch: normalized,
    },
  );
  if (error) throw error;
  return objectOf(data);
}
