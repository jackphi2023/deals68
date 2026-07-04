import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../lib/format';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

const industryBenchmarks = {
  fb: { label: 'F&B / Retail', rev: 1.2, ebitda: 4.0, confidence: 62 },
  healthcare: { label: 'Healthcare / Clinic', rev: 2.5, ebitda: 6.0, confidence: 70 },
  tech: { label: 'Technology / SaaS', rev: 3.0, ebitda: 7.0, confidence: 68 },
  logistics: { label: 'Logistics / Manufacturing', rev: 1.5, ebitda: 5.0, confidence: 64 },
  education: { label: 'Education', rev: 1.6, ebitda: 5.2, confidence: 60 }
};

type Result = { revenue: number; ebitda: number; low: number; mid: number; high: number; confidence: number; currency: string; method: string };

export default function Valuation({ lang }: { lang: Lang }) {
  const [res, setRes] = useState<Result | null>(null);
  const [currency, setCurrency] = useState('VND');
  const [industry, setIndustry] = useState<keyof typeof industryBenchmarks>('fb');
  const selected = useMemo(() => industryBenchmarks[industry], [industry]);

  function calc(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const revenue = Number(fd.get('revenue') || 0);
    const ebitdaPct = Number(fd.get('ebitda') || 0);
    const growth = Number(fd.get('growth') || 0);
    const dataConfidence = Number(fd.get('confidence') || 65);
    const ebitda = revenue * ebitdaPct / 100;
    const valRev = revenue * selected.rev;
    const valEbitda = ebitdaPct > 0 ? ebitda * selected.ebitda : 0;
    const blended = ebitda > 0 ? valEbitda * 0.62 + valRev * 0.38 : valRev;
    const growthPremium = 1 + Math.min(0.35, Math.max(-0.2, growth / 100 * 0.55));
    const confidenceAdj = 0.9 + Math.min(0.16, dataConfidence / 100 * 0.16);
    const mid = Math.max(0, blended * growthPremium * confidenceAdj);
    const spread = dataConfidence >= 80 ? 0.12 : dataConfidence >= 60 ? 0.18 : 0.25;
    setRes({ revenue, ebitda, low: mid * (1 - spread), mid, high: mid * (1 + spread), confidence: Math.round((selected.confidence + dataConfidence) / 2), currency, method: ebitda > 0 ? 'Revenue + EBITDA blended' : 'Revenue multiple' });
  }

  return <>
    <section className="list-hero valuation-hero">
      <div className="container list-hero-inner">
        <div>
          <span className="badge-title blue">◆ {T(lang, 'Công cụ định giá Beta', 'Beta Valuation Tool')}</span>
          <h1>{T(lang, 'Ước tính nhanh khoảng định giá doanh nghiệp', 'Estimate a preliminary business valuation range')}</h1>
          <p>{T(lang, 'Công cụ dùng revenue multiple, EBITDA multiple, tăng trưởng và độ tin cậy dữ liệu để tạo khoảng định giá tham khảo trước khi lập hồ sơ Deals68.', 'The tool uses revenue multiple, EBITDA multiple, growth and data confidence to create an indicative range before preparing a Deals68 profile.')}</p>
        </div>
        <div className="list-hero-card">
          <b>{res ? formatMoney(res.mid, res.currency) : 'AI'}</b>
          <span>{T(lang, 'ước tính trung vị', 'mid estimate')}</span>
          <Link className="btn gold block" to="/register/business">{T(lang, 'Đăng hồ sơ DN', 'List business')}</Link>
        </div>
      </div>
    </section>

    <section className="section alt">
      <div className="container detail-grid">
        <main className="card valuation-card">
          <div className="card-body">
            <h2>{T(lang, 'Nhập số liệu chính', 'Enter key metrics')}</h2>
            <form onSubmit={calc} className="formgrid valuation-form">
              <label>{T(lang, 'Tiền tệ', 'Currency')}<select className="select" value={currency} onChange={e=>setCurrency(e.target.value)}><option value="VND">VND</option><option value="USD">USD</option></select></label>
              <label>{T(lang, 'Ngành benchmark', 'Industry benchmark')}<select className="select" value={industry} onChange={e=>setIndustry(e.target.value as keyof typeof industryBenchmarks)}>{Object.entries(industryBenchmarks).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></label>
              <label>{T(lang, 'Doanh thu năm gần nhất / 2025E', 'Latest / 2025E revenue')}<input className="input" name="revenue" type="number" min="0" required placeholder="15000000000" /></label>
              <label>EBITDA margin %<input className="input" name="ebitda" type="number" min="-100" max="100" step="0.1" required placeholder="12" /></label>
              <label>{T(lang, 'Tăng trưởng doanh thu %', 'Revenue growth %')}<input className="input" name="growth" type="number" step="0.1" defaultValue={10} /></label>
              <label>{T(lang, 'Độ tin cậy dữ liệu %', 'Data confidence %')}<input className="input" name="confidence" type="number" min="30" max="100" defaultValue={70} /></label>
              <div style={{gridColumn:'1/-1'}}><button className="btn blue" type="submit">{T(lang, 'Tính định giá', 'Calculate valuation')}</button></div>
            </form>
          </div>
        </main>

        <aside className="card valuation-result-card">
          <div className="card-body">
            <h2>{T(lang, 'Kết quả', 'Result')}</h2>
            {res ? <>
              <div className="valuation-range">
                <div><span>Low</span><b>{formatMoney(res.low, res.currency)}</b></div>
                <div className="base"><span>Base</span><b>{formatMoney(res.mid, res.currency)}</b></div>
                <div><span>High</span><b>{formatMoney(res.high, res.currency)}</b></div>
              </div>
              <div className="confidence-meter"><span style={{width:`${res.confidence}%`}} /></div>
              <p className="muted">{T(lang,'Độ tin cậy ước tính','Estimated confidence')}: <b>{res.confidence}/100</b> · {res.method}</p>
              <div className="summary-row"><span>Revenue</span><b>{formatMoney(res.revenue, res.currency)}</b></div>
              <div className="summary-row"><span>EBITDA</span><b>{formatMoney(res.ebitda, res.currency)}</b></div>
              <Link className="btn gold block" to="/register/business">{T(lang, 'Dùng kết quả để tạo hồ sơ DN', 'Use result to create a business profile')}</Link>
            </> : <p className="muted">{T(lang, 'Nhập số liệu để xem khoảng định giá sơ bộ.', 'Enter financials to see an indicative valuation range.')}</p>}
            <p className="notice warn small-note">{T(lang, 'Đây chỉ là ước tính tham khảo, không phải báo cáo thẩm định giá, fairness opinion, tư vấn đầu tư hoặc cam kết giao dịch.', 'This is indicative only, not a valuation report, fairness opinion, investment advice or transaction commitment.')}</p>
          </div>
        </aside>
      </div>
    </section>
  </>;
}
