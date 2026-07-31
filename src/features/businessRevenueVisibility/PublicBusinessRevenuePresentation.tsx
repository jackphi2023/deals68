import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import type { Lang } from '../../lib/i18n';
import { loadHomePublicData } from '../../lib/homePublicData';
import { stripLangPrefix } from '../../lib/i18nRoutes';
import { formatMoneyForLang } from '../../lib/labels';
import './public-business-revenue-presentation.css';

type RevenueHost = {
  slug: string;
  node: HTMLElement;
  value: string;
};

function slugFromHref(href: string) {
  if (typeof window === 'undefined') return '';
  try {
    const url = new URL(href, window.location.origin);
    const path = stripLangPrefix(url.pathname);
    const prefix = '/businesses/';
    if (!path.startsWith(prefix)) return '';
    return decodeURIComponent(path.slice(prefix.length)).replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function hostsAreEqual(current: RevenueHost[], next: RevenueHost[]) {
  return (
    current.length === next.length &&
    current.every(
      (item, index) =>
        item.node === next[index]?.node && item.value === next[index]?.value,
    )
  );
}

export default function PublicBusinessRevenuePresentation() {
  const location = useLocation();
  const lang: Lang = location.pathname.startsWith('/en') ? 'en' : 'vi';
  const homePath = stripLangPrefix(location.pathname) === '/';
  const [revenueBySlug, setRevenueBySlug] = useState<Record<string, string>>({});
  const [hosts, setHosts] = useState<RevenueHost[]>([]);

  useEffect(() => {
    let active = true;
    setRevenueBySlug({});

    if (!homePath) {
      return () => {
        active = false;
      };
    }

    void loadHomePublicData()
      .then((data) => {
        if (!active) return;
        const next: Record<string, string> = {};

        for (const row of data.businesses || []) {
          const slug = String(row?.slug || '').trim();
          const revenue = Number(row?.revenue_2025);
          if (!slug || row?.revenue_2025 === null || row?.revenue_2025 === undefined) continue;
          if (!Number.isFinite(revenue)) continue;

          next[slug] = formatMoneyForLang(
            revenue,
            row?.revenue_currency || 'VND',
            lang,
          );
        }

        setRevenueBySlug(next);
      })
      .catch(() => {
        if (active) setRevenueBySlug({});
      });

    return () => {
      active = false;
    };
  }, [homePath, lang]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    function clearPresentation() {
      document
        .querySelectorAll<HTMLElement>('[data-d68-home-public-revenue-slot]')
        .forEach((node) => node.remove());
      document
        .querySelectorAll<HTMLElement>(
          '.d68-home-business-card__metrics strong.d68-has-public-revenue',
        )
        .forEach((strong) => {
          strong.classList.remove('d68-has-public-revenue');
          strong
            .querySelector<HTMLElement>('.d68-sensitive-financial')
            ?.removeAttribute('aria-hidden');
        });
    }

    if (!homePath) {
      clearPresentation();
      setHosts([]);
      return clearPresentation;
    }

    function scanCards() {
      const next: RevenueHost[] = [];

      document
        .querySelectorAll<HTMLAnchorElement>('.d68-home-business-card[href]')
        .forEach((card) => {
          const slug = slugFromHref(card.getAttribute('href') || '');
          const value = revenueBySlug[slug];
          const strong = card.querySelector<HTMLElement>(
            '.d68-home-business-card__metrics > div:first-child > strong',
          );
          if (!strong) return;

          const sensitive = strong.querySelector<HTMLElement>(
            '.d68-sensitive-financial',
          );
          let host = strong.querySelector<HTMLElement>(
            '[data-d68-home-public-revenue-slot]',
          );

          if (!value) {
            host?.remove();
            strong.classList.remove('d68-has-public-revenue');
            sensitive?.removeAttribute('aria-hidden');
            return;
          }

          strong.classList.add('d68-has-public-revenue');
          sensitive?.setAttribute('aria-hidden', 'true');

          if (!host) {
            host = document.createElement('span');
            host.className = 'd68-home-public-revenue-slot';
            host.dataset.d68HomePublicRevenueSlot = slug;
            strong.appendChild(host);
          }

          next.push({ slug, node: host, value });
        });

      setHosts((current) => (hostsAreEqual(current, next) ? current : next));
    }

    scanCards();
    const observer = new MutationObserver(scanCards);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      clearPresentation();
    };
  }, [homePath, revenueBySlug]);

  return (
    <>
      {hosts.map((host, index) =>
        createPortal(host.value, host.node, `${host.slug}:${index}`),
      )}
    </>
  );
}
