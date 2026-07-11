import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Lang } from '../lib/i18n';
import { toLocalizedPath } from '../lib/i18nRoutes';
import { T, countryOptions, industryOptions } from '../lib/labels';
import { formatNumberTyping, parseFormattedNumber } from '../lib/numberFormat';
import {
  DEFAULT_VALUATION_CONFIG,
  getActiveValuationConfig,
  valuate,
  formatValuationMoney,
  VALUATION_DISCLAIMER_EN,
  VALUATION_DISCLAIMER_VI,
  type Currency
} from '../lib/valuationEngine';

function Row({ a, b }: { a: string; b: string }) { return <div className="d68-val-row"><span>{a}</span><b>{b}</b></div>; }
function mult(x: number) { return `${Number(x || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}×`; }
function currencyForCountry(country: string): Currency { return country === 'VN' ? 'VND' : 'USD'; }

export default function Valuation({ lang }: { lang: Lang }) {
  const [config, setConfig] = useState(DEFAULT_VALUATION_CONFIG);
  const [country, setCountry] = useState('VN');
  const [industryKey, setIndustryKey] = useState('food_beverage');
  const [revenueYear, setRevenueYear] = useState(formatNumberTyping('9000000000'));
  const [margin, setMargin] = useState('17');
  const [growth, setGrowth] = useState('10');

  useEffect(() => { getActiveValuationConfig().then(setConfig).catch(() => setConfig(DEFAULT_VALUATION_CONFIG)); }, []);

  const currency = currencyForCountry(country);
  const result = useMemo(() => valuate({
    revenueYear: parseFormattedNumber(revenueYear),
    ebitdaMargin: parseFormattedNumber(margin, true),
    growthPct: parseFormattedNumber(growth, true),
    industryKey,
    countryKey: country,
    currency
  }, config), [revenueYear, margin, growth, industryKey, country, currency, config]);

  const industry = industryOptions.find((x) => x.key === industryKey) || industryOptions[0];
  const countryLabel = countryOptions.find((x) => x.iso2 === country);
  const disclaimer = T(lang, VALUATION_DISCLAIMER_VI, VALUATION_DISCLAIMER_EN);

  return <main className="d68-valuation-page">
    <section className="d68-val-hero"><div><span>{T(lang, 'Miễn phí · Không cần đăng nhập', 'Free · No login required')}</span><h1>{T(lang, 'Định giá sơ bộ doanh nghiệp của bạn', 'Estimate your business valuation')}</h1><p>{T(lang, 'Nhận khoảng định giá tham khảo theo quốc gia, ngành, doanh thu năm gần nhất, biên lợi nhuận EBITDA và tăng trưởng doanh thu. Hệ số do Deals68 cấu hình và có thể cập nhật theo dữ liệu thị trường.', 'Get an indicative benchmark by country, industry, latest annual revenue, EBITDA margin and revenue growth. Multiples are configured by Deals68 and can be updated with market data.')}</p></div></section>

    <section className="d68-val-wrap"><div className="d68-val-cols"><article className="d68-val-card"><h2>{T(lang, 'Thông tin doanh nghiệp', 'Business details')}</h2><p className="d68-val-card-note">{T(lang, 'Chỉ nhập số liệu tổng quan; không cần đưa tên doanh nghiệp, thương hiệu, nợ vay, số tiền chào hoặc tỷ lệ cổ phần.', 'Enter high-level figures only; no company name, brand, debt, offer amount or stake is required.')}</p><div className="d68-val-form">
      <label>{T(lang, 'Quốc gia', 'Country')}<select value={country} onChange={(e) => setCountry(e.target.value)}>{countryOptions.map((c) => <option key={c.iso2} value={c.iso2}>{T(lang, c.vi, c.en)}</option>)}</select></label>
      <label>{T(lang, 'Ngành hàng / lĩnh vực', 'Industry / sector')}<select value={industryKey} onChange={(e) => setIndustryKey(e.target.value)}>{industryOptions.map((i) => <option key={i.key} value={i.key}>{T(lang, i.vi, i.en)}</option>)}</select></label>
      <label>{T(
        lang,
        `Doanh thu năm gần nhất (${currency === 'VND' ? 'VNĐ' : 'USD'})`,
        `Latest annual revenue (${currency})`,
      )}<input inputMode="numeric" value={revenueYear} onChange={(e) => setRevenueYear(formatNumberTyping(e.target.value))}/></label>
      <label>{T(lang, 'Biên lợi nhuận EBITDA (%)', 'EBITDA margin (%)')}<input inputMode="decimal" value={margin} onChange={(e) => setMargin(formatNumberTyping(e.target.value, true))}/></label>
      <label>{T(lang, 'Tăng trưởng doanh thu (%)', 'Revenue growth (%)')}<input inputMode="decimal" value={growth} onChange={(e) => setGrowth(formatNumberTyping(e.target.value, true))}/></label>
    </div></article>

    <aside className="d68-val-result d68-val-result--benchmark">
      <span>{T(lang, 'Định giá tham chiếu', 'Valuation benchmark')}</span>
      {result ? <>
        <h2>{formatValuationMoney(result.low, result.currency, lang)} – {formatValuationMoney(result.high, result.currency, lang)}</h2>
        <div>
          <Row a={T(lang, 'Thấp', 'Low')} b={formatValuationMoney(result.low, result.currency, lang)}/>
          <Row a={T(lang, 'Trung bình', 'Midpoint')} b={formatValuationMoney(result.mid, result.currency, lang)}/>
          <Row a={T(lang, 'Cao', 'High')} b={formatValuationMoney(result.high, result.currency, lang)}/>
          <Row a={T(lang, 'Phương pháp', 'Method')} b={result.method === 'blend' ? T(lang, 'Hệ số Doanh thu + Lợi nhuận', 'Revenue + profit multiples') : T(lang, 'Hệ số Doanh thu', 'Revenue multiple')}/>
          <Row a={T(lang,'Ngành','Industry')} b={T(lang, industry.vi, industry.en)}/>
          <Row a={T(lang,'Quốc gia','Country')} b={countryLabel ? T(lang, countryLabel.vi, countryLabel.en) : country}/>
        </div>
      </> : <><h2>{T(lang, 'Đang cập nhật', 'Pending')}</h2><p>{T(lang, 'Cần có doanh thu năm và ngành để tính benchmark.', 'Annual revenue and industry are required to calculate the benchmark.')}</p></>}
      <Link to={toLocalizedPath('/register/business', lang)}>{T(lang, 'Đăng hồ sơ doanh nghiệp', 'List your business')} →</Link>
    </aside></div></section>

    <section className="d68-val-method"><h2>{T(lang, 'Cách Deals68 tính tham khảo', 'How Deals68 estimates')}</h2><div><article><b>1</b><h3>{T(lang,'Bội số ngành','Industry multiples')}</h3><p>{T(lang,'Dùng bội số EV/EBITDA và EV/Doanh thu theo 23 nhóm ngành chuẩn hóa.', 'Uses EV/EBITDA and EV/Revenue multiples across the standardized 23 industries.')}</p></article><article><b>2</b><h3>{T(lang,'Điều chỉnh hệ số','Factor adjustment')}</h3><p>{T(lang,'Điều chỉnh theo quốc gia, tăng trưởng và quy mô doanh thu quy đổi USD.', 'Adjusted by country, growth and USD-converted revenue size.')}</p></article><article><b>3</b><h3>{T(lang,'Không thay thế thẩm định','Not a formal valuation')}</h3><p>{T(lang,'Kết quả là tham khảo, chưa sử dụng các nghiệp vụ định giá chuyên sâu cho từng doanh nghiệp.', 'The result is indicative and does not yet apply in-depth valuation work tailored to each business.')}</p></article></div><aside className="d68-static-notice"><span>{disclaimer}</span></aside></section>
  </main>;
}
