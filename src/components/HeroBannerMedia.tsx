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
  const desktopUrl = cleanUrl(banner.image_url);
  const mobileUrl = cleanUrl(banner.mobile_image_url);
  const fallbackUrl = cleanUrl(fallback);

  const initialMobileViewport = matchesMobileViewport();
  const initialSource =
    initialMobileViewport && mobileUrl
      ? mobileUrl
      : desktopUrl || mobileUrl || fallbackUrl;
  const initialVariant: 'mobile' | 'desktop' =
    initialMobileViewport && mobileUrl
      ? 'mobile'
      : desktopUrl
        ? 'desktop'
        : mobileUrl
          ? 'mobile'
          : 'desktop';

  const [mobileViewport, setMobileViewport] = useState(
    initialMobileViewport,
  );
  const [source, setSource] = useState(initialSource);
  const [variant, setVariant] = useState<
    'mobile' | 'desktop'
  >(initialVariant);

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

    setSource(fallbackUrl);
    setVariant('desktop');
  }, [
    desktopUrl,
    fallbackUrl,
    mobileUrl,
    mobileViewport,
  ]);

  const style = useMemo(
    () =>
      ({
        '--d68-hero-position': heroFocusPosition(banner),
      }) as CSSProperties,
    [banner.focal_x, banner.focal_y],
  );

  function handleImageError() {
    if (
      variant === 'mobile' &&
      desktopUrl &&
      source !== desktopUrl
    ) {
      setSource(desktopUrl);
      setVariant('desktop');
      return;
    }

    if (fallbackUrl && source !== fallbackUrl) {
      setSource(fallbackUrl);
      setVariant('desktop');
    }
  }

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
        src={source}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        style={style}
        onError={handleImageError}
      />
    </span>
  );
}
