#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = 'https://deals68.com';
const outputDir = path.resolve(process.argv[2] || 'dist');
const outputFile = path.join(outputDir, 'sitemap.xml');

const staticViPaths = [
  '/',
  '/businesses',
  '/businesses/featured',
  '/businesses/fundraising',
  '/businesses/sale',
  '/businesses/debt',
  '/news',
  '/pricing',
  '/pricing/business',
  '/pricing/investor',
  '/valuation',
  '/valuation/rules',
  '/about',
  '/how-it-works',
  '/faq',
  '/contact',
  '/partners',
  '/market-partner',
  '/terms',
  '/privacy',
  '/market-intelligence',
  '/localization',
];

const staticEnPaths = [
  '/en',
  '/en/businesses',
  '/en/news',
  '/en/pricing',
  '/en/valuation',
  '/en/about',
  '/en/terms',
  '/en/privacy',
  '/en/contact',
  '/en/partners',
  '/en/market-partner',
];

function xml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchRows(table, select, filters = '') {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';
  if (!url || !key) return [];

  const endpoint =
    `${url.replace(/\/+$/, '')}/rest/v1/${table}` +
    `?select=${encodeURIComponent(select)}${filters}`;

  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) return [];
  const data = await response.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

function entry(urlPath, lastmod = '') {
  const location = `${SITE_URL}${urlPath === '/' ? '/' : urlPath}`;
  return `  <url>\n    <loc>${xml(location)}</loc>${
      lastmod ? `\n    <lastmod>${xml(lastmod.slice(0, 10))}</lastmod>` : ''
    }\n  </url>`;
}

function hasNewsBundle(row, language) {
  const suffix = language === 'en' ? 'en' : 'vi';
  return Boolean(
    row?.published_date
    && String(row?.[`slug_${suffix}`] || '').trim()
    && String(row?.[`title_${suffix}`] || '').trim()
    && String(row?.[`excerpt_${suffix}`] || '').trim()
    && row?.[`content_json_${suffix}`],
  );
}

function newerLastmod(current, candidate) {
  const currentValue = String(current || '');
  const candidateValue = String(candidate || '');
  if (!currentValue) return candidateValue;
  if (!candidateValue) return currentValue;
  return candidateValue > currentValue ? candidateValue : currentValue;
}

async function main() {
  const urls = new Map();

  for (const item of [...staticViPaths, ...staticEnPaths]) {
    urls.set(item, '');
  }

  // Build-time sitemap generation uses only the same redacted public Business
  // view as the browser. Investor list/detail pages require authentication and
  // must never be indexed or fetched with the anon key.
  const businesses = await fetchRows(
    'public_businesses_safe',
    'slug,updated_at',
    '&visible=eq.true&status=eq.active&public_snapshot_json=not.is.null&slug=not.is.null',
  ).catch(() => []);

  for (const row of businesses) {
    const slug = String(row.slug || '').trim();
    if (!slug) continue;
    const encoded = encodeURIComponent(slug);
    urls.set(`/businesses/${encoded}`, row.updated_at || '');
    urls.set(`/en/businesses/${encoded}`, row.updated_at || '');
  }

  // NEWS-07: News sitemap rows are read through the anon role and are still
  // explicitly constrained to Published + non-deleted content. VI and EN URLs
  // are emitted independently so an incomplete EN bundle never creates a fake
  // translated URL.
  const newsArticles = await fetchRows(
    'news_articles',
    'id,status,slug_vi,slug_en,title_vi,title_en,excerpt_vi,excerpt_en,content_json_vi,content_json_en,published_date,updated_at,deleted_at',
    '&status=eq.published&deleted_at=is.null&published_date=not.is.null&order=published_date.desc&limit=5000',
  ).catch(() => []);

  const articleLanguages = new Map();
  let latestViNews = '';
  let latestEnNews = '';

  for (const row of newsArticles) {
    const articleId = String(row.id || '').trim();
    if (!articleId) continue;
    const vi = hasNewsBundle(row, 'vi');
    const en = hasNewsBundle(row, 'en');
    articleLanguages.set(articleId, { vi, en, updatedAt: row.updated_at || row.published_date || '' });

    if (vi) {
      const slug = String(row.slug_vi || '').trim();
      urls.set(`/news/${encodeURIComponent(slug)}`, row.updated_at || row.published_date || '');
      latestViNews = newerLastmod(latestViNews, row.updated_at || row.published_date || '');
    }
    if (en) {
      const slug = String(row.slug_en || '').trim();
      urls.set(`/en/news/${encodeURIComponent(slug)}`, row.updated_at || row.published_date || '');
      latestEnNews = newerLastmod(latestEnNews, row.updated_at || row.published_date || '');
    }
  }

  if (latestViNews) urls.set('/news', latestViNews);
  if (latestEnNews) urls.set('/en/news', latestEnNews);

  // Tag pages are emitted only when at least one sitemap-eligible article in
  // that language is linked to the tag. This keeps empty/localization-only tag
  // routes out of the index.
  const [newsRelations, newsTags] = await Promise.all([
    fetchRows('news_article_tags', 'article_id,tag_id', '&limit=10000').catch(() => []),
    fetchRows('news_tags', 'id,slug', '&limit=5000').catch(() => []),
  ]);
  const tagById = new Map(
    newsTags
      .map((tag) => [String(tag.id || ''), String(tag.slug || '').trim()])
      .filter(([id, slug]) => id && slug),
  );
  const tagLastmods = new Map();

  for (const relation of newsRelations) {
    const article = articleLanguages.get(String(relation.article_id || ''));
    const tagSlug = tagById.get(String(relation.tag_id || ''));
    if (!article || !tagSlug) continue;

    const state = tagLastmods.get(tagSlug) || { vi: '', en: '' };
    if (article.vi) state.vi = newerLastmod(state.vi, article.updatedAt);
    if (article.en) state.en = newerLastmod(state.en, article.updatedAt);
    tagLastmods.set(tagSlug, state);
  }

  for (const [tagSlug, state] of tagLastmods.entries()) {
    const encoded = encodeURIComponent(tagSlug);
    if (state.vi) urls.set(`/news/tag/${encoded}`, state.vi);
    if (state.en) urls.set(`/en/news/tag/${encoded}`, state.en);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const body = Array.from(urls.entries())
    .map(([urlPath, lastmod]) => entry(urlPath, lastmod))
    .join('\n');

  fs.writeFileSync(
    outputFile,
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
    'utf8',
  );

  console.log(`Generated ${outputFile} with ${urls.size} URLs.`);
}

main().catch((error) => {
  console.error('Sitemap generation failed:', error);
  process.exit(1);
});
