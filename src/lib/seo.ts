import {
  DEFAULT_SOCIAL_IMAGE,
  SITE_URL,
  buildSeoTitle,
  localizedSeoPath,
  supportsEnglishSeoPath,
  type SeoLanguage,
} from './seoConfig';

export { DEFAULT_SOCIAL_IMAGE } from './seoConfig';

export type ApplySeoInput = {
  lang: SeoLanguage;
  pageName: string;
  description: string;
  canonicalPath: string;
  image?: string | null;
  type?: 'website' | 'article';
  noindex?: boolean;
  structuredData?: Record<string, any> | null;
};

function absoluteUrl(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  const assetOrigin =
    typeof window !== 'undefined' && isPreviewHost()
      ? window.location.origin
      : SITE_URL;
  if (!raw) return `${assetOrigin}${DEFAULT_SOCIAL_IMAGE}`;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  return `${assetOrigin}${raw.startsWith('/') ? raw : `/${raw}`}`;
}

function cleanDescription(value: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function upsertMeta(
  attribute: 'name' | 'property',
  key: string,
  content: string,
) {
  let element = document.head.querySelector(
    `meta[${attribute}="${key}"]`,
  ) as HTMLMetaElement | null;

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

function upsertLink(
  rel: string,
  href: string,
  hreflang?: string,
  id?: string,
) {
  const selector = id
    ? `link#${id}`
    : `link[rel="${rel}"]${hreflang ? `[hreflang="${hreflang}"]` : ''}`;
  let element = document.head.querySelector(
    selector,
  ) as HTMLLinkElement | null;

  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    if (hreflang) element.hreflang = hreflang;
    if (id) element.id = id;
    document.head.appendChild(element);
  }

  element.href = href;
}

function removeAlternateLinks() {
  document.head
    .querySelectorAll('link[data-d68-seo-alternate="true"]')
    .forEach((node) => node.remove());
}

function upsertAlternateLink(
  hreflang: string,
  href: string,
) {
  const element = document.createElement('link');
  element.rel = 'alternate';
  element.hreflang = hreflang;
  element.href = href;
  element.dataset.d68SeoAlternate = 'true';
  document.head.appendChild(element);
}

function isPreviewHost(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  return !['deals68.com', 'www.deals68.com'].includes(hostname);
}

function upsertPageJsonLd(data: Record<string, any>) {
  let script = document.getElementById(
    'd68-page-jsonld',
  ) as HTMLScriptElement | null;

  if (!script) {
    script = document.createElement('script');
    script.id = 'd68-page-jsonld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(data);
}

export function applySeo(input: ApplySeoInput) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const canonicalPath = localizedSeoPath(
    input.canonicalPath || '/',
    input.lang,
  );
  const canonicalUrl = `${SITE_URL}${canonicalPath === '/' ? '/' : canonicalPath}`;
  const title = buildSeoTitle(input.pageName, input.lang);
  const description = cleanDescription(input.description);
  const image = absoluteUrl(input.image || DEFAULT_SOCIAL_IMAGE);
  const noindex = Boolean(input.noindex || isPreviewHost());
  const robots = noindex
    ? 'noindex,nofollow,noarchive'
    : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';

  document.documentElement.lang = input.lang;
  document.title = title;

  upsertMeta('name', 'description', description);
  upsertMeta('name', 'robots', robots);
  upsertMeta('name', 'author', 'Deals68.com');
  upsertMeta('name', 'theme-color', '#0F2A4A');

  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:image', image);
  upsertMeta('property', 'og:image:secure_url', image);
  upsertMeta('property', 'og:image:alt', input.pageName);
  upsertMeta('property', 'og:type', input.type || 'website');
  upsertMeta('property', 'og:url', canonicalUrl);
  upsertMeta('property', 'og:site_name', 'Deals68.com');
  upsertMeta(
    'property',
    'og:locale',
    input.lang === 'en' ? 'en_US' : 'vi_VN',
  );

  if (image.endsWith('/assets/deals68-image.jpg')) {
    upsertMeta('property', 'og:image:width', '1200');
    upsertMeta('property', 'og:image:height', '630');
    upsertMeta('property', 'og:image:type', 'image/jpeg');
  }

  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);
  upsertMeta('name', 'twitter:image', image);
  upsertMeta('name', 'twitter:image:alt', input.pageName);

  upsertLink('canonical', canonicalUrl, undefined, 'd68-canonical');

  removeAlternateLinks();
  const basePath = canonicalPath.replace(/^\/en(?=\/|$)/, '') || '/';
  if (!noindex && supportsEnglishSeoPath(basePath)) {
    upsertAlternateLink(
      'vi',
      `${SITE_URL}${localizedSeoPath(basePath, 'vi')}`,
    );
    upsertAlternateLink(
      'en',
      `${SITE_URL}${localizedSeoPath(basePath, 'en')}`,
    );
    upsertAlternateLink(
      'x-default',
      `${SITE_URL}${localizedSeoPath(basePath, 'vi')}`,
    );
  }

  const pageJsonLd =
    input.structuredData ||
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url: canonicalUrl,
      image,
      isPartOf: {
        '@type': 'WebSite',
        name: 'Deals68.com',
        url: SITE_URL,
      },
    };

  upsertPageJsonLd(pageJsonLd);
}
