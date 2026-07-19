import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getInvestorByCode,
  getMyBusiness,
  investorTargetCountries,
} from '../../lib/data';
import { listCanonicalInvestors } from '../../lib/investorListing';
import {
  investorPublicDealTypeLabels,
  investorPublicDescription,
  investorPublicIndustryLabels,
  investorPublicStageLabels,
  investorPublicTitle,
  investorPublicTypeLabels,
  investorTicketLabel,
} from '../../lib/investorDisplay';
import { approvedInvestorSectors } from '../../lib/investorCriteria';
import { labelCountry, labelIndustry, T } from '../../lib/labels';
import { toLocalizedPath } from '../../lib/i18nRoutes';
import { sendBusinessProposalToInvestor } from '../../lib/proposals';
import type { Lang } from '../../lib/i18n';

type Props = {
  code: string;
  lang: Lang;
};

type RelatedCardProps = {
  investor: any;
  lang: Lang;
  busy: boolean;
  sent: boolean;
  onProposal: () => void;
};

function RelatedInvestorCard({
  investor,
  lang,
  busy,
  sent,
  onProposal,
}: RelatedCardProps) {
  const types = investorPublicTypeLabels(investor, lang);
  const industries = investorPublicIndustryLabels(investor, lang);
  const dealTypes = investorPublicDealTypeLabels(investor, lang);
  const stages = investorPublicStageLabels(investor, lang);
  const targets = investorTargetCountries(investor);
  const ticket = investorTicketLabel(lang, investor);
  const primaryType = types[0] || T(lang, 'Nhà đầu tư', 'Investor');
  const detailPath = toLocalizedPath(`/investors/${investor.code}`, lang);

  return (
    <article className="d68-related-investor-card d68-investor-card">
      <div className="d68-investor-card__icon">
        {primaryType.slice(0, 2).toUpperCase()}
      </div>
      <div className="d68-investor-card__body">
        <div className="d68-investor-card__badges">
          <span>{types.slice(0, 2).join(' / ') || primaryType}</span>
          {targets.length ? (
            <span>
              🎯{' '}
              {targets
                .slice(0, 2)
                .map((country) => labelCountry(country, lang))
                .join(', ')}
            </span>
          ) : null}
          {investor.verified ? (
            <span className="verified">
              ✓ {T(lang, 'Xác minh', 'Verified')}
            </span>
          ) : null}
        </div>

        <h3>
          <Link
            className="d68-investor-card__title-link d68-entity-title-link"
            to={detailPath}
          >
            {investorPublicTitle(investor, lang)}
          </Link>
        </h3>
        <p>
          {investorPublicDescription(investor, lang) ||
            T(
              lang,
              'Thông tin giới thiệu đang được cập nhật.',
              'The introduction is being updated.',
            )}
        </p>

        <div className="d68-investor-card__meta">
          {ticket ? (
            <span>
              <b>{T(lang, 'Quy mô đầu tư', 'Investment size')}:</b> {ticket}
            </span>
          ) : null}
          {industries.length ? (
            <span className="d68-investor-card__industries">
              <b>{T(lang, 'Ngành', 'Industries')}:</b>{' '}
              {industries.join(', ')}
            </span>
          ) : null}
          {dealTypes.length ? (
            <span>
              <b>{T(lang, 'Loại giao dịch', 'Deal types')}:</b>{' '}
              {dealTypes.join(', ')}
            </span>
          ) : null}
          {stages.length ? (
            <span>
              <b>{T(lang, 'Giai đoạn', 'Stages')}:</b> {stages.join(', ')}
            </span>
          ) : null}
        </div>
      </div>

      <div className="d68-investor-card__actions">
        <Link to={detailPath}>{T(lang, 'Xem chi tiết', 'View detail')}</Link>
        <button type="button" onClick={onProposal} disabled={busy || sent}>
          {busy
            ? T(lang, 'Đang gửi...', 'Sending...')
            : sent
              ? T(lang, 'Đã gửi', 'Sent')
              : T(lang, 'Gửi hồ sơ DN', 'Send business proposal')}
        </button>
      </div>
    </article>
  );
}

function RelatedSkeleton() {
  return (
    <article className="d68-related-investor-card d68-related-investor-card--loading">
      <div />
      <section />
    </article>
  );
}

export default function RelatedInvestorsSection({ code, lang }: Props) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sendingId, setSendingId] = useState('');
  const [sentIds, setSentIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let live = true;

    async function loadRelated() {
      setCategory('');
      setItems([]);
      setMessage('');
      setLoading(true);

      try {
        const current = await getInvestorByCode(code);
        if (!live || !current?.id) return;

        const primaryCategory = approvedInvestorSectors(current)[0] || '';
        if (!primaryCategory) return;
        setCategory(primaryCategory);

        const result = await listCanonicalInvestors({
          industry: primaryCategory,
          limit: 16,
          offset: 0,
          sort: 'ranking',
        });
        if (!live) return;

        setItems(
          result.rows
            .filter((row: any) => String(row.id) !== String(current.id))
            .slice(0, 4),
        );
      } catch {
        if (live) {
          setItems([]);
          setMessage(
            T(
              lang,
              'Chưa tải được danh sách nhà đầu tư cùng danh mục.',
              'Could not load related investors.',
            ),
          );
        }
      } finally {
        if (live) setLoading(false);
      }
    }

    loadRelated();
    return () => {
      live = false;
    };
  }, [code, lang]);

  const allPath = useMemo(() => {
    if (!category) return toLocalizedPath('/investors', lang);
    return toLocalizedPath(
      `/investors?industry=${encodeURIComponent(category)}`,
      lang,
    );
  }, [category, lang]);

  async function sendProposal(investor: any) {
    const detailPath = toLocalizedPath(`/investors/${investor.code}`, lang);

    if (!profile) {
      navigate(
        toLocalizedPath(
          `/register/business?next=${encodeURIComponent(detailPath)}`,
          lang,
        ),
      );
      return;
    }

    if (profile.role !== 'business') {
      setMessage(
        T(
          lang,
          'Chỉ tài khoản Doanh nghiệp được gửi hồ sơ DN.',
          'Only Business accounts can send a business profile.',
        ),
      );
      return;
    }

    setSendingId(String(investor.id));
    setMessage('');

    try {
      const business = await getMyBusiness(profile.id);
      if (!business?.id) {
        navigate(toLocalizedPath('/dashboard/business', lang));
        return;
      }

      const result = await sendBusinessProposalToInvestor({
        business,
        investorId: investor.id,
        message: 'Submitted from related investors section.',
      });

      if (!result.ok) {
        setMessage(
          result.message ||
            (result.reason === 'quota_exceeded'
              ? T(
                  lang,
                  'Bạn đã hết hạn mức gửi hồ sơ DN. Vui lòng nâng gói hoặc gia hạn.',
                  'You have no proposal quota left. Please upgrade or renew your plan.',
                )
              : T(
                  lang,
                  'Không gửi được hồ sơ DN. Vui lòng thử lại.',
                  'Could not send business profile. Please try again.',
                )),
        );
        return;
      }

      setSentIds((current) => ({
        ...current,
        [String(investor.id)]: true,
      }));
      setMessage(
        result.reason === 'duplicate'
          ? T(
              lang,
              'Hồ sơ DN đã được gửi tới nhà đầu tư này trước đó.',
              'The business profile was already sent to this investor.',
            )
          : T(
              lang,
              'Đã gửi hồ sơ DN thành công.',
              'Business profile sent successfully.',
            ),
      );
    } catch (error: any) {
      setMessage(
        error?.message ||
          T(
            lang,
            'Không gửi được hồ sơ DN. Vui lòng thử lại.',
            'Could not send business profile. Please try again.',
          ),
      );
    } finally {
      setSendingId('');
    }
  }

  if (!loading && !category) return null;

  return (
    <section className="d68-related-investors" aria-labelledby="related-investors-title">
      <div className="d68-related-investors__inner">
        <header className="d68-related-investors__head">
          <div>
            <h2 id="related-investors-title">
              {T(lang, 'Nhà đầu tư cùng danh mục', 'Investors in the same category')}
            </h2>
            {category ? (
              <p>{labelIndustry(category, lang)}</p>
            ) : null}
          </div>
          <Link to={allPath}>
            {T(lang, 'Xem tất cả', 'View all')} →
          </Link>
        </header>

        {message ? <div className="d68-related-investors__message">{message}</div> : null}

        <div className="d68-related-investors__grid">
          {loading
            ? Array.from({ length: 4 }, (_, index) => (
                <RelatedSkeleton key={index} />
              ))
            : items.map((investor) => (
                <RelatedInvestorCard
                  key={investor.id}
                  investor={investor}
                  lang={lang}
                  busy={sendingId === String(investor.id)}
                  sent={!!sentIds[String(investor.id)]}
                  onProposal={() => sendProposal(investor)}
                />
              ))}
        </div>

        {!loading && !items.length ? (
          <p className="d68-related-investors__empty">
            {T(
              lang,
              'Chưa có nhà đầu tư khác trong danh mục này.',
              'There are no other investors in this category yet.',
            )}
          </p>
        ) : null}
      </div>
    </section>
  );
}
