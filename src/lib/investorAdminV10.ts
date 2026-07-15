export type InvestorRow = Record<string, any>;

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
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function pendingInvestorProfile(investor: InvestorRow) {
  return objectOf(objectOf(investor.privacy).pending_profile_changes);
}

export function investorNeedsReviewV10(investor: InvestorRow) {
  return (
    ['draft', 'payment_pending', 'pending_admin_review'].includes(
      clean(investor.status),
    ) || Object.keys(pendingInvestorProfile(investor)).length > 0
  );
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
  const pending = pendingInvestorProfile(investor);
  const pendingCriteria = objectOf(pending.criteria);
  const appetite = clean(pendingCriteria.investment_appetite);

  if (appetite) {
    privacy.pending_profile_changes = {
      criteria: { investment_appetite: appetite },
    };
  } else {
    delete privacy.pending_profile_changes;
    delete privacy.pending_submitted_at;
  }

  return privacy;
}
