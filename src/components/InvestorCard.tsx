import { Link } from 'react-router-dom';
import { formatCompactMoney } from '../lib/format';
import type { Lang } from '../lib/i18n';
export default function InvestorCard({ inv, lang='en' }: { inv: any; lang?: Lang }) {
  const title = lang === 'en' ? (inv.title_en || inv.title_vi || inv.type) : (inv.title_vi || inv.title_en || inv.type);
  const focus = (inv.industries || []).slice(0,3).join(' · ') || '-';
  return <div className="investor-card">
    <div className="investor-top"><div className="investor-icon">{inv.type === 'Strategic' ? '🌐' : inv.type === 'Family Office' ? '🏛️' : inv.type === 'Angel' ? '👤' : '🏦'}</div>{inv.verified && <span className="pill green">✓ {lang === 'en' ? 'Verified' : 'Xác minh'}</span>}</div>
    <h3>{title}</h3>
    <div className="info-row"><span>Ticket</span><span>{formatCompactMoney(inv.ticket_min,'USD')}–{formatCompactMoney(inv.ticket_max,'USD')}</span></div>
    <div className="info-row"><span>{lang === 'en' ? 'Focus' : 'Ngành'}</span><span>{focus}</span></div>
    <div className="info-row"><span>{lang === 'en' ? 'Geography' : 'Khu vực'}</span><span>{inv.country || inv.country_iso2}</span></div>
    <Link className="btn secondary" style={{marginTop:18}} to={`/investors/${inv.code}`}>{lang === 'en' ? 'View profile' : 'Xem hồ sơ'}</Link>
  </div>
}
