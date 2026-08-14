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

function newerLastmod(current, candidate) {
  const currentValue = String(current || '');
  const candidateValue = String(candidate || '');
  if (!currentValue) return candidateValue;
  if (!candidateValue) return currentValue;
  return candidateValue > currentValue ? candidateValue : currentValue;
}

function mergeNewsLanguage(articleLanguages, row, language) {
  const articleId = String(row.id || '').trim();
  if (!articleId) return;
  const current = articleLanguages.get(articleId) || { vi: false, en: false, updatedAt: '' };
  current[language] = true;
  current.updatedAt = newerLastmod(current.updatedAt, row.updated_at || row.published_date || '');
  articleLanguages.set(articleId, current);
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

  // NEWS-07: query VI and EN independently with explicit language-bundle
  // filters. This avoids downloading rich content JSON during postbuild while
  // ensuring an incomplete translation never creates an indexable URL.
  const commonNewsFilters = '&status=eq.published&deleted_at=is.null&published_date=not.is.null&order=published_date.desc&limit=5000';
  const [viNewsArticles, enNewsArticles] = await Promise.all([
    fetchRows(
      'news_articles',
      'id,slug_vi,published_date,updated_at',
      `${commonNewsFilters}&slug_vi=not.is.null&title_vi=not.is.null&excerpt_vi=not.is.null&content_json_vi=not.is.null`,
    ).catch(() => []),
    fetchRows(
      'news_articles',
      'id,slug_en,published_date,updated_at',
      `${commonNewsFilters}&slug_en=not.is.null&title_en=not.is.null&excerpt_en=not.is.null&content_json_en=not.is.null`,
    ).catch(() => []),
  ]);

  const articleLanguages = new Map();
  let latestViNews = '';
  let latestEnNews = '';

  for (const row of viNewsArticles) {
    const slug = String(row.slug_vi || '').trim();
    if (!slug) continue;
    const lastmod = row.updated_at || row.published_date || '';
    urls.set(`/news/${encodeURIComponent(slug)}`, lastmod);
    latestViNews = newerLastmod(latestViNews, lastmod);
    mergeNewsLanguage(articleLanguages, row, 'vi');
  }

  for (const row of enNewsArticles) {
    const slug = String(row.slug_en || '').trim();
    if (!slug) continue;
    const lastmod = row.updated_at || row.published_date || '';
    urls.set(`/en/news/${encodeURIComponent(slug)}`, lastmod);
    latestEnNews = newerLastmod(latestEnNews, lastmod);
    mergeNewsLanguage(articleLanguages, row, 'en');
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
