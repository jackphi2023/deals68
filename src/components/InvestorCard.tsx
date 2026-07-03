import { Link } from 'react-router-dom';
import { formatCompactMoney } from '../lib/format';
import type { Lang } from '../lib/i18n';
export default function InvestorCard({ inv, lang='en' }: { inv: any; lang?: Lang }) {
  return <div className="card"><div className="card-body">
    <span className="pill">{inv.type}</span>{inv.verified && <span className="pill green">Verified</span>}
    <h3>{lang === 'en' ? inv.title_en : inv.title_vi}</h3>
    <p className="muted">{inv.country || inv.country_iso2} · {(inv.industries || []).slice(0,3).join(', ')}</p>
    <div className="kpis"><div className="kpi"><span>Ticket</span><b>{formatCompactMoney(inv.ticket_min,'USD')}–{formatCompactMoney(inv.ticket_max,'USD')}</b></div><div className="kpi"><span>Stage</span><b>{inv.stage || '-'}</b></div><div className="kpi"><span>Activity</span><b>{inv.activity_level || '-'}</b></div></div>
    <Link className="btn secondary" to={`/investors/${inv.code}`}>{lang === 'en' ? 'View investor' : 'Xem NĐT'}</Link>
  </div></div>
}
