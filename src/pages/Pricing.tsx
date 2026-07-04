import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
type Role = 'business' | 'investor' | 'advisor';
type Country = 'vn' | 'other';
type BizPlan = 'standard' | 'featured';

const CFG = {
  business: { unitVi: 'tuần', unitEn: 'week', vn: 500_000, other: 20, min: 4, terms: [4, 8, 12, 16, 24], disc: (u: number) => u >= 16 ? 20 : u >= 8 ? 15 : 0 },
  investor: { unitVi: 'tháng', unitEn: 'month', vn: 1_000_000, other: 50, min: 3, terms: [3, 6, 9, 12, 24], disc: (u: number) => u >= 12 ? 20 : u >= 6 ? 15 : 0 },
  advisor: { unitVi: 'tháng', unitEn: 'month', vn: 1_000_000, other: 50, min: 3, terms: [3, 6, 9, 12, 24], disc: (u: number) => u >= 12 ? 20 : u >= 6 ? 15 : 0 }
};
const PROMOS: Record<string, number> = { DEALS68: 10, LAUNCH20: 20, VCPC15: 15 };

function money(v: number, cur: 'VND' | 'USD') {
  if (cur === 'VND') return Math.round(v).toLocaleString('vi-VN') + ' ₫';
  return '$' + Math.round(v).toLocaleString('en-US');
}
function route(role: Role) { return role; }
function roleLabel(lang: Lang, role: Role) {
  return role === 'business' ? T(lang, 'Doanh nghiệp', 'Business') : role === 'investor' ? T(lang, 'Nhà đầu tư', 'Investor') : T(lang, 'Cố vấn', 'Advisor');
}
function seg(active: boolean): CSSProperties {
  return { flex: 1, padding: '12px 10px', border: `1px solid ${active ? '#1BADEA' : '#E2E8F0'}`, background: active ? '#E7F6FD' : '#fff', color: active ? '#1596cc' : '#334155', borderRadius: 10, fontWeight: 800, cursor: 'pointer', minWidth: 120 };
}

export default function Pricing({ lang }: { lang: Lang }) {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>('business');
  const [country, setCountry] = useState<Country>('vn');
  const [units, setUnits] = useState(4);
  const [bizPlan, setBizPlan] = useState<BizPlan>('standard');
  const [promo, setPromo] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountPercent: number } | null>(null);
  const cfg = CFG[role];
  const cur: 'VND' | 'USD' = country === 'vn' ? 'VND' : 'USD';
  const isBusinessRole = role === 'business';
  const planMult = role === 'business' && bizPlan === 'featured' ? 1.3 : 1;
  const base = (country === 'vn' ? cfg.vn : cfg.other) * planMult;
  const termPct = cfg.disc(units);
  const subtotal = base * units;
  const afterTerm = subtotal * (1 - termPct / 100);
  const promoPct = appliedPromo?.discountPercent || 0;
  const total = afterTerm * (1 - promoPct / 100);
  const saving = subtotal - total;
  const unitLabel = T(lang, cfg.unitVi, cfg.unitEn);
  const planName = role === 'business' && bizPlan === 'featured' ? T(lang, 'Business Priority', 'Business Priority') : roleLabel(lang, role);
  const promoMsg = appliedPromo ? T(lang, `Đã áp dụng ${appliedPromo.code}: -${appliedPromo.discountPercent}%`, `${appliedPromo.code} applied: -${appliedPromo.discountPercent}%`) : promo ? T(lang, 'Nhập mã rồi bấm Áp dụng.', 'Enter a code and click Apply.') : '';
  const roleTabs = (['business', 'investor', 'advisor'] as Role[]);
  const termOptions = cfg.terms;

  function setNextRole(r: Role) { setRole(r); setUnits(CFG[r].min); setAppliedPromo(null); }
  function applyPromo() {
    const code = promo.trim().toUpperCase();
    setAppliedPromo(PROMOS[code] ? { code, discountPercent: PROMOS[code] } : null);
  }
  function checkout() {
    localStorage.setItem('d68_checkout_intent', JSON.stringify({
      role: route(role), internalRole: role, country: country === 'vn' ? 'VN' : 'GLOBAL', units, unitLabel,
      termWeeks: role === 'business' ? units : units * 4, businessPlan: bizPlan, promoCode: appliedPromo?.code || promo.trim().toUpperCase(),
      price: { total: Math.round(total), currency: cur, promoDiscountPct: promoPct, termDiscountPct: termPct }, createdAt: new Date().toISOString()
    }));
    navigate(`/register/${route(role)}`);
  }

  const planCards = [
    { key: 'business' as Role, icon: '🏢', titleVi: 'Doanh nghiệp', titleEn: 'Business', descVi: 'Đăng hồ sơ gọi vốn, bán doanh nghiệp, vay vốn hoặc tìm đối tác chiến lược.', descEn: 'List a fundraise, business sale, loan or strategic partnership profile.', price: money(CFG.business.vn, 'VND'), perVi: 'tuần', perEn: 'week', minInfoVi: 'Tối thiểu 4 tuần', minInfoEn: 'Minimum 4 weeks', popular: true, featuresVi: ['Hồ sơ ẩn danh công khai', 'Nhận proposal/quan tâm từ nhà đầu tư', 'Dashboard cập nhật số liệu', 'Tài liệu mở sau kết nối/NDA'], featuresEn: ['Anonymous public profile', 'Receive investor interest/proposals', 'Dashboard data updates', 'Documents unlock after connection/NDA'], href: '/register/business' },
    { key: 'investor' as Role, icon: '📈', titleVi: 'Nhà đầu tư', titleEn: 'Investor', descVi: 'Tìm doanh nghiệp phù hợp, lưu deal và gửi yêu cầu kết nối/data room.', descEn: 'Find matching businesses, save deals and request connection/data room.', price: money(CFG.investor.vn, 'VND'), perVi: 'tháng', perEn: 'month', minInfoVi: 'Tối thiểu 3 tháng', minInfoEn: 'Minimum 3 months', popular: false, featuresVi: ['Tìm kiếm thương vụ', 'Xem quality score', 'Lưu doanh nghiệp quan tâm', 'Yêu cầu IM/NDA'], featuresEn: ['Search deals', 'View quality scores', 'Save interested businesses', 'Request IM/NDA'], href: '/register/investor' },
    { key: 'advisor' as Role, icon: '🤝', titleVi: 'Cố vấn', titleEn: 'Advisor', descVi: 'Đại diện nhiều thương vụ, quản lý khách hàng và hỗ trợ kết nối.', descEn: 'Represent multiple mandates, manage clients and support matching.', price: money(CFG.advisor.vn, 'VND'), perVi: 'tháng', perEn: 'month', minInfoVi: 'Tối thiểu 3 tháng', minInfoEn: 'Minimum 3 months', popular: false, featuresVi: ['Quản lý nhiều hồ sơ', 'Theo dõi proposal', 'Kết nối investor/buyer', 'Hồ sơ cố vấn'], featuresEn: ['Manage multiple profiles', 'Track proposals', 'Connect investors/buyers', 'Advisor profile'], href: '/register/advisor' }
  ];

  const tiers = [
    { off: '0%', termVi: 'Kỳ hạn tối thiểu', termEn: 'Minimum term', whoVi: 'Business 4 tuần · Investor/Advisor 3 tháng', whoEn: 'Business 4 weeks · Investor/Advisor 3 months' },
    { off: '15%', termVi: '8 tuần / 6 tháng', termEn: '8 weeks / 6 months', whoVi: 'Tự động áp dụng', whoEn: 'Automatically applied' },
    { off: '20%', termVi: '16 tuần / 12 tháng+', termEn: '16 weeks / 12 months+', whoVi: 'Kỳ hạn dài', whoEn: 'Longer commitments' },
    { off: 'Mã KM', termVi: 'DEALS68 / LAUNCH20 / VCPC15', termEn: 'DEALS68 / LAUNCH20 / VCPC15', whoVi: 'Cấu hình bởi Admin', whoEn: 'Configured by Admin' }
  ];
  const faqs = [
    { qVi: 'Giá tính như thế nào?', qEn: 'How is pricing calculated?', aVi: 'Theo vai trò, quốc gia và kỳ hạn. Việt Nam dùng VNĐ, quốc gia khác dùng USD. Kỳ hạn dài được giảm 15–20%.', aEn: 'By role, country and term. Vietnam uses VND, other countries use USD. Longer terms get 15–20% discount.' },
    { qVi: 'Mã khuyến mãi cộng dồn với chiết khấu kỳ hạn?', qEn: 'Can promo codes stack with term discounts?', aVi: 'Có. Mã giảm được tính trên số tiền sau chiết khấu kỳ hạn, trừ khi Admin cấu hình khác.', aEn: 'Yes. Promo discounts are applied after term discounts unless configured otherwise.' },
    { qVi: 'Thanh toán bằng cách nào?', qEn: 'How can I pay?', aVi: 'QR chuyển khoản Vietcombank, thẻ qua Senpay, hoặc Paypal. Sau thanh toán, hồ sơ chuyển trạng thái chờ duyệt.', aEn: 'Bank QR, Senpay card or Paypal. After payment, the profile moves to pending review.' },
    { qVi: 'Có hoàn tiền không?', qEn: 'Is it refundable?', aVi: 'Gói hiển thị/thành viên không hoàn lại sau khi hồ sơ đã lên hiển thị; chi tiết trong Điều khoản.', aEn: 'Listing/membership fees are not refundable after the profile goes live; see Terms for details.' }
  ];

  return <>
    <section style={{ background: 'radial-gradient(900px 400px at 82% -20%, rgba(27,173,234,.25), transparent 60%), linear-gradient(180deg,#0F2A4A,#14315A)', color: '#fff' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '56px 24px 40px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, color: '#cfe8f6', marginBottom: 18 }}><span className="l-vi">Giá theo vai trò, quốc gia & kỳ hạn</span><span className="l-en">Priced by role, country & term</span></div>
        <h1 className="d68-hero-h1" style={{ fontSize: 44, lineHeight: 1.08, fontWeight: 800, letterSpacing: -1.2, margin: '0 0 14px' }}><span className="l-vi">Bảng giá minh bạch, linh hoạt</span><span className="l-en">Transparent, flexible pricing</span></h1>
        <p style={{ fontSize: 18, lineHeight: 1.55, color: '#c6d5e6', maxWidth: 620, margin: '0 auto' }}><span className="l-vi">Doanh nghiệp trả phí hiển thị theo tuần; Nhà đầu tư & Cố vấn trả phí thành viên theo tháng. Kỳ hạn dài hơn — giảm giá nhiều hơn.</span><span className="l-en">Businesses pay a weekly listing fee; Investors & Advisors pay a monthly membership. Longer terms mean bigger discounts.</span></p>
      </div>
    </section>

    <section style={{ maxWidth: 1240, margin: '0 auto', padding: '36px 24px 20px' }}>
      <div className="d68-calc-cols" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 400px', gap: 26, alignItems: 'start', transform: 'translateY(-56px)' }}>
        <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 20, padding: 30, boxShadow: '0 18px 44px rgba(6,20,40,.12)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 20px' }}><span className="l-vi">Tính giá gói của bạn</span><span className="l-en">Estimate your plan</span></h2>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 9 }}><span className="l-vi">Vai trò</span><span className="l-en">Role</span></div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>{roleTabs.map((r) => <button key={r} onClick={() => setNextRole(r)} style={seg(role === r)}>{roleLabel(lang, r)}</button>)}</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 9 }}><span className="l-vi">Quốc gia</span><span className="l-en">Country</span></div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}><button onClick={() => setCountry('vn')} style={seg(country === 'vn')}>🇻🇳 <span className="l-vi">Việt Nam (VNĐ)</span><span className="l-en">Vietnam (VND)</span></button><button onClick={() => setCountry('other')} style={seg(country === 'other')}>🌐 <span className="l-vi">Quốc gia khác (USD)</span><span className="l-en">Other (USD)</span></button></div>
          {isBusinessRole ? <><div style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 9 }}><span className="l-vi">Gói dịch vụ</span><span className="l-en">Service plan</span></div><div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}><button onClick={() => setBizPlan('standard')} style={seg(bizPlan === 'standard')}>{T(lang, 'Gói thường', 'Standard')}</button><button onClick={() => setBizPlan('featured')} style={seg(bizPlan === 'featured')}>{T(lang, 'Gói ưu tiên', 'Priority')}</button></div><p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 22px', lineHeight: 1.5 }}>{bizPlan === 'featured' ? T(lang, 'Hiển thị ưu tiên, 200 proposal quota, xếp hạng cao hơn.', 'Priority visibility, 200 proposal quota, higher ranking.') : T(lang, 'Hiển thị tiêu chuẩn, 100 proposal quota.', 'Standard visibility, 100 proposal quota.')}</p></> : null}
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 9 }}><span className="l-vi">Kỳ hạn</span><span className="l-en">Term</span> <span style={{ fontWeight: 500, color: '#94A3B8' }}>({unitLabel})</span></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>{termOptions.map((u) => <button key={u} onClick={() => setUnits(u)} style={{ padding: '12px 16px', border: `1px solid ${units === u ? '#1BADEA' : '#E2E8F0'}`, background: units === u ? '#E7F6FD' : '#fff', color: units === u ? '#1596cc' : '#334155', borderRadius: 10, cursor: 'pointer' }}><span style={{ fontSize: 16, fontWeight: 800 }}>{u}</span>{cfg.disc(u) ? <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', marginLeft: 5 }}>-{cfg.disc(u)}%</span> : null}</button>)}</div>
          <p style={{ fontSize: 12.5, color: '#94A3B8', margin: '8px 0 24px' }}>{T(lang, 'Kỳ hạn tối thiểu:', 'Minimum term:')} {cfg.min} {unitLabel}</p>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 9 }}><span className="l-vi">Mã khuyến mãi</span><span className="l-en">Promo code</span></div>
          <div style={{ display: 'flex', gap: 8 }}><input value={promo} onChange={(e) => { setPromo(e.target.value.toUpperCase()); setAppliedPromo(null); }} placeholder="DEALS68" style={{ flex: 1, border: '1px solid #E2E8F0', borderRadius: 10, padding: '11px 13px', fontSize: 15, color: '#0F2A4A', background: '#F7FAFC', fontWeight: 600, textTransform: 'uppercase', outline: 'none' }} /><button onClick={applyPromo} style={{ background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 14, padding: '0 20px', border: 'none', borderRadius: 10, cursor: 'pointer' }}><span className="l-vi">Áp dụng</span><span className="l-en">Apply</span></button></div>
          <p style={{ fontSize: 12.5, margin: '9px 0 0', color: appliedPromo ? '#16A34A' : '#B8860B' }}>{promoMsg}</p>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '14px 0 0', lineHeight: 1.5 }}><span className="l-vi">Gợi ý mã: DEALS68 (-10%), LAUNCH20 (-20%), VCPC15 (-15%). Admin cấu hình mã theo vai trò/quốc gia/kỳ hạn.</span><span className="l-en">Try: DEALS68 (-10%), LAUNCH20 (-20%), VCPC15 (-15%). Admins configure codes by role/country/term.</span></p>
        </div>

        <div style={{ background: '#0F2A4A', color: '#fff', borderRadius: 20, padding: 30, boxShadow: '0 18px 44px rgba(6,20,40,.18)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,181,29,.18), transparent 70%)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#9db4cc', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 6 }}>{planName}</div>
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1, lineHeight: 1, color: '#F2B51D', marginBottom: 4 }}>{money(total, cur)}</div>
            <div style={{ fontSize: 14, color: '#a9bdd4', marginBottom: 22 }}>{units} {unitLabel} · {cur}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, padding: '18px 0', borderTop: '1px solid rgba(255,255,255,.12)', borderBottom: '1px solid rgba(255,255,255,.12)' }}>
              <SummaryDark label={T(lang, 'Đơn giá cơ sở', 'Base unit')} value={money(base, cur)} />
              <SummaryDark label={T(lang, 'Tạm tính', 'Subtotal') + ` (${units} ${unitLabel})`} value={money(subtotal, cur)} />
              <SummaryDark label={T(lang, 'Giảm theo kỳ hạn', 'Term discount')} value={termPct ? `-${termPct}% · ${money(subtotal - afterTerm, cur)}` : '—'} green={!!termPct} />
              <SummaryDark label={T(lang, 'Mã khuyến mãi', 'Promo')} value={promoPct ? `-${promoPct}% · ${money(afterTerm - total, cur)}` : '—'} green={!!promoPct} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16 }}><span style={{ fontSize: 15, fontWeight: 700 }}><span className="l-vi">Tổng thanh toán</span><span className="l-en">Total due</span></span><span style={{ fontSize: 24, fontWeight: 800, color: '#F2B51D' }}>{money(total, cur)}</span></div>
            {saving > 0 ? <div style={{ marginTop: 12, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#4ade80', background: 'rgba(22,163,74,.16)', padding: 8, borderRadius: 9 }}><span className="l-vi">Tiết kiệm</span><span className="l-en">You save</span> {money(saving, cur)}</div> : null}
            <button onClick={checkout} style={{ display: 'block', width: '100%', marginTop: 18, textAlign: 'center', background: '#F2B51D', color: '#0F2A4A', fontWeight: 800, fontSize: 16, padding: 15, borderRadius: 12, boxShadow: '0 8px 20px rgba(242,181,29,.32)', border: 'none', cursor: 'pointer' }}><span className="l-vi">Đăng ký tài khoản</span><span className="l-en">Register account</span> →</button>
            <div style={{ marginTop: 12, fontSize: 12, color: '#9db4cc', textAlign: 'center', lineHeight: 1.5 }}><span className="l-vi">Thanh toán qua QR chuyển khoản, thẻ Senpay hoặc Paypal.</span><span className="l-en">Pay via bank QR, Senpay card or Paypal.</span></div>
          </div>
        </div>
      </div>
    </section>

    <section style={{ maxWidth: 1240, margin: '0 auto', padding: '0 24px 24px' }}>
      <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -.6, margin: '0 0 6px', textAlign: 'center' }}><span className="l-vi">Gói theo vai trò</span><span className="l-en">Plans by role</span></h2>
      <p style={{ fontSize: 16, color: '#64748B', margin: '0 0 32px', textAlign: 'center' }}><span className="l-vi">Giá cơ sở tại Việt Nam. Quốc gia khác tính bằng USD.</span><span className="l-en">Base prices for Vietnam. Other countries are billed in USD.</span></p>
      <div className="d68-plans" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 22 }}>{planCards.map((p) => <div key={p.key} style={{ position: 'relative', background: '#fff', border: p.popular ? '2px solid #F2B51D' : '1px solid #E7EDF3', borderRadius: 18, padding: 26, boxShadow: p.popular ? '0 16px 40px rgba(15,42,74,.10)' : '0 1px 2px rgba(15,42,74,.04)' }}>
        {p.popular ? <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%,-50%)', background: '#F2B51D', color: '#0F2A4A', fontSize: 12, fontWeight: 800, padding: '5px 14px', borderRadius: 999 }}>★ <span className="l-vi">Phổ biến</span><span className="l-en">Popular</span></div> : null}
        <div style={{ width: 52, height: 52, borderRadius: 13, background: p.popular ? '#FEF3D3' : '#E7F6FD', color: p.popular ? '#B8860B' : '#1596cc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 18 }}>{p.icon}</div>
        <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>{T(lang, p.titleVi, p.titleEn)}</h3>
        <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.5, margin: '0 0 18px', minHeight: 40 }}>{T(lang, p.descVi, p.descEn)}</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 4 }}><span style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, color: '#0F2A4A' }}>{p.price}</span><span style={{ fontSize: 14, color: '#64748B', marginBottom: 6 }}>/ {T(lang, p.perVi, p.perEn)}</span></div>
        <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 20 }}>{T(lang, p.minInfoVi, p.minInfoEn)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>{(lang === 'en' ? p.featuresEn : p.featuresVi).map((ft) => <div key={ft} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: '#334155', lineHeight: 1.45 }}><span style={{ color: '#16A34A', flexShrink: 0, fontWeight: 800 }}>✓</span>{ft}</div>)}</div>
        <Link to={p.href} style={{ display: 'block', textAlign: 'center', background: p.popular ? '#F2B51D' : '#fff', color: p.popular ? '#0F2A4A' : '#1596cc', border: p.popular ? 'none' : '1px solid #1BADEA', fontWeight: 800, fontSize: 15, padding: 13, borderRadius: 11 }}>{T(lang, 'Đăng ký', 'Register')}</Link>
      </div>)}</div>
    </section>

    <section style={{ maxWidth: 1240, margin: '0 auto', padding: '44px 24px' }}><div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 30, boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}><h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}><span className="l-vi">Chiết khấu theo kỳ hạn</span><span className="l-en">Term discounts</span></h2><p style={{ fontSize: 14, color: '#64748B', margin: '0 0 20px' }}><span className="l-vi">Áp dụng tự động khi chọn kỳ hạn dài hơn.</span><span className="l-en">Applied automatically for longer terms.</span></p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>{tiers.map((tr) => <div key={tr.off} style={{ border: '1px solid #EEF2F6', borderRadius: 13, padding: '18px 20px', background: '#F7FAFC' }}><div style={{ fontSize: 22, fontWeight: 800, color: '#1596cc', marginBottom: 2 }}>{tr.off}</div><div style={{ fontSize: 14, fontWeight: 700, color: '#0F2A4A' }}>{T(lang, tr.termVi, tr.termEn)}</div><div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{T(lang, tr.whoVi, tr.whoEn)}</div></div>)}</div></div></section>
    <section style={{ maxWidth: 900, margin: '0 auto', padding: '20px 24px 56px' }}><h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -.5, margin: '0 0 22px' }}><span className="l-vi">Câu hỏi về giá</span><span className="l-en">Pricing FAQ</span></h2><div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{faqs.map((f) => <div key={f.qVi} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 14, padding: '20px 22px' }}><div style={{ fontSize: 16, fontWeight: 700, marginBottom: 7 }}>{T(lang, f.qVi, f.qEn)}</div><p style={{ fontSize: 14.5, color: '#64748B', lineHeight: 1.6, margin: 0 }}>{T(lang, f.aVi, f.aEn)}</p></div>)}</div></section>
  </>;
}

function SummaryDark({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span style={{ color: '#c6d5e6' }}>{label}</span><span style={{ fontWeight: 700, color: green ? '#4ade80' : '#fff' }}>{value}</span></div>;
}
