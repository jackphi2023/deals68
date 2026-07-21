import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  FileWarning,
  Gavel,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  dismissAdminReportAlert,
  downloadAdminEvidenceFile,
  downloadAdminReport,
  loadAdminReportData,
  rejectListingAuthority,
  reportArtifactOf,
  requestAlertSupplement,
  resolveAdminReportAlert,
  sendAlertToLegalReview,
  verifyListingAuthority,
  writeAdminReportAudit,
} from './adminReportApi';
import type {
  AdminListingAuthority,
  AdminReportAlert,
  AdminReportBusiness,
  AdminReportBusinessFile,
  AdminReportData,
  AdminReportProfile,
  AdminReportRequest,
} from './adminReportTypes';
import './admin-reports.css';

const EMPTY_DATA: AdminReportData = {
  requests: [],
  alerts: [],
  authorities: [],
  businesses: [],
  profiles: [],
  files: [],
};

const AUTHORITY_CODES = new Set([
  'BROKER_AUTHORITY_MISSING',
  'AUTHORITY_SCOPE_INSUFFICIENT',
  'AUTHORITY_DOCUMENT_EXPIRED',
  'OWNER_IDENTITY_MISMATCH',
  'ASSET_IDENTIFIER_MISMATCH',
  'ADMIN_REVIEW_REQUIRED',
]);

const SEVERITY_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  warning: 2,
  info: 1,
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function formatDate(value: unknown) {
  const date = new Date(text(value) || 0);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString('vi-VN');
}

function businessName(business?: AdminReportBusiness) {
  return (
    business?.company_name_private ||
    business?.title_vi ||
    business?.title_en ||
    business?.public_code ||
    business?.id ||
    'Business'
  );
}

function profileName(profile?: AdminReportProfile) {
  return profile?.display_name || profile?.username || profile?.email || profile?.id || '—';
}

function alertStatusLabel(status: string) {
  if (status === 'open') return 'Mới';
  if (status === 'acknowledged') return 'Đang xử lý';
  if (status === 'resolved') return 'Đã xử lý';
  if (status === 'dismissed') return 'Bỏ qua';
  return status || '—';
}

function requestMetadata(request: AdminReportRequest) {
  return objectOf(request.metadata);
}

function reportGrade(request: AdminReportRequest) {
  const metadata = requestMetadata(request);
  return text(metadata.report_grade || metadata.grade || metadata.preflight_grade) || '—';
}

function reportLanguage(request: AdminReportRequest) {
  const metadata = requestMetadata(request);
  return text(metadata.language || metadata.lang || metadata.locale) || '—';
}

function useAdminReportsMount(pathname: string) {
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const normalized = pathname.replace(/\/+$/, '');
    if (!['/admin/reports', '/admin/ai-reports'].includes(normalized)) {
      setMount(null);
      return undefined;
    }

    const node = document.createElement('div');
    node.className = 'd68-admin-reports-portal-mount';
    let observer: MutationObserver | null = null;
    let attached = false;

    const attach = () => {
      const main = document.querySelector<HTMLElement>('.d68-admin-cols > main');
      if (!main) return false;
      main.appendChild(node);
      attached = true;
      setMount(node);
      return true;
    };

    if (!attach()) {
      observer = new MutationObserver(() => {
        if (attach()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      if (attached && node.parentNode) node.parentNode.removeChild(node);
      setMount(null);
    };
  }, [pathname]);

  return mount;
}

function AdminReportsPanel({ adminId }: { adminId: string }) {
  const [data, setData] = useState<AdminReportData>(EMPTY_DATA);
  const [view, setView] = useState<'reports' | 'alerts'>('reports');
  const [search, setSearch] = useState('');
  const [alertStatus, setAlertStatus] = useState<'active' | 'all' | 'resolved'>('active');
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [refreshedAt, setRefreshedAt] = useState('');

  const refresh = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      setData(await loadAdminReportData());
      setRefreshedAt(new Date().toISOString());
    } catch (loadError: any) {
      setError(loadError?.message || 'Không tải được dữ liệu Báo cáo AI.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const businessById = useMemo(
    () => new Map(data.businesses.map((row) => [String(row.id), row])),
    [data.businesses],
  );
  const profileById = useMemo(
    () => new Map(data.profiles.map((row) => [String(row.id), row])),
    [data.profiles],
  );
  const fileById = useMemo(
    () => new Map(data.files.map((row) => [String(row.id), row])),
    [data.files],
  );
  const authorityByBusiness = useMemo(() => {
    const map = new Map<string, AdminListingAuthority>();
    data.authorities.forEach((row) => {
      if (!map.has(String(row.business_id))) map.set(String(row.business_id), row);
    });
    return map;
  }, [data.authorities]);

  const completedReports = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return data.requests
      .filter((request) => request.status === 'completed')
      .filter((request) => {
        if (!keyword) return true;
        const business = businessById.get(String(request.business_id));
        const actor = profileById.get(String(request.actor_profile_id || ''));
        return [
          request.id,
          request.report_id,
          request.request_key,
          businessName(business),
          business?.public_code,
          business?.industry,
          profileName(actor),
          reportGrade(request),
          reportLanguage(request),
        ].some((value) => text(value).toLowerCase().includes(keyword));
      });
  }, [data.requests, search, businessById, profileById]);

  const filteredAlerts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return data.alerts
      .filter((alert) => {
        if (alertStatus === 'active') return ['open', 'acknowledged'].includes(alert.status);
        if (alertStatus === 'resolved') return ['resolved', 'dismissed'].includes(alert.status);
        return true;
      })
      .filter((alert) => {
        if (!keyword) return true;
        const business = businessById.get(String(alert.business_id));
        const file = fileById.get(String(alert.business_file_id || ''));
        return [
          alert.alert_code,
          alert.title_vi,
          alert.title_en,
          alert.status,
          alert.severity,
          businessName(business),
          business?.public_code,
          file?.display_name,
          file?.file_name,
        ].some((value) => text(value).toLowerCase().includes(keyword));
      })
      .sort((left, right) => {
        const severity = (SEVERITY_ORDER[right.severity] || 0) - (SEVERITY_ORDER[left.severity] || 0);
        if (severity) return severity;
        return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
      });
  }, [data.alerts, alertStatus, search, businessById, fileById]);

  const activeAlerts = data.alerts.filter((row) => ['open', 'acknowledged'].includes(row.status));
  const reviewAlerts = activeAlerts.filter((row) => row.requires_admin_review);
  const criticalAlerts = activeAlerts.filter((row) => ['critical', 'high'].includes(row.severity));

  async function runAction(key: string, action: () => Promise<void>, success: string) {
    setBusyAction(key);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
      await refresh();
    } catch (actionError: any) {
      setError(actionError?.message || 'Không thể thực hiện thao tác.');
    } finally {
      setBusyAction('');
    }
  }

  async function handleReportDownload(request: AdminReportRequest) {
    await runAction(
      `report-download:${request.id}`,
      async () => {
        await downloadAdminReport(request);
        await writeAdminReportAudit(adminId, 'admin_download_ai_report', 'ai_report_business_request', request.id, {
          business_id: request.business_id,
          report_id: request.report_id || null,
        });
      },
      'Đã tải Báo cáo AI.',
    );
  }

  async function handleFileDownload(file: AdminReportBusinessFile, alert: AdminReportAlert) {
    await runAction(
      `file-download:${file.id}`,
      async () => {
        await downloadAdminEvidenceFile(file);
        await writeAdminReportAudit(adminId, 'admin_download_ai_report_evidence', 'business_file', file.id, {
          business_id: alert.business_id,
          alert_id: alert.id,
        });
      },
      'Đã tải file liên quan.',
    );
  }

  return (
    <section className="d68-admin-reports" aria-labelledby="d68-admin-reports-title">
      <div className="d68-admin-reports__head">
        <div>
          <span className="d68-admin-reports__kicker">AI Reports</span>
          <h2 id="d68-admin-reports-title">Báo cáo AI & Xác minh hồ sơ</h2>
          <p>Quản lý báo cáo hoàn thành, cảnh báo dữ liệu và thẩm quyền người đăng.</p>
        </div>
        <button className="d68-admin-btn light" type="button" onClick={() => void refresh()} disabled={busy}>
          <RefreshCw size={16} className={busy ? 'is-spinning' : ''} />
          {busy ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      <div className="d68-admin-reports__metrics">
        <div><FileCheck2 size={20} /><span>Báo cáo hoàn thành</span><b>{completedReports.length}</b></div>
        <div><FileWarning size={20} /><span>Alert đang mở</span><b>{activeAlerts.length}</b></div>
        <div><AlertTriangle size={20} /><span>Cần Admin xem</span><b>{reviewAlerts.length}</b></div>
        <div><ShieldX size={20} /><span>Mức cao/nghiêm trọng</span><b>{criticalAlerts.length}</b></div>
      </div>

      {message ? <div className="d68-admin-notice ok">{message}</div> : null}
      {error ? <div className="d68-admin-notice err">{error}</div> : null}

      <div className="d68-admin-reports__toolbar">
        <div className="d68-admin-reports__tabs" role="tablist">
          <button type="button" className={view === 'reports' ? 'active' : ''} onClick={() => setView('reports')}>
            Báo cáo đã tạo
          </button>
          <button type="button" className={view === 'alerts' ? 'active' : ''} onClick={() => setView('alerts')}>
            Cần bổ sung/Xác minh
            {activeAlerts.length ? <b>{activeAlerts.length}</b> : null}
          </button>
        </div>
        <label className="d68-admin-reports__search">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm Business, mã báo cáo, alert hoặc file..." />
        </label>
        {view === 'alerts' ? (
          <select value={alertStatus} onChange={(event) => setAlertStatus(event.target.value as typeof alertStatus)}>
            <option value="active">Đang mở/đang xử lý</option>
            <option value="resolved">Đã xử lý/bỏ qua</option>
            <option value="all">Tất cả</option>
          </select>
        ) : null}
      </div>

      {view === 'reports' ? (
        <div className="d68-admin-card d68-admin-reports__card">
          <div className="d68-admin-table-wrap">
            <table className="d68-admin-table d68-admin-reports__table">
              <thead>
                <tr><th>Report ID</th><th>Business</th><th>Ngành</th><th>Tài khoản</th><th>Thời gian</th><th>Ngôn ngữ/Grade</th><th>Download</th></tr>
              </thead>
              <tbody>
                {completedReports.map((request) => {
                  const business = businessById.get(String(request.business_id));
                  const actor = profileById.get(String(request.actor_profile_id || ''));
                  const artifact = reportArtifactOf(request);
                  return (
                    <tr key={request.id}>
                      <td><code>{request.report_id || request.id}</code><br/><span className="d68-admin-badge ok">completed</span></td>
                      <td><b>{businessName(business)}</b><br/><span>{business?.public_code || request.business_id}</span></td>
                      <td>{business?.industry || 'Đang cập nhật'}</td>
                      <td>{profileName(actor)}</td>
                      <td>{formatDate(request.completed_at || request.updated_at || request.created_at)}</td>
                      <td>{reportLanguage(request)}<br/><span className="d68-admin-badge blue">{reportGrade(request)}</span></td>
                      <td>
                        <button
                          type="button"
                          className="d68-admin-btn blue"
                          disabled={!artifact || busyAction === `report-download:${request.id}`}
                          title={artifact ? 'Tải PDF báo cáo' : 'PDF chưa được report worker ghi vào metadata'}
                          onClick={() => void handleReportDownload(request)}
                        >
                          <Download size={15} /> {busyAction === `report-download:${request.id}` ? 'Đang tải...' : 'Download'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!completedReports.length ? (
            <div className="d68-admin-empty">Chưa có báo cáo hoàn thành. Report worker/PDF ở Phiên 5 sẽ ghi dữ liệu vào danh sách này.</div>
          ) : null}
        </div>
      ) : (
        <div className="d68-admin-reports__alerts">
          {filteredAlerts.map((alert) => {
            const business = businessById.get(String(alert.business_id));
            const file = fileById.get(String(alert.business_file_id || ''));
            const authority = authorityByBusiness.get(String(alert.business_id));
            const isAuthority = AUTHORITY_CODES.has(alert.alert_code);
            return (
              <article key={alert.id} className={`d68-admin-reports__alert severity-${alert.severity}`}>
                <div className="d68-admin-reports__alert-main">
                  <div className="d68-admin-reports__alert-title">
                    <span className={`d68-admin-badge ${alert.severity === 'critical' || alert.severity === 'high' ? 'err' : 'warn'}`}>{alert.severity}</span>
                    <span className={`d68-admin-badge ${alert.status === 'resolved' ? 'ok' : alert.status === 'dismissed' ? 'blue' : 'warn'}`}>{alertStatusLabel(alert.status)}</span>
                    {alert.blocks_report ? <span className="d68-admin-badge err">Chặn báo cáo</span> : <span className="d68-admin-badge blue">Không chặn</span>}
                  </div>
                  <h3>{alert.title_vi || alert.alert_code}</h3>
                  <p><b>{businessName(business)}</b> · {business?.public_code || alert.business_id} · {alert.alert_code}</p>
                  <div className="d68-admin-reports__alert-meta">
                    <span>Phát hiện: {formatDate(alert.created_at)}</span>
                    <span>File: {file?.display_name || file?.file_name || 'Không gắn file'}</span>
                    <span>Người đăng: {authority?.listing_party_type || 'Chưa khai báo'}</span>
                    <span>Thẩm quyền: {authority?.verification_status || 'Chưa có hồ sơ'}</span>
                  </div>

                  <details>
                    <summary>Xem chi tiết</summary>
                    {alert.report_notice_vi ? <p className="d68-admin-reports__notice"><AlertTriangle size={15} />{alert.report_notice_vi}</p> : null}
                    {authority ? (
                      <dl>
                        <div><dt>Bên ủy quyền</dt><dd>{authority.declared_principal_name || authority.declared_owner_name || '—'}</dd></div>
                        <div><dt>Người được ủy quyền</dt><dd>{authority.declared_agent_name || '—'}</dd></div>
                        <div><dt>Tài sản</dt><dd>{authority.declared_asset_name || authority.declared_asset_address || '—'}</dd></div>
                        <div><dt>Hiệu lực đến</dt><dd>{authority.expires_at ? formatDate(authority.expires_at) : '—'}</dd></div>
                      </dl>
                    ) : null}
                    {Object.keys(objectOf(alert.detail_json)).length ? <pre>{JSON.stringify(alert.detail_json, null, 2)}</pre> : null}
                  </details>
                </div>

                <div className="d68-admin-reports__actions">
                  {file ? (
                    <button type="button" className="d68-admin-btn light" disabled={busyAction === `file-download:${file.id}`} onClick={() => void handleFileDownload(file, alert)}>
                      <Download size={14} /> Tải file liên quan
                    </button>
                  ) : null}
                  {['open', 'acknowledged'].includes(alert.status) ? (
                    <>
                      <button type="button" className="d68-admin-btn blue" disabled={!!busyAction} onClick={() => void runAction(`supplement:${alert.id}`, () => requestAlertSupplement(alert, adminId), 'Đã chuyển yêu cầu bổ sung tới Business.')}>Yêu cầu bổ sung</button>
                      {isAuthority && authority ? (
                        <>
                          <button type="button" className="d68-admin-btn green" disabled={!!busyAction} onClick={() => void runAction(`verify:${alert.id}`, () => verifyListingAuthority(authority, alert, adminId), 'Đã xác minh thẩm quyền và đóng các alert liên quan.')}><ShieldCheck size={14} /> Đã xác minh</button>
                          <button type="button" className="d68-admin-btn red" disabled={!!busyAction} onClick={() => void runAction(`reject:${alert.id}`, () => rejectListingAuthority(authority, alert, adminId), 'Đã đánh dấu thẩm quyền không hợp lệ.')}><ShieldX size={14} /> Không hợp lệ</button>
                        </>
                      ) : null}
                      <button type="button" className="d68-admin-btn light" disabled={!!busyAction} onClick={() => void runAction(`legal:${alert.id}`, () => sendAlertToLegalReview(alert, adminId), 'Đã chuyển alert sang luồng rà soát pháp lý.')}><Gavel size={14} /> Chuyển pháp lý</button>
                      <button type="button" className="d68-admin-btn green" disabled={!!busyAction} onClick={() => void runAction(`resolve:${alert.id}`, () => resolveAdminReportAlert(alert, adminId), 'Đã đánh dấu alert hoàn tất.')}><CheckCircle2 size={14} /> Đã xử lý</button>
                      <button type="button" className="d68-admin-btn light" disabled={!!busyAction} onClick={() => void runAction(`dismiss:${alert.id}`, () => dismissAdminReportAlert(alert, adminId), 'Đã bỏ qua alert.')}>
                        Bỏ qua
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
          {!filteredAlerts.length ? <div className="d68-admin-empty">Không có alert phù hợp bộ lọc.</div> : null}
        </div>
      )}

      <p className="d68-admin-reports__refreshed">Cập nhật gần nhất: {refreshedAt ? formatDate(refreshedAt) : '—'}</p>
    </section>
  );
}

export default function AdminReportsPortal() {
  const { profile } = useAuth();
  const location = useLocation();
  const mount = useAdminReportsMount(location.pathname);
  if (!mount || profile?.role !== 'admin' || !profile.id) return null;
  return createPortal(<AdminReportsPanel adminId={profile.id} />, mount);
}
