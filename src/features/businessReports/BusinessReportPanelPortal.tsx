import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  Download,
  FilePlus2,
  FileSearch,
  LoaderCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getMyBusiness } from '../../lib/data';
import {
  langFromPath,
  stripLangPrefix,
  toLocalizedPath,
} from '../../lib/i18nRoutes';
import {
  downloadBusinessReport,
  generateBusinessReport,
  getBusinessReportRateStatus,
  getBusinessReportStatus,
  getLatestBusinessReport,
  listBusinessReportAlerts,
  runBusinessReportPreflight,
} from './reportApi';
import type {
  BusinessReportAlert,
  BusinessReportArtifact,
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
  | 'downloading'
  | 'completed'
  | 'blocked'
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

function formatDate(value: string | null | undefined, lang: ReportLang) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
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
  variant = 'primary',
  ariaLabel,
}: {
  children: ReactNode;
  disabled: boolean;
  inactive: boolean;
  onClick: () => void;
  lang: ReportLang;
  variant?: 'primary' | 'secondary';
  ariaLabel: string;
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
        className={`d68-business-report-panel__button ${variant === 'secondary' ? 'secondary' : ''}`}
        disabled={disabled}
        onClick={onClick}
        aria-label={ariaLabel}
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
  const [latestReport, setLatestReport] = useState<BusinessReportArtifact | null>(null);
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
      const [nextStatus, nextRate, nextAlerts, nextReport] = await Promise.all([
        getBusinessReportStatus(business.id),
        getBusinessReportRateStatus(business.id),
        listBusinessReportAlerts(business.id),
        getLatestBusinessReport(business.id),
      ]);

      setStatus(nextStatus);
      setRateStatus(nextRate);
      setAlerts(nextAlerts);
      setLatestReport(nextReport);
      setPreflight(nextStatus.latest_preflight || null);

      if (nextStatus.active_request_id || nextStatus.reason === 'REPORT_IN_PROGRESS') {
        setMode('processing');
      } else if (nextStatus.latest_preflight?.allow_report === false) {
        setMode('blocked');
      } else if (nextReport?.id) {
        setMode('completed');
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
  const downloadRate = rateStatus.download;
  const generateLimited = active && generateRate?.allowed === false;
  const downloadLimited = active && downloadRate?.allowed === false;
  const inactive = !active;
  const generating = mode === 'loading' || mode === 'checking' || mode === 'processing';
  const downloading = mode === 'downloading';

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
      return T(lang, 'Đang tạo báo cáo và file PDF...', 'Creating the report and PDF...');
    }
    if (mode === 'downloading') {
      return T(lang, 'Đang chuẩn bị file tải xuống...', 'Preparing the report download...');
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
    if (latestReport?.id) {
      const created = formatDate(latestReport.generated_at, lang);
      const modeLabel = latestReport.generator_mode === 'openai_assisted'
        ? T(lang, 'AI hỗ trợ', 'AI-assisted')
        : T(lang, 'phân tích theo dữ liệu nguồn', 'source-grounded analysis');
      return T(
        lang,
        `Báo cáo đã sẵn sàng${created ? ` · ${created}` : ''} · ${modeLabel}. Nguồn file: Deals68 AI Report.`,
        `The report is ready${created ? ` · ${created}` : ''} · ${modeLabel}. File source: Deals68 AI Report.`,
      );
    }
    if (generateLimited) {
      return formatRetry(Number(generateRate?.retry_after_seconds || 3600), lang);
    }
    return T(
      lang,
      'Bạn có thể tạo tối đa 01 báo cáo và tải tối đa 01 lần trong mỗi 60 phút.',
      'You can create up to 1 report and download up to 1 time in each 60-minute window.',
    );
  })();

  async function handleGenerate() {
    if (!business?.id || inactive || generating || generateLimited) return;
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

      if (nextRate.generate?.allowed === false) {
        setMode(latestReport?.id ? 'completed' : 'idle');
        return;
      }

      setMode('processing');
      const generated = await generateBusinessReport(business.id, lang);
      if (!generated.ok) throw Object.assign(new Error(generated.message || generated.error), generated);
      await refresh();
    } catch (error: any) {
      setMode('error');
      setErrorMessage(
        error?.message ||
          T(lang, 'Không thể tạo báo cáo.', 'Could not generate the report.'),
      );
    }
  }

  async function handleDownload() {
    if (!business?.id || !latestReport?.id || inactive || downloading || downloadLimited) return;
    setMode('downloading');
    setErrorMessage('');

    try {
      await downloadBusinessReport(business.id, latestReport);
      await refresh();
    } catch (error: any) {
      setMode('error');
      setErrorMessage(
        error?.message ||
          T(lang, 'Không thể tải báo cáo.', 'Could not download the report.'),
      );
    }
  }

  const metadataClass =
    mode === 'error' || mode === 'blocked'
      ? 'error'
      : mode === 'completed'
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
          {generating || downloading ? (
            <LoaderCircle size={14} className="d68-business-report-panel__spinner" />
          ) : null}
          <span>{metadata}</span>
        </div>

        {latestReport?.source_label ? (
          <div className="d68-business-report-panel__source">
            {T(lang, 'Nguồn file báo cáo', 'Report file source')}: <b>{latestReport.source_label}</b>
          </div>
        ) : null}

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

      <div className="d68-business-report-panel__actions">
        {latestReport?.id ? (
          <PanelAction
            disabled={inactive || downloading || generating || downloadLimited}
            inactive={inactive}
            onClick={handleDownload}
            lang={lang}
            ariaLabel={T(lang, 'Tải báo cáo', 'Download report')}
          >
            {downloading ? (
              <LoaderCircle size={18} className="d68-business-report-panel__spinner" />
            ) : (
              <Download size={18} aria-hidden="true" />
            )}
            <span>
              {downloading
                ? T(lang, 'Đang tải...', 'Downloading...')
                : T(lang, 'Tải báo cáo', 'Download report')}
            </span>
          </PanelAction>
        ) : null}

        <PanelAction
          disabled={inactive || generating || downloading || generateLimited}
          inactive={inactive}
          onClick={handleGenerate}
          lang={lang}
          variant={latestReport?.id ? 'secondary' : 'primary'}
          ariaLabel={T(lang, latestReport?.id ? 'Tạo báo cáo mới' : 'Tạo báo cáo', latestReport?.id ? 'Generate new report' : 'Generate report')}
        >
          {generating ? (
            <LoaderCircle size={18} className="d68-business-report-panel__spinner" />
          ) : (
            <FilePlus2 size={18} aria-hidden="true" />
          )}
          <span>
            {mode === 'processing'
              ? T(lang, 'Đang tạo báo cáo...', 'Creating report...')
              : mode === 'checking'
                ? T(lang, 'Đang kiểm tra...', 'Checking...')
                : T(
                    lang,
                    latestReport?.id ? 'Tạo báo cáo mới' : 'Tạo báo cáo',
                    latestReport?.id ? 'Generate new report' : 'Generate report',
                  )}
          </span>
        </PanelAction>

        {downloadLimited && latestReport?.id ? (
          <small>{formatRetry(Number(downloadRate?.retry_after_seconds || 3600), lang)}</small>
        ) : null}
      </div>
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
