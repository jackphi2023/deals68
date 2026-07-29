import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getMyBusiness } from '../../lib/data';
import { stripLangPrefix } from '../../lib/i18nRoutes';
import { invalidatePublicQueryCache } from '../../lib/publicQueryCache';
import { supabase } from '../../lib/supabase';
import './business-public-revenue-controls.css';

type Lang = 'vi' | 'en';

const T = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);

function isBusinessProfilePath(pathname: string) {
  return stripLangPrefix(pathname) === '/dashboard/business/profile';
}

function isPricingPath(pathname: string) {
  return stripLangPrefix(pathname) === '/pricing';
}

export default function BusinessPublicRevenueControls() {
  const { profile } = useAuth();
  const location = useLocation();
  const lang: Lang = location.pathname.startsWith('/en') ? 'en' : 'vi';
  const businessProfilePath = isBusinessProfilePath(location.pathname);
  const pricingPath = isPricingPath(location.pathname);

  const [business, setBusiness] = useState<any>(null);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dashboardHost, setDashboardHost] = useState<HTMLElement | null>(null);
  const [pricingHost, setPricingHost] = useState<HTMLElement | null>(null);
  const dashboardHostRef = useRef<HTMLElement | null>(null);
  const pricingHostRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBusiness() {
      setBusiness(null);
      setChecked(false);
      setMessage('');
      setError('');
      if (!businessProfilePath || profile?.role !== 'business' || !profile.id) return;

      setLoading(true);
      try {
        const row = await getMyBusiness(profile.id);
        if (!active) return;
        setBusiness(row || null);
        setChecked(row?.revenue_public_visible === true);
      } catch (loadError: any) {
        if (active) {
          setError(
            loadError?.message ||
              T(lang, 'Không tải được cài đặt hiển thị doanh thu.', 'Could not load the revenue visibility setting.'),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadBusiness();
    return () => {
      active = false;
    };
  }, [businessProfilePath, lang, profile?.id, profile?.role]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    function removeDashboardHost() {
      dashboardHostRef.current?.remove();
      dashboardHostRef.current = null;
      setDashboardHost(null);
    }

    function removePricingHost() {
      pricingHostRef.current?.remove();
      pricingHostRef.current = null;
      setPricingHost(null);
    }

    function ensureDashboardHost() {
      if (!businessProfilePath || profile?.role !== 'business') {
        removeDashboardHost();
        return;
      }

      const grid = document.querySelector<HTMLElement>('.d68-business-financial-fields');
      if (!grid) return;
      const existing = dashboardHostRef.current;
      if (existing?.isConnected && grid.contains(existing)) return;

      existing?.remove();
      const host = document.createElement('div');
      host.className = 'd68-business-revenue-public-slot';
      host.dataset.businessRevenuePublicControl = 'true';
      const nextField = grid.children.item(5);
      grid.insertBefore(host, nextField || null);
      dashboardHostRef.current = host;
      setDashboardHost(host);
    }

    function ensurePricingHost() {
      if (!pricingPath) {
        removePricingHost();
        return;
      }

      const list = document.querySelector<HTMLElement>(
        '.d68-pricing-plans > div > article:first-child ul',
      );
      if (!list) return;
      const existing = pricingHostRef.current;
      if (existing?.isConnected && list.contains(existing)) return;

      existing?.remove();
      const host = document.createElement('li');
      host.className = 'd68-business-unlimited-investor-connections';
      host.dataset.businessUnlimitedConnections = 'true';
      list.insertBefore(host, list.lastElementChild);
      pricingHostRef.current = host;
      setPricingHost(host);
    }

    const ensureHosts = () => {
      ensureDashboardHost();
      ensurePricingHost();
    };

    ensureHosts();
    const observer = new MutationObserver(ensureHosts);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      removeDashboardHost();
      removePricingHost();
    };
  }, [businessProfilePath, pricingPath, profile?.role]);

  async function setPublicVisibility(next: boolean) {
    if (!business?.id || !profile?.id || saving) return;

    const previous = checked;
    setChecked(next);
    setSaving(true);
    setMessage('');
    setError('');

    const { data, error: updateError } = await supabase
      .from('businesses')
      .update({ revenue_public_visible: next })
      .eq('id', business.id)
      .eq('owner_id', profile.id)
      .select('id,revenue_public_visible')
      .single();

    if (updateError) {
      setChecked(previous);
      setError(
        updateError.message ||
          T(lang, 'Không cập nhật được quyền hiển thị doanh thu.', 'Could not update revenue visibility.'),
      );
    } else {
      const saved = data?.revenue_public_visible === true;
      setChecked(saved);
      setBusiness((current: any) => ({ ...current, revenue_public_visible: saved }));
      invalidatePublicQueryCache();
      setMessage(
        saved
          ? T(
              lang,
              'Doanh thu năm đang được hiển thị công khai.',
              'Annual revenue is now publicly visible.',
            )
          : T(
              lang,
              'Doanh thu năm đã được ẩn khỏi các trang công khai.',
              'Annual revenue is now hidden from public pages.',
            ),
      );
    }

    setSaving(false);
  }

  return (
    <>
      {dashboardHost
        ? createPortal(
            <div className="d68-dashboard-field d68-business-revenue-public-field">
              <span>{T(lang, 'Quyền hiển thị', 'Visibility')}</span>
              <label className="d68-business-revenue-public-check">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={loading || saving || !business}
                  onChange={(event) => void setPublicVisibility(event.target.checked)}
                />
                <strong>{T(lang, 'Hiển thị công khai', 'Show publicly')}</strong>
              </label>
              <small>
                {saving
                  ? T(lang, 'Đang cập nhật...', 'Updating...')
                  : T(
                      lang,
                      'Áp dụng ngay, không cần Admin duyệt.',
                      'Applies immediately without Admin approval.',
                    )}
              </small>
              {message ? <em className="is-success">{message}</em> : null}
              {error ? <em className="is-error">{error}</em> : null}
            </div>,
            dashboardHost,
          )
        : null}
      {pricingHost
        ? createPortal(
            <>
              ✓{' '}
              {T(
                lang,
                'Không giới hạn nhận kết nối từ Nhà đầu tư',
                'Unlimited incoming connections from Investors',
              )}
            </>,
            pricingHost,
          )
        : null}
    </>
  );
}
