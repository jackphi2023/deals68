import type { ReactNode } from 'react';
import { Globe2, History, Info, LockKeyhole, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Lang } from '../../lib/i18n';
import {
  revenueRangeLabel,
  returnExpectationLabel,
  riskAppetiteLabel,
} from '../../lib/investorCriteriaOptions';
import {
  labelCountry,
  labelDealType,
  labelIndustry,
  labelInvestorType,
  labelStage,
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

function countryFlag(raw: string) {
  const code = String(raw || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '🌐';
  return String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0)));
}

function SectionTitle({ icon, children }: { icon: ReactNode; children: string }) {
  return (
    <div className="d68-id-section-title">
      <span aria-hidden="true">{icon}</span>
      <h2>{children}</h2>
    </div>
  );
}

function CriteriaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="d68-id-criteria-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export default function InvestorPublicSectionsV10({
  lang,
  description,
  country,
  investorType,
  dealTypes,
  stage,
  ticket,
  appetite,
  riskAppetite,
  returnExpectation,
  revenueRange,
  industries,
  markets,
  publicHistory,
  contact,
}: {
  lang: Lang;
  description: string;
  country: string;
  investorType: string;
  dealTypes: string[];
  stage: string;
  ticket: string;
  appetite: string;
  riskAppetite: string;
  returnExpectation: string;
  revenueRange: string;
  industries: string[];
  markets: string[];
  publicHistory: any[];
  contact: any;
}) {
  const connected = Boolean(contact?.connected);
  const transactionLabel = dealTypes
    .map((item) => labelDealType(item, lang, true))
    .filter(Boolean)
    .join(' · ');
  const stageLabel = stage ? labelStage(stage, lang) : '';
  const ticketLabel = ticket && ticket !== '—' ? ticket : '';
  const riskLabel = riskAppetite ? riskAppetiteLabel(riskAppetite, lang) : '';
  const returnLabel = returnExpectation
    ? returnExpectationLabel(returnExpectation, lang)
    : '';
  const revenueLabel = revenueRange ? revenueRangeLabel(revenueRange, lang) : '';
  const hasCriteria = Boolean(
    transactionLabel ||
    stageLabel ||
    ticketLabel ||
    appetite ||
    riskLabel ||
    returnLabel ||
    revenueLabel ||
    industries.length,
  );

  return (
    <>
      <section className="d68-id-section d68-id-section--card d68-id-introduction" data-testid="investor-introduction">
        <SectionTitle icon={<Info size={22} strokeWidth={2.15} />}>{T(lang, 'Giới thiệu', 'Introduction')}</SectionTitle>
        {description ? <p className="d68-id-introduction__copy">{description}</p> : null}
        <div className="d68-id-introduction__facts">
          <CriteriaRow label={T(lang, 'Quốc gia trụ sở', 'HQ country')} value={labelCountry(country, lang)} />
          <CriteriaRow label={T(lang, 'Loại Nhà đầu tư', 'Investor type')} value={labelInvestorType(investorType, lang)} />
        </div>
      </section>

      <section className="d68-id-section d68-id-section--card" data-testid="investor-criteria">
        <SectionTitle icon={<Target size={22} strokeWidth={2.15} />}>{T(lang, 'Tiêu chí đầu tư', 'Investment criteria')}</SectionTitle>
        {hasCriteria ? (
          <>
            <div className="d68-id-criteria-table">
              {transactionLabel ? <CriteriaRow label={T(lang, 'Ưu tiên giao dịch', 'Preferred transactions')} value={transactionLabel} /> : null}
              {stageLabel ? <CriteriaRow label={T(lang, 'Giai đoạn phù hợp', 'Preferred stage')} value={stageLabel} /> : null}
              {ticketLabel ? <CriteriaRow label={T(lang, 'Khoản đầu tư', 'Investment size')} value={ticketLabel} /> : null}
              {revenueLabel ? <CriteriaRow label={T(lang, 'Quy mô doanh thu', 'Revenue scale')} value={revenueLabel} /> : null}
              {riskLabel ? <CriteriaRow label={T(lang, 'Khẩu vị rủi ro', 'Risk appetite')} value={riskLabel} /> : null}
              {returnLabel ? <CriteriaRow label={T(lang, 'Kỳ vọng lợi nhuận', 'Return expectation')} value={returnLabel} /> : null}
              {appetite ? <CriteriaRow label={T(lang, 'Khẩu vị đầu tư', 'Investment appetite')} value={appetite} /> : null}
            </div>
            {industries.length ? (
              <div className="d68-id-sector-block">
                <h3>{T(lang, 'Ngành quan tâm', 'Sectors of interest')}</h3>
                <div className="d68-id-tags d68-id-sector-tags">
                  {industries.map((item) => <span key={item}>{labelIndustry(item, lang)}</span>)}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="d68-id-muted">{T(lang, 'Chưa có tiêu chí đầu tư được duyệt public.', 'No public investment criteria are available yet.')}</p>
        )}
      </section>

      <section className="d68-id-section d68-id-section--card" data-testid="investor-markets">
        <SectionTitle icon={<Globe2 size={22} strokeWidth={2.15} />}>{T(lang, 'Thị trường quan tâm', 'Target investment markets')}</SectionTitle>
        {markets.length ? (
          <div className="d68-id-tags d68-id-market-tags">
            {markets.map((item) => (
              <span key={item}><i aria-hidden="true">{countryFlag(item)}</i>{labelCountry(item, lang)}</span>
            ))}
          </div>
        ) : (
          <p className="d68-id-muted">{T(lang, 'Chưa công bố thị trường đầu tư.', 'No target investment markets are public yet.')}</p>
        )}
      </section>

      <section className="d68-id-section d68-id-section--card" data-testid="investor-proposal-history">
        <SectionTitle icon={<History size={22} strokeWidth={2.15} />}>{T(lang, 'Lịch sử nhận Proposal', 'Proposal history')}</SectionTitle>
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

      <section className="d68-id-section d68-id-section--card" data-testid="investor-contact">
        <SectionTitle icon={<LockKeyhole size={22} strokeWidth={2.15} />}>{T(lang, 'Thông tin liên hệ', 'Contact information')}</SectionTitle>
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
