import {
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { SiteBanner } from '../lib/banners';

type ResponsiveBanner = Pick<
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
  banner: ResponsiveBanner;
  fallback: string;
  alt: string;
  eager?: boolean;
  className?: string;
};

const preloadedHeroUrls = new Set<string>();

function cleanUrl(value?: string | null) {
  return String(value || '').trim();
}

function clampFocus(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function heroFocusPosition(
  banner: Pick<ResponsiveBanner, 'focal_x' | 'focal_y'>,
) {
  return `${clampFocus(banner.focal_x)}% ${clampFocus(banner.focal_y)}%`;
}

export function heroMobileFocusPosition(banner: ResponsiveBanner) {
  return `${clampFocus(banner.mobile_focal_x ?? banner.focal_x)}% ${clampFocus(
    banner.mobile_focal_y ?? banner.focal_y,
  )}%`;
}

function responsiveUrlFromSlide(slide: Element) {
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches;
  if (mobile) {
    const source = slide.querySelector<HTMLSourceElement>('source[media="(max-width: 700px)"]');
    const sourceUrl = cleanUrl(source?.srcset || source?.getAttribute('srcset'));
    if (sourceUrl) return sourceUrl.split(',')[0].trim().split(' ')[0];
  }
  const image = slide.querySelector<HTMLImageElement>('.d68-hero-media__image');
  return cleanUrl(image?.currentSrc || image?.src);
}

function preloadNextSlide(currentImage: HTMLImageElement) {
  if (typeof window === 'undefined' || document.visibilityState !== 'visible') return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;

  const currentSlide = currentImage.closest('.d68-hero-slide');
  const slider = currentImage.closest('.d68-hero-slider');
  if (!currentSlide || !slider) return;
  const slides = Array.from(slider.querySelectorAll('.d68-hero-slide'));
  if (slides.length <= 1) return;
  const currentIndex = slides.indexOf(currentSlide);
  if (currentIndex < 0) return;
  const nextSlide = slides[(currentIndex + 1) % slides.length];
  const nextUrl = responsiveUrlFromSlide(nextSlide);
  if (!nextUrl || preloadedHeroUrls.has(nextUrl)) return;
  preloadedHeroUrls.add(nextUrl);

  window.setTimeout(() => {
    if (document.visibilityState !== 'visible') return;
    const image = new Image();
    image.decoding = 'async';
    image.src = nextUrl;
  }, 600);
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
    [banner.focal_x, banner.focal_y, banner.mobile_focal_x, banner.mobile_focal_y],
  );

  function handleError() {
    if (mobileEnabled) {
      setMobileEnabled(false);
      return;
    }
    if (currentDesktop !== fallback) setCurrentDesktop(fallback);
  }

  return (
    <picture
      className={`d68-hero-media${mobileEnabled ? ' d68-hero-media--has-mobile' : ''} ${className}`.trim()}
      style={style}
    >
      {mobileEnabled && mobileUrl ? (
        <source media="(max-width: 700px)" srcSet={mobileUrl} />
      ) : null}
      <img
        className="d68-hero-media__image"
        src={currentDesktop}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        style={style}
        onLoad={(event) => preloadNextSlide(event.currentTarget)}
        onError={handleError}
      />
    </picture>
  );
}
