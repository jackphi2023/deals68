import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { listSiteBanners, type SiteBanner } from '../lib/banners';
import type { Lang } from '../lib/i18n';

const MOBILE_QUERY = '(max-width: 700px)';

function cleanUrl(value?: string | null) {
  return String(value || '').trim();
}

function clampFocus(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function isMobileViewport() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia(MOBILE_QUERY).matches
  );
}

function MaybeLink({
  href,
  className,
  children,
}: {
  href?: string | null;
  className: string;
  children: ReactNode;
}) {
  const url = cleanUrl(href);
  if (!url) return <div className={className}>{children}</div>;

  const external = /^https?:\/\//i.test(url);
  return (
    <a
      className={className}
      href={url}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
    >
      {children}
    </a>
  );
}

function HomepageHeroMedia({ banner }: { banner: SiteBanner }) {
  const desktopUrl = cleanUrl(banner.image_url);
  const mobileUrl = cleanUrl(banner.mobile_image_url);
  const [mobileViewport, setMobileViewport] = useState(isMobileViewport);
  const [source, setSource] = useState(() =>
    isMobileViewport() && mobileUrl
      ? mobileUrl
      : desktopUrl || mobileUrl,
  );
  const [variant, setVariant] = useState<'mobile' | 'desktop'>(() =>
    isMobileViewport() && mobileUrl ? 'mobile' : 'desktop',
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const query = window.matchMedia(MOBILE_QUERY);
    const sync = () => setMobileViewport(query.matches);
    sync();

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', sync);
      return () => query.removeEventListener('change', sync);
    }

    query.addListener(sync);
    return () => query.removeListener(sync);
  }, []);

  useEffect(() => {
    if (mobileViewport && mobileUrl) {
      setSource(mobileUrl);
      setVariant('mobile');
      return;
    }

    if (desktopUrl) {
      setSource(desktopUrl);
      setVariant('desktop');
      return;
    }

    if (mobileUrl) {
      setSource(mobileUrl);
      setVariant('mobile');
      return;
    }

    setSource('');
    setVariant('desktop');
  }, [desktopUrl, mobileUrl, mobileViewport]);

  const style = useMemo(
    () =>
      ({
        '--d68-hero-position': `${clampFocus(
          banner.focal_x,
        )}% ${clampFocus(banner.focal_y)}%`,
      }) as CSSProperties,
    [banner.focal_x, banner.focal_y],
  );

  function handleError() {
    if (variant === 'mobile' && desktopUrl && source !== desktopUrl) {
      setSource(desktopUrl);
      setVariant('desktop');
      return;
    }

    setSource('');
  }

  return (
    <span
      className={`d68-home-hero-media d68-home-hero-media--${variant}`}
      data-hero-variant={variant}
      style={style}
    >
      {source ? (
        <img
          className="d68-home-hero-media__image"
          src={source}
          alt=""
          loading="eager"
          fetchPriority="high"
          style={style}
          onError={handleError}
        />
      ) : null}
    </span>
  );
}

export default function HomepageHeroSlider({ lang }: { lang: Lang }) {
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
    setActive((current) =>
      rows.length ? Math.min(current, rows.length - 1) : 0,
    );
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

  if (!loaded) {
    return (
      <div
        className="d68-hero-slider d68-home-hero-slider-v2 d68-home-hero-slider-v2--loading"
        aria-hidden="true"
        data-hero-loading="true"
      />
    );
  }

  if (!rows.length) {
    return (
      <div
        className="d68-hero-slider d68-home-hero-slider-v2 d68-home-hero-slider-v2--empty"
        aria-hidden="true"
      />
    );
  }

  const activeBanner = rows[active] || rows[0];

  return (
    <div
      className="d68-hero-slider d68-home-hero-slider-v2 d68-home-hero-slider-v2--ready"
      data-hero-layout="single-active"
    >
      <MaybeLink
        key={activeBanner.id}
        href={activeBanner.link_url}
        className="d68-hero-slide is-active"
      >
        <HomepageHeroMedia banner={activeBanner} />
      </MaybeLink>

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
