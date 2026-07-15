import type { Lang } from '../../lib/i18n';
import type { InvestorRow } from '../../lib/investorAdminV10';
import {
  DEFAULT_INVESTOR_COVER,
  investorCoverUrl,
  type InvestorCoverBanner,
} from '../../lib/investorProfileService';
import { labelCountry, labelInvestorType, T } from '../../lib/labels';

export default function InvestorPublicHeroV10({
  investor,
  defaultCover,
  lang,
  title,
}: {
  investor: InvestorRow;
  defaultCover: InvestorCoverBanner | null;
  lang: Lang;
  title: string;
}) {
  return (
    <section className="d68-id-cover" data-testid="investor-public-hero">
      <img
        src={investorCoverUrl(investor, defaultCover)}
        alt={title}
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = DEFAULT_INVESTOR_COVER;
        }}
      />
      <div className="d68-id-cover__shade" />
      <div className="d68-id-cover__content">
        <div className="d68-id-cover__eyebrow">
          {investor.code} · {T(lang, 'Hồ sơ Nhà đầu tư', 'Investor profile')}
        </div>
        <h1>{title}</h1>
        <div className="d68-id-cover__badges">
          <span>{labelInvestorType(investor.type, lang)}</span>
          <span>📍 {labelCountry(investor.country_iso2 || investor.country, lang)}</span>
          <span className="active">● {T(lang, 'Đang hoạt động', 'Active')}</span>
        </div>
      </div>
    </section>
  );
}
