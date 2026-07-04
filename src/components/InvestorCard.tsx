import { Link } from 'react-router-dom';
import { formatCompactMoney } from '../lib/format';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

function iconForType(type?: string) {
  const t = String(type || '').toLowerCase();
  if (t.includes('strategic') || t.includes('corporate')) return '🌐';
  if (t.includes('family')) return '🏛️';
  if (t.includes('angel') || t.includes('individual')) return '👤';
  if (t.includes('lender') || t.includes('debt')) return '💳';
  if (t.includes('pe')) return '🏦';
  if (t.includes('vc')) return '🚀';
  return '📈';
}

function compactList(value: any, fallback = '-') {
  if (Array.isArray(value)) return value.filter(Boolean).slice(0, 3).join(' · ') || fallback;
  return String(value || fallback);
}

export default function InvestorCard({ inv, lang='vi' }: { inv: any; lang?: Lang }) {
  const title = lang === 'en' ? (inv.title_en || inv.title_vi || inv.type) : (inv.title_vi || inv.title_en || inv.type);
  const focus = compactList(inv.industries, '-');
  const dealTypes = compactList(inv.deal_types, '-');
  const ticket = `${formatCompactMoney(inv.ticket_min, 'USD')}–${formatCompactMoney(inv.ticket_max, 'USD')}`;
  const country = inv.country || inv.country_iso2 || T(lang, 'Toàn cầu', 'Global');
  const activity = inv.activity_level || (inv.verified ? T(lang, 'Đã xác minh', 'Verified') : T(lang, 'Đang hoạt động', 'Active'));

  return <article className="investor-card investor-card--beta">
    <div className="investor-top">
      <div className="investor-icon">{iconForType(inv.type)}</div>
      <div className="investor-badges">
        {inv.verified && <span className="pill green">✓ {T(lang, 'Xác minh', 'Verified')}</span>}
        {inv.admin_priority && <span className="pill gold">★ {T(lang, 'Ưu tiên', 'Priority')}</span>}
      </div>
    </div>
    <span className="investor-code">{inv.code || T(lang, 'Hồ sơ ẩn danh', 'Anonymous profile')}</span>
    <h3>{title}</h3>
    <p className="investor-desc">{lang === 'en' ? inv.desc_en : inv.desc_vi}</p>
    <div className="info-row"><span>{T(lang, 'Loại', 'Type')}</span><span>{inv.type || '-'}</span></div>
    <div className="info-row"><span>Ticket</span><span>{ticket}</span></div>
    <div className="info-row"><span>{T(lang, 'Ngành', 'Focus')}</span><span>{focus}</span></div>
    <div className="info-row"><span>{T(lang, 'Hình thức', 'Deal type')}</span><span>{dealTypes}</span></div>
    <div className="info-row"><span>{T(lang, 'Khu vực', 'Geography')}</span><span>{country}</span></div>
    <div className="investor-privacy-note">🔒 {T(lang, 'Tên, email, website và liên hệ thật được ẩn cho đến khi kết nối được duyệt.', 'Real name, email, website and contact details stay hidden until an approved connection.')}</div>
    <div className="investor-card-footer">
      <span>{activity}</span>
      <Link className="btn secondary small" to={`/investors/${inv.code}`}>{T(lang, 'Xem hồ sơ', 'View profile')}</Link>
    </div>
  </article>;
}
