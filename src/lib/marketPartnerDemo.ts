import type {
  AffiliateCommissionRow,
  AffiliatePayoutRow,
  MarketPartnerDashboardData,
} from './marketPartners';

export const MARKET_PARTNER_DEMO_EMAIL = 'partnerdemo@deals68.com';
export const MARKET_PARTNER_DEMO_PASSWORD = 'Abc@12345';
export const MARKET_PARTNER_DEMO_AFFILIATE_CODE = 'D68A7F3C9B2E';
export const MARKET_PARTNER_DEMO_SESSION_KEY = 'd68_market_partner_demo_session_v1';

const DEMO_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const BUSINESS_WEEKLY_PRICE_VND = 500_000;
const CUSTOMER_DISCOUNT_PCT = 40;
const COMMISSION_TIER_1_MAX = 20_000_000;
const COMMISSION_TIER_2_MAX = 50_000_000;
const COMMISSION_TIER_1_PCT = 40;
const COMMISSION_TIER_2_PCT = 50;
const COMMISSION_TIER_3_PCT = 60;

export type DemoPartnerTransaction = {
  businessCode: string;
  termWeeks: 4 | 8 | 12 | 16 | 24;
  createdAt: string;
  confirmedAt: string | null;
  paymentStatus: 'confirmed' | 'pending';
  transferStatus: 'success' | 'pending';
  subtotal: number;
  termDiscountPct: number;
  termDiscount: number;
  affiliateEligibleAmount: number;
  affiliateDiscountPct: number;
  affiliateDiscount: number;
  netPaidAmount: number;
  commissionPct: number;
  commissionAmount: number;
  commissionRecorded: boolean;
};

export type DemoAffiliateCommissionRow = AffiliateCommissionRow & {
  business_code: string;
  term_weeks: number;
};

export type MarketPartnerDemoDashboardData = Omit<MarketPartnerDashboardData, 'commissions'> & {
  transactions: DemoPartnerTransaction[];
  summary: {
    confirmedRevenue: number;
    pendingRevenue: number;
    projectedPendingCommission: number;
  };
  commissions: DemoAffiliateCommissionRow[];
};

function termDiscountPct(termWeeks: number) {
  if (termWeeks >= 16) return 20;
  if (termWeeks >= 8) return 15;
  return 0;
}

function commissionPct(netPaidAmount: number) {
  if (netPaidAmount < COMMISSION_TIER_1_MAX) return COMMISSION_TIER_1_PCT;
  if (netPaidAmount <= COMMISSION_TIER_2_MAX) return COMMISSION_TIER_2_PCT;
  return COMMISSION_TIER_3_PCT;
}

function calculateTransaction(input: {
  businessCode: string;
  termWeeks: DemoPartnerTransaction['termWeeks'];
  createdAt: string;
  confirmedAt?: string;
}): DemoPartnerTransaction {
  const subtotal = BUSINESS_WEEKLY_PRICE_VND * input.termWeeks;
  const discountPct = termDiscountPct(input.termWeeks);
  const termDiscount = Math.round(subtotal * discountPct / 100);
  const affiliateEligibleAmount = subtotal - termDiscount;
  const affiliateDiscount = Math.round(affiliateEligibleAmount * CUSTOMER_DISCOUNT_PCT / 100);
  const netPaidAmount = affiliateEligibleAmount - affiliateDiscount;
  const y = commissionPct(netPaidAmount);
  const recorded = Boolean(input.confirmedAt);

  return {
    businessCode: input.businessCode,
    termWeeks: input.termWeeks,
    createdAt: input.createdAt,
    confirmedAt: input.confirmedAt || null,
    paymentStatus: recorded ? 'confirmed' : 'pending',
    transferStatus: recorded ? 'success' : 'pending',
    subtotal,
    termDiscountPct: discountPct,
    termDiscount,
    affiliateEligibleAmount,
    affiliateDiscountPct: CUSTOMER_DISCOUNT_PCT,
    affiliateDiscount,
    netPaidAmount,
    commissionPct: y,
    commissionAmount: Math.round(netPaidAmount * y / 100),
    commissionRecorded: recorded,
  };
}

export const MARKET_PARTNER_DEMO_TRANSACTIONS: DemoPartnerTransaction[] = [
  calculateTransaction({
    businessCode: 'D68-20260710-F343',
    termWeeks: 12,
    createdAt: '2026-07-10T09:30:00+07:00',
    confirmedAt: '2026-07-15T10:15:00+07:00',
  }),
  calculateTransaction({
    businessCode: 'D68-02',
    termWeeks: 4,
    createdAt: '2026-07-11T14:00:00+07:00',
    confirmedAt: '2026-07-16T11:20:00+07:00',
  }),
  calculateTransaction({
    businessCode: 'D68-01',
    termWeeks: 16,
    createdAt: '2026-07-12T08:45:00+07:00',
    confirmedAt: '2026-07-17T15:05:00+07:00',
  }),
  calculateTransaction({
    businessCode: 'D68-03',
    termWeeks: 24,
    createdAt: '2026-07-13T16:10:00+07:00',
    confirmedAt: '2026-07-18T09:40:00+07:00',
  }),
  calculateTransaction({
    businessCode: 'D68-20260713-7030',
    termWeeks: 8,
    createdAt: '2026-07-19T10:25:00+07:00',
  }),
];

const confirmedTransactions = MARKET_PARTNER_DEMO_TRANSACTIONS.filter((row) => row.commissionRecorded);
const pendingTransactions = MARKET_PARTNER_DEMO_TRANSACTIONS.filter((row) => !row.commissionRecorded);
const recordedCommission = confirmedTransactions.reduce((sum, row) => sum + row.commissionAmount, 0);
const confirmedRevenue = confirmedTransactions.reduce((sum, row) => sum + row.netPaidAmount, 0);
const pendingRevenue = pendingTransactions.reduce((sum, row) => sum + row.netPaidAmount, 0);
const projectedPendingCommission = pendingTransactions.reduce((sum, row) => sum + row.commissionAmount, 0);
const payoutCode = 'D68PAY-20260720-01';

const commissions: DemoAffiliateCommissionRow[] = confirmedTransactions.map((row, index) => ({
  id: `demo-commission-${index + 1}`,
  partner_id: 'demo-market-partner-static',
  business_code: row.businessCode,
  term_weeks: row.termWeeks,
  currency: 'VND',
  net_paid_amount: row.netPaidAmount,
  commission_pct: row.commissionPct,
  commission_amount: row.commissionAmount,
  status: 'paid',
  payout_id: 'demo-payout-1',
  payout_code: payoutCode,
  source: 'payment_confirmed',
  paid_at: '2026-07-20T16:30:00+07:00',
  created_at: row.confirmedAt || row.createdAt,
  updated_at: '2026-07-20T16:30:00+07:00',
}));

const payouts: AffiliatePayoutRow[] = [{
  id: 'demo-payout-1',
  partner_id: 'demo-market-partner-static',
  payout_code: payoutCode,
  period_start: '2026-07-15',
  period_end: '2026-07-18',
  currency: 'VND',
  gross_commission_amount: recordedCommission,
  adjustment_amount: 0,
  net_payout_amount: recordedCommission,
  commission_count: commissions.length,
  status: 'paid',
  payment_reference: 'VCB-20260720-6868',
  note: 'Đối soát hoa hồng kỳ 07/2026',
  approved_at: '2026-07-20T09:00:00+07:00',
  paid_at: '2026-07-20T16:30:00+07:00',
  created_at: '2026-07-20T08:30:00+07:00',
  updated_at: '2026-07-20T16:30:00+07:00',
}];

export const MARKET_PARTNER_DEMO_DATA: MarketPartnerDemoDashboardData = {
  partner: {
    id: 'demo-market-partner-static',
    display_name: 'Đối tác thị trường Deals68',
    contact_email: MARKET_PARTNER_DEMO_EMAIL,
    phone: '+84 909 686 868',
    country: 'Việt Nam',
    country_iso2: 'VN',
    intro: 'Kết nối doanh nghiệp phù hợp với nền tảng Deals68.',
    affiliate_code: MARKET_PARTNER_DEMO_AFFILIATE_CODE,
    customer_discount_pct: CUSTOMER_DISCOUNT_PCT,
    commission_pct: COMMISSION_TIER_1_PCT,
    commission_basis_currency: 'VND',
    commission_tier_1_max: COMMISSION_TIER_1_MAX,
    commission_tier_2_max: COMMISSION_TIER_2_MAX,
    commission_tier_1_pct: COMMISSION_TIER_1_PCT,
    commission_tier_2_pct: COMMISSION_TIER_2_PCT,
    commission_tier_3_pct: COMMISSION_TIER_3_PCT,
    status: 'active',
    bank_account_json: {
      bank_name: 'Vietcombank',
      account_holder: 'DOI TAC THI TRUONG DEALS68',
      account_number: '6868686868',
      branch: 'TP. Hồ Chí Minh',
      swift_code: 'BFTVVNVX',
      currency: 'VND',
      country: 'Vietnam',
      note: 'Tài khoản nhận hoa hồng',
    },
    activated_at: '2026-07-01T09:00:00+07:00',
    created_at: '2026-07-01T08:30:00+07:00',
    updated_at: '2026-07-20T16:30:00+07:00',
  },
  metrics: {
    click_count: 28,
    signup_count: MARKET_PARTNER_DEMO_TRANSACTIONS.length,
    paid_transaction_count: confirmedTransactions.length,
    recorded_commission: recordedCommission,
    pending_commission: 0,
    approved_commission: 0,
    paid_commission: recordedCommission,
    available_commission: 0,
    currency: 'VND',
  },
  commissions,
  payouts,
  transactions: MARKET_PARTNER_DEMO_TRANSACTIONS,
  summary: {
    confirmedRevenue,
    pendingRevenue,
    projectedPendingCommission,
  },
};

export function isMarketPartnerDemoCredentials(email: string, password: string) {
  return email.trim().toLowerCase() === MARKET_PARTNER_DEMO_EMAIL && password === MARKET_PARTNER_DEMO_PASSWORD;
}

export function startMarketPartnerDemoSession() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(MARKET_PARTNER_DEMO_SESSION_KEY, JSON.stringify({
    email: MARKET_PARTNER_DEMO_EMAIL,
    expiresAt: Date.now() + DEMO_SESSION_TTL_MS,
  }));
}

export function hasMarketPartnerDemoSession() {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.sessionStorage.getItem(MARKET_PARTNER_DEMO_SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { email?: string; expiresAt?: number };
    if (parsed.email !== MARKET_PARTNER_DEMO_EMAIL || Number(parsed.expiresAt || 0) <= Date.now()) {
      window.sessionStorage.removeItem(MARKET_PARTNER_DEMO_SESSION_KEY);
      return false;
    }
    return true;
  } catch {
    window.sessionStorage.removeItem(MARKET_PARTNER_DEMO_SESSION_KEY);
    return false;
  }
}

export function clearMarketPartnerDemoSession() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(MARKET_PARTNER_DEMO_SESSION_KEY);
}
