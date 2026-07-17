import {
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { SiteBanner } from '../lib/banners';

type HeroBannerLike = Pick<
  SiteBanner,
  | 'image_url'
  | 'mobile_image_url'
  | 'focal_x'
  | 'focal_y'
> & {
  mobile_focal_x?: number | null;
  mobile_focal_y?: number | null;
};

type Props = {
  banner: HeroBannerLike;
  fallback: string;
  alt: string;
  eager?: boolean;
  className?: string;
};

function cleanUrl(value?: string | null) {
  return String(value || '').trim();
}

function clampFocus(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function heroFocusPosition(
  banner: Pick<SiteBanner, 'focal_x' | 'focal_y'>,
) {
  return `${clampFocus(banner.focal_x)}% ${clampFocus(
    banner.focal_y,
  )}%`;
}

export function heroMobileFocusPosition(banner: HeroBannerLike) {
  const mobileX = banner.mobile_focal_x ?? banner.focal_x;
  const mobileY = banner.mobile_focal_y ?? banner.focal_y;
  return `${clampFocus(mobileX)}% ${clampFocus(mobileY)}%`;
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
  const [currentDesktop, setCurrentDesktop] = useState(desktopUrl);
  const [mobileEnabled, setMobileEnabled] = useState(!!mobileUrl);

  useEffect(() => {
    setCurrentDesktop(desktopUrl);
    setMobileEnabled(!!mobileUrl);
  }, [desktopUrl, mobileUrl]);

  const style = useMemo(
    () =>
      ({
        '--d68-hero-position': heroFocusPosition(banner),
        '--d68-hero-mobile-position': heroMobileFocusPosition(banner),
      }) as CSSProperties,
    [
      banner.focal_x,
      banner.focal_y,
      banner.mobile_focal_x,
      banner.mobile_focal_y,
    ],
  );

  function handleError() {
    if (mobileEnabled) {
      setMobileEnabled(false);
      return;
    }

    if (currentDesktop !== fallback) {
      setCurrentDesktop(fallback);
    }
  }

  return (
    <picture
      className={
        `d68-hero-media${
          mobileEnabled ? ' d68-hero-media--has-mobile' : ''
        } ${className}`.trim()
      }
      style={style}
    >
      {mobileEnabled && mobileUrl ? (
        <source
          media="(max-width: 700px)"
          srcSet={mobileUrl}
        />
      ) : null}
      <img
        className="d68-hero-media__image"
        src={currentDesktop}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        style={style}
        onError={handleError}
      />
    </picture>
  );
}
