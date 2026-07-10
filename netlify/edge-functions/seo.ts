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

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

async function fetchRows(
  table: string,
  params: URLSearchParams,
): Promise<any[]> {
  const url =
    Netlify.env.get('VITE_SUPABASE_URL') ||
    Netlify.env.get('SUPABASE_URL') ||
    '';
  const key =
    Netlify.env.get('VITE_SUPABASE_ANON_KEY') ||
    Netlify.env.get('SUPABASE_ANON_KEY') ||
    '';

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

async function businessSeo(slug: string, lang: 'vi' | 'en') {
  const params = new URLSearchParams();
  params.set(
    'select',
    'id,slug,title_vi,title_en,description_vi,description_en,highlights_vi,highlights_en,hero_image_url,image_url,updated_at',
  );
  params.set('slug', `eq.${slug}`);
  params.set('visible', 'eq.true');
  params.set('status', 'eq.active');
  params.set('limit', '1');

  const business = (await fetchRows('businesses', params))[0];
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

async function investorSeo(code: string, lang: 'vi' | 'en') {
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

function isPreviewHost(hostname: string) {
  return !['deals68.com', 'www.deals68.com'].includes(
    hostname.toLowerCase(),
  );
}

function renderSeoBlock(input: {
  lang: 'vi' | 'en';
  pageName: string;
  description: string;
  canonicalPath: string;
  image: string;
  type: 'website' | 'article';
  noindex: boolean;
  assetOrigin: string;
}) {
  const title = buildSeoTitle(input.pageName, input.lang);
  const description = cleanDescription(input.description);
  const canonical = `${SITE_URL}${input.canonicalPath === '/' ? '/' : input.canonicalPath}`;
  const image = absoluteUrl(input.image, input.assetOrigin);
  const robots = input.noindex
    ? 'noindex,nofollow,noarchive'
    : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
  const basePath =
    input.canonicalPath.replace(/^\/en(?=\/|$)/, '') || '/';

  const alternates =
    !input.noindex && supportsEnglishSeoPath(basePath)
      ? [
          `<link rel="alternate" hreflang="vi" href="${escapeHtml(`${SITE_URL}${localizedSeoPath(basePath, 'vi')}`)}" />`,
          `<link rel="alternate" hreflang="en" href="${escapeHtml(`${SITE_URL}${localizedSeoPath(basePath, 'en')}`)}" />`,
          `<link rel="alternate" hreflang="x-default" href="${escapeHtml(`${SITE_URL}${localizedSeoPath(basePath, 'vi')}`)}" />`,
        ].join('\n    ')
      : '';

  const pageJsonLd = {
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
    <meta property="og:image:alt" content="${escapeHtml(input.pageName)}" />
    <meta property="og:type" content="${input.type}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:site_name" content="Deals68.com" />
    <meta property="og:locale" content="${input.lang === 'en' ? 'en_US' : 'vi_VN'}" />
    ${
      image.endsWith('/assets/deals68-image.jpg')
        ? '<meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />\n    <meta property="og:image:type" content="image/jpeg" />'
        : ''
    }
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(input.pageName)}" />
    <script type="application/ld+json" id="d68-page-jsonld">${safeJson(pageJsonLd)}</script>
    ${END}`;
}

export default async function seoEdgeFunction(
  request: Request,
  context: any,
) {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';

  if (
    request.method === 'HEAD' ||
    !contentType.includes('text/html')
  ) {
    return response;
  }

  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const lang = seoLanguageFromPath(pathname);
  const basePath = stripSeoLanguagePrefix(pathname);
  const definition = seoForPath(pathname);

  let pageName =
    lang === 'en' ? definition.pageNameEn : definition.pageNameVi;
  let description =
    lang === 'en'
      ? definition.descriptionEn
      : definition.descriptionVi;
  let image = DEFAULT_SOCIAL_IMAGE;
  let type = definition.type || 'website';
  let noindex = Boolean(definition.noindex);

  const businessMatch = basePath.match(/^\/businesses\/([^/]+)$/);
  const investorMatch = basePath.match(/^\/investors\/([^/]+)$/);
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

  if (
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

  noindex = noindex || isPreviewHost(url.hostname);

  const canonicalPath = localizedSeoPath(basePath, lang);
  const html = await response.text();
  const seoBlock = renderSeoBlock({
    lang,
    pageName,
    description,
    canonicalPath,
    image,
    type,
    noindex,
    assetOrigin: url.origin,
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
