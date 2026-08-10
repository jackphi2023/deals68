import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  acceptAdvisorAssignment,
  getMyAdvisorAccount,
  getMyAdvisorBusinessContext,
  getMyAdvisorPortfolio,
  type AdvisorAccountRow,
  type AdvisorBusinessContext,
  type AdvisorBusinessIntakeResult,
  type AdvisorPortfolioItem,
} from '../lib/advisorAuth';
import { toLocalizedPath } from '../lib/i18nRoutes';
import type { Lang } from '../lib/i18n';
import AdvisorBusinessCreate from './AdvisorBusinessCreate';
import AdvisorAuthorityEvidencePanel from '../components/AdvisorAuthorityEvidencePanel';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

function labelStatus(value: string | undefined, lang: Lang) {
  const labels: Record<string, [string, string]> = {
    pending: ['Chờ chấp nhận', 'Pending'], active: ['Đang hoạt động', 'Active'],
    verified: ['Đã xác minh', 'Verified'], suspended: ['Tạm ngưng', 'Suspended'],
    revoked: ['Đã thu hồi', 'Revoked'], expired: ['Đã hết hạn', 'Expired'],
    rejected: ['Không được chấp thuận', 'Rejected'], draft: ['Bản nháp', 'Draft'],
    pending_review: ['Chờ xác minh authority', 'Authority review pending'],
    pending_admin_review: ['Chờ Admin kiểm tra', 'Pending Admin review'],
  };
  const pair = labels[value || ''] || [value || '—', value || '—'];
  return T(lang, pair[0], pair[1]);
}

function formatDate(value: string | null | undefined, lang: Lang) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'vi-VN').format(date);
}

function businessTitle(item: AdvisorPortfolioItem, lang: Lang) {
  return item.business.company_name
    || (lang === 'en' ? item.business.title_en : item.business.title_vi)
    || item.business.title_vi || item.business.title_en || item.business.public_code || 'Deals68 Business';
}

export default function AdvisorAccount({ lang = 'vi' }: { lang?: Lang }) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [advisor, setAdvisor] = useState<AdvisorAccountRow | null>(null);
  const [portfolio, setPortfolio] = useState<AdvisorPortfolioItem[]>([]);
  const [context, setContext] = useState<AdvisorBusinessContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [actionId, setActionId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    getMyAdvisorAccount(user.id)
      .then((row) => { if (!cancelled) setAdvisor(row); })
      .catch((e: any) => { if (!cancelled) setError(e?.message || 'Could not load Advisor profile'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const approved = profile?.status === 'active'
    && advisor?.status === 'active'
    && advisor?.verification_status === 'verified';

  const loadPortfolio = useCallback(async () => {
    if (!approved) return [] as AdvisorPortfolioItem[];
    setPortfolioLoading(true);
    setError('');
    try {
      const data = await getMyAdvisorPortfolio();
      setPortfolio(data.items);
      return data.items;
    } catch (e: any) {
      setError(e?.message || T(lang, 'Không thể tải danh mục được phân công.', 'Could not load assigned portfolio.'));
      return [] as AdvisorPortfolioItem[];
    } finally {
      setPortfolioLoading(false);
    }
  }, [approved, lang]);

  useEffect(() => { if (approved) void loadPortfolio(); }, [approved, loadPortfolio]);

  const businessId = params.get('business') || '';
  const selected = useMemo(() => portfolio.find((item) => item.business_id === businessId) || null, [portfolio, businessId]);

  useEffect(() => {
    if (!businessId || !selected?.can_open_context) { setContext(null); return; }
    let cancelled = false;
    setContextLoading(true);
    setError('');
    getMyAdvisorBusinessContext(businessId)
      .then((data) => { if (!cancelled) setContext(data); })
      .catch((e: any) => { if (!cancelled) { setContext(null); setError(e?.message || T(lang, 'Không thể mở ngữ cảnh doanh nghiệp.', 'Could not open Business context.')); } })
      .finally(() => { if (!cancelled) setContextLoading(false); });
    return () => { cancelled = true; };
  }, [businessId, selected?.can_open_context, lang]);

  useEffect(() => {
    if (!approved || businessId || portfolioLoading) return;
    const first = portfolio.find((item) => item.can_open_context);
    if (!first) return;
    const next = new URLSearchParams(params);
    next.set('business', first.business_id);
    setParams(next, { replace: true });
  }, [approved, businessId, portfolio, portfolioLoading, params, setParams]);

  async function logout() {
    await signOut();
    navigate(toLocalizedPath('/advisor/login', lang), { replace: true });
  }

  function selectBusiness(item: AdvisorPortfolioItem) {
    if (!item.can_open_context) return;
    const next = new URLSearchParams(params);
    next.set('business', item.business_id);
    setParams(next);
    setNotice('');
  }

  async function accept(item: AdvisorPortfolioItem) {
    if (!item.can_accept || actionId) return;
    setActionId(item.assignment_id);
    setError('');
    setNotice('');
    try {
      await acceptAdvisorAssignment(item.assignment_id);
      const items = await loadPortfolio();
      const accepted = items.find((row) => row.assignment_id === item.assignment_id);
      if (accepted?.can_open_context) {
        const next = new URLSearchParams(params);
        next.set('business', accepted.business_id);
        setParams(next, { replace: true });
      }
      setNotice(T(lang, 'Đã chấp nhận phân công. Quyền vẫn giới hạn theo scope đã được Admin cấp.', 'Assignment accepted. Access remains limited to Admin-granted scopes.'));
    } catch (e: any) {
      setError(e?.message || T(lang, 'Không thể chấp nhận phân công.', 'Could not accept assignment.'));
    } finally {
      setActionId('');
    }
  }

  async function afterBusinessIntake(result: AdvisorBusinessIntakeResult) {
    await loadPortfolio();
    setNotice(T(
      lang,
      `Đã tạo Business draft ${result.business_id}. Bạn có thể nộp bằng chứng authority trong hồ sơ assignment; chưa có quyền chỉnh sửa Business.`,
      `Business draft ${result.business_id} was created. You may submit authority evidence from the assignment; no Business edit access is granted.`,
    ));
  }

  const counts = useMemo(() => ({
    total: portfolio.length,
    active: portfolio.filter((item) => item.status === 'active').length,
    pending: portfolio.filter((item) => item.status === 'pending').length,
    blocked: portfolio.filter((item) => ['suspended', 'revoked', 'expired'].includes(item.status)).length,
  }), [portfolio]);

  const expertise = Array.isArray(advisor?.payload?.expertise) ? advisor?.payload?.expertise as string[] : [];
  const introduction = typeof advisor?.payload?.introduction === 'string' ? advisor.payload.introduction : '';

  return (
    <main className="d68-advisor-account-page">
      <section className="d68-advisor-account-shell">
        <header className="d68-advisor-account-header">
          <div><span>Deals68 Advisor</span><h1>{T(lang, 'Danh mục khách hàng và Business intake', 'Client portfolio and Business intake')}</h1><p>{T(lang, 'Phiên 8 bổ sung cảnh báo authority còn 30/14/7 ngày, trạng thái hết hạn và re-review theo thời gian thực. Business context vẫn chỉ đọc và tự đóng nếu authority không còn verified/hợp lệ.', 'Session 8 adds read-time 30/14/7-day authority expiry alerts, expired state and re-review status. Business context remains read only and automatically closes when authority is no longer verified/current.')}</p></div>
          <button type="button" onClick={logout}>{T(lang, 'Đăng xuất', 'Log out')}</button>
        </header>

        {loading ? <div className="d68-advisor-account-panel">{T(lang, 'Đang tải hồ sơ...', 'Loading profile...')}</div> : null}
        {error ? <div className="d68-auth-error">⚠ {error}</div> : null}
        {notice ? <div className="d68-advisor-notice">✓ {notice}</div> : null}

        {!loading && advisor ? <>
          <div className={`d68-advisor-account-banner ${approved ? 'approved' : advisor.status === 'rejected' || advisor.status === 'suspended' ? 'blocked' : 'pending'}`}>
            <b>{approved ? T(lang, 'Hồ sơ Advisor đã được xác minh', 'Advisor profile verified') : T(lang, 'Hồ sơ chưa sẵn sàng nhận phân công', 'Profile is not ready for assignments')}</b>
            <span>{approved ? T(lang, 'Bạn có thể gửi Business mới, theo dõi cảnh báo authority, nộp hoặc thay thế bằng chứng và chỉ thấy các Business có assignment của mình. Cảnh báo/acknowledgement không tạo ownership hoặc quyền chỉnh sửa.', 'You may submit new Businesses, monitor authority alerts, provide or replace evidence and only see Businesses linked to your assignments. Alerts and acknowledgements create no ownership or edit access.') : T(lang, 'Email đã xác thực nhưng Admin vẫn cần kích hoạt và xác minh hồ sơ.', 'Email is verified, but Admin activation and verification are still required.')}</span>
          </div>

          <div className="d68-advisor-status-grid">
            <article><span>{T(lang, 'Tài khoản', 'Account')}</span><b>{labelStatus(profile?.status, lang)}</b></article>
            <article><span>{T(lang, 'Hồ sơ Advisor', 'Advisor profile')}</span><b>{labelStatus(advisor.status, lang)}</b></article>
            <article><span>{T(lang, 'Xác minh', 'Verification')}</span><b>{labelStatus(advisor.verification_status, lang)}</b></article>
            <article><span>{T(lang, 'Assignment', 'Assignments')}</span><b>{approved ? counts.total : 0}</b></article>
          </div>

          {approved ? <>
            <div className="d68-advisor-portfolio-stats">
              <span>{T(lang, 'Đang hoạt động', 'Active')} <b>{counts.active}</b></span>
              <span>{T(lang, 'Chờ xử lý', 'Pending')} <b>{counts.pending}</b></span>
              <span>{T(lang, 'Bị giới hạn', 'Restricted')} <b>{counts.blocked}</b></span>
            </div>

            <AdvisorBusinessCreate
              lang={lang}
              advisorName={advisor.company_name || advisor.title || undefined}
              onCreated={afterBusinessIntake}
            />

            <section className="d68-advisor-workspace">
              <aside className="d68-advisor-portfolio-list">
                <div className="d68-advisor-list-title"><h2>{T(lang, 'Doanh nghiệp được phân công', 'Assigned Businesses')}</h2><button type="button" onClick={() => void loadPortfolio()} disabled={portfolioLoading}>{portfolioLoading ? '…' : '↻'}</button></div>
                {!portfolioLoading && portfolio.length === 0 ? <p className="d68-advisor-empty">{T(lang, 'Chưa có assignment.', 'No assignments yet.')}</p> : null}
                {portfolio.map((item) => <article key={item.assignment_id} className={`d68-advisor-assignment ${businessId === item.business_id ? 'selected' : ''}`}>
                  <button type="button" className="d68-advisor-assignment-main" onClick={() => selectBusiness(item)} disabled={!item.can_open_context}>
                    <span className={`d68-advisor-assignment-status ${item.status}`}>{labelStatus(item.status, lang)}</span>
                    <b>{businessTitle(item, lang)}</b>
                    <small>{[item.business.industry, item.business.city].filter(Boolean).join(' · ') || item.business.public_code || '—'}</small>
                  </button>
                  <div className="d68-advisor-scope-list">{item.permissions.map((scope) => <span key={scope}>{scope}</span>)}</div>
                  <div className="d68-advisor-assignment-meta"><span>{T(lang, 'Hết hạn', 'Expires')}: {formatDate(item.expires_at, lang)}</span><span>{labelStatus(item.authority.verification_status, lang)}</span></div>
                  {item.status === 'pending' ? <button className="d68-advisor-accept" type="button" disabled={!item.can_accept || Boolean(actionId)} onClick={() => void accept(item)}>{actionId === item.assignment_id ? T(lang, 'Đang xử lý...', 'Processing...') : item.can_accept ? T(lang, 'Chấp nhận phân công', 'Accept assignment') : T(lang, 'Chờ Admin xác minh authority', 'Awaiting authority review')}</button> : null}
                  {item.business.status === 'draft' && item.business.moderation_status === 'pending_admin_review' ? <AdvisorAuthorityEvidencePanel assignmentId={item.assignment_id} lang={lang} /> : null}
                  {item.status === 'active' && !item.can_open_context ? <p className="d68-advisor-warning">{T(lang, 'Business context đang bị khóa vì scope hoặc authority không còn hợp lệ; kiểm tra trạng thái tái thẩm định/cảnh báo bên dưới.', 'Business context is locked because scope or authority is not currently valid; check the re-review/alert status below.')}</p> : null}
                </article>)}
              </aside>

              <section className="d68-advisor-context-panel">
                {!selected ? <div className="d68-advisor-context-empty"><h2>{T(lang, 'Chọn một doanh nghiệp', 'Select a Business')}</h2><p>{T(lang, 'Chỉ assignment đang hoạt động, đã chấp nhận, có scope Hồ sơ và authority verified/chưa hết hạn mới mở được ngữ cảnh.', 'Only active, accepted assignments with Profile scope and verified/unexpired authority can open context.')}</p></div> : null}
                {selected && !selected.can_open_context ? <div className="d68-advisor-context-empty"><h2>{T(lang, 'Ngữ cảnh chưa khả dụng', 'Context unavailable')}</h2><p>{T(lang, 'Ngữ cảnh sẽ bị đóng trong lúc authority chờ duyệt hoặc tái thẩm định, hết hạn, bị từ chối hay assignment thiếu điều kiện.', 'Context closes while authority is pending initial review or re-review, expired, rejected, or the assignment is otherwise ineligible.')}</p></div> : null}
                {contextLoading ? <div className="d68-advisor-context-empty">{T(lang, 'Đang mở ngữ cảnh...', 'Opening context...')}</div> : null}
                {!contextLoading && context ? <>
                  <header className="d68-advisor-context-header"><div><span>{context.business.public_code || 'Deals68 Business'}</span><h2>{context.business.company_name || (lang === 'en' ? context.business.title_en : context.business.title_vi)}</h2><p>{lang === 'en' ? context.business.title_en : context.business.title_vi}</p></div><b>{T(lang, 'Chỉ đọc', 'Read only')}</b></header>
                  <div className="d68-advisor-context-grid">
                    <article><span>{T(lang, 'Ngành', 'Industry')}</span><b>{context.business.industry || '—'}</b></article>
                    <article><span>{T(lang, 'Địa điểm', 'Location')}</span><b>{[context.business.city, context.business.country_iso2].filter(Boolean).join(', ') || '—'}</b></article>
                    <article><span>{T(lang, 'Loại giao dịch', 'Deal type')}</span><b>{context.business.deal_type || '—'}</b></article>
                    <article><span>{T(lang, 'Trạng thái', 'Status')}</span><b>{labelStatus(context.business.status || context.business.moderation_status, lang)}</b></article>
                  </div>
                  <section className="d68-advisor-context-access"><h3>{T(lang, 'Phạm vi đang mở', 'Current access')}</h3><div>{context.assignment.permissions.map((scope) => <span key={scope}>{scope}</span>)}</div><p>{T(lang, 'Phiên 8 kế thừa ranh giới Phiên 7: context vẫn chỉ trả về nhận diện và trạng thái Business cơ bản. Alert/receipt authority nằm ngoài Business; không có dữ liệu tài chính, file Business riêng tư, proposal, yêu cầu dữ liệu, thanh toán, báo cáo hoặc mutation.', 'Session 8 inherits the Session 7 boundary: context still returns only basic Business identity and status. Authority alerts/receipts sit outside Business; financials, private Business files, proposals, data requests, payments, reports and mutations remain unavailable.')}</p></section>
                </> : null}
              </section>
            </section>
          </> : null}

          <section className="d68-advisor-account-panel"><h2>{advisor.title || T(lang, 'Hồ sơ nghề nghiệp', 'Professional profile')}</h2><dl><div><dt>{T(lang, 'Công ty / Tổ chức', 'Company / Organization')}</dt><dd>{advisor.company_name || '—'}</dd></div><div><dt>Website</dt><dd>{advisor.website ? <a href={advisor.website} target="_blank" rel="noreferrer">{advisor.website}</a> : '—'}</dd></div><div><dt>{T(lang, 'Lĩnh vực chuyên môn', 'Expertise')}</dt><dd>{expertise.join(' · ') || '—'}</dd></div><div className="wide"><dt>{T(lang, 'Giới thiệu', 'Introduction')}</dt><dd>{introduction || '—'}</dd></div></dl></section>

          <section className="d68-advisor-account-panel d68-advisor-session-boundary"><h2>{T(lang, 'Ranh giới Phiên 8 · kế thừa Ranh giới Phiên 7', 'Session 8 boundary · inherits Session 7 boundary')}</h2><ul><li>{T(lang, 'Authority verified sẽ có cảnh báo read-time khi còn 30/14/7 ngày hoặc đã hết hạn; trạng thái re-review pending được ưu tiên cao nhất. Chưa có email/SMS/push tự động.', 'Verified authority gets read-time alerts at 30/14/7 days and after expiry; pending re-review has the highest priority. No automated email/SMS/push is sent.')}</li><li>{T(lang, 'Nút Đã xem chỉ ghi acknowledgement receipt cho đúng cảnh báo server hiện tại; không gia hạn authority, không mở Business context và không thay đổi permission.', 'Acknowledge records a receipt only for the current server-derived alert; it does not renew authority, open Business context or change permissions.')}</li><li>{T(lang, 'Admin vẫn dùng quy trình evidence/re-review Phiên 7. Business vẫn ownerless/draft/non-public trong intake; không có quyền sửa Business, payment, file Business, proposal, data request hoặc report.', 'Admin continues to use the Session 7 evidence/re-review workflow. The intake Business remains ownerless/draft/non-public; no Business editing, payments, Business files, proposals, data requests or reports are enabled.')}</li></ul><p>{T(lang, 'Cần hỗ trợ?', 'Need support?')} <Link to={toLocalizedPath('/contact', lang)}>{T(lang, 'Liên hệ Deals68', 'Contact Deals68')}</Link>.</p></section>
        </> : null}
      </section>
    </main>
  );
}
