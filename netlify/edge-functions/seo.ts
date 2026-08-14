import {
  DEFAULT_SOCIAL_IMAGE,
  SITE_URL,
  buildSeoTitle,
  localizedSeoPath,
  seoForPath,
  seoLanguageFromPath,
  stripSeoLanguagePrefix,
  supportsEnglishSeoPath,
} from '../../src/lib/seoConfig.ts';

declare const Netlify: {
  env: {
    get(name: string): string | undefined;
  };
};

const START = '<!-- d68:seo:start -->';
const END = '<!-- d68:seo:end -->';

type SeoLanguage = 'vi' | 'en';
type SeoAlternate = { hreflang: SeoLanguage; path: string };

type DynamicSeo = {
  pageName: string;
  titleOverride?: string;
  description: string;
  image: string;
  imageAlt?: string;
  type: 'website' | 'article';
  noindex: boolean;
  canonicalPath?: string;
  alternates?: SeoAlternate[];
  jsonLd?: Record<string, unknown>;
  publishedTime?: string | null;
  modifiedTime?: string | null;
  tags?: string[];
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeXml(value: unknown): string {
  return escapeHtml(value).replace(/'/g, '&apos;');
}

function cleanDescription(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function absoluteUrl(value: unknown, assetOrigin: string): string {
  const raw = String(value || '').trim();
  if (!raw) return `${assetOrigin}${DEFAULT_SOCIAL_IMAGE}`;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  return `${assetOrigin}${raw.startsWith('/') ? raw : `/${raw}`}`;
}

function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function localizedNewsPath(lang: SeoLanguage, suffix = '') {
  return `${lang === 'en' ? '/en/news' : '/news'}${suffix}`;
}

function localizedTagLabel(tag: any, lang: SeoLanguage) {
  return lang === 'en'
    ? String(tag?.label_en || tag?.label_vi || tag?.slug || '').trim()
    : String(tag?.label_vi || tag?.label_en || tag?.slug || '').trim();
}

function validNewsPage(rawPage: string | null) {
  if (!rawPage) return { page: 1, valid: true };
  if (!/^\d+$/.test(rawPage)) return { page: 1, valid: false };
  const page = Number(rawPage);
  return {
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    valid: Number.isSafeInteger(page) && page > 0,
  };
}

function newsCollectionDescription(lang: SeoLanguage) {
  return lang === 'en'
    ? 'Updates and practical perspectives on investment, M&A, fundraising and private-market transactions.'
    : 'Cập nhật và góc nhìn thực tiễn về đầu tư, M&A, gọi vốn và các giao dịch trên thị trường tư nhân.';
}

function supabaseCredentials() {
  return {
    url:
      Netlify.env.get('VITE_SUPABASE_URL') ||
      Netlify.env.get('SUPABASE_URL') ||
      '',
    key:
      Netlify.env.get('VITE_SUPABASE_ANON_KEY') ||
      Netlify.env.get('SUPABASE_ANON_KEY') ||
      '',
  };
}

async function fetchRows(
  table: string,
  params: URLSearchParams,
): Promise<any[]> {
  const { url, key } = supabaseCredentials();
  if (!url || !key) return [];

  const response = await fetch(
    `${url.replace(/\/+$/, '')}/rest/v1/${table}?${params.toString()}`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) return [];
  const data = await response.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

async function fetchRowsStrict(
  table: string,
  params: URLSearchParams,
): Promise<any[]> {
  const { url, key } = supabaseCredentials();
  if (!url || !key) throw new Error('Supabase anon environment is unavailable.');

  const response = await fetch(
    `${url.replace(/\/+$/, '')}/rest/v1/${table}?${params.toString()}`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) throw new Error(`Supabase sitemap query failed: ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Supabase sitemap response was not an array.');
  return data;
}

async function businessSeo(slug: string, lang: SeoLanguage) {
  const params = new URLSearchParams();
  params.set(
    'select',
    'id,slug,title_vi,title_en,description_vi,description_en,highlights_vi,highlights_en,hero_image_url,image_url,updated_at',
  );
  params.set('slug', `eq.${slug}`);
  params.set('visible', 'eq.true');
  params.set('status', 'eq.active');
  params.set('limit', '1');

  const business = (await fetchRows('public_businesses_safe', params))[0];
  if (!business) return null;

  const imageParams = new URLSearchParams();
  imageParams.set('select', 'public_url,is_hero,sort_order,created_at');
  imageParams.set('business_id', `eq.${business.id}`);
  imageParams.set('public_visible', 'eq.true');
  imageParams.set(
    'order',
    'is_hero.desc.nullslast,sort_order.asc.nullslast,created_at.asc',
  );
  imageParams.set('limit', '1');

  const approvedImage = (await fetchRows('business_images', imageParams))[0];
  const title =
    lang === 'en'
      ? business.title_en || business.title_vi || 'Business Opportunity'
      : business.title_vi || business.title_en || 'Hồ sơ doanh nghiệp';
  const description =
    lang === 'en'
      ? business.description_en ||
        business.description_vi ||
        business.highlights_en ||
        business.highlights_vi
      : business.description_vi ||
        business.highlights_vi ||
        business.description_en;

  return {
    pageName: title,
    description:
      description ||
      (lang === 'en'
        ? 'Anonymous business opportunity listed on Deals68.'
        : 'Hồ sơ doanh nghiệp ẩn danh được đăng trên Deals68.'),
    image:
      approvedImage?.public_url ||
      business.hero_image_url ||
      business.image_url ||
      DEFAULT_SOCIAL_IMAGE,
    type: 'article' as const,
    noindex: false,
    updatedAt: business.updated_at,
  };
}

async function investorSeo(code: string, lang: SeoLanguage) {
  const params = new URLSearchParams();
  params.set(
    'select',
    'code,title_vi,title_en,desc_vi,desc_en,updated_at',
  );
  params.set('code', `eq.${code}`);
  params.set('visible', 'eq.true');
  params.set('limit', '1');

  const investor = (await fetchRows('investors', params))[0];
  if (!investor) return null;

  return {
    pageName:
      lang === 'en'
        ? investor.title_en || investor.title_vi || 'Investor Profile'
        : investor.title_vi || investor.title_en || 'Hồ sơ Nhà đầu tư',
    description:
      (lang === 'en'
        ? investor.desc_en || investor.desc_vi
        : investor.desc_vi || investor.desc_en) ||
      (lang === 'en'
        ? 'Investor profile and investment criteria on Deals68.'
        : 'Hồ sơ và tiêu chí đầu tư của nhà đầu tư trên Deals68.'),
    image: DEFAULT_SOCIAL_IMAGE,
    type: 'article' as const,
    noindex: false,
    updatedAt: investor.updated_at,
  };
}

function addPublishedNewsFilters(params: URLSearchParams, lang: SeoLanguage) {
  const suffix = lang === 'en' ? 'en' : 'vi';
  params.set('status', 'eq.published');
  params.set('deleted_at', 'is.null');
  params.set('published_date', 'not.is.null');
  params.set(`slug_${suffix}`, 'not.is.null');
  params.set(`title_${suffix}`, 'not.is.null');
  params.set(`excerpt_${suffix}`, 'not.is.null');
  params.set(`content_json_${suffix}`, 'not.is.null');
}

async function newsAlternateForArticle(articleId: string, lang: SeoLanguage) {
  const suffix = lang === 'en' ? 'en' : 'vi';
  const params = new URLSearchParams();
  params.set('select', `id,slug_${suffix}`);
  params.set('id', `eq.${articleId}`);
  addPublishedNewsFilters(params, lang);
  params.set('limit', '1');
  const row = (await fetchRows('news_articles', params))[0];
  const slug = String(row?.[`slug_${suffix}`] || '').trim();
  return slug || null;
}

async function newsTagsForArticle(articleId: string, lang: SeoLanguage) {
  const relationParams = new URLSearchParams();
  relationParams.set('select', 'tag_id');
  relationParams.set('article_id', `eq.${articleId}`);
  relationParams.set('limit', '100');
  const relations = await fetchRows('news_article_tags', relationParams);
  const tagIds = Array.from(new Set(relations.map((row) => String(row.tag_id || '').trim()).filter(Boolean)));
  if (!tagIds.length) return [];

  const tagParams = new URLSearchParams();
  tagParams.set('select', 'id,slug,label_vi,label_en');
  tagParams.set('id', `in.(${tagIds.join(',')})`);
  tagParams.set('limit', String(tagIds.length));
  const tags = await fetchRows('news_tags', tagParams);
  return tags.map((tag) => localizedTagLabel(tag, lang)).filter(Boolean);
}

async function newsArticleSeo(slug: string, lang: SeoLanguage): Promise<DynamicSeo | null> {
  const suffix = lang === 'en' ? 'en' : 'vi';
  const params = new URLSearchParams();
  params.set(
    'select',
    'id,slug_vi,slug_en,title_vi,title_en,excerpt_vi,excerpt_en,featured_image_url,featured_image_alt_vi,featured_image_alt_en,author_name,seo_title_vi,seo_title_en,seo_description_vi,seo_description_en,published_date,updated_at',
  );
  params.set(`slug_${suffix}`, `eq.${slug}`);
  addPublishedNewsFilters(params, lang);
  params.set('limit', '1');

  const article = (await fetchRows('news_articles', params))[0];
  if (!article) return null;

  const localizedSlug = String(article[`slug_${suffix}`] || '').trim();
  const articleTitle = String(article[`title_${suffix}`] || '').trim();
  const excerpt = String(article[`excerpt_${suffix}`] || '').trim();
  if (!localizedSlug || !articleTitle || !excerpt) return null;

  const seoTitle = String(article[`seo_title_${suffix}`] || '').trim();
  const seoDescription = String(article[`seo_description_${suffix}`] || '').trim();
  const imageAlt = String(article[`featured_image_alt_${suffix}`] || '').trim() || articleTitle;
  const canonicalPath = localizedNewsPath(lang, `/${encodeURIComponent(localizedSlug)}`);
  const canonical = `${SITE_URL}${canonicalPath}`;
  const otherLang: SeoLanguage = lang === 'en' ? 'vi' : 'en';
  const alternateSlug = await newsAlternateForArticle(String(article.id), otherLang).catch(() => null);
  const tags = await newsTagsForArticle(String(article.id), lang).catch(() => []);
  const alternates: SeoAlternate[] = [{ hreflang: lang, path: canonicalPath }];
  if (alternateSlug) {
    alternates.push({
      hreflang: otherLang,
      path: localizedNewsPath(otherLang, `/${encodeURIComponent(alternateSlug)}`),
    });
  }

  const image = article.featured_image_url || DEFAULT_SOCIAL_IMAGE;
  const absoluteImage = absoluteUrl(image, SITE_URL);
  const description = seoDescription || excerpt;
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: articleTitle,
    description,
    datePublished: article.published_date,
    dateModified: article.updated_at,
    author: {
      '@type': 'Organization',
      name: article.author_name || 'Deals68.com',
    },
    publisher: { '@id': `${SITE_URL}/#organization` },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonical,
    },
    inLanguage: lang,
    keywords: tags,
    image: [absoluteImage],
  };

  return {
    pageName: articleTitle,
    titleOverride: seoTitle || `${articleTitle} | Deals68.com`,
    description,
    image,
    imageAlt,
    type: 'article',
    noindex: false,
    canonicalPath,
    alternates,
    jsonLd,
    publishedTime: article.published_date,
    modifiedTime: article.updated_at,
    tags,
  };
}

async function newsTagArticleIds(tagId: string) {
  const params = new URLSearchParams();
  params.set('select', 'article_id');
  params.set('tag_id', `eq.${tagId}`);
  params.set('limit', '5000');
  const rows = await fetchRows('news_article_tags', params);
  return Array.from(new Set(rows.map((row) => String(row.article_id || '').trim()).filter(Boolean)));
}

async function eligibleNewsForIds(articleIds: string[], lang: SeoLanguage) {
  for (let index = 0; index < articleIds.length; index += 100) {
    const chunk = articleIds.slice(index, index + 100);
    const params = new URLSearchParams();
    params.set('select', 'id,published_date,updated_at');
    params.set('id', `in.(${chunk.join(',')})`);
    addPublishedNewsFilters(params, lang);
    params.set('order', 'published_date.desc,created_at.desc');
    params.set('limit', '1');
    const row = (await fetchRows('news_articles', params))[0];
    if (row) return row;
  }
  return null;
}

async function newsTagSeo(tagSlug: string, lang: SeoLanguage, page: number): Promise<DynamicSeo | null> {
  const tagParams = new URLSearchParams();
  tagParams.set('select', 'id,slug,label_vi,label_en');
  tagParams.set('slug', `eq.${tagSlug}`);
  tagParams.set('limit', '1');
  const tag = (await fetchRows('news_tags', tagParams))[0];
  if (!tag) return null;

  const articleIds = await newsTagArticleIds(String(tag.id));
  const currentEligible = await eligibleNewsForIds(articleIds, lang);
  const label = localizedTagLabel(tag, lang) || tagSlug;
  const canonicalPath = localizedNewsPath(lang, `/tag/${encodeURIComponent(String(tag.slug || tagSlug))}`);
  const pageSuffix = page > 1 ? (lang === 'en' ? ` – Page ${page}` : ` – Trang ${page}`) : '';
  const pageName = lang === 'en' ? `${label} News` : `Tin tức chủ đề ${label}`;
  const titleOverride = `${pageName}${pageSuffix} | Deals68.com`;
  const description = lang === 'en'
    ? 'Published Deals68 articles in this topic.'
    : 'Các bài viết Deals68 đã xuất bản thuộc chủ đề này.';

  if (!currentEligible) {
    return {
      pageName,
      titleOverride,
      description,
      image: DEFAULT_SOCIAL_IMAGE,
      type: 'website',
      noindex: true,
      canonicalPath,
      alternates: [],
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: titleOverride,
        description,
        url: `${SITE_URL}${canonicalPath}`,
        inLanguage: lang,
      },
    };
  }

  const alternates: SeoAlternate[] = [];
  if (page === 1) {
    alternates.push({ hreflang: lang, path: canonicalPath });
    const otherLang: SeoLanguage = lang === 'en' ? 'vi' : 'en';
    const otherEligible = await eligibleNewsForIds(articleIds, otherLang).catch(() => null);
    if (otherEligible) {
      alternates.push({
        hreflang: otherLang,
        path: localizedNewsPath(otherLang, `/tag/${encodeURIComponent(String(tag.slug || tagSlug))}`),
      });
    }
  }

  const canonicalUrl = `${SITE_URL}${canonicalPath}${page > 1 ? `?page=${page}` : ''}`;
  return {
    pageName,
    titleOverride,
    description,
    image: DEFAULT_SOCIAL_IMAGE,
    type: 'website',
    noindex: false,
    canonicalPath: `${canonicalPath}${page > 1 ? `?page=${page}` : ''}`,
    alternates,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: titleOverride,
      description,
      url: canonicalUrl,
      inLanguage: lang,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  };
}

function newsCollectionSeo(lang: SeoLanguage, page: number): DynamicSeo {
  const rootPath = localizedNewsPath(lang);
  const pageSuffix = page > 1 ? (lang === 'en' ? ` – Page ${page}` : ` – Trang ${page}`) : '';
  const pageName = lang === 'en' ? 'News & Market Insights' : 'Tin tức & Góc nhìn thị trường';
  const titleOverride = `${pageName}${pageSuffix} | Deals68.com`;
  const description = newsCollectionDescription(lang);
  const canonicalPath = `${rootPath}${page > 1 ? `?page=${page}` : ''}`;
  const alternates: SeoAlternate[] = page === 1
    ? [
        { hreflang: 'vi', path: '/news' },
        { hreflang: 'en', path: '/en/news' },
      ]
    : [];

  return {
    pageName,
    titleOverride,
    description,
    image: DEFAULT_SOCIAL_IMAGE,
    type: 'website',
    noindex: false,
    canonicalPath,
    alternates,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: titleOverride,
      description,
      url: `${SITE_URL}${canonicalPath}`,
      inLanguage: lang,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  };
}

function newerLastmod(current: string, candidate: string) {
  if (!current) return candidate;
  if (!candidate) return current;
  return candidate > current ? candidate : current;
}

function mergeNewsLanguage(
  articleLanguages: Map<string, { vi: boolean; en: boolean; updatedAt: string }>,
  row: any,
  lang: SeoLanguage,
) {
  const id = String(row.id || '').trim();
  if (!id) return;
  const current = articleLanguages.get(id) || { vi: false, en: false, updatedAt: '' };
  current[lang] = true;
  current.updatedAt = newerLastmod(current.updatedAt, row.updated_at || row.published_date || '');
  articleLanguages.set(id, current);
}

async function liveNewsSitemapEntries() {
  const buildLanguageParams = (lang: SeoLanguage) => {
    const suffix = lang === 'en' ? 'en' : 'vi';
    const params = new URLSearchParams();
    params.set('select', `id,slug_${suffix},published_date,updated_at`);
    addPublishedNewsFilters(params, lang);
    params.set('order', 'published_date.desc');
    params.set('limit', '5000');
    return params;
  };

  const [viRows, enRows] = await Promise.all([
    fetchRowsStrict('news_articles', buildLanguageParams('vi')),
    fetchRowsStrict('news_articles', buildLanguageParams('en')),
  ]);

  const urls = new Map<string, string>();
  const articleLanguages = new Map<string, { vi: boolean; en: boolean; updatedAt: string }>();
  let latestVi = '';
  let latestEn = '';

  for (const row of viRows) {
    const slug = String(row.slug_vi || '').trim();
    if (!slug) continue;
    const lastmod = row.updated_at || row.published_date || '';
    urls.set(`/news/${encodeURIComponent(slug)}`, lastmod);
    latestVi = newerLastmod(latestVi, lastmod);
    mergeNewsLanguage(articleLanguages, row, 'vi');
  }
  for (const row of enRows) {
    const slug = String(row.slug_en || '').trim();
    if (!slug) continue;
    const lastmod = row.updated_at || row.published_date || '';
    urls.set(`/en/news/${encodeURIComponent(slug)}`, lastmod);
    latestEn = newerLastmod(latestEn, lastmod);
    mergeNewsLanguage(articleLanguages, row, 'en');
  }

  urls.set('/news', latestVi);
  urls.set('/en/news', latestEn);

  const relationParams = new URLSearchParams();
  relationParams.set('select', 'article_id,tag_id');
  relationParams.set('limit', '10000');
  const tagParams = new URLSearchParams();
  tagParams.set('select', 'id,slug');
  tagParams.set('limit', '5000');
  const [relations, tags] = await Promise.all([
    fetchRowsStrict('news_article_tags', relationParams),
    fetchRowsStrict('news_tags', tagParams),
  ]);
  const tagById = new Map(
    tags
      .map((tag) => [String(tag.id || ''), String(tag.slug || '').trim()] as const)
      .filter(([id, slug]) => id && slug),
  );
  const tagLastmods = new Map<string, { vi: string; en: string }>();

  for (const relation of relations) {
    const article = articleLanguages.get(String(relation.article_id || ''));
    const tagSlug = tagById.get(String(relation.tag_id || ''));
    if (!article || !tagSlug) continue;
    const state = tagLastmods.get(tagSlug) || { vi: '', en: '' };
    if (article.vi) state.vi = newerLastmod(state.vi, article.updatedAt);
    if (article.en) state.en = newerLastmod(state.en, article.updatedAt);
    tagLastmods.set(tagSlug, state);
  }

  for (const [tagSlug, state] of tagLastmods) {
    const encoded = encodeURIComponent(tagSlug);
    if (state.vi) urls.set(`/news/tag/${encoded}`, state.vi);
    if (state.en) urls.set(`/en/news/tag/${encoded}`, state.en);
  }

  return urls;
}

function sitemapEntry(path: string, lastmod: string) {
  return `  <url>\n    <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>${
    lastmod ? `\n    <lastmod>${escapeXml(lastmod.slice(0, 10))}</lastmod>` : ''
  }\n  </url>`;
}

function isNewsSitemapLoc(loc: string) {
  return loc === `${SITE_URL}/news`
    || loc.startsWith(`${SITE_URL}/news/`)
    || loc === `${SITE_URL}/en/news`
    || loc.startsWith(`${SITE_URL}/en/news/`);
}

function overlayLiveNewsSitemap(xml: string, newsUrls: Map<string, string>) {
  if (!xml.includes('</urlset>')) return xml;
  const withoutStaleNews = xml.replace(/\s*<url>[\s\S]*?<\/url>/g, (block) => {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1] || '';
    return isNewsSitemapLoc(loc.trim()) ? '' : block;
  });
  const newsBody = Array.from(newsUrls.entries())
    .map(([path, lastmod]) => sitemapEntry(path, lastmod))
    .join('\n');
  return withoutStaleNews.replace('</urlset>', `${newsBody ? `\n${newsBody}\n` : '\n'}</urlset>`);
}

function isPreviewHost(hostname: string) {
  return !['deals68.com', 'www.deals68.com'].includes(
    hostname.toLowerCase(),
  );
}

function renderSeoBlock(input: {
  lang: SeoLanguage;
  pageName: string;
  titleOverride?: string;
  description: string;
  canonicalPath: string;
  image: string;
  imageAlt?: string;
  type: 'website' | 'article';
  noindex: boolean;
  assetOrigin: string;
  alternates?: SeoAlternate[];
  jsonLd?: Record<string, unknown>;
  publishedTime?: string | null;
  modifiedTime?: string | null;
  tags?: string[];
}) {
  const title = input.titleOverride || buildSeoTitle(input.pageName, input.lang);
  const description = cleanDescription(input.description);
  const canonical = `${SITE_URL}${input.canonicalPath === '/' ? '/' : input.canonicalPath}`;
  const image = absoluteUrl(input.image, input.assetOrigin);
  const robots = input.noindex
    ? 'noindex,nofollow,noarchive'
    : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
  const basePath = input.canonicalPath.replace(/\?.*$/, '').replace(/^\/en(?=\/|$)/, '') || '/';

  const alternateRows: Array<{ hreflang: string; path: string }> = input.alternates === undefined
    ? (!input.noindex && supportsEnglishSeoPath(basePath)
      ? [
          { hreflang: 'vi', path: localizedSeoPath(basePath, 'vi') },
          { hreflang: 'en', path: localizedSeoPath(basePath, 'en') },
          { hreflang: 'x-default', path: localizedSeoPath(basePath, 'vi') },
        ]
      : [])
    : (!input.noindex ? input.alternates : []);
  const alternates = alternateRows
    .map((alternate) => `<link rel="alternate" hreflang="${escapeHtml(alternate.hreflang)}" href="${escapeHtml(`${SITE_URL}${alternate.path}`)}" />`)
    .join('\n    ');

  const pageJsonLd = input.jsonLd || {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: canonical,
    image,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Deals68.com',
      url: SITE_URL,
    },
  };
  const articleMeta = input.type === 'article'
    ? [
        input.publishedTime
          ? `<meta property="article:published_time" content="${escapeHtml(input.publishedTime)}" />`
          : '',
        input.modifiedTime
          ? `<meta property="article:modified_time" content="${escapeHtml(input.modifiedTime)}" />`
          : '',
        ...(input.tags || []).map((tag) => `<meta property="article:tag" content="${escapeHtml(tag)}" />`),
      ].filter(Boolean).join('\n    ')
    : '';
  const hasAlternateLocale = alternateRows.some((alternate) => alternate.hreflang === (input.lang === 'en' ? 'vi' : 'en'));

  return `${START}
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" id="d68-canonical" href="${escapeHtml(canonical)}" />
    ${alternates}
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(image)}" />
    <meta property="og:image:alt" content="${escapeHtml(input.imageAlt || input.pageName)}" />
    <meta property="og:type" content="${input.type}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:site_name" content="Deals68.com" />
    <meta property="og:locale" content="${input.lang === 'en' ? 'en_US' : 'vi_VN'}" />
    ${hasAlternateLocale ? `<meta property="og:locale:alternate" content="${input.lang === 'en' ? 'vi_VN' : 'en_US'}" />` : ''}
    ${
      image.endsWith('/assets/deals68-image.jpg')
        ? '<meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />\n    <meta property="og:image:type" content="image/jpeg" />'
        : ''
    }
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(input.imageAlt || input.pageName)}" />
    ${articleMeta}
    <script type="application/ld+json" id="d68-page-jsonld">${safeJson(pageJsonLd)}</script>
    ${END}`;
}

export default async function seoEdgeFunction(
  request: Request,
  context: any,
) {
  const response = await context.next();
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/sitemap.xml') {
    try {
      const liveNews = await liveNewsSitemapEntries();
      const xml = await response.text();
      const nextXml = overlayLiveNewsSitemap(xml, liveNews);
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      headers.set('cache-control', 'public, max-age=300, stale-while-revalidate=600');
      headers.set('x-deals68-seo', 'edge-v1-news-sitemap');
      return new Response(nextXml, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      return response;
    }
  }

  const contentType = response.headers.get('content-type') || '';
  if (
    request.method === 'HEAD' ||
    !contentType.includes('text/html')
  ) {
    return response;
  }

  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const lang = seoLanguageFromPath(pathname);
  const basePath = stripSeoLanguagePrefix(pathname);
  const definition = seoForPath(pathname);

  let pageName =
    lang === 'en' ? definition.pageNameEn : definition.pageNameVi;
  let titleOverride: string | undefined;
  let description =
    lang === 'en'
      ? definition.descriptionEn
      : definition.descriptionVi;
  let image = DEFAULT_SOCIAL_IMAGE;
  let imageAlt: string | undefined;
  let type = definition.type || 'website';
  let noindex = Boolean(definition.noindex);
  let canonicalPath = localizedSeoPath(basePath, lang);
  let alternates: SeoAlternate[] | undefined;
  let jsonLd: Record<string, unknown> | undefined;
  let publishedTime: string | null | undefined;
  let modifiedTime: string | null | undefined;
  let tags: string[] | undefined;

  const businessMatch = basePath.match(/^\/businesses\/([^/]+)$/);
  const investorMatch = basePath.match(/^\/investors\/([^/]+)$/);
  const newsTagMatch = basePath.match(/^\/news\/tag\/([^/]+)$/);
  const newsArticleMatch = basePath.match(/^\/news\/([^/]+)$/);
  const reservedBusinessPaths = new Set([
    'featured',
    'fundraising',
    'sale',
    'debt',
  ]);
  const reservedInvestorPaths = new Set([
    'active',
    'funds',
    'strategic',
  ]);

  if (basePath === '/news') {
    const pageState = validNewsPage(url.searchParams.get('page'));
    const dynamic = newsCollectionSeo(lang, pageState.page);
    pageName = dynamic.pageName;
    titleOverride = dynamic.titleOverride;
    description = dynamic.description;
    image = dynamic.image;
    imageAlt = dynamic.imageAlt;
    type = dynamic.type;
    noindex = dynamic.noindex || !pageState.valid;
    canonicalPath = dynamic.canonicalPath || canonicalPath;
    alternates = pageState.valid ? dynamic.alternates : [];
    jsonLd = dynamic.jsonLd;
  } else if (newsTagMatch) {
    const pageState = validNewsPage(url.searchParams.get('page'));
    const tagSlug = decodeURIComponent(newsTagMatch[1]);
    const dynamic = await newsTagSeo(tagSlug, lang, pageState.page).catch(() => null);
    if (dynamic) {
      pageName = dynamic.pageName;
      titleOverride = dynamic.titleOverride;
      description = dynamic.description;
      image = dynamic.image;
      imageAlt = dynamic.imageAlt;
      type = dynamic.type;
      noindex = dynamic.noindex || !pageState.valid;
      canonicalPath = dynamic.canonicalPath || canonicalPath;
      alternates = pageState.valid ? dynamic.alternates : [];
      jsonLd = dynamic.jsonLd;
    } else {
      pageName = lang === 'en' ? 'News topic' : 'Chủ đề Tin tức';
      titleOverride = `${pageName} | Deals68.com`;
      description = lang === 'en'
        ? 'This Deals68 News topic is not available.'
        : 'Chủ đề Tin tức Deals68 này không khả dụng.';
      noindex = true;
      canonicalPath = localizedNewsPath(lang, `/tag/${encodeURIComponent(tagSlug)}`);
      alternates = [];
    }
  } else if (newsArticleMatch) {
    const articleSlug = decodeURIComponent(newsArticleMatch[1]);
    const dynamic = await newsArticleSeo(articleSlug, lang).catch(() => null);
    if (dynamic) {
      pageName = dynamic.pageName;
      titleOverride = dynamic.titleOverride;
      description = dynamic.description;
      image = dynamic.image;
      imageAlt = dynamic.imageAlt;
      type = dynamic.type;
      noindex = false;
      canonicalPath = dynamic.canonicalPath || canonicalPath;
      alternates = dynamic.alternates;
      jsonLd = dynamic.jsonLd;
      publishedTime = dynamic.publishedTime;
      modifiedTime = dynamic.modifiedTime;
      tags = dynamic.tags;
    } else {
      pageName = lang === 'en' ? 'Article not found' : 'Không tìm thấy bài viết';
      titleOverride = `${pageName} | Deals68.com`;
      description = lang === 'en'
        ? 'This Deals68 News article is not available.'
        : 'Bài viết Tin tức Deals68 này không khả dụng.';
      noindex = true;
      canonicalPath = localizedNewsPath(lang, `/${encodeURIComponent(articleSlug)}`);
      alternates = [];
    }
  } else if (
    businessMatch &&
    !reservedBusinessPaths.has(businessMatch[1])
  ) {
    const dynamic = await businessSeo(
      decodeURIComponent(businessMatch[1]),
      lang,
    ).catch(() => null);

    if (dynamic) {
      pageName = dynamic.pageName;
      description = dynamic.description;
      image = dynamic.image;
      type = dynamic.type;
      noindex = false;
    } else {
      noindex = true;
    }
  } else if (
    investorMatch &&
    !reservedInvestorPaths.has(investorMatch[1])
  ) {
    const dynamic = await investorSeo(
      decodeURIComponent(investorMatch[1]),
      lang,
    ).catch(() => null);

    if (dynamic) {
      pageName = dynamic.pageName;
      description = dynamic.description;
      image = dynamic.image;
      type = dynamic.type;
      noindex = false;
    } else {
      noindex = true;
    }
  }

  const previewHost = isPreviewHost(url.hostname);
  noindex = noindex || previewHost;
  if (previewHost) alternates = [];

  const html = await response.text();
  const seoBlock = renderSeoBlock({
    lang,
    pageName,
    titleOverride,
    description,
    canonicalPath,
    image,
    imageAlt,
    type,
    noindex,
    assetOrigin: url.origin,
    alternates,
    jsonLd,
    publishedTime,
    modifiedTime,
    tags,
  });

  const start = html.indexOf(START);
  const end = html.indexOf(END);
  const nextHtml =
    start >= 0 && end > start
      ? `${html.slice(0, start)}${seoBlock}${html.slice(end + END.length)}`
      : html.replace('</head>', `${seoBlock}\n  </head>`);

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('x-deals68-seo', 'edge-v1');

  return new Response(nextHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
