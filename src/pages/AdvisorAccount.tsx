import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getMyAdvisorAccount, type AdvisorAccountRow } from '../lib/advisorAuth';
import { toLocalizedPath } from '../lib/i18nRoutes';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

function advisorTypeLabel(value: string | undefined, lang: Lang) {
  if (value === 'broker') return T(lang, 'Môi giới', 'Broker');
  if (value === 'advisor_broker') return T(lang, 'Cố vấn & Môi giới', 'Advisor & Broker');
  return T(lang, 'Cố vấn', 'Advisor');
}

function statusLabel(value: string | undefined, lang: Lang) {
  const labels: Record<string, [string, string]> = {
    pending: ['Chờ duyệt', 'Pending review'],
    pending_admin_review: ['Chờ Admin kiểm tra', 'Pending Admin review'],
    active: ['Đang hoạt động', 'Active'],
    verified: ['Đã xác minh', 'Verified'],
    suspended: ['Tạm ngưng', 'Suspended'],
    rejected: ['Không được chấp thuận', 'Rejected'],
    draft: ['Bản nháp', 'Draft'],
  };
  const pair = labels[String(value || '')] || [String(value || '—'), String(value || '—')];
  return T(lang, pair[0], pair[1]);
}

export default function AdvisorAccount({ lang = 'vi' }: { lang?: Lang }) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [advisor, setAdvisor] = useState<AdvisorAccountRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    getMyAdvisorAccount(user.id)
      .then((row) => { if (!cancelled) setAdvisor(row); })
      .catch((loadError: any) => { if (!cancelled) setError(loadError?.message || 'Could not load Advisor profile'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  async function logout() {
    await signOut();
    navigate(toLocalizedPath('/advisor/login', lang), { replace: true });
  }

  const isApproved = profile?.status === 'active' && advisor?.status === 'active' && advisor?.verification_status === 'verified';
  const expertise = Array.isArray(advisor?.payload?.expertise) ? advisor?.payload?.expertise as string[] : [];
  const introduction = typeof advisor?.payload?.introduction === 'string' ? advisor.payload.introduction : '';

  return (
    <main className="d68-advisor-account-page">
      <section className="d68-advisor-account-shell">
        <header className="d68-advisor-account-header">
          <div>
            <span>Deals68 Advisor</span>
            <h1>{T(lang, 'Trạng thái tài khoản Advisor', 'Advisor account status')}</h1>
            <p>{T(lang, 'Phiên 2 chỉ mở xác thực và xem trạng thái hồ sơ. Danh mục doanh nghiệp và chuyển đổi ngữ cảnh sẽ được triển khai ở Phiên 3.', 'Session 2 enables authentication and application status only. Business portfolio and context switching are deferred to Session 3.')}</p>
          </div>
          <button type="button" onClick={logout}>{T(lang, 'Đăng xuất', 'Log out')}</button>
        </header>

        {loading ? <div className="d68-advisor-account-panel">{T(lang, 'Đang tải hồ sơ...', 'Loading profile...')}</div> : null}
        {error ? <div className="d68-auth-error">⚠ {error}</div> : null}

        {!loading && advisor ? (
          <>
            <div className={`d68-advisor-account-banner ${isApproved ? 'approved' : advisor.status === 'rejected' || advisor.status === 'suspended' ? 'blocked' : 'pending'}`}>
              <b>{isApproved ? T(lang, 'Hồ sơ đã được xác minh', 'Profile verified') : advisor.status === 'rejected' ? T(lang, 'Hồ sơ chưa được chấp thuận', 'Application not approved') : advisor.status === 'suspended' ? T(lang, 'Tài khoản đang tạm ngưng', 'Account suspended') : T(lang, 'Hồ sơ đang chờ kiểm tra', 'Application is under review')}</b>
              <span>{isApproved
                ? T(lang, 'Deals68 đã xác minh hồ sơ. Phiên 2 vẫn chưa cấp quyền truy cập doanh nghiệp; quyền chỉ xuất hiện sau assignment hợp lệ trong các phiên tiếp theo.', 'Deals68 has verified the profile. Session 2 still grants no Business access; access appears only after a valid assignment in later sessions.')
                : T(lang, 'Email đã được xác thực. Admin sẽ kiểm tra thông tin nghề nghiệp trước khi kích hoạt và phân công bất kỳ doanh nghiệp nào.', 'Your email is verified. An Admin will review the professional information before activation or any Business assignment.')}</span>
            </div>

            <div className="d68-advisor-status-grid">
              <article><span>{T(lang, 'Tài khoản', 'Account')}</span><b>{statusLabel(profile?.status, lang)}</b></article>
              <article><span>{T(lang, 'Hồ sơ Advisor', 'Advisor profile')}</span><b>{statusLabel(advisor.status, lang)}</b></article>
              <article><span>{T(lang, 'Xác minh', 'Verification')}</span><b>{statusLabel(advisor.verification_status, lang)}</b></article>
              <article><span>{T(lang, 'Vai trò', 'Role')}</span><b>{advisorTypeLabel(advisor.advisor_type, lang)}</b></article>
            </div>

            <section className="d68-advisor-account-panel">
              <h2>{advisor.title || T(lang, 'Hồ sơ nghề nghiệp', 'Professional profile')}</h2>
              <dl>
                <div><dt>{T(lang, 'Công ty / Tổ chức', 'Company / Organization')}</dt><dd>{advisor.company_name || '—'}</dd></div>
                <div><dt>Website</dt><dd>{advisor.website ? <a href={advisor.website} target="_blank" rel="noreferrer">{advisor.website}</a> : '—'}</dd></div>
                <div><dt>{T(lang, 'Lĩnh vực chuyên môn', 'Areas of expertise')}</dt><dd>{expertise.length ? expertise.join(' · ') : '—'}</dd></div>
                <div className="wide"><dt>{T(lang, 'Giới thiệu', 'Introduction')}</dt><dd>{introduction || '—'}</dd></div>
              </dl>
            </section>

            <section className="d68-advisor-account-panel d68-advisor-session-boundary">
              <h2>{T(lang, 'Ranh giới Phiên 2', 'Session 2 boundary')}</h2>
              <ul>
                <li>{T(lang, 'Không có quyền đọc hoặc sửa hồ sơ doanh nghiệp.', 'No permission to read or edit Business profiles.')}</li>
                <li>{T(lang, 'Không có danh sách khách hàng hoặc chuyển đổi ngữ cảnh.', 'No client portfolio or context switching.')}</li>
                <li>{T(lang, 'Không thể tự tạo assignment hoặc tự cấp quyền.', 'No self-created assignments or self-granted access.')}</li>
              </ul>
              <p>{T(lang, 'Cần hỗ trợ?', 'Need support?')} <Link to={toLocalizedPath('/contact', lang)}>{T(lang, 'Liên hệ Deals68', 'Contact Deals68')}</Link>.</p>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
