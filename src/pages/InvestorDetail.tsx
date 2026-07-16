import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getInvestorByCode,
  getMyBusiness,
  investorTargetCountries,
} from '../lib/data';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toLocalizedPath } from '../lib/i18nRoutes';
import { sendBusinessProposalToInvestor } from '../lib/proposals';
import { labelCountry, labelRegion, T } from '../lib/labels';
import {
  investorPublicDealTypeLabels,
  investorPublicDescription,
  investorPublicIndustryLabels,
  investorPublicStageLabels,
  investorPublicTitle,
  investorPublicTypeLabels,
  investorTicketLabel,
} from '../lib/investorDisplay';
import { approvedInvestorAppetite } from '../lib/investorCriteria';
import type { Lang } from '../lib/i18n';
import { applySeo, DEFAULT_SOCIAL_IMAGE } from '../lib/seo';
import {
  getActiveInvestorDefaultCover,
  INVESTOR_COVER_FALLBACK,
  resolveInvestorCover,
  type SiteBanner,
} from '../lib/banners';

type ContactAccess = {
  connected?: boolean;
  name?: string;
  email?: string;
  phone?: string;
  website?: string;
} | null;

type SectionIconKind =
  | 'intro'
  | 'criteria'
  | 'markets'
  | 'history'
  | 'contact';

function arr(value: any): string[] {
  if (Array.isArray(value)) {
    return value
      .filter(Boolean)
      .map(String)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (!value) return [];
  return String(value)
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function objectOf(value: any): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function proposalHistory(investor: any): string[] {
  const raw =
    investor?.criteria?.proposal_history ||
    investor?.criteria?.proposalHistory ||
    [];
  return arr(raw);
}

function relativeTime(value: any, lang: Lang) {
  const date = value ? new Date(value) : new Date();
  const diffDays = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 86_400_000),
  );
  if (!Number.isFinite(diffDays)) return '';
  if (diffDays < 1) return T(lang, 'Hôm nay', 'Today');
  if (diffDays < 30) {
    return T(
      lang,
      `${diffDays} ngày trước`,
      `${diffDays} day${diffDays > 1 ? 's' : ''} ago`,
    );
  }
  const months = Math.max(1, Math.floor(diffDays / 30));
  return T(
    lang,
    `${months} tháng trước`,
    `${months} month${months > 1 ? 's' : ''} ago`,
  );
}

function SectionIcon({ kind }: { kind: SectionIconKind }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (kind === 'intro') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle {...common} cx="12" cy="8" r="3" />
        <path {...common} d="M5.5 20c.8-4.2 3-6.2 6.5-6.2s5.7 2 6.5 6.2" />
      </svg>
    );
  }
  if (kind === 'criteria') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
      </svg>
    );
  }
  if (kind === 'markets') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle {...common} cx="12" cy="12" r="9" />
        <path {...common} d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
      </svg>
    );
  }
  if (kind === 'history') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5M4 4v4.5h4.5M12 7v5l3 2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path {...common} d="M4 5h16v14H4zM4 7l8 6 8-6" />
    </svg>
  );
}

function SectionTitle({
  icon,
  children,
}: {
  icon: SectionIconKind;
  children: React.ReactNode;
}) {
  return (
    <h2 className="d68-id-section-title">
      <span><SectionIcon kind={icon} /></span>
      {children}
    </h2>
  );
}

function TagList({ values, empty }: { values: string[]; empty: string }) {
  return (
    <div className="d68-id-tags">
      {values.length ? (
        values.map((value) => <span key={value}>{value}</span>)
      ) : (
        <span className="d68-id-tag--empty">{empty}</span>
      )}
    </div>
  );
}

export default function InvestorDetail({ lang }: { lang: Lang }) {
  const { code = '' } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [inv, setInv] = useState<any>(null);
  const [contact, setContact] = useState<ContactAccess>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [proposalBusy, setProposalBusy] = useState(false);
  const [sentProposal, setSentProposal] = useState<any>(null);
  const [publicHistory, setPublicHistory] = useState<any[]>([]);
  const [defaultCoverBanner, setDefaultCoverBanner] =
    useState<SiteBanner | null>(null);

  useEffect(() => {
    let live = true;

    async function load() {
      setLoading(true);
      setError('');
      setInv(null);
      setContact(null);
      setMsg('');
      setPublicHistory([]);

      try {
        const data = await getInvestorByCode(code);
        if (!live) return;

        if (!data) {
          setError(
            T(
              lang,
              'Không tìm thấy hồ sơ nhà đầu tư hoặc hồ sơ chưa public.',
              'Investor profile not found or not public.',
            ),
          );
          return;
        }

        setInv(data);
        setPublicHistory(
          proposalHistory(data).map((item) => ({
            label: item,
            slug: '',
            sent_at: null,
          })),
        );

        const { data: history } = await supabase
          .rpc('get_public_investor_proposal_history', {
            investor_uuid: data.id,
          })
          .catch(() => ({ data: null } as any));

        if (live && history?.length) {
          setPublicHistory(
            history.slice(0, 10).map((row: any) => ({
              sent_at: row.sent_at,
              slug: row.business_slug,
              label:
                row.business_title ||
                row.business_public_code ||
                T(
                  lang,
                  'Hồ sơ doanh nghiệp ẩn danh',
                  'Anonymous business profile',
                ),
            })),
          );
        }
      } catch (loadError: any) {
        if (live) {
          setError(
            loadError?.message ||
              T(
                lang,
                'Không tải được hồ sơ nhà đầu tư.',
                'Could not load investor profile.',
              ),
          );
        }
      } finally {
        if (live) setLoading(false);
      }
    }

    load();
    return () => { live = false; };
  }, [code, lang]);

  useEffect(() => {
    let live = true;
    setDefaultCoverBanner(null);

    getActiveInvestorDefaultCover(lang)
      .then((row) => {
        if (live) setDefaultCoverBanner(row);
      })
      .catch(() => {
        if (live) setDefaultCoverBanner(null);
      });

    return () => { live = false; };
  }, [lang]);

  useEffect(() => {
    let live = true;

    async function loadContact() {
      if (!profile || !inv?.id) {
        setContact(null);
        return;
      }

      const { data } = await supabase
        .rpc('get_investor_contact_if_connected', {
          investor_uuid: inv.id,
        })
        .catch(() => ({ data: null } as any));

      if (live) setContact(data || null);
    }

    loadContact();
    return () => { live = false; };
  }, [profile?.id, inv?.id]);

  useEffect(() => {
    let live = true;

    async function loadSentProposal() {
      setSentProposal(null);
      if (!profile || profile.role !== 'business' || !inv?.id) return;

      try {
        const business = await getMyBusiness(profile.id);
        if (!live || !business?.id) return;

        const { data } = await supabase
          .from('proposals')
          .select('id,status,sent_at')
          .eq('business_id', business.id)
          .eq('investor_id', inv.id)
          .maybeSingle();

        if (live) setSentProposal(data || null);
      } catch {
        if (live) setSentProposal(null);
      }
    }

    loadSentProposal();
    return () => { live = false; };
  }, [profile?.id, profile?.role, inv?.id]);

  const title = inv ? investorPublicTitle(inv, lang) : '';
  const desc = inv ? investorPublicDescription(inv, lang) : '';
  const resolvedCover = useMemo(
    () => resolveInvestorCover(inv, defaultCoverBanner),
    [inv, defaultCoverBanner],
  );
  const coverUrl = resolvedCover.url;

  useEffect(() => {
    if (loading) return;
    const canonicalPath =
      lang === 'en'
        ? `/en/investors/${encodeURIComponent(code)}`
        : `/investors/${encodeURIComponent(code)}`;

    if (!inv) {
      applySeo({
        lang,
        pageName: T(
          lang,
          'Không tìm thấy hồ sơ Nhà đầu tư',
          'Investor Profile Not Found',
        ),
        description:
          error ||
          T(
            lang,
            'Hồ sơ Nhà đầu tư không tồn tại hoặc chưa được duyệt công khai.',
            'The investor profile does not exist or is not approved for public display.',
          ),
        canonicalPath,
        image: DEFAULT_SOCIAL_IMAGE,
        type: 'article',
        noindex: true,
      });
      return;
    }

    applySeo({
      lang,
      pageName: title,
      description: desc,
      canonicalPath,
      image: coverUrl || DEFAULT_SOCIAL_IMAGE,
      type: 'article',
      noindex: false,
    });
  }, [code, coverUrl, desc, error, inv, lang, loading, title]);

  const approvedCriteria = useMemo(() => objectOf(inv?.criteria), [inv]);
  const investorTypes = useMemo(
    () => investorPublicTypeLabels(inv, lang),
    [inv, lang],
  );
  const stages = useMemo(
    () => investorPublicStageLabels(inv, lang),
    [inv, lang],
  );
  const industries = useMemo(
    () => investorPublicIndustryLabels(inv, lang),
    [inv, lang],
  );
  const dealTypes = useMemo(
    () => investorPublicDealTypeLabels(inv, lang),
    [inv, lang],
  );
  const markets = useMemo(
    () => investorTargetCountries(inv),
    [inv],
  );
  const investmentAppetite = useMemo(
    () => approvedInvestorAppetite(inv, lang),
    [inv, lang],
  );
  const connected = !!contact?.connected;
  const activeLabel =
    inv?.visible === false
      ? T(lang, 'Hồ sơ công khai', 'Public profile')
      : T(lang, 'Đang hoạt động', 'Active');

  async function sendProposal() {
    if (!profile) {
      navigate(
        toLocalizedPath(
          `/register/business?next=/investors/${code}`,
          lang,
        ),
      );
      return;
    }

    if (profile.role !== 'business') {
      setMsg(
        T(
          lang,
          'Chỉ tài khoản Doanh nghiệp được gửi hồ sơ DN.',
          'Only Business accounts can send a business profile.',
        ),
      );
      return;
    }

    if (sentProposal) {
      setMsg(
        T(
          lang,
          'Bạn đã gửi hồ sơ DN tới nhà đầu tư này. Vui lòng theo dõi tại Dashboard DN → Proposal.',
          'You already sent your business profile to this investor. Please track it in Business Dashboard → Proposals.',
        ),
      );
      return;
    }

    setProposalBusy(true);
    setMsg('');

    try {
      const business = await getMyBusiness(profile.id);
      if (!business?.id) {
        navigate(toLocalizedPath('/dashboard/business', lang));
        return;
      }

      const result = await sendBusinessProposalToInvestor({
        business,
        investorId: inv.id,
        message: 'Submitted from public investor detail page.',
      });

      if (!result.ok) {
        if (result.reason === 'quota_exceeded') {
          setMsg(
            T(
              lang,
              'Bạn đã hết hạn mức gửi Proposal. Vui lòng nâng gói hoặc gia hạn.',
              'You have no proposal quota left. Please upgrade or renew your plan.',
            ),
          );
        } else {
          setMsg(
            result.message ||
              T(
                lang,
                'Không gửi được hồ sơ DN. Vui lòng thử lại.',
                'Could not send business profile. Please try again.',
              ),
          );
        }
        return;
      }

      setSentProposal(
        result.proposal || {
          status: 'sent',
          sent_at: new Date().toISOString(),
        },
      );
      const displayDate = new Date(
        result.proposal?.sent_at || Date.now(),
      ).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');

      setMsg(
        result.reason === 'duplicate'
          ? T(
              lang,
              'Bạn đã gửi hồ sơ DN tới nhà đầu tư này trước đó. Vui lòng theo dõi tại Dashboard DN → Proposal.',
              'You already sent your business profile to this investor. Please track it in Business Dashboard → Proposals.',
            )
          : T(
              lang,
              `Bạn đã gửi thành công ngày ${displayDate}. Hãy đợi nhà đầu tư xem xét duyệt.`,
              `Sent successfully on ${displayDate}. Please wait for the investor to review and approve.`,
            ),
      );
    } catch (sendError: any) {
      setMsg(
        sendError?.message ||
          T(
            lang,
            'Không gửi được hồ sơ DN. Vui lòng thử lại.',
            'Could not send business profile. Please try again.',
          ),
      );
    } finally {
      setProposalBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="d68-investor-detail">
        <div className="d68-id-state">
          {T(
            lang,
            'Đang tải hồ sơ nhà đầu tư...',
            'Loading investor profile...',
          )}
        </div>
      </main>
    );
  }

  if (error || !inv) {
    return (
      <main className="d68-investor-detail">
        <div className="d68-id-state">
          <h1>{T(lang, 'Không hiển thị được hồ sơ', 'Profile unavailable')}</h1>
          <p>{error}</p>
          <Link to={toLocalizedPath('/investors', lang)}>
            ← {T(lang, 'Quay lại danh sách', 'Back to investors')}
          </Link>
        </div>
      </main>
    );
  }

  const typeSummary =
    investorTypes.join(' / ') || T(lang, 'Nhà đầu tư', 'Investor');
  const stageSummary =
    stages.join(' / ') || T(lang, 'Linh hoạt', 'Flexible');

  return (
    <main className="d68-investor-detail">
      <section className="d68-id-wrap">
        <div className="d68-id-breadcrumb">
          <Link to={toLocalizedPath('/', lang)}>{T(lang, 'Trang chủ', 'Home')}</Link>
          {' › '}
          <Link to={toLocalizedPath('/investors', lang)}>
            {T(lang, 'Nhà đầu tư', 'Investors')}
          </Link>
          {' › '}
          <b>{inv.code}</b>
        </div>

        <div className="d68-id-layout">
          <div className="d68-id-main">
            <article className="d68-id-cover-card">
              <div className="d68-id-cover-copy">
                <div className="d68-id-cover__eyebrow">
                  <span>{inv.code}</span>
                  <b>{T(lang, 'Hồ sơ Nhà đầu tư', 'Investor profile')}</b>
                </div>
                <h1>{title}</h1>
                <div className="d68-id-cover-badges">
                  <span>{typeSummary}</span>
                  <span>📍 {labelCountry(inv.country_iso2 || inv.country, lang)}</span>
                  <span className="active">● {activeLabel}</span>
                </div>
              </div>
              <div
                className="d68-id-cover-media"
                data-cover-source={resolvedCover.source}
              >
                <img
                  src={coverUrl}
                  alt={T(
                    lang,
                    `Ảnh cover ${title}`,
                    `${title} cover image`,
                  )}
                  onError={(event) => {
                    if (
                      !event.currentTarget.src.endsWith(
                        INVESTOR_COVER_FALLBACK,
                      )
                    ) {
                      event.currentTarget.src = INVESTOR_COVER_FALLBACK;
                    }
                  }}
                />
              </div>
            </article>

            <section className="d68-id-section d68-id-section--card d68-id-section--intro">
              <SectionTitle icon="intro">
                {T(lang, 'Giới thiệu', 'Introduction')}
              </SectionTitle>
              <p className="d68-id-intro-copy">
                {desc ||
                  T(
                    lang,
                    'Thông tin giới thiệu đang được cập nhật.',
                    'The introduction is being updated.',
                  )}
              </p>
              <div className="d68-id-facts d68-id-facts--intro">
                <Fact
                  k={T(lang, 'Quốc gia trụ sở', 'HQ country')}
                  v={labelCountry(inv.country_iso2 || inv.country, lang)}
                />
                <Fact
                  k={T(lang, 'Loại hình nhà đầu tư', 'Investor types')}
                  v={typeSummary}
                />
                <Fact
                  k={T(lang, 'Khu vực', 'Region')}
                  v={labelRegion(inv.region, lang)}
                />
                <Fact
                  k={T(lang, 'Giai đoạn phù hợp', 'Preferred stages')}
                  v={stageSummary}
                />
                {investorTicketLabel(lang, inv) ? (
                  <Fact
                    k={T(lang, 'Quy mô đầu tư', 'Investment size')}
                    v={investorTicketLabel(lang, inv)}
                  />
                ) : null}
              </div>
            </section>

            <section className="d68-id-section d68-id-section--card d68-id-section--criteria">
              <SectionTitle icon="criteria">
                {T(lang, 'Tiêu chí đầu tư', 'Investment criteria')}
              </SectionTitle>
              <div className="d68-id-criteria-grid">
                <CriteriaGroup
                  label={T(
                    lang,
                    'Loại hình nhà đầu tư',
                    'Investor types',
                  )}
                >
                  <TagList
                    values={investorTypes}
                    empty={T(lang, 'Đang cập nhật', 'Updating')}
                  />
                </CriteriaGroup>
                <CriteriaGroup
                  label={T(lang, 'Giai đoạn phù hợp', 'Preferred stages')}
                >
                  <TagList
                    values={stages}
                    empty={T(lang, 'Đang cập nhật', 'Updating')}
                  />
                </CriteriaGroup>
                <CriteriaGroup
                  label={T(
                    lang,
                    'Loại giao dịch quan tâm',
                    'Preferred deal types',
                  )}
                >
                  <TagList
                    values={dealTypes}
                    empty={T(lang, 'Đang cập nhật', 'Updating')}
                  />
                </CriteriaGroup>
                <CriteriaGroup
                  label={T(lang, 'Ngành quan tâm', 'Sectors of interest')}
                >
                  <TagList
                    values={industries}
                    empty={T(lang, 'Đang cập nhật', 'Updating')}
                  />
                </CriteriaGroup>
                {investmentAppetite ? (
                  <CriteriaText
                    label={T(lang, 'Khẩu vị đầu tư', 'Investment appetite')}
                    value={investmentAppetite}
                  />
                ) : null}
                {approvedCriteria.riskAppetite ? (
                  <CriteriaText
                    label={T(lang, 'Khẩu vị rủi ro', 'Risk appetite')}
                    value={String(approvedCriteria.riskAppetite)}
                  />
                ) : null}
                {approvedCriteria.returnExpectation ? (
                  <CriteriaText
                    label={T(lang, 'Kỳ vọng lợi nhuận', 'Return expectation')}
                    value={String(approvedCriteria.returnExpectation)}
                  />
                ) : null}
              </div>
            </section>

            <section className="d68-id-section d68-id-section--card d68-id-section--markets">
              <SectionTitle icon="markets">
                {T(
                  lang,
                  'Nước quan tâm đầu tư',
                  'Target investment countries',
                )}
              </SectionTitle>
              <p className="d68-id-muted">
                {T(
                  lang,
                  'Các thị trường mà Nhà đầu tư ưu tiên tìm kiếm và xem xét cơ hội.',
                  'Markets where this investor prioritises sourcing and reviewing opportunities.',
                )}
              </p>
              <TagList
                values={markets.map((value) => labelCountry(value, lang))}
                empty={T(lang, 'Đang cập nhật', 'Updating')}
              />
            </section>

            <section className="d68-id-section d68-id-section--card d68-id-section--history">
              <SectionTitle icon="history">
                {T(lang, 'Lịch sử nhận proposal', 'Proposal history')}
              </SectionTitle>
              {publicHistory.length ? (
                <div className="d68-id-timeline d68-id-timeline--proposal">
                  {publicHistory.map((item, index) => (
                    <div key={`${item.slug || item.label}-${index}`}>
                      <i />
                      <span>
                        <small>{relativeTime(item.sent_at, lang)}</small>
                        {item.slug ? (
                          <Link
                            to={`/businesses/${item.slug}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {item.label}
                          </Link>
                        ) : (
                          <b>{item.label}</b>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="d68-id-muted">
                  {T(
                    lang,
                    'Chưa nhận Hồ sơ chào từ doanh nghiệp nào.',
                    'No business proposal profiles received yet.',
                  )}
                </p>
              )}
            </section>

            <section className="d68-id-section d68-id-section--card d68-id-section--contact">
              <SectionTitle icon="contact">
                {T(lang, 'Thông tin liên hệ', 'Contact information')}
              </SectionTitle>
              <p className="d68-id-muted">
                {T(
                  lang,
                  'Chỉ Doanh nghiệp đã kết nối với Nhà đầu tư mới được xem.',
                  'Only businesses connected with this investor can view contact details.',
                )}
              </p>
              <div className="d68-id-contact-list">
                <ContactRow
                  label={T(lang, 'Người liên hệ', 'Contact person')}
                  value={contact?.name}
                  unlocked={connected && !!contact?.name}
                />
                <ContactRow
                  label={T(lang, 'Số điện thoại', 'Phone')}
                  value={contact?.phone}
                  unlocked={connected && !!contact?.phone}
                />
                <ContactRow
                  label="Email"
                  value={contact?.email}
                  unlocked={connected && !!contact?.email}
                />
                <ContactRow
                  label={T(lang, 'Website', 'Website')}
                  value={contact?.website}
                  unlocked={connected && !!contact?.website}
                  href={contact?.website}
                />
              </div>
            </section>
          </div>

          <aside className="d68-id-side d68-id-side--sticky">
            <div className="d68-id-cta">
              <span>
                {T(
                  lang,
                  'Gửi Hồ sơ Doanh nghiệp',
                  'Send business profile',
                )}
              </span>
              <p>
                {T(
                  lang,
                  'Gửi hồ sơ doanh nghiệp của bạn tới nhà đầu tư này để bắt đầu kết nối.',
                  'Send your business profile to this investor to start the connection workflow.',
                )}
              </p>
              <button
                onClick={sendProposal}
                disabled={proposalBusy || !!sentProposal}
              >
                {sentProposal
                  ? T(lang, 'Đã gửi hồ sơ DN', 'Profile sent')
                  : proposalBusy
                    ? T(lang, 'Đang gửi...', 'Sending...')
                    : T(lang, 'Gửi hồ sơ DN', 'Send business profile')}
              </button>
              {sentProposal ? (
                <small>
                  {T(
                    lang,
                    'Đã gửi. Theo dõi tại Dashboard DN → Proposal.',
                    'Sent. Track it in Business Dashboard → Proposals.',
                  )}
                </small>
              ) : null}
            </div>
            <div className="d68-id-access">
              <h3>{T(lang, 'Ai được xem gì', 'Who can see what')}</h3>
              <p>
                👤 {T(
                  lang,
                  'Khách chỉ xem được hồ sơ công khai',
                  'Guests can only view the public profile.',
                )}
              </p>
              <p>
                🏢 {T(
                  lang,
                  'Doanh nghiệp đã đăng nhập có thể gửi Hồ sơ DN/proposal',
                  'Logged-in businesses can send a business profile/proposal.',
                )}
              </p>
              <p>
                ✅ {T(
                  lang,
                  'Sau khi kết nối/duyệt: mở thông tin liên hệ do nhà đầu tư cài đặt (SĐT, Email)',
                  'After approval/connection: contact details set by the investor are unlocked (phone, email).',
                )}
              </p>
            </div>
            {msg ? <div className="d68-id-msg">{msg}</div> : null}
          </aside>
        </div>
      </section>
    </main>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="d68-id-fact">
      <span>{k}</span>
      <b>{v || '—'}</b>
    </div>
  );
}

function CriteriaGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="d68-id-criteria-group">
      <h3>{label}</h3>
      {children}
    </div>
  );
}

function CriteriaText({ label, value }: { label: string; value: string }) {
  return (
    <div className="d68-id-criteria-text">
      <h3>{label}</h3>
      <p>{value}</p>
    </div>
  );
}

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
      ? (
          <a
            href={href.startsWith('http') ? href : `https://${href}`}
            target="_blank"
            rel="noreferrer"
          >
            {value}
          </a>
        )
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
