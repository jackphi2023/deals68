export type InvestorRow = Record<string, any>;

export const INVESTOR_REVIEW_CRITERIA_KEYS = [
  'investment_appetite',
  'riskAppetite',
  'returnExpectation',
  'revenueRange',
] as const;

export const INVESTOR_PUBLIC_PROFILE_KEYS = [
  'title_vi',
  'title_en',
  'desc_vi',
  'desc_en',
  'country',
  'country_iso2',
  'region',
  'ticket_min',
  'ticket_max',
  'industries',
  'deal_types',
  'type',
  'stage',
] as const;

export function objectOf(value: unknown): InvestorRow {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as InvestorRow)
    : {};
}

export function clean(value: unknown) {
  return String(value ?? '').trim();
}

export function valueList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/[;,\n|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function pendingInvestorProfile(investor: InvestorRow) {
  return objectOf(objectOf(investor.privacy).pending_profile_changes);
}

export function pendingInvestorCriteriaV10(investor: InvestorRow) {
  return objectOf(pendingInvestorProfile(investor).criteria);
}

export function pendingInvestorCriteriaKeysV10(investor: InvestorRow) {
  const pendingCriteria = pendingInvestorCriteriaV10(investor);
  return INVESTOR_REVIEW_CRITERIA_KEYS.filter((key) =>
    Object.prototype.hasOwnProperty.call(pendingCriteria, key),
  );
}

export function changedInvestorCriteriaKeysV10(investor: InvestorRow) {
  const approvedCriteria = objectOf(investor.criteria);
  const pendingCriteria = pendingInvestorCriteriaV10(investor);
  return pendingInvestorCriteriaKeysV10(investor).filter(
    (key) => clean(pendingCriteria[key]) !== clean(approvedCriteria[key]),
  );
}

export function hasPendingInvestorCriteriaV10(investor: InvestorRow) {
  return pendingInvestorCriteriaKeysV10(investor).length > 0;
}

export function hasPendingInvestorAppetiteV10(investor: InvestorRow) {
  return Object.prototype.hasOwnProperty.call(
    pendingInvestorCriteriaV10(investor),
    'investment_appetite',
  );
}

export function investorReviewReasonsV10(investor: InvestorRow) {
  const pending = pendingInvestorProfile(investor);
  const pendingCriteria = objectOf(pending.criteria);
  const criteriaKeys = Object.keys(pendingCriteria);
  const reviewedCriteriaKeys = new Set<string>(INVESTOR_REVIEW_CRITERIA_KEYS);
  const profileCriteriaKeys = criteriaKeys.filter((key) => !reviewedCriteriaKeys.has(key));
  const topLevelKeys = Object.keys(pending).filter((key) => key !== 'criteria');
  const newAccount = ['draft', 'payment_pending', 'pending_admin_review'].includes(
    clean(investor.status),
  );
  const descriptionUpdated = ['desc_vi', 'desc_en'].some((key) =>
    Object.prototype.hasOwnProperty.call(pending, key),
  );
  const criteriaUpdated = pendingInvestorCriteriaKeysV10(investor).length > 0;
  const profileUpdated = topLevelKeys.length > 0 || profileCriteriaKeys.length > 0;

  return {
    newAccount,
    profileUpdated,
    criteriaUpdated,
    descriptionUpdated,
    pendingKeys: topLevelKeys,
    pendingCriteriaKeys: criteriaKeys,
    any: newAccount || profileUpdated || criteriaUpdated,
  };
}

export function investorNeedsReviewV10(investor: InvestorRow) {
  return investorReviewReasonsV10(investor).any;
}

export function investorDisplayNameV10(investor: InvestorRow) {
  return (
    clean(investor.private_name) ||
    clean(investor.title_vi) ||
    clean(investor.title_en) ||
    clean(investor.code) ||
    'Investor'
  );
}

export function privacyAfterInvestorProfileApproval(investor: InvestorRow) {
  const privacy = { ...objectOf(investor.privacy) };
  const pendingCriteria = pendingInvestorCriteriaV10(investor);
  const preservedCriteria: InvestorRow = {};

  for (const key of INVESTOR_REVIEW_CRITERIA_KEYS) {
    if (Object.prototype.hasOwnProperty.call(pendingCriteria, key)) {
      preservedCriteria[key] = clean(pendingCriteria[key]);
    }
  }

  const preservedPending = Object.keys(preservedCriteria).length
    ? { criteria: preservedCriteria }
    : {};

  if (Object.keys(preservedPending).length) {
    privacy.pending_profile_changes = preservedPending;
    privacy.pending_submitted_at =
      clean(privacy.pending_submitted_at) || new Date().toISOString();
  } else {
    delete privacy.pending_profile_changes;
    delete privacy.pending_submitted_at;
  }

  return privacy;
}
