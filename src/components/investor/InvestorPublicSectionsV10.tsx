import { Link } from 'react-router-dom';
import type { Lang } from '../../lib/i18n';
import {
  labelCountry,
  labelIndustry,
  T,
} from '../../lib/labels';

function ContactRow({
  label,
  value,
  unlocked,
  href,
}: {
  label: string;
  value?: string;
  unlocked: boolean;
  href?: string;
}) {
  const display = unlocked
    ? href
      ? <a href={href.startsWith('http') ? href : `https://${href}`} target="_blank" rel="noreferrer">{value}</a>
      : value
    : '';
  return (
    <div className={`d68-id-contact-row${unlocked ? ' unlocked' : ''}`}>
      <span>{unlocked ? '✅' : '🔒'}</span>
      <b>{label}</b>
      <em>{display}</em>
    </div>
  );
}

function relativeTime(value: unknown, lang: Lang) {
  const date = value ? new Date(String(value)) : new Date();
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  if (!Number.isFinite(days) || days < 1) return T(lang, 'Hôm nay', 'Today');
  if (days < 30) return T(lang, `${days} ngày trước`, `${days} day${days > 1 ? 's' : ''} ago`);
  const months = Math.max(1, Math.floor(days / 30));
  return T(lang, `${months} tháng trước`, `${months} month${months > 1 ? 's' : ''} ago`);
}

export default function InvestorPublicSectionsV10({
  lang,
  description,
  criteria,
  appetite,
  industries,
  markets,
  publicHistory,
  contact,
}: {
  lang: Lang;
  description: string;
  criteria: string[];
  appetite: string;
  industries: string[];
  markets: string[];
  publicHistory: any[];
  contact: any;
}) {
  const connected = Boolean(contact?.connected);
  return (
    <>
      <section className="d68-id-section d68-id-section--card">
        <h2>{T(lang, 'Giới thiệu', 'Introduction')}</h2>
        <p>{description}</p>
      </section>
      <section className="d68-id-section d68-id-section--card">
        <h2>{T(lang, 'Tiêu chí đầu tư', 'Investment criteria')}</h2>
        <ul className="d68-id-bullets">
          {criteria.length
            ? criteria.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)
            : <li>{T(lang, 'Chưa có tiêu chí chi tiết được Admin duyệt public.', 'No detailed administrator-approved criteria yet.')}</li>}
        </ul>
      </section>
      {appetite ? (
        <section className="d68-id-section d68-id-section--card d68-v10-appetite-public">
          <h2>{T(lang, 'Khẩu vị đầu tư', 'Investment appetite')}</h2>
          <p>{appetite}</p>
        </section>
      ) : null}
      <section className="d68-id-section d68-id-section--card">
        <h2>{T(lang, 'Ngành quan tâm', 'Sectors of interest')}</h2>
        <div className="d68-id-tags">
          {industries.length
            ? industries.map((item) => <span key={item}>{labelIndustry(item, lang)}</span>)
            : <span>{T(lang, 'Đang cập nhật', 'Updating')}</span>}
        </div>
      </section>
      <section className="d68-id-section d68-id-section--card">
        <h2>{T(lang, 'Thị trường quan tâm', 'Target investment markets')}</h2>
        <div className="d68-id-tags">
          {markets.length
            ? markets.map((item) => <span key={item}>{labelCountry(item, lang)}</span>)
            : <span>{T(lang, 'Đang cập nhật', 'Updating')}</span>}
        </div>
      </section>
      <section className="d68-id-section d68-id-section--card">
        <h2>{T(lang, 'Lịch sử nhận proposal', 'Proposal history')}</h2>
        {publicHistory.length ? (
          <div className="d68-id-timeline d68-id-timeline--proposal">
            {publicHistory.map((item, index) => (
              <div key={`${index}-${item.label}`}>
                <i />
                <span>
                  <small>{relativeTime(item.sent_at, lang)}</small>
                  {item.slug
                    ? <Link to={`/businesses/${item.slug}`} target="_blank" rel="noreferrer">{item.label}</Link>
                    : <b>{item.label}</b>}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="d68-id-muted">{T(lang, 'Chưa nhận Hồ sơ chào từ doanh nghiệp nào.', 'No business proposal profiles received yet.')}</p>
        )}
      </section>
      <section className="d68-id-section d68-id-section--card">
        <h2>{T(lang, 'Thông tin liên hệ', 'Contact information')}</h2>
        <p className="d68-id-muted">{T(lang, 'Chỉ Doanh nghiệp đã kết nối với Nhà đầu tư mới được xem.', 'Only businesses connected with this investor can view contact details.')}</p>
        <div className="d68-id-contact-list">
          <ContactRow label={T(lang, 'Người liên hệ', 'Contact person')} value={contact?.name} unlocked={connected && Boolean(contact?.name)} />
          <ContactRow label="Email" value={contact?.email} unlocked={connected && Boolean(contact?.email)} />
          <ContactRow label={T(lang, 'Điện thoại', 'Phone')} value={contact?.phone} unlocked={connected && Boolean(contact?.phone)} />
          <ContactRow label="Website" value={contact?.website} unlocked={connected && Boolean(contact?.website)} href={contact?.website} />
        </div>
      </section>
    </>
  );
}
