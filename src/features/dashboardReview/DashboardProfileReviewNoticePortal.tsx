import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getInvestorByOwner, getMyBusiness } from '../../lib/data';
import { langFromPath, stripLangPrefix } from '../../lib/i18nRoutes';
import { supabase } from '../../lib/supabase';
import './dashboard-profile-review-notice.css';

type DashboardKind = 'business' | 'investor';
type Lang = 'vi' | 'en';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

function dashboardKindFromPath(pathname: string): DashboardKind | null {
  const path = stripLangPrefix(pathname).replace(/\/$/, '');
  if (path === '/dashboard/business' || path === '/dashboard/business/overview') {
    return 'business';
  }
  if (
    path === '/dashboard/investor' ||
    path === '/dashboard/investor/profile' ||
    path === '/dashboard/investor/overview'
  ) {
    return 'investor';
  }
  return null;
}

function useNoticeMount(kind: DashboardKind | null, pathname: string) {
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!kind) {
      setMount(null);
      return undefined;
    }

    const node = document.createElement('div');
    node.className = 'd68-dashboard-profile-review-mount';
    const pageClass = kind === 'business'
      ? '.d68-business-dashboard-page'
      : '.d68-investor-dashboard-page';
    let observer: MutationObserver | null = null;

    const attach = () => {
      const header = document.querySelector<HTMLElement>(
        `${pageClass} .d68-dashboard-wrap > .d68-dashboard-head`,
      );
      if (!header?.parentNode) return false;
      header.parentNode.insertBefore(node, header.nextSibling);
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
  }, [kind, pathname]);

  return mount;
}

function isPubliclyApproved(kind: DashboardKind, subject: any) {
  if (kind === 'business') return Boolean(subject?.public_snapshot_json);
  return Boolean(
    subject?.visible === true &&
    String(subject?.status || '').toLowerCase() === 'active',
  );
}

export default function DashboardProfileReviewNoticePortal() {
  const { profile } = useAuth();
  const location = useLocation();
  const lang = langFromPath(location.pathname) as Lang;
  const kind = useMemo(
    () => dashboardKindFromPath(location.pathname),
    [location.pathname],
  );
  const mount = useNoticeMount(kind, location.pathname);
  const [subject, setSubject] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!kind || !profile?.id || profile.role !== kind) {
      setSubject(null);
      setLoaded(true);
      return;
    }

    try {
      const nextSubject = kind === 'business'
        ? await getMyBusiness(profile.id)
        : await getInvestorByOwner(profile.id);
      setSubject(nextSubject || null);
    } catch {
      setSubject(null);
    } finally {
      setLoaded(true);
    }
  }, [kind, profile?.id, profile?.role]);

  useEffect(() => {
    setLoaded(false);
    setSubject(null);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!kind || !profile?.id || profile.role !== kind) return undefined;

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [kind, profile?.id, profile?.role, refresh]);

  useEffect(() => {
    if (!kind || !subject?.id || profile?.role !== kind) return undefined;
    const table = kind === 'business' ? 'businesses' : 'investors';
    const channel = supabase
      .channel(`dashboard-profile-review-${kind}-${subject.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table,
          filter: `id=eq.${subject.id}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [kind, profile?.role, refresh, subject?.id]);

  const shouldShow = Boolean(
    mount &&
    loaded &&
    kind &&
    subject?.id &&
    profile?.role === kind &&
    !isPubliclyApproved(kind, subject),
  );

  if (!shouldShow || !mount) return null;

  return createPortal(
    <div
      className="d68-dashboard-notice d68-dashboard-profile-review-alert"
      role="status"
      aria-live="polite"
    >
      {T(
        lang,
        'Hồ sơ đang được kiểm duyệt, vui lòng đợi 1 đến 3 ngày làm việc',
        'Your profile is under review. Please allow 1 to 3 business days.',
      )}
    </div>,
    mount,
  );
}
