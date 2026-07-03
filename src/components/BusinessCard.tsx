import { Link } from 'react-router-dom';
import { formatCompactMoney } from '../lib/format';
import type { Lang } from '../lib/i18n';

export default function BusinessCard({ b, lang='vi' }: { b: any; lang?: Lang }) {
  const title = lang === 'en' ? (b.title_en || b.title_vi) : (b.title_vi || b.title_en);
  const industry = String(b.industry || '').split(';')[0] || (lang === 'en' ? 'Business' : 'Doanh nghiệp');
  const dealType = String(b.deal_type || '').split(';')[0] || 'Deal';
  const ask = b.stake_pct ? `${formatCompactMoney(b.ask_amount, b.ask_currency)} · ${b.stake_pct}%` : formatCompactMoney(b.ask_amount, b.ask_currency);
  return <Link className="deal-card" to={`/businesses/${b.slug}`}>
    <div className="deal-img-wrap"><img src={b.image_url || '/assets/deal1.png'} alt={title}/>{b.plan === 'featured' && <span className="featured-pill">★ Featured</span>}</div>
    <div className="card-body">
      <div className="pills"><span className="pill">{industry}</span><span className="pill gray">{dealType}</span>{b.quality_score && <span className="pill green">Quality {b.quality_score}/100</span>}</div>
      <h3>{title}</h3>
      <div className="kpis">
        <div className="kpi"><span>{lang === 'en' ? 'Revenue 2025E' : 'Doanh thu 2025E'}</span><b>{formatCompactMoney(b.revenue_2025, b.revenue_currency)}</b></div>
        <div className="kpi accent"><span>{lang === 'en' ? 'Amount / Stake' : 'Giá trị / Cổ phần'}</span><b>{ask}</b></div>
      </div>
      <span className="btn block" style={{marginTop:18}}>{lang === 'en' ? 'View details' : 'Xem chi tiết'}</span>
    </div>
  </Link>
}
