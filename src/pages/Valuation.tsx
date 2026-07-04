import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

type Country = { value: string; region: string; cur: 'VND' | 'USD'; adj: number };
type Industry = { key: string; vi: string; en: string; rev: number; eb: number };
const COUNTRIES: Country[] = [
  { value: 'Vietnam', region: 'asia', cur: 'VND', adj: 0.85 }, { value: 'Singapore', region: 'asia', cur: 'USD', adj: 1.15 }, { value: 'South Korea', region: 'asia', cur: 'USD', adj: 1.05 }, { value: 'Hong Kong', region: 'asia', cur: 'USD', adj: 1.1 }, { value: 'Japan', region: 'asia', cur: 'USD', adj: 1.1 }, { value: 'China', region: 'asia', cur: 'USD', adj: 1 }, { value: 'Thailand', region: 'asia', cur: 'USD', adj: 0.92 }, { value: 'United States', region: 'americas', cur: 'USD', adj: 1.25 }, { value: 'United Kingdom', region: 'europe', cur: 'USD', adj: 1.15 }, { value: 'Germany', region: 'europe', cur: 'USD', adj: 1.12 }, { value: 'Australia', region: 'oceania', cur: 'USD', adj: 1.1 }, { value: 'UAE', region: 'mideast', cur: 'USD', adj: 1.05 }
];
const INDUSTRIES: Industry[] = [
  { key: 'fnb', vi: 'F&B', en: 'F&B', rev: 1.2, eb: 6 }, { key: 'health', vi: 'Y tế & Sức khỏe', en: 'Healthcare', rev: 2, eb: 9 }, { key: 'retail', vi: 'Bán lẻ', en: 'Retail', rev: .8, eb: 6 }, { key: 'mfg', vi: 'Sản xuất', en: 'Manufacturing', rev: 1, eb: 7 }, { key: 'tech', vi: 'Công nghệ / IT', en: 'Technology / IT', rev: 3, eb: 14 }, { key: 'realestate', vi: 'Bất động sản', en: 'Real Estate', rev: 2.5, eb: 10 }, { key: 'logistics', vi: 'Logistics', en: 'Logistics', rev: 1, eb: 7 }, { key: 'edu', vi: 'Giáo dục', en: 'Education', rev: 1.8, eb: 9 }, { key: 'beauty', vi: 'Làm đẹp', en: 'Beauty', rev: 1.3, eb: 7 }, { key: 'energy', vi: 'Năng lượng', en: 'Energy', rev: 1.5, eb: 8 }, { key: 'ecom', vi: 'E-commerce', en: 'E-commerce', rev: 1.2, eb: 10 }, { key: 'seafood', vi: 'Thủy sản & Xuất khẩu', en: 'Seafood & Export', rev: .9, eb: 6 }
];
function regionLabel(key: string, lang: Lang) {
  const m: Record<string, [string, string]> = { asia: ['Châu Á', 'Asia'], americas: ['Châu Mỹ', 'Americas'], europe: ['Châu Âu', 'Europe'], oceania: ['Châu Úc', 'Oceania'], mideast: ['Trung Đông', 'Middle East'], africa: ['Châu Phi', 'Africa'] };
  return T(lang, ...(m[key] || ['Khác', 'Other']));
}
function fmt(amount: number, cur: 'VND' | 'USD') {
  if (!Number.isFinite(amount)) return '—';
  if (cur === 'VND') return amount >= 1e9 ? (amount / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tỷ ₫' : (amount / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' triệu ₫';
  if (amount >= 1e6) return '$' + (amount / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 }) + 'M';
  return '$' + (amount / 1e3).toLocaleString('en-US', { maximumFractionDigits: 0 }) + 'k';
}

export default function Valuation({ lang }: { lang: Lang }) {
  const [country, setCountry] = useState('Vietnam');
  const [industry, setIndustry] = useState('fnb');
  const [revenue, setRevenue] = useState(42);
  const [margin, setMargin] = useState(18);
  const [growth, setGrowth] = useState(25);
  const [founded, setFounded] = useState(2018);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [leadSaved, setLeadSaved] = useState(false);
  const [applied, setApplied] = useState({ country: 'Vietnam', industry: 'fnb', revenue: 42, margin: 18, growth: 25, founded: 2018 });
  const currentCountry = COUNTRIES.find((x) => x.value === country) || COUNTRIES[0];

  const result = useMemo(() => {
    const c = COUNTRIES.find((x) => x.value === applied.country) || COUNTRIES[0];
    const ind = INDUSTRIES.find((x) => x.key === applied.industry) || INDUSTRIES[0];
    const revAbs = Number(applied.revenue || 0) * (c.cur === 'VND' ? 1e9 : 1e6);
    const m = Number(applied.margin || 0);
    const g = Number(applied.growth || 0);
    const ebitdaAmount = revAbs * m / 100;
    let growthAdj = 1, growthText = '';
    if (g < 0) { growthAdj = .8; growthText = T(lang, 'Tăng trưởng âm — giảm bội số', 'Negative growth — lower multiple'); }
    else if (g <= 10) { growthAdj = .95; growthText = T(lang, 'Tăng trưởng 0–10% — trung tính', 'Growth 0–10% — neutral'); }
    else if (g <= 30) { growthAdj = 1.12; growthText = T(lang, 'Tăng trưởng 10–30% — cộng điểm', 'Growth 10–30% — premium'); }
    else { growthAdj = 1.3; growthText = T(lang, 'Tăng trưởng >30% — cộng điểm mạnh', 'Growth >30% — strong premium'); }
    let marginAdj = 1, marginText = '';
    if (m <= 0) { marginAdj = .85; marginText = T(lang, 'Chưa có EBITDA dương — độ tin cậy thấp hơn', 'No positive EBITDA — lower confidence'); }
    else if (m < 10) { marginAdj = .94; marginText = T(lang, 'Biên lợi nhuận thấp', 'Thin margin'); }
    else if (m <= 20) { marginAdj = 1; marginText = T(lang, 'Biên lợi nhuận lành mạnh', 'Healthy margin'); }
    else { marginAdj = 1.1; marginText = T(lang, 'Biên lợi nhuận cao — cộng điểm', 'High margin — premium'); }
    const countryText = c.adj > 1 ? T(lang, `${c.value} — thị trường định giá cao hơn`, `${c.value} — higher-valued market`) : c.adj < 1 ? T(lang, `${c.value} — chiết khấu thị trường mới nổi`, `${c.value} — emerging-market discount`) : T(lang, `${c.value} — trung tính`, `${c.value} — neutral`);
    const revMultEff = ind.rev * c.adj * growthAdj * marginAdj;
    const ebMultEff = ind.eb * c.adj * growthAdj;
    const revenueVal = revAbs * revMultEff;
    const ebitdaVal = ebitdaAmount * ebMultEff;
    const base = m > 0 ? .6 * ebitdaVal + .4 * revenueVal : revenueVal * .92;
    const confKey = m > 0 ? (g !== 0 && applied.founded ? 'high' : 'medium') : 'low';
    const conf = confKey === 'high' ? { label: T(lang, 'Độ tin cậy cao', 'High confidence'), color: '#4ade80', bg: 'rgba(22,163,74,.18)' } : confKey === 'medium' ? { label: T(lang, 'Độ tin cậy trung bình', 'Medium confidence'), color: '#F2B51D', bg: 'rgba(242,181,29,.18)' } : { label: T(lang, 'Độ tin cậy thấp', 'Low confidence'), color: '#fb923c', bg: 'rgba(220,120,40,.20)' };
    const mk = (adj: number, text: string) => ({ sign: adj > 1 ? '+' : adj < 1 ? '−' : '=', bg: adj > 1 ? 'rgba(74,222,128,.16)' : adj < 1 ? 'rgba(251,146,60,.18)' : 'rgba(255,255,255,.1)', color: adj > 1 ? '#4ade80' : adj < 1 ? '#fb923c' : '#cbd5e1', text });
    return { cur: c.cur, base, low: base * .82, high: base * 1.18, revMultiple: revAbs > 0 ? (base / revAbs).toFixed(1) + '×' : '—', ebitdaMultiple: m > 0 && ebitdaAmount > 0 ? (base / ebitdaAmount).toFixed(1) + '×' : 'N/A', conf, reasons: [mk(1.001, T(lang, 'Ngành ', 'Industry ') + T(lang, ind.vi, ind.en) + T(lang, ` · bội số cơ sở ${ind.rev}× DThu / ${ind.eb}× EBITDA`, ` · base ${ind.rev}× rev / ${ind.eb}× EBITDA`)), mk(c.adj, countryText), mk(growthAdj, growthText), mk(marginAdj, marginText)] };
  }, [applied, lang]);

  const inputStyle = { border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 13px', fontSize: 15, color: '#0F2A4A', background: '#F7FAFC', fontWeight: 500, outline: 'none', width: '100%' };
  const methods = [
    { tag: T(lang, 'Bội số benchmark', 'Benchmark multiples'), text: T(lang, 'Bội số doanh thu & EBITDA cơ sở theo ngành, quốc gia và quy mô — admin cấu hình được.', 'Base revenue & EBITDA multiples by industry, country and size — admin-configurable.') },
    { tag: T(lang, 'Kết hợp có trọng số', 'Weighted blend'), text: T(lang, 'Nếu EBITDA dương: 60% theo EBITDA + 40% theo doanh thu; nếu chưa có EBITDA: theo doanh thu với độ tin cậy thấp hơn.', 'If EBITDA is positive: 60% EBITDA-based + 40% revenue-based; otherwise revenue-based with lower confidence.') },
    { tag: T(lang, 'Điều chỉnh', 'Adjustments'), text: T(lang, 'Tăng/giảm theo dải tăng trưởng, biên lợi nhuận và chiết khấu/thặng dư theo quốc gia.', 'Up/down by growth band, profit margin and country discount/premium.') },
    { tag: T(lang, 'Độ tin cậy', 'Confidence'), text: T(lang, 'Cao khi đủ doanh thu, EBITDA, tăng trưởng, quốc gia, ngành; thấp khi chỉ có doanh thu.', 'High with revenue, EBITDA, growth, country and industry; low with revenue only.') }
  ];

  return <>
    <section style={{ background: 'radial-gradient(900px 400px at 82% -20%, rgba(27,173,234,.25), transparent 60%), linear-gradient(180deg,#0F2A4A,#14315A)', color: '#fff' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 24px 40px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, color: '#cfe8f6', marginBottom: 18 }}><span className="l-vi">Miễn phí · Không cần đăng nhập</span><span className="l-en">Free · No login required</span></div>
        <h1 className="d68-hero-h1" style={{ fontSize: 44, lineHeight: 1.08, fontWeight: 800, letterSpacing: -1.2, margin: '0 0 14px', maxWidth: 760 }}><span className="l-vi">Định giá sơ bộ <span style={{ color: '#F2B51D' }}>doanh nghiệp</span> của bạn</span><span className="l-en">Estimate your <span style={{ color: '#F2B51D' }}>business</span> valuation</span></h1>
        <p style={{ fontSize: 18, lineHeight: 1.55, color: '#c6d5e6', maxWidth: 640, margin: 0 }}><span className="l-vi">Nhận khoảng định giá tham khảo theo ngành, quốc gia và tài chính — dựa trên bội số benchmark do Deals68 cấu hình.</span><span className="l-en">Get an indicative valuation range by industry, country and financials — using Deals68's configurable benchmark multiples.</span></p>
      </div>
    </section>

    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px 20px' }}>
      <div className="d68-val-cols" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.05fr)', gap: 26, alignItems: 'start', transform: 'translateY(-56px)' }}>
        <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 20, padding: 30, boxShadow: '0 18px 44px rgba(6,20,40,.12)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}><span className="l-vi">Thông tin doanh nghiệp</span><span className="l-en">Business details</span></h2>
          <p style={{ fontSize: 14, color: '#64748B', margin: '0 0 22px' }}><span className="l-vi">Điền các trường dưới đây rồi bấm ước tính.</span><span className="l-en">Fill in the fields below and estimate.</span></p>
          <div className="d68-form-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label={T(lang, 'Quốc gia', 'Country')} required><select value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle}>{COUNTRIES.map((c) => <option value={c.value} key={c.value}>{c.value}</option>)}</select><span style={{ fontSize: 12, color: '#94A3B8' }}>{T(lang, 'Khu vực:', 'Region:')} {regionLabel(currentCountry.region, lang)} · {currentCountry.cur}</span></Field>
            <Field label={T(lang, 'Ngành', 'Industry')} required><select value={industry} onChange={(e) => setIndustry(e.target.value)} style={inputStyle}>{INDUSTRIES.map((i) => <option value={i.key} key={i.key}>{T(lang, i.vi, i.en)}</option>)}</select></Field>
            <Field label={T(lang, 'Doanh thu năm gần nhất', 'Latest annual revenue')} required><div style={{ position: 'relative' }}><input type="number" value={revenue} onChange={(e) => setRevenue(Number(e.target.value))} min="0" style={{ ...inputStyle, paddingRight: 70 }} /><span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color: '#64748B' }}>{currentCountry.cur === 'VND' ? 'tỷ ₫' : T(lang, 'triệu $', 'M $')}</span></div></Field>
            <Field label={T(lang, 'Biên EBITDA / lợi nhuận', 'EBITDA / profit margin')}><div style={{ position: 'relative' }}><input type="number" value={margin} onChange={(e) => setMargin(Number(e.target.value))} style={{ ...inputStyle, paddingRight: 38 }} /><span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color: '#64748B' }}>%</span></div></Field>
            <Field label={T(lang, 'Tăng trưởng doanh thu / năm', 'Revenue growth / year')}><div style={{ position: 'relative' }}><input type="number" value={growth} onChange={(e) => setGrowth(Number(e.target.value))} style={{ ...inputStyle, paddingRight: 38 }} /><span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color: '#64748B' }}>%</span></div></Field>
            <Field label={T(lang, 'Năm thành lập', 'Founded year')}><input type="number" value={founded} onChange={(e) => setFounded(Number(e.target.value))} placeholder="2018" style={inputStyle} /></Field>
          </div>
          <button onClick={() => setApplied({ country, industry, revenue, margin, growth, founded })} style={{ marginTop: 24, width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#F2B51D', color: '#0F2A4A', fontWeight: 800, fontSize: 16, padding: 15, border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: '0 10px 24px rgba(242,181,29,.35)' }}><span className="l-vi">Ước tính định giá</span><span className="l-en">Estimate valuation</span> →</button>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '14px 0 0', lineHeight: 1.5 }}><span className="l-vi">Kết quả chỉ mang tính tham khảo, không thay thế tư vấn định giá, thẩm định hoặc ý kiến pháp lý/tài chính độc lập.</span><span className="l-en">Results are indicative only and do not replace independent valuation, due diligence or legal/financial advice.</span></p>
        </div>

        <div style={{ background: '#0F2A4A', color: '#fff', borderRadius: 20, padding: 30, boxShadow: '0 18px 44px rgba(6,20,40,.18)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,181,29,.18), transparent 70%)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 22 }}><div style={{ fontSize: 13, fontWeight: 600, color: '#9db4cc', textTransform: 'uppercase', letterSpacing: .6 }}><span className="l-vi">Khoảng định giá ước tính</span><span className="l-en">Estimated valuation range</span></div><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, padding: '6px 12px', borderRadius: 999, background: result.conf.bg, color: result.conf.color }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: result.conf.color }} />{result.conf.label}</span></div>
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1, lineHeight: 1, marginBottom: 6, color: '#F2B51D' }}>{fmt(result.base, result.cur)}</div>
            <div style={{ fontSize: 14, color: '#a9bdd4', marginBottom: 22 }}><span className="l-vi">Giá trị cơ sở</span><span className="l-en">Base value</span></div>
            <div style={{ height: 8, borderRadius: 999, background: 'linear-gradient(90deg,#1BADEA,#F2B51D)', marginBottom: 10, position: 'relative' }}><span style={{ position: 'absolute', left: '50%', top: -4, width: 16, height: 16, borderRadius: '50%', background: '#fff', border: '3px solid #F2B51D', transform: 'translateX(-50%)' }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#c6d5e6', marginBottom: 26 }}><div><div style={{ fontSize: 11, color: '#7f97b3' }}><span className="l-vi">Thấp</span><span className="l-en">Low</span></div><div style={{ fontWeight: 700, fontSize: 15 }}>{fmt(result.low, result.cur)}</div></div><div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, color: '#7f97b3' }}><span className="l-vi">Cao</span><span className="l-en">High</span></div><div style={{ fontWeight: 700, fontSize: 15 }}>{fmt(result.high, result.cur)}</div></div></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}><Metric label={T(lang, 'Bội số doanh thu', 'Revenue multiple')} value={result.revMultiple} /><Metric label={T(lang, 'Bội số EBITDA', 'EBITDA multiple')} value={result.ebitdaMultiple} /></div>
            <div style={{ fontSize: 12, color: '#9db4cc', textTransform: 'uppercase', letterSpacing: .5, fontWeight: 700, marginBottom: 12 }}><span className="l-vi">Yếu tố điều chỉnh</span><span className="l-en">Adjustment factors</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{result.reasons.map((rs) => <div key={rs.text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}><span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, background: rs.bg, color: rs.color }}>{rs.sign}</span><span style={{ color: '#dbe6f2' }}>{rs.text}</span></div>)}</div>
          </div>
        </div>
      </div>
    </section>

    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 40px' }}><div className="d68-val-cols" style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 20, padding: 34, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 34, boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}><div><h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -.5, margin: '0 0 10px' }}><span className="l-vi">Sẵn sàng thu hút nhà đầu tư?</span><span className="l-en">Ready to attract investors?</span></h2><p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.55, margin: '0 0 22px' }}><span className="l-vi">Đăng hồ sơ ẩn danh trên Deals68 để tiếp cận nhà đầu tư, người mua chiến lược và bên cho vay — hoặc nhận tư vấn định giá chuyên sâu.</span><span className="l-en">Post an anonymous profile on Deals68 to reach investors, strategic buyers and lenders — or get an in-depth valuation review.</span></p><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><Link to="/register/business" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 15, padding: '14px 24px', borderRadius: 11 }}><span className="l-vi">Đăng hồ sơ gọi vốn / bán DN</span><span className="l-en">Post a fundraise / sale profile</span> →</Link><a href="mailto:partner@vietcapitalpartners.com?subject=Deals68%20-%20T%C6%B0%20v%E1%BA%A5n%20%C4%91%E1%BB%8Bnh%20gi%C3%A1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: '#1596cc', border: '1px solid #1BADEA', fontWeight: 700, fontSize: 15, padding: '14px 24px', borderRadius: 11 }}><span className="l-vi">Nhận tư vấn nâng cao</span><span className="l-en">Get advanced advisory</span></a></div></div><div style={{ background: '#F7FAFC', border: '1px solid #E7EDF3', borderRadius: 16, padding: 24 }}><div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}><span className="l-vi">Lưu kết quả định giá</span><span className="l-en">Save your valuation</span></div><p style={{ fontSize: 13, color: '#64748B', margin: '0 0 16px' }}><span className="l-vi">Để lại email hoặc số điện thoại để nhận báo cáo chi tiết.</span><span className="l-en">Leave an email or phone to receive the detailed report.</span></p><div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@company.com" style={inputStyle} /><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+84 ..." style={inputStyle} /><button onClick={() => setLeadSaved(true)} style={{ width: '100%', background: '#1BADEA', color: '#fff', fontWeight: 700, fontSize: 15, padding: 13, border: 'none', borderRadius: 11, cursor: 'pointer' }}>{leadSaved ? T(lang, 'Đã lưu ✓', 'Saved ✓') : T(lang, 'Nhận báo cáo', 'Get report')}</button></div></div></div></section>
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 72px' }}><h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -.5, margin: '0 0 22px' }}><span className="l-vi">Cách chúng tôi ước tính</span><span className="l-en">How we estimate</span></h2><div className="d68-val-cols" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>{methods.map((m) => <div key={m.tag} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 14, padding: 22 }}><div style={{ fontSize: 13, fontWeight: 800, color: '#1596cc', marginBottom: 10 }}>{m.tag}</div><p style={{ fontSize: 14, color: '#475569', lineHeight: 1.55, margin: 0 }}>{m.text}</p></div>)}</div></section>
  </>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>{label} {required ? <span style={{ color: '#DC2626' }}>*</span> : null}</span>{children}</label>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: 14 }}><div style={{ fontSize: 11, color: '#9db4cc', textTransform: 'uppercase', letterSpacing: .4, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{value}</div></div>;
}
