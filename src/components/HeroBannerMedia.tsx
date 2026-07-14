import {
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { SiteBanner } from '../lib/banners';

type Props = {
  banner: Pick<
    SiteBanner,
    | 'image_url'
    | 'mobile_image_url'
    | 'focal_x'
    | 'focal_y'
  >;
  fallback: string;
  alt: string;
  eager?: boolean;
  className?: string;
};

const MOBILE_QUERY = '(max-width: 700px)';

function cleanUrl(value?: string | null) {
  return String(value || '').trim();
}

function clampFocus(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function matchesMobileViewport() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia(MOBILE_QUERY).matches
  );
}

export function heroFocusPosition(
  banner: Pick<SiteBanner, 'focal_x' | 'focal_y'>,
) {
  return `${clampFocus(banner.focal_x)}% ${clampFocus(
    banner.focal_y,
  )}%`;
}

export default function HeroBannerMedia({
  banner,
  fallback,
  alt,
  eager = false,
  className = '',
}: Props) {
  const desktopUrl = cleanUrl(banner.image_url) || fallback;
  const mobileUrl = cleanUrl(banner.mobile_image_url);

  const [desktopSource, setDesktopSource] = useState(desktopUrl);
  const [mobileSourceEnabled, setMobileSourceEnabled] = useState(
    Boolean(mobileUrl),
  );
  const [mobileViewport, setMobileViewport] = useState(
    matchesMobileViewport,
  );

  useEffect(() => {
    setDesktopSource(desktopUrl);
    setMobileSourceEnabled(Boolean(mobileUrl));
  }, [desktopUrl, mobileUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    const syncViewport = () => {
      setMobileViewport(mediaQuery.matches);
    };

    syncViewport();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncViewport);
      return () => {
        mediaQuery.removeEventListener('change', syncViewport);
      };
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  const usingMobileSource =
    mobileViewport &&
    mobileSourceEnabled &&
    Boolean(mobileUrl);

  const imageSource = usingMobileSource
    ? mobileUrl
    : desktopSource;

  const style = useMemo(
    () =>
      ({
        '--d68-hero-position': heroFocusPosition(banner),
      }) as CSSProperties,
    [banner.focal_x, banner.focal_y],
  );

  function handleImageError() {
    if (usingMobileSource) {
      setMobileSourceEnabled(false);
      return;
    }

    if (desktopSource !== fallback) {
      setDesktopSource(fallback);
    }
  }

  const variant = usingMobileSource ? 'mobile' : 'desktop';

  return (
    <span
      className={
        `d68-hero-media d68-hero-media--${variant} ` +
        className
      }
      style={style}
      data-hero-variant={variant}
    >
      <img
        className="d68-hero-media__image"
        src={imageSource}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        style={style}
        onError={handleImageError}
      />
    </span>
  );
}
