import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Lang } from '../lib/i18n';
import { formatMoney } from '../lib/format';
import { calculatePricing, lookupPromo, normaliseRole, roleLabel, roleRoute, type PricingRole, type BusinessPlan } from '../lib/pricing';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

const roleOptions: PricingRole[] = ['business', 'investor', 'advisor', 'affiliate'];
const countryOptions = [
  { code: 'VN', vi: 'Việt Nam', en: 'Vietnam' },
  { code: 'SG', vi: 'Singapore', en: 'Singapore' },
  { code: 'US', vi: 'Hoa Kỳ', en: 'United States' },
  { code: 'JP', vi: 'Nhật Bản', en: 'Japan' },
  { code: 'KR', vi: 'Hàn Quốc', en: 'Korea' },
  { code: 'HK', vi: 'Hồng Kông', en: 'Hong Kong' }
];

export default function Pricing({ lang }: { lang: Lang }) {
  const navigate = useNavigate();
  const [role, setRole] = useState<PricingRole>('business');
  const [country, setCountry] = useState('VN');
  const [termWeeks, setTermWeeks] = useState(4);
  const [businessPlan, setBusinessPlan] = useState<BusinessPlan>('standard');
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscountPct, setPromoDiscountPct] = useState(0);
  const [promoMsg, setPromoMsg] = useState('');
  const [checkingPromo, setCheckingPromo] = useState(false);

  const price = useMemo(() => calculatePricing({ role, country, termWeeks, businessPlan, promoCode }, promoDiscountPct), [role, country, termWeeks, businessPlan, promoCode, promoDiscountPct]);

  async function checkPromo() {
    setCheckingPromo(true);
    const r = await lookupPromo(promoCode, normaliseRole(role));
    setPromoDiscountPct(r.discountPct);
    setPromoMsg(r.message);
    setCheckingPromo(false);
  }

  function choose(nextRole = role) {
    const r = normaliseRole(nextRole);
    localStorage.setItem('d68_checkout_intent', JSON.stringify({
      role: roleRoute(r),
      internalRole: r,
      country,
      termWeeks,
      businessPlan,
      promoCode: promoCode.trim().toUpperCase(),
      price,
      createdAt: new Date().toISOString()
    }));
    navigate(`/register/${roleRoute(r)}`);
  }

  return <>
    <section className="list-hero pricing-hero">
      <div className="container list-hero-inner">
        <div>
          <span className="badge-title gold">★ {T(lang, 'Bảng giá Beta', 'Beta Pricing')}</span>
          <h1>{T(lang, 'Bảng giá minh bạch cho từng vai trò', 'Transparent pricing for every role')}</h1>
          <p>{T(lang, 'Doanh nghiệp, nhà đầu tư, cố vấn và Đối tác thị trường có thể chọn gói phù hợp. Thanh toán tự động đang ở Beta; quản trị viên vẫn có thể xác nhận thủ công.', 'Businesses, investors, advisors and Market Partners can choose the right plan. Payment automation is in Beta; admins can still confirm manually.')}</p>
        </div>
        <div className="list-hero-card">
          <b>{formatMoney(price.total, price.currency)}</b>
          <span>{T(lang, 'tổng tạm tính', 'estimated total')}</span>
          <button className="btn gold block" onClick={() => choose()}>{T(lang, 'Tiếp tục đăng ký', 'Continue registration')}</button>
        </div>
      </div>
    </section>

    <section className="section alt">
      <div className="container pricing-layout">
        <main className="pricing-main">
          <div className="pricing-estimator card">
            <div className="card-body">
              <div className="section-title" style={{marginBottom: 18}}>
                <div><h2>{T(lang, 'Công cụ tính giá', 'Price estimator')}</h2><p>{T(lang, 'Một công thức dùng chung cho phần tính giá và ý định đăng ký để tránh lệch số.', 'One shared formula is used for the estimator and register intent to avoid mismatched totals.')}</p></div>
              </div>
              <div className="formgrid">
                <label>{T(lang, 'Vai trò', 'Role')}<select className="select" value={role} onChange={e=>{setRole(normaliseRole(e.target.value)); setPromoDiscountPct(0); setPromoMsg('');}}>{roleOptions.map(x=><option key={x} value={x}>{roleLabel(x, lang)}</option>)}</select></label>
                <label>{T(lang, 'Quốc gia', 'Country')}<select className="select" value={country} onChange={e=>setCountry(e.target.value)}>{countryOptions.map(c=><option key={c.code} value={c.code}>{lang === 'en' ? c.en : c.vi}</option>)}</select></label>
                {role === 'business' && <label>{T(lang, 'Gói DN', 'Business plan')}<select className="select" value={businessPlan} onChange={e=>setBusinessPlan(e.target.value as BusinessPlan)}><option value="standard">{T(lang, 'Gói thường · 100 đề xuất', 'Standard · 100 proposals')}</option><option value="featured">{T(lang, 'Gói ưu tiên · 200 đề xuất', 'Featured · 200 proposals')}</option></select></label>}
                <label>{T(lang, 'Thời hạn', 'Term')}<select className="select" value={termWeeks} onChange={e=>setTermWeeks(Number(e.target.value))}><option value={1}>1 {T(lang,'tuần','week')}</option><option value={4}>4 {T(lang,'tuần','weeks')}</option><option value={12}>12 {T(lang,'tuần','weeks')}</option><option value={24}>24 {T(lang,'tuần','weeks')}</option><option value={52}>52 {T(lang,'tuần','weeks')}</option></select></label>
                <label>{T(lang, 'Mã khuyến mãi', 'Promo code')}<div className="promo-input-row"><input className="input" value={promoCode} onChange={e=>{setPromoCode(e.target.value); setPromoDiscountPct(0); setPromoMsg('');}} placeholder="FREE10JULY-DN16"/><button type="button" className="btn secondary" onClick={checkPromo} disabled={!promoCode.trim() || checkingPromo}>{checkingPromo ? '...' : T(lang,'Áp dụng','Apply')}</button></div></label>
              </div>
              {promoMsg && <p className={`notice ${promoDiscountPct ? 'ok' : 'warn'}`}>{promoMsg}</p>}
            </div>
          </div>

          <div className="grid pricing-cards">
            <PlanCard lang={lang} title="Business" vi="Doanh nghiệp" price={formatMoney(calculatePricing({role:'business',country,termWeeks:1,businessPlan:'standard'}).planWeekly, price.currency)} desc={T(lang,'Đăng hồ sơ gọi vốn/bán/vay, ẩn danh và nhận quan tâm từ nhà đầu tư.','List fundraising, sale or debt opportunities anonymously and receive investor interest.')} cta={T(lang,'Đăng ký DN','Register Business')} onClick={()=>choose('business')} featured />
            <PlanCard lang={lang} title="Investor" vi="Nhà đầu tư" price={formatMoney(calculatePricing({role:'investor',country,termWeeks:1}).planWeekly, price.currency)} desc={T(lang,'Tìm DN phù hợp, lưu thương vụ, gửi đề xuất và yêu cầu dữ liệu.','Find matching businesses, save deals, send proposals and request data.')} cta={T(lang,'Đăng ký NĐT','Register Investor')} onClick={()=>choose('investor')} />
            <PlanCard lang={lang} title="Market Partner" vi="Đối tác thị trường" price={T(lang,'Chờ duyệt','Approval')} desc={T(lang,'Giới thiệu doanh nghiệp/nhà đầu tư, theo dõi chuyển đổi và hoa hồng sau khi đơn đã thanh toán.','Refer businesses/investors, track conversions and commissions after paid orders.')} cta={T(lang,'Đăng ký Đối tác thị trường','Register Market Partner')} onClick={()=>choose('affiliate')} />
          </div>
        </main>

        <aside className="pricing-summary card">
          <div className="card-body">
            <h3>{T(lang, 'Tóm tắt thanh toán', 'Payment summary')}</h3>
            <SummaryRow label={T(lang,'Vai trò','Role')} value={roleLabel(role, lang)} />
            <SummaryRow label={T(lang,'Gói','Plan')} value={price.planLabel} />
            <SummaryRow label={T(lang,'Đơn giá/tuần','Weekly price')} value={formatMoney(price.planWeekly, price.currency)} />
            <SummaryRow label={T(lang,'Thời hạn','Term')} value={`${price.termWeeks} ${T(lang,'tuần','weeks')}`} />
            <SummaryRow label={T(lang,'Tạm tính','Subtotal')} value={formatMoney(price.subtotal, price.currency)} />
            <SummaryRow label={T(lang,'Giảm theo kỳ hạn','Term discount')} value={`${price.termDiscountPct}% · ${formatMoney(price.termDiscount, price.currency)}`} />
            <SummaryRow label={T(lang,'Mã khuyến mãi','Promo discount')} value={`${price.promoDiscountPct}% · ${formatMoney(price.promoDiscount, price.currency)}`} />
            <div className="total-row"><span>{T(lang,'Tổng cộng','Total')}</span><b>{formatMoney(price.total, price.currency)}</b></div>
            {price.proposalQuota > 0 && <p className="notice small-note">{T(lang,'Số lượt đề xuất','Proposal quota')}: <b>{price.proposalQuota}</b></p>}
            <button className="btn gold block" onClick={()=>choose()}>{T(lang, 'Tiếp tục', 'Continue')}</button>
            <p className="muted" style={{fontSize:13,lineHeight:1.55}}>{T(lang, 'QR ngân hàng/Sepay có thể xác nhận thủ công trong Beta. Stripe/PayPal sẽ tích hợp webhook sau.', 'Bank QR/Sepay can be confirmed manually in Beta. Stripe/PayPal webhooks will be integrated later.')}</p>
          </div>
        </aside>
      </div>
    </section>
  </>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="summary-row"><span>{label}</span><b>{value}</b></div>;
}

function PlanCard({ lang, title, vi, price, desc, cta, onClick, featured }: { lang: Lang; title: string; vi: string; price: string; desc: string; cta: string; onClick: () => void; featured?: boolean }) {
  return <div className={`card plan-card ${featured ? 'plan-card--featured' : ''}`}>
    <div className="card-body">
      {featured && <span className="pill gold">★ {lang === 'en' ? 'Most used' : 'Phổ biến'}</span>}
      <h3>{lang === 'en' ? title : vi}</h3>
      <h2>{price}</h2>
      <p className="muted">{desc}</p>
      <button className={featured ? 'btn gold block' : 'btn secondary block'} onClick={onClick}>{cta}</button>
    </div>
  </div>;
}
