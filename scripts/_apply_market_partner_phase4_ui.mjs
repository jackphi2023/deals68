#!/usr/bin/env node
import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${path}: expected one match, found ${count}`);
  }
  fs.writeFileSync(path, source.replace(before, after));
}

const registerPath = 'src/pages/Register.tsx';
const adminPath = 'src/pages/Admin.tsx';
const affiliatePath = 'src/lib/affiliate.ts';

replaceOnce(
  affiliatePath,
  `function storageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Cookie fallback remains available when localStorage is blocked.
  }
}
`,
  `function storageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Cookie fallback remains available when localStorage is blocked.
  }
}

function storageRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Cookie cleanup remains available when localStorage is blocked.
  }
}
`,
);

replaceOnce(
  affiliatePath,
  `export async function captureAffiliateReferralFromCurrentPage(): Promise<StoredAffiliateReferral | null> {`,
  `export function clearStoredAffiliateReferral() {
  if (typeof window === 'undefined') return;
  storageRemove(REFERRAL_STORAGE_KEY);
  if (typeof document !== 'undefined') {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = \`${REFERRAL_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax\${secure}\`;
  }
}

export async function captureAffiliateReferralFromCurrentPage(): Promise<StoredAffiliateReferral | null> {`,
);

replaceOnce(
  registerPath,
  `import type { InvestorPlan } from '../lib/investorPlans';
`,
  `import type { InvestorPlan } from '../lib/investorPlans';
import {
  applyAffiliateCodeForCheckout,
  clearStoredAffiliateReferral,
  getAffiliateCheckoutQuote,
  getAffiliateReferralForSignup,
  getStoredAffiliateReferral,
  type AffiliateCheckoutQuote,
  type StoredAffiliateReferral,
} from '../lib/affiliate';
`,
);

replaceOnce(
  registerPath,
  `  const [promoCode, setPromoCode] = useState('');
  const [promoPct, setPromoPct] = useState<number>(0);
  const [promoMsg, setPromoMsg] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
`,
  `  const [promoCode, setPromoCode] = useState('');
  const [promoPct, setPromoPct] = useState<number>(0);
  const [promoMsg, setPromoMsg] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [affiliateReferral, setAffiliateReferral] = useState<StoredAffiliateReferral | null>(() =>
    typeof window === 'undefined' ? null : getStoredAffiliateReferral(),
  );
  const [affiliateQuote, setAffiliateQuote] = useState<AffiliateCheckoutQuote | null>(null);
  const [affiliateLoading, setAffiliateLoading] = useState(false);
`,
);

replaceOnce(
  registerPath,
  `  useEffect(() => {
    getActiveValuationConfig()
      .then(setValuationConfig)
      .catch(() => setValuationConfig(DEFAULT_VALUATION_CONFIG));
  }, []);
`,
  `  useEffect(() => {
    getActiveValuationConfig()
      .then(setValuationConfig)
      .catch(() => setValuationConfig(DEFAULT_VALUATION_CONFIG));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getAffiliateReferralForSignup().then((referral) => {
      if (cancelled || !referral) return;
      setAffiliateReferral(referral);
      setPromoCode(referral.code);
      setPromoPct(0);
      setPromoMsg(
        T(lang, 'Đã nhận mã Đối tác. Đang xác thực mức giảm giá.', 'Partner code received. Validating discount.'),
      );
    });
    return () => { cancelled = true; };
  }, [lang]);
`,
);

replaceOnce(
  registerPath,
  `  const price = calculatePricing(
    {
      role: pricingRole,
      country: countryCode,
      termWeeks: effectiveWeeks,
      businessPlan: selectedBusinessPlan,
      promoCode,
    },
    promoPct,
  );
`,
  `  const basePrice = calculatePricing(
    {
      role: pricingRole,
      country: countryCode,
      termWeeks: effectiveWeeks,
      businessPlan: selectedBusinessPlan,
      promoCode: affiliateReferral ? '' : promoCode,
    },
    affiliateReferral ? 0 : promoPct,
  );
  const affiliateActive = Boolean(
    affiliateReferral && affiliateQuote?.valid && affiliateQuote.affiliate && affiliateQuote.price,
  );
  const price = affiliateActive
    ? { ...basePrice, ...(affiliateQuote?.price || {}), promoCode: undefined }
    : basePrice;

  useEffect(() => {
    let cancelled = false;
    if (!affiliateReferral || !hasSelectedPackage || (!isBusiness && !investorPremiumSelected)) {
      setAffiliateQuote(null);
      setAffiliateLoading(false);
      return () => { cancelled = true; };
    }

    setAffiliateLoading(true);
    void getAffiliateCheckoutQuote(affiliateReferral, {
      role: isInvestor ? 'investor' : 'business',
      countryIso2: countryCode,
      businessPlan: selectedBusinessPlan,
      termUnits: Number(isInvestor ? investorMonths : serviceWeeks),
      investorPlan,
    })
      .then((quote) => {
        if (cancelled) return;
        setAffiliateQuote(quote);
        if (quote.valid && quote.affiliate) {
          setPromoPct(0);
          setPromoMsg(
            T(
              lang,
              \`Mã Đối tác hợp lệ · giảm \${Number(quote.affiliate.customer_discount_pct || 0)}% · không cộng dồn mã khuyến mãi khác.\`,
              \`Valid Partner code · \${Number(quote.affiliate.customer_discount_pct || 0)}% discount · cannot be combined with another promo code.\`,
            ),
          );
        } else {
          setPromoMsg(T(lang, 'Mã Đối tác không còn hợp lệ cho gói đã chọn.', 'Partner code is not valid for the selected package.'));
        }
      })
      .catch((quoteError: any) => {
        if (cancelled) return;
        setAffiliateQuote({ valid: false, reason: quoteError?.message || 'quote_failed' });
        setPromoMsg(T(lang, 'Không thể xác thực giảm giá Đối tác.', 'Could not validate Partner discount.'));
      })
      .finally(() => {
        if (!cancelled) setAffiliateLoading(false);
      });

    return () => { cancelled = true; };
  }, [
    affiliateReferral?.code,
    affiliateReferral?.clickId,
    countryCode,
    hasSelectedPackage,
    investorMonths,
    investorPlan,
    investorPremiumSelected,
    isBusiness,
    isInvestor,
    lang,
    selectedBusinessPlan,
    serviceWeeks,
  ]);
`,
);

replaceOnce(
  registerPath,
  `  function removeAsset(kind: 'image' | 'doc', id: string) {
    const setter = kind === 'image' ? setBusinessImages : setBusinessDocs;
    setter((current) => current.filter((asset) => asset.id !== id));
  }

  async function submit(event: FormEvent) {`,
  `  function removeAsset(kind: 'image' | 'doc', id: string) {
    const setter = kind === 'image' ? setBusinessImages : setBusinessDocs;
    setter((current) => current.filter((asset) => asset.id !== id));
  }

  async function applyRegistrationCode() {
    const code = promoCode.trim().toUpperCase();
    if (!code) {
      setPromoPct(0);
      setPromoMsg(T(lang, 'Vui lòng nhập mã.', 'Please enter a code.'));
      return;
    }

    setPromoLoading(true);
    setPaymentAck(false);
    try {
      const referral = await applyAffiliateCodeForCheckout(code);
      if (referral) {
        setAffiliateReferral(referral);
        setAffiliateQuote(null);
        setPromoCode(referral.code);
        setPromoPct(0);
        setPromoMsg(T(lang, 'Đã nhận mã Đối tác. Đang xác thực mức giảm giá.', 'Partner code received. Validating discount.'));
        return;
      }

      const result = await lookupPromo(code, pricingRole);
      setPromoPct(Number(result.discountPct || 0));
      setPromoMsg(
        result.discountPct
          ? T(lang, 'Mã khuyến mãi hợp lệ, đã cập nhật số tiền.', 'Valid promo code, amount updated.')
          : result.message || T(lang, 'Mã không hợp lệ.', 'Invalid code.'),
      );
    } catch (codeError: any) {
      setPromoPct(0);
      setPromoMsg(codeError?.message || T(lang, 'Không thể kiểm tra mã.', 'Could not check code.'));
    } finally {
      setPromoLoading(false);
    }
  }

  function removeAffiliateCode() {
    clearStoredAffiliateReferral();
    setAffiliateReferral(null);
    setAffiliateQuote(null);
    setAffiliateLoading(false);
    setPromoCode('');
    setPromoPct(0);
    setPromoMsg(T(lang, 'Đã bỏ mã Đối tác.', 'Partner code removed.'));
    setPaymentAck(false);
  }

  async function submit(event: FormEvent) {`,
);

replaceOnce(
  registerPath,
  `    setLoading(true);
    setMsg('');

    if (isInvestor) {`,
  `    if (
      affiliateReferral &&
      hasSelectedPackage &&
      (!affiliateQuote?.valid || !affiliateQuote.affiliate || affiliateLoading)
    ) {
      setMsgType('err');
      setMsg(
        T(
          lang,
          'Mã Đối tác chưa được hệ thống xác thực cho gói đã chọn. Vui lòng thử lại hoặc bỏ mã.',
          'The Partner code has not been validated for the selected package. Please retry or remove it.',
        ),
      );
      return;
    }
    if (affiliateActive && promoPct > 0) {
      setMsgType('err');
      setMsg(T(lang, 'Không thể cộng dồn mã Đối tác và mã khuyến mãi.', 'Partner and promo codes cannot be combined.'));
      return;
    }

    setLoading(true);
    setMsg('');

    if (isInvestor) {`,
);

replaceOnce(
  registerPath,
  `          checkout_intent: intent,
          price: isInvestor && investorPlan === 'standard'
`,
  `          checkout_intent: intent,
          affiliate: affiliateActive ? affiliateQuote?.affiliate : undefined,
          affiliate_code: affiliateActive ? affiliateQuote?.affiliate?.affiliate_code : undefined,
          partner_id: affiliateActive ? affiliateQuote?.affiliate?.partner_id : undefined,
          affiliate_discount_pct: affiliateActive ? affiliateQuote?.affiliate?.customer_discount_pct : undefined,
          affiliate_discount_amount: affiliateActive ? affiliateQuote?.affiliate?.discount_amount : undefined,
          net_paid_amount: affiliateActive ? affiliateQuote?.affiliate?.net_paid_amount : undefined,
          affiliate_policy_version: affiliateActive ? affiliateQuote?.affiliate?.policy_version : undefined,
          price: isInvestor && investorPlan === 'standard'
`,
);

replaceOnce(
  registerPath,
  `                      promoCode,
                    },
                    promoPct,
`,
  `                      promoCode: affiliateReferral ? '' : promoCode,
                    },
                    affiliateReferral ? 0 : promoPct,
`,
);

replaceOnce(
  registerPath,
  `                <input
                  value={promoCode}
                  onChange={(event) =>
                    setPromoCode(event.target.value.toUpperCase())
                  }
                  placeholder={T(lang, 'Nhập mã (nếu có)', 'Enter code (optional)')}
                />
                <button
                  type="button"
                  disabled={promoLoading}
                  onClick={async () => {
                    setPromoLoading(true);
                    const result = await lookupPromo(promoCode, pricingRole).catch(
                      (promoError: any) => ({
                        discountPct: 0,
                        message: promoError?.message || 'Could not check promo.',
                      }),
                    );
                    setPromoLoading(false);
                    setPromoPct(Number(result.discountPct || 0));
                    setPromoMsg(
                      result.discountPct
                        ? T(
                            lang,
                            'Mã hợp lệ, đã cập nhật số tiền giảm giá',
                            'Valid code, discount amount updated',
                          )
                        : result.message || T(lang, 'Mã không hợp lệ.', 'Invalid code.'),
                    );
                  }}
                >
                  {promoLoading ? '...' : T(lang, 'Áp dụng', 'Apply')}
                </button>`,
  `                <input
                  value={promoCode}
                  disabled={Boolean(affiliateReferral)}
                  onChange={(event) => {
                    setPromoCode(event.target.value.toUpperCase());
                    setPromoPct(0);
                    setPromoMsg('');
                  }}
                  placeholder={T(lang, 'Nhập mã khuyến mãi hoặc mã Đối tác', 'Enter a promo or Partner code')}
                />
                <button
                  type="button"
                  disabled={promoLoading || affiliateLoading}
                  onClick={affiliateReferral ? removeAffiliateCode : applyRegistrationCode}
                >
                  {promoLoading || affiliateLoading
                    ? '...'
                    : affiliateReferral
                      ? T(lang, 'Bỏ mã', 'Remove')
                      : T(lang, 'Áp dụng', 'Apply')}
                </button>`,
);

replaceOnce(
  registerPath,
  `                    promoPct
                      ? 'd68-bizreg-promo-ok'
                      : 'd68-bizreg-promo-warn'`,
  `                    affiliateActive || promoPct
                      ? 'd68-bizreg-promo-ok'
                      : 'd68-bizreg-promo-warn'`,
);

replaceOnce(
  registerPath,
  `                a={T(lang, 'Giảm giá', 'Promo discount')}
                b={
                  hasSelectedPackage
                    ? price.promoDiscountPct
                      ? '-' +
                        money(price.promoDiscount, price.currency) +
                        ' (' +
                        price.promoDiscountPct +
                        '%)'
                      : T(lang, 'Không', 'None')
                    : '-'
                }
                good={hasSelectedPackage && !!price.promoDiscountPct}`,
  `                a={affiliateActive
                  ? T(lang, 'Giảm giá Đối tác', 'Partner discount')
                  : T(lang, 'Giảm giá khuyến mãi', 'Promo discount')}
                b={
                  hasSelectedPackage
                    ? affiliateActive && affiliateQuote?.affiliate
                      ? '-' +
                        money(affiliateQuote.affiliate.discount_amount, price.currency) +
                        ' (' +
                        Number(affiliateQuote.affiliate.customer_discount_pct || 0) +
                        '%)'
                      : price.promoDiscountPct
                        ? '-' +
                          money(price.promoDiscount, price.currency) +
                          ' (' +
                          price.promoDiscountPct +
                          '%)'
                        : T(lang, 'Không', 'None')
                    : '-'
                }
                good={hasSelectedPackage && (affiliateActive || !!price.promoDiscountPct)}`,
);

replaceOnce(
  registerPath,
  `                  onChange={(event) => setPaymentAck(event.target.checked)}`,
  `                  disabled={affiliateLoading || Boolean(affiliateReferral && !affiliateActive)}
                  onChange={(event) => setPaymentAck(event.target.checked)}`,
);

replaceOnce(
  adminPath,
  `  convertPartnerLead,
  createMarketPartner,
`,
  `  DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY,
  convertPartnerLead,
  createMarketPartner,
`,
);

replaceOnce(
  adminPath,
  `  customerDiscountPct: 0,
  commissionPct: 0,
`,
  `  ...DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY,
`,
);

replaceOnce(
  adminPath,
  `  const [customerDiscountPct, setCustomerDiscountPct] = useState(0);
  const [commissionPct, setCommissionPct] = useState(0);
  const [status, setStatus] = useState<MarketPartnerStatus>('active');`,
  `  const [customerDiscountPct, setCustomerDiscountPct] = useState(DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.customerDiscountPct);
  const [commissionPct, setCommissionPct] = useState(DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.commissionPct);
  const [commissionBasisCurrency, setCommissionBasisCurrency] = useState<'VND' | 'USD'>(DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.commissionBasisCurrency);
  const [commissionTier1Max, setCommissionTier1Max] = useState(DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.commissionTier1Max);
  const [commissionTier2Max, setCommissionTier2Max] = useState(DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.commissionTier2Max);
  const [commissionTier2Pct, setCommissionTier2Pct] = useState(DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.commissionTier2Pct);
  const [commissionTier3Pct, setCommissionTier3Pct] = useState(DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.commissionTier3Pct);
  const [status, setStatus] = useState<MarketPartnerStatus>('active');`,
);

replaceOnce(
  adminPath,
  `      <label>Hoa hồng partner (%)<input className="d68-admin-input" type="number" min="0" max="100" step="0.01" value={commissionPct} onChange={(event) => setCommissionPct(Number(event.target.value || 0))} /></label>
      <label>Trạng thái`,
  `      <label>Y1 · Hoa hồng dưới mốc 1 (%)<input className="d68-admin-input" type="number" min="0" max="100" step="0.01" value={commissionPct} onChange={(event) => setCommissionPct(Number(event.target.value || 0))} /></label>
      <label>Đồng tiền mốc Y<select className="d68-admin-input" value={commissionBasisCurrency} onChange={(event) => setCommissionBasisCurrency(event.target.value as 'VND' | 'USD')}><option value="VND">VND</option><option value="USD">USD</option></select></label>
      <label>Mốc doanh thu 1<input className="d68-admin-input" type="number" min="0" step="1" value={commissionTier1Max} onChange={(event) => setCommissionTier1Max(Number(event.target.value || 0))} /></label>
      <label>Mốc doanh thu 2<input className="d68-admin-input" type="number" min="0" step="1" value={commissionTier2Max} onChange={(event) => setCommissionTier2Max(Number(event.target.value || 0))} /></label>
      <label>Y2 · Hoa hồng mốc 1–2 (%)<input className="d68-admin-input" type="number" min="0" max="100" step="0.01" value={commissionTier2Pct} onChange={(event) => setCommissionTier2Pct(Number(event.target.value || 0))} /></label>
      <label>Y3 · Hoa hồng trên mốc 2 (%)<input className="d68-admin-input" type="number" min="0" max="100" step="0.01" value={commissionTier3Pct} onChange={(event) => setCommissionTier3Pct(Number(event.target.value || 0))} /></label>
      <label>Trạng thái`,
);

replaceOnce(
  adminPath,
  `        onClick={() => onConvert(lead, { customerDiscountPct, commissionPct, status, affiliateCode })}`,
  `        onClick={() => onConvert(lead, {
          customerDiscountPct,
          commissionPct,
          commissionBasisCurrency,
          commissionTier1Max,
          commissionTier2Max,
          commissionTier2Pct,
          commissionTier3Pct,
          status,
          affiliateCode,
        })}`,
);

replaceOnce(
  adminPath,
  `    commissionPct: Number(partner.commission_pct || 0),
    status: partner.status,`,
  `    commissionPct: Number(partner.commission_tier_1_pct ?? partner.commission_pct ?? DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.commissionPct),
    commissionBasisCurrency: String(partner.commission_basis_currency || DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.commissionBasisCurrency) === 'USD' ? 'USD' : 'VND',
    commissionTier1Max: Number(partner.commission_tier_1_max ?? DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.commissionTier1Max),
    commissionTier2Max: Number(partner.commission_tier_2_max ?? DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.commissionTier2Max),
    commissionTier2Pct: Number(partner.commission_tier_2_pct ?? DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.commissionTier2Pct),
    commissionTier3Pct: Number(partner.commission_tier_3_pct ?? DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.commissionTier3Pct),
    status: partner.status,`,
);

replaceOnce(
  adminPath,
  `    <label>Giảm giá khách hàng (%)<input className="d68-admin-input" type="number" min="0" max="100" step="0.01" value={draft.customerDiscountPct} onChange={(event) => setDraft((current) => ({ ...current, customerDiscountPct: Number(event.target.value || 0) }))} /></label>
    <label>Hoa hồng partner (%)<input className="d68-admin-input" type="number" min="0" max="100" step="0.01" value={draft.commissionPct} onChange={(event) => setDraft((current) => ({ ...current, commissionPct: Number(event.target.value || 0) }))} /></label>
    <label>Trạng thái`,
  `    <label>X · Giảm giá khách hàng (%)<input className="d68-admin-input" type="number" min="0" max="100" step="0.01" value={draft.customerDiscountPct} onChange={(event) => setDraft((current) => ({ ...current, customerDiscountPct: Number(event.target.value || 0) }))} /></label>
    <label>Đồng tiền mốc Y<select className="d68-admin-input" value={draft.commissionBasisCurrency} onChange={(event) => setDraft((current) => ({ ...current, commissionBasisCurrency: event.target.value as 'VND' | 'USD' }))}><option value="VND">VND</option><option value="USD">USD</option></select></label>
    <label>Mốc doanh thu 1<input className="d68-admin-input" type="number" min="0" step="1" value={draft.commissionTier1Max} onChange={(event) => setDraft((current) => ({ ...current, commissionTier1Max: Number(event.target.value || 0) }))} /></label>
    <label>Y1 · Dưới mốc 1 (%)<input className="d68-admin-input" type="number" min="0" max="100" step="0.01" value={draft.commissionPct} onChange={(event) => setDraft((current) => ({ ...current, commissionPct: Number(event.target.value || 0) }))} /></label>
    <label>Mốc doanh thu 2<input className="d68-admin-input" type="number" min="0" step="1" value={draft.commissionTier2Max} onChange={(event) => setDraft((current) => ({ ...current, commissionTier2Max: Number(event.target.value || 0) }))} /></label>
    <label>Y2 · Từ mốc 1 đến mốc 2 (%)<input className="d68-admin-input" type="number" min="0" max="100" step="0.01" value={draft.commissionTier2Pct} onChange={(event) => setDraft((current) => ({ ...current, commissionTier2Pct: Number(event.target.value || 0) }))} /></label>
    <label>Y3 · Trên mốc 2 (%)<input className="d68-admin-input" type="number" min="0" max="100" step="0.01" value={draft.commissionTier3Pct} onChange={(event) => setDraft((current) => ({ ...current, commissionTier3Pct: Number(event.target.value || 0) }))} /></label>
    <label>Trạng thái`,
);

replaceOnce(
  adminPath,
  `            Mã affiliate, giảm giá khách hàng và tỷ lệ hoa hồng được quản trị riêng; không dùng admin_priority hoặc dữ liệu Investor.`,
  `            Admin cấu hình X và biểu Y riêng cho từng Partner. X giảm trên phí sau chiết khấu kỳ hạn; Y tính trên tiền khách thực thanh toán. Không cộng dồn promo và không dùng dữ liệu Investor.`,
);

console.log('✓ Phase 4 UI applicator completed.');
