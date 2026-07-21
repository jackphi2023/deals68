import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, Download, FileSearch, LoaderCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getMyBusiness } from '../../lib/data';
import {
  langFromPath,
  stripLangPrefix,
  toLocalizedPath,
} from '../../lib/i18nRoutes';
import {
  getBusinessReportRateStatus,
  getBusinessReportStatus,
  listBusinessReportAlerts,
  runBusinessReportPreflight,
} from './reportApi';
import type {
  BusinessReportAlert,
  BusinessReportStatus,
  ReportLang,
  ReportMessageItem,
  ReportPreflight,
  ReportRateStatus,
} from './reportTypes';
import './business-report-panel.css';

type PanelMode =
  | 'loading'
  | 'idle'
  | 'checking'
  | 'processing'
  | 'blocked'
  | 'ready'
  | 'error';

const T = (lang: ReportLang, vi: string, en: string) =>
  lang === 'en' ? en : vi;

function messageText(item: ReportMessageItem | string, lang: ReportLang) {
  if (typeof item === 'string') return item.replaceAll('_', ' ');
  return lang === 'en'
    ? item.message_en || item.message_vi || item.code || ''
    : item.message_vi || item.message_en || item.code || '';
}

function alertText(alert: BusinessReportAlert, lang: ReportLang) {
  return lang === 'en'
    ? alert.title_en || alert.title_vi || alert.alert_code || ''
    : alert.title_vi || alert.title_en || alert.alert_code || '';
}

function formatRetry(seconds: number, lang: ReportLang) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return T(
    lang,
    `Bạn có thể thực hiện lại sau khoảng ${minutes} phút.`,
    `You can try again in about ${minutes} minute(s).`,
  );
}

function useReportMount(pathname: string) {
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const route = stripLangPrefix(pathname).replace(/\/$/, '');
    const isOverview = route === '/dashboard/business';
    const isDocuments =
      route === '/dashboard/business/files' ||
      route === '/dashboard/business/documents';

    if (!isOverview && !isDocuments) {
      setMount(null);
      return undefined;
    }

    const node = document.createElement('div');
    node.className = 'd68-business-report-portal-mount';
    node.dataset.reportPanelMount = isOverview ? 'overview' : 'documents';

    let observer: MutationObserver | null = null;
    let attached = false;

    const attach = () => {
      const section = document.querySelector<HTMLElement>(
        '.d68-business-dashboard-page .d68-dashboard-cols > section',
      );
      if (!section) return false;

      if (isOverview) {
        const metrics = section.querySelector<HTMLElement>(
          '.d68-business-overview-metrics',
        );
        if (!metrics) return false;
        section.insertBefore(node, metrics);
      } else {
        section.insertBefore(node, section.firstChild);
      }

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

function PanelAction({
  children,
  disabled,
  inactive,
  onClick,
  lang,
}: {
  children: ReactNode;
  disabled: boolean;
  inactive: boolean;
  onClick: () => void;
  lang: ReportLang;
}) {
  const tooltip = inactive
    ? T(
        lang,
        'Bạn chưa sử dụng được do chưa được kích hoạt hồ sơ.',
        'This feature is unavailable because your profile has not been activated.',
      )
    : '';

  return (
    <span
      className="d68-business-report-panel__action-wrap"
      data-tooltip={tooltip || undefined}
      tabIndex={inactive ? 0 : -1}
    >
      <button
        type="button"
        className="d68-business-report-panel__button"
        disabled={disabled}
        onClick={onClick}
        aria-label={T(lang, 'Tải báo cáo', 'Download report')}
      >
        {children}
      </button>
    </span>
  );
}

function BusinessReportPanel({ business, lang }: { business: any; lang: ReportLang }) {
  const [mode, setMode] = useState<PanelMode>('loading');
  const [status, setStatus] = useState<BusinessReportStatus>({});
  const [rateStatus, setRateStatus] = useState<ReportRateStatus>({});
  const [preflight, setPreflight] = useState<ReportPreflight | null>(null);
  const [alerts, setAlerts] = useState<BusinessReportAlert[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  const active = Boolean(
    business?.visible &&
      String(business?.status || '').toLowerCase() === 'active' &&
      business?.public_snapshot_json,
  );

  const refresh = useCallback(async () => {
    if (!business?.id) return;
    setMode('loading');
    setErrorMessage('');

    try {
      const [nextStatus, nextRate, nextAlerts] = await Promise.all([
        getBusinessReportStatus(business.id),
        getBusinessReportRateStatus(business.id),
        listBusinessReportAlerts(business.id),
      ]);

      setStatus(nextStatus);
      setRateStatus(nextRate);
      setAlerts(nextAlerts);
      setPreflight(nextStatus.latest_preflight || null);

      if (nextStatus.active_request_id || nextStatus.reason === 'REPORT_IN_PROGRESS') {
        setMode('processing');
      } else if (nextStatus.latest_preflight?.allow_report === false) {
        setMode('blocked');
      } else {
        setMode('idle');
      }
    } catch (error: any) {
      setMode('error');
      setErrorMessage(
        error?.message ||
          T(lang, 'Không tải được trạng thái báo cáo.', 'Could not load report status.'),
      );
    }
  }, [business?.id, lang]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (mode !== 'processing') return undefined;
    const timer = window.setInterval(() => void refresh(), 12_000);
    return () => window.clearInterval(timer);
  }, [mode, refresh]);

  const generateRate = rateStatus.generate;
  const rateLimited = active && generateRate?.allowed === false;
  const inactive = !active;
  const busy = mode === 'loading' || mode === 'checking' || mode === 'processing';
  const disabled = inactive || busy || rateLimited;

  const primaryBlocking = useMemo(() => {
    const candidates = [
      ...(preflight?.blocking || []),
      ...(preflight?.missing || []),
    ];
    return candidates.map((item) => messageText(item, lang)).find(Boolean) || '';
  }, [preflight, lang]);

  const notice = useMemo(() => {
    if (!preflight?.authority_notice_required) return '';
    return lang === 'en'
      ? preflight.authority_notice_en || preflight.authority_notice_vi || ''
      : preflight.authority_notice_vi || preflight.authority_notice_en || '';
  }, [preflight, lang]);

  const metadata = (() => {
    if (inactive) {
      return T(
        lang,
        'Hồ sơ cần được kích hoạt và hiển thị trước khi sử dụng báo cáo.',
        'The profile must be activated and visible before reports can be used.',
      );
    }
    if (mode === 'loading') {
      return T(lang, 'Đang kiểm tra trạng thái báo cáo...', 'Checking report status...');
    }
    if (mode === 'checking') {
      return T(lang, 'Đang kiểm tra dữ liệu hồ sơ...', 'Checking profile data...');
    }
    if (mode === 'processing') {
      return T(lang, 'Đang tạo báo cáo...', 'Creating report...');
    }
    if (mode === 'error') return errorMessage;
    if (mode === 'blocked') {
      return (
        primaryBlocking ||
        T(
          lang,
          'Chưa đủ điều kiện tạo báo cáo. Vui lòng bổ sung dữ liệu và tài liệu theo cảnh báo bên dưới.',
          'The report requirements are not met. Add the data and documents listed below.',
        )
      );
    }
    if (rateLimited) {
      return formatRetry(Number(generateRate?.retry_after_seconds || 3600), lang);
    }
    if (mode === 'ready') {
      return T(
        lang,
        'Hồ sơ đã đủ điều kiện tiền kiểm tra. Dịch vụ sinh báo cáo/PDF sẽ được kết nối ở phiên xử lý tiếp theo.',
        'The profile passed preflight. Report/PDF generation will be connected in the next processing phase.',
      );
    }
    return T(
      lang,
      'Bạn có thể tạo tối đa 01 báo cáo và tải tối đa 01 lần trong mỗi 60 phút.',
      'You can create up to 1 report and download up to 1 time in each 60-minute window.',
    );
  })();

  async function handleReportAction() {
    if (!business?.id || disabled) return;
    setMode('checking');
    setErrorMessage('');

    try {
      const nextPreflight = await runBusinessReportPreflight(business.id);
      setPreflight(nextPreflight);

      const [nextRate, nextAlerts] = await Promise.all([
        getBusinessReportRateStatus(business.id),
        listBusinessReportAlerts(business.id),
      ]);
      setRateStatus(nextRate);
      setAlerts(nextAlerts);

      if (!nextPreflight.allow_report) {
        setMode('blocked');
        return;
      }

      // Phase 3 intentionally stops after deterministic preflight. It does not
      // reserve a report job until the report worker/PDF service is available.
      setMode('ready');
    } catch (error: any) {
      setMode('error');
      setErrorMessage(
        error?.message ||
          T(lang, 'Không thể kiểm tra điều kiện tạo báo cáo.', 'Could not check report eligibility.'),
      );
    }
  }

  const metadataClass =
    mode === 'error' || mode === 'blocked'
      ? 'error'
      : mode === 'ready'
        ? 'success'
        : '';

  const visibleAlerts = alerts.slice(0, 5);

  return (
    <section className="d68-business-report-panel" aria-labelledby="d68-business-report-title">
      <div className="d68-business-report-panel__content">
        <div className="d68-business-report-panel__heading">
          <FileSearch size={22} aria-hidden="true" />
          <div>
            <h2 id="d68-business-report-title">
              {T(lang, 'Xem Báo cáo Tối ưu Hồ sơ DN', 'View Business Profile Optimization Report')}
            </h2>
            <p>
              {T(
                lang,
                'Phân tích thông tin hồ sơ, số liệu tài chính và các tài liệu doanh nghiệp đã cung cấp.',
                'Analyze profile information, financial data and documents provided by the Business.',
              )}
            </p>
          </div>
        </div>

        <div
          className={`d68-business-report-panel__meta ${metadataClass}`}
          aria-live="polite"
        >
          {mode === 'processing' || mode === 'checking' || mode === 'loading' ? (
            <LoaderCircle size={14} className="d68-business-report-panel__spinner" />
          ) : null}
          <span>{metadata}</span>
        </div>

        {notice ? (
          <div className="d68-business-report-panel__authority-notice">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{notice}</span>
          </div>
        ) : null}

        {visibleAlerts.length ? (
          <div className="d68-business-report-panel__alerts">
            <strong>{T(lang, 'Cần bổ sung hoặc xác minh', 'Information to add or verify')}</strong>
            <ul>
              {visibleAlerts.map((alert) => (
                <li key={alert.id} className={alert.blocks_report ? 'blocking' : ''}>
                  {alertText(alert, lang)}
                </li>
              ))}
            </ul>
            <Link to={toLocalizedPath('/dashboard/business/files', lang)}>
              {T(lang, 'Mở Tài liệu Dataroom để bổ sung', 'Open Dataroom Documents to add files')} →
            </Link>
          </div>
        ) : null}
      </div>

      <PanelAction
        disabled={disabled}
        inactive={inactive}
        onClick={handleReportAction}
        lang={lang}
      >
        {busy ? (
          <LoaderCircle size={18} className="d68-business-report-panel__spinner" />
        ) : (
          <Download size={18} aria-hidden="true" />
        )}
        <span>
          {mode === 'processing'
            ? T(lang, 'Đang tạo báo cáo...', 'Creating report...')
            : mode === 'checking'
              ? T(lang, 'Đang kiểm tra...', 'Checking...')
              : T(lang, 'Tải báo cáo', 'Download report')}
        </span>
      </PanelAction>
    </section>
  );
}

export default function BusinessReportPanelPortal() {
  const { profile } = useAuth();
  const location = useLocation();
  const lang = langFromPath(location.pathname) as ReportLang;
  const mount = useReportMount(location.pathname);
  const [business, setBusiness] = useState<any>(null);

  useEffect(() => {
    let active = true;
    if (!profile?.id || (profile.role !== 'business' && profile.role !== 'admin')) {
      setBusiness(null);
      return undefined;
    }

    getMyBusiness(profile.id)
      .then((row) => {
        if (active) setBusiness(row || null);
      })
      .catch(() => {
        if (active) setBusiness(null);
      });

    return () => {
      active = false;
    };
  }, [profile?.id, profile?.role]);

  if (!mount || !business?.id) return null;
  return createPortal(<BusinessReportPanel business={business} lang={lang} />, mount);
}
