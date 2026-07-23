import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Lang } from '../lib/i18n';
import { lookupPromo, type PricingRole } from '../lib/pricing';
import {
  BUSINESS_FEATURED_PROPOSAL_QUOTA,
  BUSINESS_STANDARD_PROPOSAL_QUOTA,
  businessProposalQuotaForPlan,
} from '../lib/businessPlans';
import { toLocalizedPath } from '../lib/i18nRoutes';
import {
  INVESTOR_PREMIUM_MONTHLY_USD,
  INVESTOR_PREMIUM_MONTHLY_VND,
  type InvestorPlan,
} from '../lib/investorPlans';

const T = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);
type Role = 'business' | 'investor' | 'advisor';
type Country = 'vn' | 'other';
type BizPlan = 'standard' | 'featured';

const CFG = {
  business: {
    unitVi: 'tuần',
    unitEn: 'week',
    vn: 500_000,
    other: 20,
    min: 4,
    terms: [4, 8, 12, 16, 24],
    disc: (units: number) => (units >= 16 ? 20 : units >= 8 ? 15 : 0),
  },
  investor: {
    unitVi: 'tháng',
    unitEn: 'month',
    vn: INVESTOR_PREMIUM_MONTHLY_VND,
    other: INVESTOR_PREMIUM_MONTHLY_USD,
    min: 4,
    terms: [4, 8, 12, 16, 24],
    disc: (units: number) => (units >= 16 ? 20 : units >= 8 ? 15 : 0),
  },
  advisor: {
    unitVi: 'tháng',
    unitEn: 'month',
    vn: 1_000_000,
    other: 50,
    min: 4,
    terms: [4, 8, 12, 16, 24],
    disc: (units: number) => (units >= 16 ? 20 : units >= 8 ? 15 : 0),
  },
};

function money(value: number, currency: 'VND' | 'USD') {
  if (currency === 'VND') {
    return `${Math.round(value).toLocaleString('vi-VN')} ₫`;
  }
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function roleLabel(lang: Lang, role: Role) {
  return role === 'business'
    ? T(lang, 'Doanh nghiệp', 'Business')
    : role === 'investor'
      ? T(lang, 'Nhà đầu tư', 'Investor')
      : T(lang, 'Cố vấn', 'Advisor');
}

export default function Pricing({ lang }: { lang: Lang }) {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>('business');
  const [country, setCountry] = useState<Country>('vn');
  const [units, setUnits] = useState(4);
  const [bizPlan, setBizPlan] = useState<BizPlan>('standard');
  const [investorPlan, setInvestorPlan] = useState<InvestorPlan>('standard');
  const [promo, setPromo] = useState('');
  const [promoPct, setPromoPct] = useState(0);
  const [promoMsg, setPromoMsg] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  const cfg = CFG[role];
  const currency: 'VND' | 'USD' = country === 'vn' ? 'VND' : 'USD';
  const investorStandardSelected = role === 'investor' && investorPlan === 'standard';
  const paidPlanSelected = !investorStandardSelected;
  const planMult = role === 'business' && bizPlan === 'featured' ? 1.3 : 1;
  const base = paidPlanSelected
    ? (country === 'vn' ? cfg.vn : cfg.other) * planMult
    : 0;
  const termPct = paidPlanSelected ? cfg.disc(units) : 0;
  const subtotal = base * (paidPlanSelected ? units : 0);
  const afterTerm = subtotal * (1 - termPct / 100);
  const effectivePromoPct = paidPlanSelected ? promoPct : 0;
  const total = afterTerm * (1 - effectivePromoPct / 100);
  const saving = subtotal - total;
  const unitLabel = T(lang, cfg.unitVi, cfg.unitEn);
  const planName = role === 'business'
    ? bizPlan === 'featured'
      ? T(lang, 'Gói Ưu tiên', 'Priority package')
      : T(lang, 'Gói Thường', 'Regular package')
    : role === 'investor'
      ? investorPlan === 'premium'
        ? T(lang, 'Nhà đầu tư Nâng cao', 'Premium Investor')
        : T(lang, 'Nhà đầu tư Tiêu chuẩn', 'Standard Investor')
      : roleLabel(lang, role);
  const businessProposalQuota = role === 'business'
    ? businessProposalQuotaForPlan(bizPlan)
    : 0;
  const termWeeks = role === 'business' ? units : paidPlanSelected ? units * 4 : 0;
  const advisorComingSoon = role === 'advisor';
  const advisorTooltip = T(lang, 'Sắp ra mắt', 'Coming soon');
  const premiumUnitPrice = country === 'vn'
    ? money(INVESTOR_PREMIUM_MONTHLY_VND, 'VND')
    : money(INVESTOR_PREMIUM_MONTHLY_USD, 'USD');

  const planCards = [
    {
      key: 'business' as Role,
      icon: '🏢',
      titleVi: 'Doanh nghiệp',
      titleEn: 'Business',
      descVi: 'Đăng hồ sơ gọi vốn, bán doanh nghiệp, vay vốn hoặc tìm đối tác chiến lược.',
      descEn: 'List a fundraise, business sale, loan or strategic partnership profile.',
      price: money(CFG.business.vn, 'VND'),
      perVi: 'tuần',
      perEn: 'week',
      popular: true,
      features: [
        T(lang, 'Hồ sơ ẩn danh công khai', 'Public anonymous profile'),
        T(
          lang,
          `Gói Thường: ${BUSINESS_STANDARD_PROPOSAL_QUOTA} lượt gửi Hồ sơ DN`,
          `Regular: ${BUSINESS_STANDARD_PROPOSAL_QUOTA} business profile sends`,
        ),
        T(
          lang,
          `Gói Ưu tiên: ${BUSINESS_FEATURED_PROPOSAL_QUOTA} lượt gửi Hồ sơ DN`,
          `Priority: ${BUSINESS_FEATURED_PROPOSAL_QUOTA} business profile sends`,
        ),
        T(lang, 'Xem Báo cáo Tối ưu Hồ sơ DN', 'View Business Profile Optimization Report'),
        T(lang, 'Tương tác với Nhà đầu tư kết nối', 'Interact with connected investors'),
      ],
    },
    {
      key: 'investor' as Role,
      icon: '📈',
      titleVi: 'Nhà đầu tư Tiêu chuẩn',
      titleEn: 'Standard Investor',
      descVi: 'Miễn phí tạo tài khoản và sử dụng các tính năng kết nối cốt lõi dành cho Nhà đầu tư.',
      descEn: 'Create an account for free and use the core Investor connection features.',
      price: T(lang, 'Miễn phí', 'Free'),
      perVi: '',
      perEn: '',
      popular: false,
      features: [
        T(lang, 'Tìm kiếm và lưu thương vụ quan tâm', 'Search for and save deals of interest'),
        T(lang, 'Nhận Proposal không giới hạn theo gói', 'Receive proposals without a plan quota'),
        T(
          lang,
          'Xem hồ sơ, gửi yêu cầu tài liệu và ký eNDA',
          'View profiles, request documents and sign eNDAs',
        ),
        T(
          lang,
          'Xem Dataroom sau khi được doanh nghiệp cấp quyền',
          'View the Dataroom after access is granted by the Business',
        ),
        T(
          lang,
          'Xem Báo cáo Phân tích đầu tư: 50 triệu đ/tháng.',
          'View Investment Analysis Reports: USD 2,500/month.',
        ),
      ],
    },
    {
      key: 'advisor' as Role,
      icon: '🤝',
      titleVi: 'Cố vấn',
      titleEn: 'Advisor',
      descVi: 'Đại diện nhiều thương vụ, quản lý khách hàng và hỗ trợ kết nối.',
      descEn: 'Represent multiple mandates, manage clients and support matching.',
      price: money(CFG.advisor.vn, 'VND'),
      perVi: 'tháng',
      perEn: 'month',
      popular: false,
      features: [
        T(lang, 'Quản lý nhiều hồ sơ', 'Manage multiple profiles'),
        T(lang, 'Tiếp cận nhiều nhà đầu tư hơn', 'Reach more investors'),
        T(lang, 'Kết nối Nhà đầu tư và Doanh nghiệp', 'Connect investors and businesses'),
        T(lang, 'Hồ sơ cố vấn', 'Advisor profile'),
      ],
    },
  ];

  const tiers = [
    {
      off: '0%',
      termVi: 'Kỳ hạn tối thiểu',
      termEn: 'Minimum term',
      whoVi: 'Doanh nghiệp 4 tuần · Nhà đầu tư Nâng cao/Cố vấn 4 tháng',
      whoEn: 'Business 4 weeks · Premium Investor/Advisor 4 months',
    },
    {
      off: '15%',
      termVi: '8 tuần / 8 tháng',
      termEn: '8 weeks / 8 months',
      whoVi: 'Thêm hỗ trợ từ Deals68',
      whoEn: 'Additional support from Deals68',
    },
    {
      off: '20%',
      termVi: '16 tuần / 16 tháng+',
      termEn: '16 weeks / 16 months+',
      whoVi: 'Thêm hỗ trợ từ Deals68',
      whoEn: 'Additional support from Deals68',
    },
    {
      off: 'Mã Khuyến mãi',
      termVi: 'Áp dụng bổ sung',
      termEn: 'Additional discount',
      whoVi: 'Thêm lợi ích',
      whoEn: 'Extra benefit',
    },
  ];

  const faqs = [
    {
      qVi: 'Báo cáo Tối ưu hồ sơ Doanh nghiệp là gì?',
      qEn: 'What is the Business Profile Optimization Report?',
      aVi: 'Là chức năng tổng hợp toàn bộ thông tin doanh nghiệp đăng lên tại Dataroom để tổng hợp và đưa ra các đề xuất tối ưu. Chỉ doanh nghiệp dùng gói Ưu tiên mới được sử dụng. Nhà đầu tư cũng có thể xem Báo cáo Tóm lượt cơ hội đầu tư, thay vì cần nhiều ngày để đọc hàng trăm trang tài liệu trong Dataroom của doanh nghiệp.',
      aEn: 'It consolidates all information uploaded by the Business to the Dataroom and provides optimization recommendations. The feature is available only to Businesses using the Priority plan. Investors can also view an Investment Opportunity Summary Report instead of spending days reading hundreds of pages of documents in the Business Dataroom.',
    },
    {
      qVi: 'Dataroom và eNDA là gì?',
      qEn: 'What are the Dataroom and eNDA?',
      aVi: 'Dataroom là phòng chứa toàn bộ các tài liệu doanh nghiệp cung cấp, và chỉ mở cho nhà đầu tư xem sau khi đã ký eNDA. eNDA là văn bản số chứng thực nhà đầu tư cam kết bảo mật thông tin doanh nghiệp cung cấp tại Dataroom để được cấp quyền xem.',
      aEn: "The Dataroom contains all documents provided by the Business and is opened to an investor only after the investor has signed the eNDA. The eNDA is a digitally executed agreement confirming the investor's commitment to keep the information provided in the Dataroom confidential before access is granted.",
    },
    {
      qVi: 'Giá tính như thế nào?',
      qEn: 'How is pricing calculated?',
      aVi: 'Nhà đầu tư Tiêu chuẩn được miễn phí. Nhà đầu tư Nâng cao có giá 50.000.000 VNĐ/tháng tại Việt Nam hoặc 2.500 USD/tháng tại các quốc gia khác. Các gói trả phí được tính theo vai trò, quốc gia và kỳ hạn; kỳ hạn dài được giảm 15–20%.',
      aEn: 'Standard Investors are free. Premium Investors cost VND 50,000,000 per month in Vietnam or USD 2,500 per month in other countries. Paid plans are calculated by role, country and term, with 15–20% discounts for longer terms.',
    },
    {
      qVi: 'Mã khuyến mãi có thể áp dụng thêm với Giảm giá theo gói không?',
      qEn: 'Can promo codes be applied on top of package discounts?',
      aVi: 'Có, nếu bạn có mã khuyến mãi hoặc đối tác cung cấp mã, hãy nhập để được giảm giá kèm thêm.',
      aEn: 'Yes. If you have a promo code or a partner provides one, enter it to receive an additional discount.',
    },
    {
      qVi: 'Thanh toán bằng cách nào?',
      qEn: 'How can I pay?',
      aVi: 'QR chuyển khoản, Thẻ nội địa, Thẻ tín dụng.',
      aEn: 'Bank QR, domestic card or credit card.',
    },
  ];

  function resetPromo() {
    setPromo('');
    setPromoPct(0);
    setPromoMsg('');
  }

  function setNextRole(nextRole: Role) {
    setRole(nextRole);
    setUnits(CFG[nextRole].min);
    if (nextRole === 'investor') setInvestorPlan('standard');
    resetPromo();
  }

  function setNextInvestorPlan(nextPlan: InvestorPlan) {
    setInvestorPlan(nextPlan);
    setUnits(CFG.investor.min);
    resetPromo();
  }

  async function applyPromo() {
    const code = promo.trim().toUpperCase();
    setPromoLoading(true);
    setPromoMsg('');
    const result = await lookupPromo(code, role as PricingRole).catch(() => ({
      discountPct: 0,
    }));
    setPromoLoading(false);
    const discountPct = Number(result.discountPct || 0);
    setPromoPct(discountPct);
    setPromoMsg(
      discountPct
        ? T(lang, 'Mã hợp lệ, đã cập nhật số tiền giảm giá', 'Valid code, discount amount updated')
        : T(lang, 'Mã không hợp lệ', 'Invalid code'),
    );
  }

  function checkout() {
    if (advisorComingSoon) return;
    localStorage.setItem(
      'd68_checkout_intent',
      JSON.stringify({
        role,
        internalRole: role,
        country: country === 'vn' ? 'VN' : 'GLOBAL',
        units: paidPlanSelected ? units : 0,
        unitLabel,
        termWeeks,
        businessPlan: bizPlan,
        investorPlan: role === 'investor' ? investorPlan : undefined,
        promoCode: paidPlanSelected ? promo.trim().toUpperCase() : '',
        price: {
          total: Math.round(total),
          currency,
          promoDiscountPct: effectivePromoPct,
          termDiscountPct: termPct,
        },
        createdAt: new Date().toISOString(),
      }),
    );
    navigate(toLocalizedPath(`/register/${role}`, lang));
  }

  return (
    <main className="d68-pricing-page">
      <section className="d68-pricing-hero">
        <div>
          <span>{T(lang, 'Bảng Giá Giải pháp Deals68', 'Deals68 Solution Pricing')}</span>
          <h1>{T(lang, 'Bảng giá minh bạch, linh hoạt', 'Transparent, flexible pricing')}</h1>
          <p>
            {T(
              lang,
              'Doanh nghiệp trả phí hiển thị theo tuần; Nhà đầu tư Tiêu chuẩn miễn phí, Nhà đầu tư Nâng cao và Cố vấn trả phí theo tháng. Kỳ hạn dài hơn — giảm giá nhiều hơn.',
              'Businesses pay a weekly listing fee; Standard Investors are free, while Premium Investors and Advisors pay monthly. Longer terms mean bigger discounts.',
            )}
          </p>
        </div>
      </section>

      <section className="d68-pricing-calc">
        <div className="d68-pricing-calc__grid">
          <div className="d68-pricing-panel">
            <h2>{T(lang, 'Tính giá gói của bạn', 'Estimate your plan')}</h2>
            <Label>{T(lang, 'Vai trò', 'Role')}</Label>
            <div className="d68-pricing-segments">
              {(['business', 'investor', 'advisor'] as Role[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={role === item ? 'active' : ''}
                  onClick={() => setNextRole(item)}
                >
                  {roleLabel(lang, item)}
                </button>
              ))}
            </div>

            <Label>{T(lang, 'Quốc gia', 'Country')}</Label>
            <div className="d68-pricing-segments">
              <button
                type="button"
                className={country === 'vn' ? 'active' : ''}
                onClick={() => setCountry('vn')}
              >
                🇻🇳 {T(lang, 'Việt Nam (VNĐ)', 'Vietnam (VND)')}
              </button>
              <button
                type="button"
                className={country === 'other' ? 'active' : ''}
                onClick={() => setCountry('other')}
              >
                🌐 {T(lang, 'Quốc gia khác (USD)', 'Other (USD)')}
              </button>
            </div>

            {role === 'business' ? (
              <>
                <Label>{T(lang, 'Gói dịch vụ', 'Service plan')}</Label>
                <div className="d68-pricing-segments">
                  <button
                    type="button"
                    className={bizPlan === 'standard' ? 'active' : ''}
                    onClick={() => setBizPlan('standard')}
                  >
                    {T(lang, 'Thường', 'Regular')}
                  </button>
                  <button
                    type="button"
                    className={bizPlan === 'featured' ? 'active' : ''}
                    onClick={() => setBizPlan('featured')}
                  >
                    {T(lang, 'Ưu tiên +30%', 'Priority +30%')}
                  </button>
                </div>
              </>
            ) : null}

            {role === 'investor' ? (
              <>
                <Label>{T(lang, 'Gói Nhà đầu tư', 'Investor plan')}</Label>
                <div className="d68-pricing-segments">
                  <button
                    type="button"
                    className={investorPlan === 'standard' ? 'active' : ''}
                    onClick={() => setNextInvestorPlan('standard')}
                  >
                    {T(lang, 'Tiêu chuẩn · Miễn phí', 'Standard · Free')}
                  </button>
                  <button
                    type="button"
                    className={investorPlan === 'premium' ? 'active' : ''}
                    onClick={() => setNextInvestorPlan('premium')}
                  >
                    {T(lang, 'Nâng cao', 'Premium')}
                  </button>
                </div>
                {investorStandardSelected ? (
                  <p className="d68-pricing-note">
                    {T(
                      lang,
                      'Miễn phí tạo tài khoản, nhận Proposal và sử dụng các tính năng kết nối cốt lõi.',
                      'Free account creation, proposal receipt and core connection features.',
                    )}
                  </p>
                ) : (
                  <p className="d68-pricing-note">
                    {T(
                      lang,
                      `Báo cáo Phân tích cơ hội đầu tư: ${premiumUnitPrice}/tháng.`,
                      `Investment Opportunity Analysis Reports: ${premiumUnitPrice}/month.`,
                    )}
                  </p>
                )}
              </>
            ) : null}

            {paidPlanSelected ? (
              <>
                <Label>
                  {T(lang, 'Kỳ hạn', 'Term')} ({unitLabel})
                </Label>
                <div className="d68-pricing-terms">
                  {cfg.terms.map((term) => (
                    <button
                      key={term}
                      type="button"
                      className={units === term ? 'active' : ''}
                      onClick={() => setUnits(term)}
                    >
                      <b>{term}</b>
                      {cfg.disc(term) ? <span>-{cfg.disc(term)}%</span> : null}
                    </button>
                  ))}
                </div>
                <Label>{T(lang, 'Mã khuyến mãi', 'Promo code')}</Label>
                <div className="d68-pricing-promo">
                  <input
                    value={promo}
                    onChange={(event) => setPromo(event.target.value.toUpperCase())}
                    placeholder="DEALS68"
                  />
                  <button type="button" onClick={applyPromo} disabled={promoLoading}>
                    {promoLoading ? '...' : T(lang, 'Áp dụng', 'Apply')}
                  </button>
                </div>
                {promoMsg ? <p className={promoPct ? 'ok' : 'warn'}>{promoMsg}</p> : null}
              </>
            ) : null}
          </div>

          <aside className="d68-pricing-result">
            <span>{planName}</span>
            <strong>{investorStandardSelected ? T(lang, 'Miễn phí', 'Free') : money(total, currency)}</strong>
            <em>
              {investorStandardSelected
                ? T(lang, 'Không yêu cầu thanh toán', 'No payment required')
                : `${units} ${unitLabel} · ${country === 'vn' ? 'VNĐ' : 'USD'}`}
            </em>
            <div>
              {investorStandardSelected ? (
                <>
                  <Row a={T(lang, 'Phí tài khoản', 'Account fee')} b={T(lang, 'Miễn phí', 'Free')} />
                  <Row
                    a={T(lang, 'Báo cáo Phân tích đầu tư', 'Investment Analysis Report')}
                    b={T(lang, '50 triệu đ/tháng', 'USD 2,500/month')}
                  />
                </>
              ) : (
                <>
                  <Row a={T(lang, 'Đơn giá', 'Unit price')} b={money(base, currency)} />
                  <Row a={T(lang, 'Phí dịch vụ', 'Service fee')} b={money(subtotal, currency)} />
                  {role === 'business' ? (
                    <Row
                      a={T(lang, 'Lượt gửi Hồ sơ DN', 'Business profile sends')}
                      b={T(lang, `${businessProposalQuota} lượt`, `${businessProposalQuota} sends`)}
                    />
                  ) : null}
                  <Row
                    a={T(lang, 'Giảm kỳ hạn', 'Term discount')}
                    b={termPct ? `-${termPct}%` : '0%'}
                  />
                  <Row
                    a={T(lang, 'Mã khuyến mãi', 'Promo')}
                    b={effectivePromoPct ? `-${effectivePromoPct}%` : '0%'}
                  />
                </>
              )}
            </div>
            <Row
              a={T(lang, 'Tổng thanh toán', 'Total due')}
              b={investorStandardSelected ? T(lang, 'Miễn phí', 'Free') : money(total, currency)}
              bold
            />
            {saving > 0 ? (
              <p className="d68-pricing-saving">
                {T(lang, 'Tiết kiệm', 'You save')} {money(saving, currency)}
              </p>
            ) : null}
            <span
              className="d68-pricing-checkout-wrap"
              data-tooltip={advisorComingSoon ? advisorTooltip : undefined}
              tabIndex={advisorComingSoon ? 0 : undefined}
              aria-label={advisorComingSoon ? advisorTooltip : undefined}
            >
              <button
                type="button"
                onClick={checkout}
                disabled={advisorComingSoon}
                aria-disabled={advisorComingSoon}
              >
                {advisorComingSoon
                  ? T(lang, 'Tạo tài khoản', 'Create account')
                  : investorStandardSelected
                    ? T(lang, 'Tạo tài khoản miễn phí', 'Create free account')
                    : T(lang, 'Đăng ký tài khoản', 'Register account')}{' '}
                {!advisorComingSoon ? '→' : ''}
              </button>
            </span>
            <small>
              {investorStandardSelected
                ? T(
                    lang,
                    'Nhà đầu tư Tiêu chuẩn không cần thanh toán khi đăng ký.',
                    'Standard Investors do not need to make a payment during registration.',
                  )
                : T(
                    lang,
                    'Thanh toán qua QR chuyển khoản, Thẻ nội địa, Thẻ tín dụng.',
                    'Pay via bank QR, domestic card or credit card.',
                  )}
            </small>
          </aside>
        </div>
      </section>

      <section className="d68-pricing-plans">
        <h2>{T(lang, 'Bảng giá Giải pháp Deals68', 'Deals68 Solution Pricing')}</h2>
        <p>
          {T(
            lang,
            'Tham gia Deals68.com - Kết nối thương vụ, Khai mở lộc phát',
            'Join Deals68.com - Connecting Deals, Unlocking Prosperity',
          )}
        </p>
        <div>
          {planCards.map((planCard) => (
            <article key={planCard.key} className={planCard.popular ? 'popular' : ''}>
              <i>{planCard.icon}</i>
              {planCard.popular ? <b>★ {T(lang, 'Phổ biến', 'Popular')}</b> : null}
              <h3>{T(lang, planCard.titleVi, planCard.titleEn)}</h3>
              <p>{T(lang, planCard.descVi, planCard.descEn)}</p>
              <strong>
                {planCard.price}
                {planCard.perVi ? <small>/ {T(lang, planCard.perVi, planCard.perEn)}</small> : null}
              </strong>
              <ul>
                {planCard.features.map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setNextRole(planCard.key);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                {planCard.key === 'investor'
                  ? T(lang, 'Tạo tài khoản miễn phí', 'Create free account')
                  : T(lang, 'Chọn gói', 'Choose plan')}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="d68-pricing-discounts">
        <h2>{T(lang, 'Chiết khấu & ưu đãi', 'Discounts & offers')}</h2>
        <div>
          {tiers.map((tier) => (
            <article key={tier.off}>
              <b>{tier.off}</b>
              <strong>{T(lang, tier.termVi, tier.termEn)}</strong>
              <span>{T(lang, tier.whoVi, tier.whoEn)}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="d68-pricing-faq">
        <h2>FAQ</h2>
        {faqs.map((faq) => (
          <article key={faq.qVi}>
            <h3>{T(lang, faq.qVi, faq.qEn)}</h3>
            <p>{T(lang, faq.aVi, faq.aEn)}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="d68-pricing-label">{children}</div>;
}

function Row({ a, b, bold }: { a: string; b: string; bold?: boolean }) {
  return (
    <div className={bold ? 'd68-pricing-row bold' : 'd68-pricing-row'}>
      <span>{a}</span>
      <b>{b}</b>
    </div>
  );
}
