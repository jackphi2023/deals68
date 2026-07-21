import { type ReactNode, useEffect, useState } from 'react';
import type { Lang } from '../lib/i18n';
import {
  listSiteBanners,
  type SiteBanner,
} from '../lib/banners';
import HeroBannerMedia from './HeroBannerMedia';

function svgData(
  title: string,
  subtitle: string,
  bg1: string,
  bg2: string,
  height = 800,
) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" ` +
    `height="${height}" viewBox="0 0 1600 ${height}">` +
    '<defs><linearGradient id="g" x1="0" x2="1">' +
    `<stop offset="0" stop-color="${bg1}"/>` +
    `<stop offset="1" stop-color="${bg2}"/>` +
    '</linearGradient></defs>' +
    `<rect width="1600" height="${height}" fill="url(#g)"/>` +
    '<circle cx="1300" cy="140" r="230" ' +
    'fill="rgba(255,255,255,.18)"/>' +
    `<circle cx="1220" cy="${height - 160}" r="320" ` +
    'fill="rgba(242,181,29,.20)"/>' +
    `<text x="120" y="180" font-family="Arial, sans-serif" ` +
    `font-size="54" font-weight="800" fill="white">${title}</text>` +
    `<text x="120" y="250" font-family="Arial, sans-serif" ` +
    'font-size="28" font-weight="600" ' +
    `fill="rgba(255,255,255,.82)">${subtitle}</text>` +
    '</svg>';

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const HERO_FALLBACK = svgData(
  'Deals68.com',
  '',
  '#0F2A4A',
  '#1596cc',
  600,
);

const PROMO_FALLBACK = svgData(
  'Deals68 Beta',
  'Upload promotion banner in Admin',
  '#F2B51D',
  '#1BADEA',
  360,
);

const HERO_FALLBACK_ROW: SiteBanner = {
  id: 'hero-fallback',
  placement: 'home_hero',
  title: 'Deals68 hero placeholder',
  image_url: '',
  mobile_image_url: null,
  focal_x: 50,
  focal_y: 50,
  sort_order: 1,
  lang_mode: 'both',
  active: true,
};

function cleanUrl(url?: string | null) {
  return String(url || '').trim();
}

function BannerImg({
  src,
  alt,
  fallback,
  eager = false,
}: {
  src?: string | null;
  alt: string;
  fallback: string;
  eager?: boolean;
}) {
  const [current, setCurrent] = useState(
    cleanUrl(src) || fallback,
  );

  useEffect(() => {
    setCurrent(cleanUrl(src) || fallback);
  }, [src, fallback]);

  return (
    <img
      src={current}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      onError={() => setCurrent(fallback)}
    />
  );
}

function MaybeLink({
  href,
  className,
  ariaHidden,
  tabIndex,
  children,
}: {
  href?: string | null;
  className?: string;
  ariaHidden?: boolean;
  tabIndex?: number;
  children: ReactNode;
}) {
  const clean = cleanUrl(href);

  if (!clean) {
    return (
      <div className={className} aria-hidden={ariaHidden}>
        {children}
      </div>
    );
  }

  const external = clean.startsWith('http');

  return (
    <a
      className={className}
      href={clean}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      aria-hidden={ariaHidden}
      tabIndex={tabIndex}
    >
      {children}
    </a>
  );
}

export function HeroBannerSlider({
  lang,
}: {
  lang: Lang;
}) {
  const [rows, setRows] = useState<SiteBanner[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let live = true;
    setLoaded(false);

    listSiteBanners('home_hero', lang)
      .then((data) => {
        if (!live) return;
        setRows(data.slice(0, 5));
        setLoaded(true);
      })
      .catch(() => {
        if (!live) return;
        setRows([]);
        setLoaded(true);
      });

    return () => {
      live = false;
    };
  }, [lang]);

  useEffect(() => {
    setActive(0);
  }, [rows.length]);

  useEffect(() => {
    if (rows.length <= 1 || typeof window === 'undefined') {
      return undefined;
    }

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );
    if (reducedMotion.matches) return undefined;

    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % rows.length);
    }, 5500);

    return () => window.clearInterval(timer);
  }, [rows.length]);

  useEffect(() => {
  if (rows.length <= 1 || typeof window === 'undefined') return undefined;
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (
    connection?.saveData ||
    connection?.effectiveType === 'slow-2g' ||
    connection?.effectiveType === '2g'
  ) {
    return undefined;
  }

  const next = rows[(active + 1) % rows.length];
  const mobile = window.matchMedia('(max-width: 700px)').matches;
  const nextUrl = cleanUrl(
    mobile ? next?.mobile_image_url || next?.image_url : next?.image_url,
  );
  if (!nextUrl) return undefined;

  const timer = window.setTimeout(() => {
    if (document.visibilityState !== 'visible') return;
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'low';
    image.src = nextUrl;
  }, 3500);

  return () => window.clearTimeout(timer);
}, [active, rows]);

  const activeBanner = rows[active] || null;
  const sliderClassName =
    `d68-hero-slider${
      cleanUrl(activeBanner?.mobile_image_url)
        ? ' has-mobile-image'
        : ''
    }`;

  if (!loaded || !rows.length) {
    return (
      <div
        className={`${sliderClassName} d68-hero-slider--fallback`}
        aria-hidden="true"
      >
        <div className="d68-hero-slide is-active">
          <HeroBannerMedia
            banner={HERO_FALLBACK_ROW}
            fallback={HERO_FALLBACK}
            alt="Deals68 hero placeholder"
            eager
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={sliderClassName}
      data-hero-layout="single-active"
    >
      {activeBanner ? (
      <MaybeLink
        key={activeBanner.id}
        href={activeBanner.link_url}
        className="d68-hero-slide is-active"
      >
        <HeroBannerMedia
          banner={activeBanner}
          fallback={HERO_FALLBACK}
          alt={activeBanner.title || 'Deals68 banner'}
          eager={active === 0}
        />
      </MaybeLink>
    ) : null}

    {rows.length > 1 ? (
        <div className="d68-hero-dots">
          {rows.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Slide ${index + 1}`}
              aria-pressed={index === active}
              className={index === active ? 'active' : ''}
              onClick={() => setActive(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PromotionBanner({
  placement,
  lang,
  className = '',
}: {
  placement: 'home_promotion' | 'listing_promotion';
  lang: Lang;
  className?: string;
}) {
  const [rows, setRows] = useState<SiteBanner[]>([]);

  useEffect(() => {
    let live = true;

    listSiteBanners(placement, lang)
      .then((data) => {
        if (live) setRows(data);
      })
      .catch(() => {
        if (live) setRows([]);
      });

    return () => {
      live = false;
    };
  }, [placement, lang]);

  const banner = rows[0] || null;
  if (!banner) return null;

  return (
    <section
      className={`d68-promo-banner ${className}`.trim()}
    >
      <MaybeLink
        href={banner.link_url}
        className="d68-promo-banner__link"
      >
        <BannerImg
          src={banner.image_url}
          fallback={PROMO_FALLBACK}
          alt={banner.title || 'Deals68 promotion'}
        />
      </MaybeLink>
    </section>
  );
}
