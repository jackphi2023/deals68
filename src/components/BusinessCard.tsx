import { Link } from 'react-router-dom';
import { formatCompactMoney, percent } from '../lib/format';
import type { Lang } from '../lib/i18n';

export default function BusinessCard({ b, lang='vi' }: { b: any; lang?: Lang }) {
  const title = lang === 'en' ? b.title_en : b.title_vi;
  return <div className="card">
    <img className="deal-img" src={b.image_url || '/assets/deal1.svg'} alt={title}/>
    <div className="card-body">
      <span className="pill gold">{b.plan === 'featured' ? 'Featured' : 'Standard'}</span>
      <span className="pill green">Quality {b.quality_score || 0}/100</span>
      <h3>{title}</h3>
      <p className="muted">{b.industry} · {b.city || b.country_iso2}</p>
      <div className="kpis">
        <div className="kpi"><span>2025 Revenue</span><b>{formatCompactMoney(b.revenue_2025, b.revenue_currency)}</b></div>
        <div className="kpi"><span>EBITDA</span><b>{percent(b.ebitda_margin)}</b></div>
        <div className="kpi"><span>Ask</span><b>{formatCompactMoney(b.ask_amount, b.ask_currency)}</b></div>
      </div>
      <Link className="btn secondary" to={`/businesses/${b.slug}`}>{lang === 'en' ? 'View profile' : 'Xem hồ sơ'}</Link>
    </div>
  </div>
}
