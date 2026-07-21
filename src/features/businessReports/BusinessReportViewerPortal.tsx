import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, LoaderCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getMyBusiness } from '../../lib/data';
import { langFromPath, stripLangPrefix } from '../../lib/i18nRoutes';
import {
  getBusinessReportFreshness,
  getBusinessReportStatus,
  getCachedBusinessReportContent,
  getLatestBusinessReport,
} from './reportApi';
import { reportErrorText, T } from './reportCore';
import type {
  BusinessReportArtifact,
  ReportContent,
  ReportFreshness,
  ReportLang,
} from './reportTypes';

const ReportViewer = lazy(() => import('./ReportViewer'));

function useViewerMount(pathname: string) {
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const route = stripLangPrefix(pathname).replace(/\/$/, '');
    const supported =
      route === '/dashboard/business' ||
      route === '/dashboard/business/files' ||
      route === '/dashboard/business/documents';
    if (!supported) {
      setMount(null);
      return undefined;
    }

    const node = document.createElement('div');
    node.className = 'd68-business-report-viewer-portal-mount';
    let observer: MutationObserver | null = null;

    const attach = () => {
      const panelMount = document.querySelector<HTMLElement>('.d68-business-report-portal-mount');
      if (!panelMount?.parentNode) return false;
      panelMount.parentNode.insertBefore(node, panelMount.nextSibling);
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
      node.remove();
      setMount(null);
    };
  }, [pathname]);

  return mount;
}

function InlineViewer({ business, lang }: { business: any; lang: ReportLang }) {
  const [artifact, setArtifact] = useState<BusinessReportArtifact | null>(null);
  const [content, setContent] = useState<ReportContent | null>(null);
  const [freshness, setFreshness] = useState<ReportFreshness>({ stale: false });
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async (openAfterRefresh = false) => {
    if (!business?.id) return;
    setLoading(true);
    setError('');
    try {
      const [nextArtifact, nextStatus] = await Promise.all([
        getLatestBusinessReport(business.id),
        getBusinessReportStatus(business.id),
      ]);
      setArtifact(nextArtifact);
      if (!nextArtifact) {
        setContent(null);
        setFreshness({ stale: false });
        setExpanded(false);
        return;
      }
      const nextFreshness = await getBusinessReportFreshness({
        businessId: business.id,
        artifact: nextArtifact,
        preflight: nextStatus.latest_preflight || null,
        businessUpdatedAt: business.updated_at || business.pending_submitted_at || null,
      });
      setFreshness(nextFreshness);
      if (openAfterRefresh) setExpanded(true);
    } catch (nextError) {
      setError(reportErrorText(
        nextError,
        lang,
        'Không tải được báo cáo mới nhất.',
        'Could not load the latest report.',
      ));
    } finally {
      setLoading(false);
    }
  }, [business?.id, business?.pending_submitted_at, business?.updated_at, lang]);

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  useEffect(() => {
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ businessId?: string }>).detail;
      if (!detail?.businessId || detail.businessId === business?.id) {
        void refresh(true);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh(false);
    };
    window.addEventListener('d68:business-report-updated', onUpdated);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('d68:business-report-updated', onUpdated);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [business?.id, refresh]);

  useEffect(() => {
    if (!expanded || !artifact?.id || content) return;
    let active = true;
    setContentLoading(true);
    setError('');
    getCachedBusinessReportContent(business.id, artifact.id)
      .then((nextContent) => {
        if (!active) return;
        if (!nextContent) {
          setError(T(lang, 'Không đọc được nội dung báo cáo.', 'Could not read the report content.'));
          return;
        }
        setContent(nextContent);
      })
      .catch((nextError) => {
        if (active) {
          setError(reportErrorText(
            nextError,
            lang,
            'Không đọc được nội dung báo cáo.',
            'Could not read the report content.',
          ));
        }
      })
      .finally(() => {
        if (active) setContentLoading(false);
      });
    return () => {
      active = false;
    };
  }, [artifact?.id, business.id, content, expanded, lang]);

  useEffect(() => {
    setContent(null);
  }, [artifact?.id]);

  if (loading && !artifact) {
    return (
      <div className="d68-report-viewer-shell">
        <p className="d68-report-viewer-shell__status">
          {T(lang, 'Đang kiểm tra báo cáo mới nhất...', 'Checking the latest report...')}
        </p>
      </div>
    );
  }
  if (!artifact) return null;

  return (
    <section className="d68-report-viewer-shell" aria-label={T(lang, 'Nội dung báo cáo', 'Report content')}>
      <button
        type="button"
        className="d68-report-viewer-shell__toggle"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        {contentLoading ? (
          <LoaderCircle size={16} className="d68-business-report-panel__spinner" aria-hidden="true" />
        ) : expanded ? (
          <ChevronUp size={16} aria-hidden="true" />
        ) : (
          <ChevronDown size={16} aria-hidden="true" />
        )}
        {expanded
          ? T(lang, 'Thu gọn báo cáo', 'Collapse report')
          : T(lang, 'Xem báo cáo trực tiếp', 'View report inline')}
      </button>

      {error ? <p className="d68-report-viewer-shell__status error">{error}</p> : null}
      {expanded && content ? (
        <Suspense fallback={(
          <p className="d68-report-viewer-shell__status">
            {T(lang, 'Đang mở báo cáo...', 'Opening report...')}
          </p>
        )}>
          <ReportViewer
            content={content}
            artifact={artifact}
            lang={lang}
            audience="business_owner"
            stale={freshness.stale}
          />
        </Suspense>
      ) : null}
    </section>
  );
}

export default function BusinessReportViewerPortal() {
  const { profile } = useAuth();
  const location = useLocation();
  const lang = langFromPath(location.pathname) as ReportLang;
  const mount = useViewerMount(location.pathname);
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
  return createPortal(<InlineViewer business={business} lang={lang} />, mount);
}
