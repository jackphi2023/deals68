import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Lang } from '../lib/i18n';
import { lookupPromo, type PricingRole } from '../lib/pricing';
import {
  BUSINESS_FEATURED_PROPOSAL_QUOTA,
  BUSINESS_STANDARD_PROPOSAL_QUOTA,
  businessProposalQuotaForPlan,
} from '../lib/businessPlans';
import { toLocalizedPath } from '../lib/i18nRoutes';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
type Role = 'business' | 'investor' | 'advisor';
type Country = 'vn' | 'other';
type BizPlan = 'standard' | 'featured';

const CFG = {
  business: { unitVi: 'tuần', unitEn: 'week', vn: 500_000, other: 20, min: 4, terms: [4, 8, 12, 16, 24], disc: (u: number) => u >= 16 ? 20 : u >= 8 ? 15 : 0 },
  investor: { unitVi: 'tháng', unitEn: 'month', vn: 1_000_000, other: 50, min: 4, terms: [4, 8, 12, 16, 24], disc: (u: number) => u >= 16 ? 20 : u >= 8 ? 15 : 0 },
  advisor: { unitVi: 'tháng', unitEn: 'month', vn: 1_000_000, other: 50, min: 4, terms: [4, 8, 12, 16, 24], disc: (u: number) => u >= 16 ? 20 : u >= 8 ? 15 : 0 },
};

function money(v: number, cur: 'VND' | 'USD') {
  if (cur === 'VND') return Math.round(v).toLocaleString('vi-VN') + ' ₫';
  return '$' + Math.round(v).toLocaleString('en-US');
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
  const [promo, setPromo] = useState('');
  const [promoPct, setPromoPct] = useState(0);
  const [promoMsg, setPromoMsg] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  const cfg = CFG[role];
  const cur: 'VND' | 'USD' = country === 'vn' ? 'VND' : 'USD';
  const planMult = role === 'business' && bizPlan === 'featured' ? 1.3 : 1;
  const base = (country === 'vn' ? cfg.vn : cfg.other) * planMult;
  const termPct = cfg.disc(units);
  const subtotal = base * units;
  const afterTerm = subtotal * (1 - termPct / 100);
  const total = afterTerm * (1 - promoPct / 100);
  const saving = subtotal - total;
  const unitLabel = T(lang, cfg.unitVi, cfg.unitEn);
  const planName = role === 'business'
    ? (bizPlan === 'featured'
      ? T(lang, 'Gói Ưu tiên', 'Priority package')
      : T(lang, 'Gói Thường', 'Regular package'))
    : roleLabel(lang, role);
  const businessProposalQuota = role === 'business'
    ? businessProposalQuotaForPlan(bizPlan)
    : 0;
  const termWeeks = role === 'business' ? units : units * 4;
  const advisorComingSoon = role === 'advisor';
  const advisorTooltip = T(lang, 'Sắp ra mắt', 'Coming soon');

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
      featuresVi: [
        T(lang, 'Hồ sơ ẩn danh công khai', 'Public anonymous profile'),
        T(lang, `Gói Thường: ${BUSINESS_STANDARD_PROPOSAL_QUOTA} lượt gửi Hồ sơ DN`, `Regular: ${BUSINESS_STANDARD_PROPOSAL_QUOTA} business profile sends`),
        T(lang, `Gói Ưu tiên: ${BUSINESS_FEATURED_PROPOSAL_QUOTA} lượt gửi Hồ sơ DN`, `Priority: ${BUSINESS_FEATURED_PROPOSAL_QUOTA} business profile sends`),
        T(lang, 'Xem Báo cáo Tối ưu Hồ sơ DN', 'View Business Profile Optimization Report'),
        T(lang, 'Tương tác với Nhà đầu tư kết nối', 'Interact with connected investors'),
      ],
    },
    {
      key: 'investor' as Role,
      icon: '📈',
      titleVi: 'Nhà đầu tư',
      titleEn: 'Investor',
      descVi: 'Tìm doanh nghiệp phù hợp, lưu deal và gửi yêu cầu kết nối/data room.',
      descEn: 'Find matching businesses, save deals and request connection/data room.',
      price: money(CFG.investor.vn, 'VND'),
      perVi: 'tháng',
      perEn: 'month',
      popular: false,
      featuresVi: [
        T(lang, 'Tìm kiếm thương vụ', 'Search for deals'),
        T(lang, 'Xem Business Quality Score', 'View Business Quality Score'),
        T(lang, 'Lưu doanh nghiệp quan tâm', 'Save businesses of interest'),
        T(lang, 'Xem chi tiết hồ sơ và Yêu cầu cung cấp tài liệu', 'View detailed profiles and request supporting documents'),
        T(lang, 'Xem Báo cáo Phân tích đầu tư', 'View Investment Analysis Report'),
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
      featuresVi: [
        T(lang, 'Quản lý nhiều hồ sơ', 'Manage multiple profiles'),
        T(lang, 'Tiếp cận nhiều nhà đầu tư hơn', 'Reach more investors'),
        T(lang, 'Kết nối Nhà đầu tư và Doanh nghiệp', 'Connect investors and businesses'),
        T(lang, 'Hồ sơ cố vấn', 'Advisor profile'),
      ],
    },
  ];

  const tiers = [
    { off: '0%', termVi: 'Kỳ hạn tối thiểu', termEn: 'Minimum term', whoVi: 'Doanh nghiệp 4 tuần · Nhà đầu tư/Cố vấn 4 tháng', whoEn: 'Business 4 weeks · Investor/Advisor 4 months' },
    { off: '15%', termVi: '8 tuần / 8 tháng', termEn: '8 weeks / 8 months', whoVi: 'Thêm hỗ trợ từ Deals68', whoEn: 'Additional support from Deals68' },
    { off: '20%', termVi: '16 tuần / 16 tháng+', termEn: '16 weeks / 16 months+', whoVi: 'Thêm hỗ trợ từ Deals68', whoEn: 'Additional support from Deals68' },
    { off: 'Mã Khuyến mãi', termVi: 'Áp dụng bổ sung', termEn: 'Additional discount', whoVi: 'Thêm lợi ích', whoEn: 'Extra benefit' },
  ];

  const faqs = [
    { qVi: 'Giá tính như thế nào?', qEn: 'How is pricing calculated?', aVi: 'Theo vai trò, quốc gia và kỳ hạn. Việt Nam dùng VNĐ, quốc gia khác dùng USD. Kỳ hạn dài được giảm 15–20%.', aEn: 'By role, country and term. Vietnam uses VND, other countries use USD. Longer terms get 15–20% discount.' },
    { qVi: 'Mã khuyến mãi có thể áp dụng thêm với Giảm giá theo gói không?', qEn: 'Can promo codes be applied on top of package discounts?', aVi: 'Có, nếu bạn có mã khuyến mãi hoặc đối tác cung cấp mã, hãy nhập để được giảm giá kèm thêm.', aEn: 'Yes. If you have a promo code or a partner provides one, enter it to receive an additional discount.' },
    { qVi: 'Thanh toán bằng cách nào?', qEn: 'How can I pay?', aVi: 'QR chuyển khoản, Thẻ nội địa, Thẻ tín dụng.', aEn: 'Bank QR, domestic card or credit card.' },
  ];

  function setNextRole(r: Role) {
    setRole(r);
    setUnits(CFG[r].min);
    setPromoPct(0);
    setPromoMsg('');
  }

  async function applyPromo() {
    const code = promo.trim().toUpperCase();
    setPromoLoading(true);
    setPromoMsg('');
    const res = await lookupPromo(code, role as PricingRole).catch(() => ({ discountPct: 0 }));
    setPromoLoading(false);
    const discountPct = Number(res.discountPct || 0);
    setPromoPct(discountPct);
    setPromoMsg(discountPct
      ? T(lang, 'Mã hợp lệ, đã cập nhật số tiền giảm giá', 'Valid code, discount amount updated')
      : T(lang, 'Mã không hợp lệ', 'Invalid code'));
  }

  function checkout() {
    if (advisorComingSoon) return;
    localStorage.setItem('d68_checkout_intent', JSON.stringify({
      role,
      internalRole: role,
      country: country === 'vn' ? 'VN' : 'GLOBAL',
      units,
      unitLabel,
      termWeeks,
      businessPlan: bizPlan,
      promoCode: promo.trim().toUpperCase(),
      price: {
        total: Math.round(total),
        currency: cur,
        promoDiscountPct: promoPct,
        termDiscountPct: termPct,
      },
      createdAt: new Date().toISOString(),
    }));
    navigate(toLocalizedPath(`/register/${role}`, lang));
  }

  return <main className="d68-pricing-page">
    <section className="d68-pricing-hero"><div><span>{T(lang, 'Bảng Giá Giải pháp Deals68', 'Deals68 Solution Pricing')}</span><h1>{T(lang, 'Bảng giá minh bạch, linh hoạt', 'Transparent, flexible pricing')}</h1><p>{T(lang, 'Doanh nghiệp trả phí hiển thị theo tuần; Nhà đầu tư & Cố vấn trả phí thành viên theo tháng. Kỳ hạn dài hơn — giảm giá nhiều hơn.', 'Businesses pay a weekly listing fee; Investors & Advisors pay a monthly membership. Longer terms mean bigger discounts.')}</p></div></section>
    <section className="d68-pricing-calc"><div className="d68-pricing-calc__grid"><div className="d68-pricing-panel"><h2>{T(lang, 'Tính giá gói của bạn', 'Estimate your plan')}</h2><Label>{T(lang, 'Vai trò', 'Role')}</Label><div className="d68-pricing-segments">{(['business','investor','advisor'] as Role[]).map((r) => <button key={r} type="button" className={role === r ? 'active' : ''} onClick={() => setNextRole(r)}>{roleLabel(lang, r)}</button>)}</div><Label>{T(lang, 'Quốc gia', 'Country')}</Label><div className="d68-pricing-segments"><button type="button" className={country === 'vn' ? 'active' : ''} onClick={() => setCountry('vn')}>🇻🇳 {T(lang, 'Việt Nam (VNĐ)', 'Vietnam (VND)')}</button><button type="button" className={country === 'other' ? 'active' : ''} onClick={() => setCountry('other')}>🌐 {T(lang, 'Quốc gia khác (USD)', 'Other (USD)')}</button></div>{role === 'business' ? <><Label>{T(lang, 'Gói dịch vụ', 'Service plan')}</Label><div className="d68-pricing-segments"><button type="button" className={bizPlan === 'standard' ? 'active' : ''} onClick={() => setBizPlan('standard')}>{T(lang, 'Thường', 'Regular')}</button><button type="button" className={bizPlan === 'featured' ? 'active' : ''} onClick={() => setBizPlan('featured')}>{T(lang, 'Ưu tiên +30%', 'Priority +30%')}</button></div></> : null}<Label>{T(lang, 'Kỳ hạn', 'Term')} ({unitLabel})</Label><div className="d68-pricing-terms">{cfg.terms.map((t) => <button key={t} type="button" className={units === t ? 'active' : ''} onClick={() => setUnits(t)}><b>{t}</b>{cfg.disc(t) ? <span>-{cfg.disc(t)}%</span> : null}</button>)}</div><Label>{T(lang, 'Mã khuyến mãi', 'Promo code')}</Label><div className="d68-pricing-promo"><input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder="DEALS68"/><button type="button" onClick={applyPromo} disabled={promoLoading}>{promoLoading ? '...' : T(lang, 'Áp dụng', 'Apply')}</button></div>{promoMsg ? <p className={promoPct ? 'ok' : 'warn'}>{promoMsg}</p> : null}</div><aside className="d68-pricing-result"><span>{planName}</span><strong>{money(total, cur)}</strong><em>{units} {unitLabel} · {country === 'vn' ? 'VNĐ' : 'USD'}</em><div><Row a={T(lang,'Đơn giá','Unit price')} b={money(base, cur)} /><Row a={T(lang,'Phí dịch vụ','Service fee')} b={money(subtotal, cur)} />{role === 'business' ? <Row a={T(lang,'Lượt gửi Hồ sơ DN','Business profile sends')} b={T(lang, `${businessProposalQuota} lượt`, `${businessProposalQuota} sends`)} /> : null}<Row a={T(lang,'Giảm kỳ hạn','Term discount')} b={termPct ? `-${termPct}%` : '0%'} /><Row a={T(lang,'Mã khuyến mãi','Promo')} b={promoPct ? `-${promoPct}%` : '0%'} /></div><Row a={T(lang,'Tổng thanh toán','Total due')} b={money(total, cur)} bold />{saving > 0 ? <p className="d68-pricing-saving">{T(lang, 'Tiết kiệm', 'You save')} {money(saving, cur)}</p> : null}<span className="d68-pricing-checkout-wrap" data-tooltip={advisorComingSoon ? advisorTooltip : undefined} tabIndex={advisorComingSoon ? 0 : undefined} aria-label={advisorComingSoon ? advisorTooltip : undefined}><button type="button" onClick={checkout} disabled={advisorComingSoon} aria-disabled={advisorComingSoon}>{advisorComingSoon ? T(lang, 'Tạo tài khoản', 'Create account') : T(lang, 'Đăng ký tài khoản', 'Register account')} {!advisorComingSoon ? '→' : ''}</button></span><small>{T(lang, 'Thanh toán qua QR chuyển khoản, Thẻ nội địa, Thẻ tín dụng.', 'Pay via bank QR, domestic card or credit card.')}</small></aside></div></section>
    <section className="d68-pricing-plans"><h2>{T(lang, 'Bảng giá Giải pháp Deals68', 'Deals68 Solution Pricing')}</h2><p>{T(lang, 'Tham gia Deals68.com - Kết nối thương vụ, Khai mở lộc phát', 'Join Deals68.com - Connecting Deals, Unlocking Prosperity')}</p><div>{planCards.map((p) => <article key={p.key} className={p.popular ? 'popular' : ''}><i>{p.icon}</i>{p.popular ? <b>★ {T(lang, 'Phổ biến', 'Popular')}</b> : null}<h3>{T(lang, p.titleVi, p.titleEn)}</h3><p>{T(lang, p.descVi, p.descEn)}</p><strong>{p.price}<small>/ {T(lang, p.perVi, p.perEn)}</small></strong><ul>{p.featuresVi.map((f) => <li key={f}>✓ {f}</li>)}</ul><button type="button" onClick={() => { setNextRole(p.key); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{T(lang, 'Chọn gói', 'Choose plan')}</button></article>)}</div></section>
    <section className="d68-pricing-discounts"><h2>{T(lang, 'Chiết khấu & ưu đãi', 'Discounts & offers')}</h2><div>{tiers.map((t) => <article key={t.off}><b>{t.off}</b><strong>{T(lang, t.termVi, t.termEn)}</strong><span>{T(lang, t.whoVi, t.whoEn)}</span></article>)}</div></section>
    <section className="d68-pricing-faq"><h2>FAQ</h2>{faqs.map((f) => <article key={f.qVi}><h3>{T(lang, f.qVi, f.qEn)}</h3><p>{T(lang, f.aVi, f.aEn)}</p></article>)}</section>
  </main>;
}

function Label({ children }: { children: any }) {
  return <div className="d68-pricing-label">{children}</div>;
}

function Row({ a, b, bold }: { a: string; b: string; bold?: boolean }) {
  return <div className={bold ? 'd68-pricing-row bold' : 'd68-pricing-row'}><span>{a}</span><b>{b}</b></div>;
}
