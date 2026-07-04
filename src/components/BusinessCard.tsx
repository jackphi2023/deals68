import { Link } from 'react-router-dom';
import { formatCompactMoney, percent } from '../lib/format';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

function dealLabel(lang: Lang, value?: string | null) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('debt') || raw.includes('vay')) return T(lang, 'Vay vốn', 'Debt');
  if (raw.includes('sell') || raw.includes('sale') || raw.includes('bán') || raw.includes('sang')) return T(lang, 'Bán / sang nhượng', 'Sale / Transfer');
  if (raw.includes('fund') || raw.includes('raise') || raw.includes('gọi')) return T(lang, 'Gọi vốn', 'Fundraising');
  return T(lang, 'Cơ hội đầu tư', 'Investment deal');
}

function qualityBand(score?: number | string | null) {
  const n = Number(score || 0);
  if (n >= 85) return { cls: 'green', label: 'A' };
  if (n >= 70) return { cls: 'gold', label: 'B+' };
  if (n >= 55) return { cls: 'gray', label: 'B' };
  return { cls: 'red', label: 'Review' };
}

export default function BusinessCard({ b, lang='vi', index = 0 }: { b: any; lang?: Lang; index?: number }) {
  const title = lang === 'en' ? (b.title_en || b.title_vi) : (b.title_vi || b.title_en);
  const industry = String(b.industry || '').split(';')[0] || T(lang, 'Doanh nghiệp', 'Business');
  const city = b.city || b.country_iso2 || 'VN';
  const ask = b.stake_pct ? `${formatCompactMoney(b.ask_amount, b.ask_currency)} · ${percent(b.stake_pct)}` : formatCompactMoney(b.ask_amount, b.ask_currency);
  const score = Number(b.quality_score || 0);
  const band = qualityBand(score);
  const imageUrl = b.image_url || `/assets/deal${(index % 6) + 1}.png`;

  return <Link className="deal-card deal-card--beta" to={`/businesses/${b.slug}`}>
    <div className="deal-img-wrap">
      <img src={imageUrl} alt={title}/>
      <span className="featured-pill">{b.plan === 'featured' ? '★ Featured' : (b.public_code || 'D68')}</span>
      <span className={`quality-chip ${band.cls}`}>QS {score || '-'} · {band.label}</span>
    </div>
    <div className="card-body">
      <div className="pills">
        <span className="pill">{industry}</span>
        <span className="pill gray">{city}</span>
        <span className="pill gold">{dealLabel(lang, b.deal_type)}</span>
      </div>
      <h3>{title}</h3>
      <p className="deal-desc">{lang === 'en' ? (b.description_en || b.highlights_en) : (b.description_vi || b.highlights_vi)}</p>
      <div className="kpis deal-kpis">
        <div className="kpi"><span>{T(lang, 'Doanh thu 2025E', '2025E Revenue')}</span><b>{formatCompactMoney(b.revenue_2025, b.revenue_currency)}</b></div>
        <div className="kpi"><span>EBITDA</span><b>{percent(b.ebitda_margin)}</b></div>
        <div className="kpi accent"><span>{T(lang, 'Nhu cầu / tỷ lệ', 'Ask / stake')}</span><b>{ask}</b></div>
      </div>
      <div className="deal-card-footer">
        <span>{T(lang, 'Hồ sơ ẩn danh · Mở chi tiết sau kết nối', 'Anonymous teaser · Details unlock after connection')}</span>
        <b>{T(lang, 'Xem chi tiết', 'View details')} →</b>
      </div>
    </div>
  </Link>
}
