import { useEffect, useMemo } from 'react';
import { localizeNewsArticle, type NewsArticle, type NewsLanguage } from '../../lib/newsTypes';

const NEWS_SITE_URL = 'https://deals68.com';
const NEWS_DEFAULT_SOCIAL_IMAGE = `${NEWS_SITE_URL}/assets/deals68-image.jpg`;
const NEWS_ORGANIZATION_ID = `${NEWS_SITE_URL}/#organization`;

export type NewsSeoAlternate = {
  lang: NewsLanguage;
  path: string;
};

type PageSeoProps = {
  lang: NewsLanguage;
  title: string;
  description: string;
  path: string;
  image?: string | null;
  imageAlt?: string | null;
  type?: 'website' | 'article';
  robots?: string;
  alternates?: NewsSeoAlternate[];
  jsonLd?: Record<string, unknown> | null;
  publishedTime?: string | null;
  modifiedTime?: string | null;
  tags?: string[];
};

type CollectionSeoProps = {
  lang: NewsLanguage;
  title: string;
  description: string;
  path: string;
  alternatePath?: string | null;
  noindex?: boolean;
};

type ArticleSeoProps = {
  article: NewsArticle;
  lang: NewsLanguage;
};

type StateSeoProps = {
  lang: NewsLanguage;
  path: string;
  title?: string;
  description?: string;
};

function absoluteNewsUrl(value: string | null | undefined) {
  const input = String(value || '').trim();
  if (!input) return NEWS_SITE_URL;
  try {
    return new URL(input, NEWS_SITE_URL).toString();
  } catch {
    return NEWS_SITE_URL;
  }
}

function absoluteNewsPath(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return absoluteNewsUrl(normalized);
}

function localeFor(lang: NewsLanguage) {
  return lang === 'en' ? 'en_US' : 'vi_VN';
}

function alternateLocaleFor(lang: NewsLanguage) {
  return lang === 'en' ? 'vi_VN' : 'en_US';
}

function setMeta(
  selector: string,
  attributes: Record<string, string>,
  content: string,
  restorers: Array<() => void>,
) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  const created = !element;
  const previous = element?.getAttribute('content');

  if (!element) {
    element = document.createElement('meta');
    Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
    element.setAttribute('data-d68-runtime-seo', 'news');
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
  restorers.push(() => {
    if (created) {
      element?.remove();
      return;
    }
    if (previous === null || previous === undefined) element?.removeAttribute('content');
    else element?.setAttribute('content', previous);
  });
}

function setCanonical(url: string, restorers: Array<() => void>) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const created = !element;
  const previous = element?.getAttribute('href');

  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    element.id = 'd68-canonical';
    element.setAttribute('data-d68-runtime-seo', 'news');
    document.head.appendChild(element);
  }

  element.href = url;
  restorers.push(() => {
    if (created) {
      element?.remove();
      return;
    }
    if (previous === null || previous === undefined) element?.removeAttribute('href');
    else element?.setAttribute('href', previous);
  });
}

function replaceAlternates(alternates: NewsSeoAlternate[], restorers: Array<() => void>) {
  const existing = Array.from(
    document.head.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]'),
  ).map((element) => ({
    hreflang: element.getAttribute('hreflang') || '',
    href: element.getAttribute('href') || '',
  }));

  document.head
    .querySelectorAll('link[rel="alternate"][hreflang]')
    .forEach((element) => element.remove());

  const unique = new Map<string, string>();
  alternates.forEach((alternate) => {
    if (!alternate.lang || !alternate.path) return;
    unique.set(alternate.lang, absoluteNewsPath(alternate.path));
  });

  unique.forEach((href, hreflang) => {
    const element = document.createElement('link');
    element.rel = 'alternate';
    element.hreflang = hreflang;
    element.href = href;
    element.setAttribute('data-d68-runtime-seo', 'news');
    document.head.appendChild(element);
  });

  restorers.push(() => {
    document.head
      .querySelectorAll('link[rel="alternate"][hreflang][data-d68-runtime-seo="news"]')
      .forEach((element) => element.remove());
    existing.forEach(({ hreflang, href }) => {
      if (!hreflang || !href) return;
      const element = document.createElement('link');
      element.rel = 'alternate';
      element.hreflang = hreflang;
      element.href = href;
      document.head.appendChild(element);
    });
  });
}

function replaceJsonLd(jsonLd: Record<string, unknown> | null | undefined, restorers: Array<() => void>) {
  let element = document.getElementById('d68-page-jsonld') as HTMLScriptElement | null;
  const created = !element;
  const previous = element?.textContent || '';

  if (!element) {
    element = document.createElement('script');
    element.type = 'application/ld+json';
    element.id = 'd68-page-jsonld';
    element.setAttribute('data-d68-runtime-seo', 'news');
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(jsonLd || {});
  restorers.push(() => {
    if (created) {
      element?.remove();
      return;
    }
    if (element) element.textContent = previous;
  });
}

function replaceArticleMeta(
  publishedTime: string | null | undefined,
  modifiedTime: string | null | undefined,
  tags: string[],
  restorers: Array<() => void>,
) {
  const existing = Array.from(
    document.head.querySelectorAll<HTMLMetaElement>('meta[property^="article:"]'),
  ).map((element) => ({
    property: element.getAttribute('property') || '',
    content: element.getAttribute('content') || '',
  }));

  document.head
    .querySelectorAll('meta[property^="article:"]')
    .forEach((element) => element.remove());

  const add = (property: string, content: string | null | undefined) => {
    const value = String(content || '').trim();
    if (!value) return;
    const element = document.createElement('meta');
    element.setAttribute('property', property);
    element.setAttribute('content', value);
    element.setAttribute('data-d68-runtime-seo', 'news');
    document.head.appendChild(element);
  };

  add('article:published_time', publishedTime);
  add('article:modified_time', modifiedTime);
  tags.filter(Boolean).forEach((tag) => add('article:tag', tag));

  restorers.push(() => {
    document.head
      .querySelectorAll('meta[property^="article:"][data-d68-runtime-seo="news"]')
      .forEach((element) => element.remove());
    existing.forEach(({ property, content }) => {
      if (!property || !content) return;
      const element = document.createElement('meta');
      element.setAttribute('property', property);
      element.setAttribute('content', content);
      document.head.appendChild(element);
    });
  });
}

function NewsPageSeo({
  lang,
  title,
  description,
  path,
  image,
  imageAlt,
  type = 'website',
  robots = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
  alternates = [],
  jsonLd = null,
  publishedTime = null,
  modifiedTime = null,
  tags = [],
}: PageSeoProps) {
  const alternateKey = useMemo(() => JSON.stringify(alternates), [alternates]);
  const jsonLdKey = useMemo(() => JSON.stringify(jsonLd || {}), [jsonLd]);
  const tagsKey = useMemo(() => JSON.stringify(tags), [tags]);

  useEffect(() => {
    const restorers: Array<() => void> = [];
    const canonicalUrl = absoluteNewsPath(path);
    const socialImage = absoluteNewsUrl(image || NEWS_DEFAULT_SOCIAL_IMAGE);
    const socialImageAlt = imageAlt || 'Deals68.com';
    const previousTitle = document.title;
    const previousLang = document.documentElement.lang;

    document.title = title;
    document.documentElement.lang = lang;
    restorers.push(() => { document.title = previousTitle; });
    restorers.push(() => { document.documentElement.lang = previousLang; });

    setMeta('meta[name="description"]', { name: 'description' }, description, restorers);
    setMeta('meta[name="robots"]', { name: 'robots' }, robots, restorers);
    setCanonical(canonicalUrl, restorers);
    replaceAlternates(alternates, restorers);

    setMeta('meta[property="og:title"]', { property: 'og:title' }, title, restorers);
    setMeta('meta[property="og:description"]', { property: 'og:description' }, description, restorers);
    setMeta('meta[property="og:type"]', { property: 'og:type' }, type, restorers);
    setMeta('meta[property="og:url"]', { property: 'og:url' }, canonicalUrl, restorers);
    setMeta('meta[property="og:site_name"]', { property: 'og:site_name' }, 'Deals68.com', restorers);
    setMeta('meta[property="og:locale"]', { property: 'og:locale' }, localeFor(lang), restorers);
    setMeta('meta[property="og:image"]', { property: 'og:image' }, socialImage, restorers);
    setMeta('meta[property="og:image:secure_url"]', { property: 'og:image:secure_url' }, socialImage, restorers);
    setMeta('meta[property="og:image:alt"]', { property: 'og:image:alt' }, socialImageAlt, restorers);

    if (alternates.some((alternate) => alternate.lang !== lang)) {
      setMeta(
        'meta[property="og:locale:alternate"]',
        { property: 'og:locale:alternate' },
        alternateLocaleFor(lang),
        restorers,
      );
    }

    setMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary_large_image', restorers);
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, title, restorers);
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, description, restorers);
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, socialImage, restorers);
    setMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt' }, socialImageAlt, restorers);

    replaceJsonLd(jsonLd, restorers);
    replaceArticleMeta(
      type === 'article' ? publishedTime : null,
      type === 'article' ? modifiedTime : null,
      type === 'article' ? tags : [],
      restorers,
    );

    return () => {
      [...restorers].reverse().forEach((restore) => restore());
    };
  }, [
    lang,
    title,
    description,
    path,
    image,
    imageAlt,
    type,
    robots,
    alternateKey,
    jsonLdKey,
    publishedTime,
    modifiedTime,
    tagsKey,
  ]);

  return null;
}

export function NewsCollectionSeo({
  lang,
  title,
  description,
  path,
  alternatePath = null,
  noindex = false,
}: CollectionSeoProps) {
  const alternates: NewsSeoAlternate[] = [
    { lang, path },
    ...(alternatePath
      ? [{ lang: lang === 'en' ? 'vi' as const : 'en' as const, path: alternatePath }]
      : []),
  ];
  const canonical = absoluteNewsPath(path);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: canonical,
    inLanguage: lang,
    isPartOf: { '@id': `${NEWS_SITE_URL}/#website` },
    publisher: { '@id': NEWS_ORGANIZATION_ID },
  };

  return (
    <NewsPageSeo
      lang={lang}
      title={title}
      description={description}
      path={path}
      robots={noindex ? 'noindex,follow' : undefined}
      alternates={alternates}
      jsonLd={jsonLd}
    />
  );
}

export function NewsArticleSeo({ article, lang }: ArticleSeoProps) {
  const localized = localizeNewsArticle(article, lang);
  if (!localized) return null;

  const otherLang: NewsLanguage = lang === 'en' ? 'vi' : 'en';
  const alternate = localizeNewsArticle(article, otherLang);
  const path = `${lang === 'en' ? '/en/news' : '/news'}/${encodeURIComponent(localized.slug)}`;
  const alternatePath = alternate
    ? `${otherLang === 'en' ? '/en/news' : '/news'}/${encodeURIComponent(alternate.slug)}`
    : null;
  const title = localized.seoTitle || `${localized.title} | Deals68.com`;
  const description = localized.seoDescription || localized.excerpt;
  const canonical = absoluteNewsPath(path);
  const image = localized.featuredImageUrl
    ? absoluteNewsUrl(localized.featuredImageUrl)
    : null;
  const tags = localized.tags.map((tag) => tag.label).filter(Boolean);
  const alternates: NewsSeoAlternate[] = [
    { lang, path },
    ...(alternatePath ? [{ lang: otherLang, path: alternatePath }] : []),
  ];
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: localized.title,
    description,
    datePublished: localized.publishedDate,
    dateModified: localized.updatedAt,
    author: {
      '@type': 'Organization',
      name: localized.authorName || 'Deals68.com',
    },
    publisher: { '@id': NEWS_ORGANIZATION_ID },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonical,
    },
    inLanguage: lang,
    keywords: tags,
  };
  if (image) jsonLd.image = [image];

  return (
    <NewsPageSeo
      lang={lang}
      title={title}
      description={description}
      path={path}
      image={image}
      imageAlt={localized.featuredImageAlt || localized.title}
      type="article"
      alternates={alternates}
      jsonLd={jsonLd}
      publishedTime={localized.publishedDate}
      modifiedTime={localized.updatedAt}
      tags={tags}
    />
  );
}

export function NewsStateSeo({
  lang,
  path,
  title,
  description,
}: StateSeoProps) {
  return (
    <NewsCollectionSeo
      lang={lang}
      path={path}
      title={title || (lang === 'en' ? 'News | Deals68.com' : 'Tin tức | Deals68.com')}
      description={description || (lang === 'en'
        ? 'Deals68 News and market insights.'
        : 'Tin tức và góc nhìn thị trường từ Deals68.')}
      noindex
    />
  );
}
