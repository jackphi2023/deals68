import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Lang } from '../lib/i18n';
import { toLocalizedPath } from '../lib/i18nRoutes';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
type Country = { value: string; region: string; cur: 'VND' | 'USD'; adj: number };
type Industry = { key: string; vi: string; en: string; rev: number; eb: number };
const COUNTRIES: Country[] = [
  { value: 'Vietnam', region: 'asia', cur: 'VND', adj: 0.85 }, { value: 'Singapore', region: 'asia', cur: 'USD', adj: 1.15 }, { value: 'South Korea', region: 'asia', cur: 'USD', adj: 1.05 }, { value: 'Hong Kong', region: 'asia', cur: 'USD', adj: 1.1 }, { value: 'Japan', region: 'asia', cur: 'USD', adj: 1.1 }, { value: 'Thailand', region: 'asia', cur: 'USD', adj: 0.92 }, { value: 'United States', region: 'americas', cur: 'USD', adj: 1.25 }, { value: 'United Kingdom', region: 'europe', cur: 'USD', adj: 1.15 }, { value: 'Germany', region: 'europe', cur: 'USD', adj: 1.12 }, { value: 'Australia', region: 'oceania', cur: 'USD', adj: 1.1 }, { value: 'UAE', region: 'mideast', cur: 'USD', adj: 1.05 }
];
const INDUSTRIES: Industry[] = [
  { key: 'fnb', vi: 'Nhà hàng & Đồ uống', en: 'F&B', rev: 1.2, eb: 6 }, { key: 'health', vi: 'Y tế & Chăm sóc sức khỏe', en: 'Healthcare', rev: 2, eb: 9 }, { key: 'retail', vi: 'Bán lẻ', en: 'Retail', rev: .8, eb: 6 }, { key: 'mfg', vi: 'Sản xuất', en: 'Manufacturing', rev: 1, eb: 7 }, { key: 'tech', vi: 'Công nghệ', en: 'Technology', rev: 3, eb: 14 }, { key: 'realestate', vi: 'Bất động sản', en: 'Real Estate', rev: 2.5, eb: 10 }, { key: 'logistics', vi: 'Vận tải & Kho vận', en: 'Logistics', rev: 1, eb: 7 }, { key: 'edu', vi: 'Giáo dục', en: 'Education', rev: 1.8, eb: 9 }, { key: 'beauty', vi: 'Làm đẹp', en: 'Beauty', rev: 1.3, eb: 7 }, { key: 'seafood', vi: 'Thủy sản & Xuất khẩu', en: 'Seafood & Export', rev: .9, eb: 6 }
];
function fmt(amount: number, cur: 'VND' | 'USD') {
  if (!Number.isFinite(amount)) return '—';
  if (cur === 'VND') return amount >= 1e9 ? (amount / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tỷ ₫' : (amount / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' triệu ₫';
  if (amount >= 1e6) return '$' + (amount / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 }) + 'M';
  return '$' + (amount / 1e3).toLocaleString('en-US', { maximumFractionDigits: 0 }) + 'k';
}


function splitNumberParts(value: any, allowDecimal = false) {
  const raw = String(value ?? '').replace(/\s/g, '').replace(/[^0-9,.-]/g, '');
  const negative = raw.startsWith('-') ? '-' : '';
  let body = raw.replace(/-/g, '');
  let decimal = '';
  let hasDecimal = false;
  if (allowDecimal) {
    const commaIndex = body.lastIndexOf(',');
    if (commaIndex >= 0) {
      hasDecimal = true;
      decimal = body.slice(commaIndex + 1).replace(/\D/g, '').slice(0, 2);
      body = body.slice(0, commaIndex);
    }
  }
  const integer = body.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return { negative, integer, decimal, hasDecimal };
}
function formatNumberTyping(value: any, allowDecimal = false) {
  const { negative, integer, decimal, hasDecimal } = splitNumberParts(value, allowDecimal);
  if (!integer && !decimal) return '';
  const grouped = (integer || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative}${grouped}${hasDecimal ? `,${decimal}` : ''}`;
}
function parseFormattedNumber(value: any, allowDecimal = false) {
  const { negative, integer, decimal } = splitNumberParts(value, allowDecimal);
  if (!integer && !decimal) return 0;
  return Number(`${negative}${integer || '0'}${allowDecimal && decimal ? `.${decimal}` : ''}`) || 0;
}

export default function Valuation({ lang }: { lang: Lang }) {
  const [country, setCountry] = useState('Vietnam');
  const [industry, setIndustry] = useState('fnb');
  const [revenue, setRevenue] = useState('42');
  const [margin, setMargin] = useState('18');
  const [growth, setGrowth] = useState('25');
  const [founded, setFounded] = useState('2018');
  const [applied, setApplied] = useState({ country: 'Vietnam', industry: 'fnb', revenue: 42, margin: 18, growth: 25, founded: 2018 });

  const result = useMemo(() => {
    const c = COUNTRIES.find((x) => x.value === applied.country) || COUNTRIES[0];
    const ind = INDUSTRIES.find((x) => x.key === applied.industry) || INDUSTRIES[0];
    const revAbs = Number(applied.revenue || 0) * (c.cur === 'VND' ? 1e9 : 1e6);
    const m = Number(applied.margin || 0);
    const g = Number(applied.growth || 0);
    const ebitdaAmount = revAbs * m / 100;
    const growthAdj = g < 0 ? .8 : g <= 10 ? .95 : g <= 30 ? 1.12 : 1.3;
    const marginAdj = m <= 0 ? .85 : m < 10 ? .94 : m <= 20 ? 1 : 1.1;
    const revMultEff = ind.rev * c.adj * growthAdj * marginAdj;
    const ebMultEff = ind.eb * c.adj * growthAdj;
    const revenueVal = revAbs * revMultEff;
    const ebitdaVal = ebitdaAmount * ebMultEff;
    const base = m > 0 ? .6 * ebitdaVal + .4 * revenueVal : revenueVal * .92;
    const confKey = m > 0 ? (g !== 0 && applied.founded ? 'high' : 'medium') : 'low';
    const conf = confKey === 'high' ? T(lang, 'Độ tin cậy cao', 'High confidence') : confKey === 'medium' ? T(lang, 'Độ tin cậy trung bình', 'Medium confidence') : T(lang, 'Độ tin cậy thấp', 'Low confidence');
    return { cur: c.cur, base, low: base * .82, high: base * 1.18, revMultiple: revAbs > 0 ? (base / revAbs).toFixed(1) + '×' : '—', ebitdaMultiple: m > 0 && ebitdaAmount > 0 ? (base / ebitdaAmount).toFixed(1) + '×' : 'N/A', conf, ind, country: c };
  }, [applied, lang]);

  function apply() { setApplied({ country, industry, revenue: parseFormattedNumber(revenue, true), margin: parseFormattedNumber(margin, true), growth: parseFormattedNumber(growth, true), founded: parseFormattedNumber(founded) }); }

  return <main className="d68-valuation-page">
    <section className="d68-val-hero"><div><span>{T(lang, 'Miễn phí · Không cần đăng nhập', 'Free · No login required')}</span><h1>{T(lang, 'Định giá sơ bộ doanh nghiệp của bạn', 'Estimate your business valuation')}</h1><p>{T(lang, 'Nhận khoảng định giá tham khảo theo ngành, quốc gia và tài chính. Công cụ này dùng bội số cấu hình nội bộ của Deals68 để hỗ trợ sàng lọc ban đầu.', 'Get an indicative valuation range by industry, country and financials. This tool uses Deals68 internal benchmark multiples for initial screening support.')}</p></div></section>
    <section className="d68-val-wrap"><div className="d68-val-cols"><article className="d68-val-card"><h2>{T(lang, 'Thông tin doanh nghiệp', 'Business details')}</h2><p className="d68-val-card-note">{T(lang, 'Nhập số liệu tổng quan; không cần đưa tên doanh nghiệp, thương hiệu hoặc tài liệu riêng tư.', 'Enter high-level figures only; no company name, brand or private documents are required.')}</p><div className="d68-val-form"><label>{T(lang, 'Quốc gia', 'Country')}<select value={country} onChange={(e) => setCountry(e.target.value)}>{COUNTRIES.map((c) => <option key={c.value}>{c.value}</option>)}</select></label><label>{T(lang, 'Ngành', 'Industry')}<select value={industry} onChange={(e) => setIndustry(e.target.value)}>{INDUSTRIES.map((i) => <option key={i.key} value={i.key}>{T(lang, i.vi, i.en)}</option>)}</select></label><label>{T(lang, 'Doanh thu năm gần nhất', 'Latest annual revenue')}<input inputMode="decimal" value={revenue} onChange={(e) => setRevenue(formatNumberTyping(e.target.value, true))}/><small>{country === 'Vietnam' ? T(lang, 'tỷ đồng', 'VND billion') : T(lang, 'triệu đô la Mỹ', 'USD million')}</small></label><label>{T(lang, 'Biên lợi nhuận EBITDA (%)', 'EBITDA margin (%)')}<input inputMode="decimal" value={margin} onChange={(e) => setMargin(formatNumberTyping(e.target.value, true))}/></label><label>{T(lang, 'Tăng trưởng doanh thu (%)', 'Revenue growth (%)')}<input inputMode="decimal" value={growth} onChange={(e) => setGrowth(formatNumberTyping(e.target.value, true))}/></label><label>{T(lang, 'Năm thành lập', 'Founded year')}<input inputMode="numeric" value={founded} onChange={(e) => setFounded(formatNumberTyping(e.target.value))}/></label></div><button type="button" onClick={apply}>{T(lang, 'Cập nhật định giá', 'Update valuation')}</button></article><aside className="d68-val-result"><span>{result.conf}</span><h2>{fmt(result.low, result.cur)} – {fmt(result.high, result.cur)}</h2><p>{T(lang, 'Khoảng định giá chỉ để tham khảo, không phải tư vấn đầu tư, định giá chính thức hoặc cam kết giao dịch.', 'Indicative valuation range only, not investment advice, a formal valuation or a transaction commitment.')}</p><div><Row a={T(lang, 'Bội số doanh thu', 'Revenue multiple')} b={result.revMultiple}/><Row a={T(lang, 'Bội số EBITDA', 'EBITDA multiple')} b={result.ebitdaMultiple}/><Row a={T(lang,'Ngành','Industry')} b={T(lang,result.ind.vi,result.ind.en)}/><Row a={T(lang,'Quốc gia','Country')} b={result.country.value}/></div><Link to={toLocalizedPath('/register/business', lang)}>{T(lang, 'Đăng hồ sơ doanh nghiệp', 'List your business')} →</Link></aside></div></section>
    <section className="d68-val-method"><h2>{T(lang, 'Cách Deals68 tính tham khảo', 'How Deals68 estimates')}</h2><div><article><b>1</b><h3>{T(lang,'Bội số ngành','Industry multiples')}</h3><p>{T(lang,'Dùng bội số doanh thu và EBITDA cơ sở theo ngành.','Uses base revenue and EBITDA multiples by industry.')}</p></article><article><b>2</b><h3>{T(lang,'Điều chỉnh thị trường','Market adjustment')}</h3><p>{T(lang,'Điều chỉnh theo quốc gia, tăng trưởng và biên lợi nhuận.','Adjusted by country, growth and margin.')}</p></article><article><b>3</b><h3>{T(lang,'Độ tin cậy dữ liệu','Data confidence')}</h3><p>{T(lang,'Độ tin cậy cao hơn khi có đủ doanh thu, EBITDA, tăng trưởng và lịch sử hoạt động.','Higher confidence when revenue, EBITDA, growth and operating history are available.')}</p></article></div><aside className="d68-static-notice"><b>⚠️</b><span>{T(lang, 'Muốn có định giá nghiêm túc hơn, doanh nghiệp nên bổ sung báo cáo tài chính, cơ cấu cổ đông, tài sản, nợ vay, tăng trưởng và rủi ro ngành trong dashboard; mọi cập nhật công khai vẫn cần Admin duyệt.', 'For a more serious valuation, businesses should add financial statements, shareholder structure, assets, debt, growth and industry risks in the dashboard; public updates still require Admin approval.')}</span></aside></section>
  </main>;
}
function Row({ a, b }: { a: string; b: string }) { return <div className="d68-val-row"><span>{a}</span><b>{b}</b></div>; }
