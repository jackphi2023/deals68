#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
let total = 0;

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function check(label, condition) {
  total += 1;
  if (condition) console.log(`PASS ${label}`);
  else {
    failures.push(label);
    console.error(`FAIL ${label}`);
  }
}

const seoRel = 'src/components/news/NewsSeo.tsx';
const listRel = 'src/pages/News.tsx';
const detailRel = 'src/pages/NewsDetail.tsx';
const typesRel = 'src/lib/newsTypes.ts';
const sitemapRel = 'scripts/generate-sitemap.mjs';
const packageRel = 'package.json';
const robotsRel = 'public/robots.txt';

for (const rel of [seoRel, listRel, detailRel, typesRel, sitemapRel, packageRel, robotsRel]) {
  check(`${rel} exists`, exists(rel));
}

const seo = read(seoRel);
const list = read(listRel);
const detail = read(detailRel);
const types = read(typesRel);
const sitemap = read(sitemapRel);
const pkg = read(packageRel);
const robots = read(robotsRel);

check('SEO canonical host is Deals68 production', /NEWS_SITE_URL = 'https:\/\/deals68\.com'/.test(seo));
check('SEO manages document title', /document\.title = title/.test(seo));
check('SEO manages meta description', /meta\[name="description"\]/.test(seo));
check('SEO manages canonical URL', /link\[rel="canonical"\]/.test(seo));
check('SEO manages hreflang alternates', /link\[rel="alternate"\]\[hreflang\]/.test(seo));
check('SEO manages Open Graph title', /og:title/.test(seo));
check('SEO manages Open Graph description', /og:description/.test(seo));
check('SEO manages Open Graph URL', /og:url/.test(seo));
check('SEO manages Open Graph image', /og:image/.test(seo));
check('SEO manages Twitter large card', /twitter:card[\s\S]*summary_large_image/.test(seo));
check('SEO updates JSON-LD through textContent, not raw HTML', /element\.textContent = JSON\.stringify/.test(seo) && !/dangerouslySetInnerHTML/.test(seo));
check('Collection pages emit CollectionPage JSON-LD', /'@type': 'CollectionPage'/.test(seo));
check('Detail emits NewsArticle JSON-LD', /'@type': 'NewsArticle'/.test(seo));
check('NewsArticle datePublished uses editorial publishedDate', /datePublished: localized\.publishedDate/.test(seo));
check('NewsArticle dateModified uses updatedAt', /dateModified: localized\.updatedAt/.test(seo));
check('NewsArticle canonical is mainEntityOfPage', /mainEntityOfPage[\s\S]*'@id': canonical/.test(seo));
check('NewsArticle uses Admin SEO title with title fallback', /localized\.seoTitle \|\| `\$\{localized\.title\} \| Deals68\.com`/.test(seo));
check('NewsArticle uses Admin SEO description with excerpt fallback', /localized\.seoDescription \|\| localized\.excerpt/.test(seo));
check('NewsArticle uses featured image when available', /localized\.featuredImageUrl/.test(seo) && /jsonLd\.image/.test(seo));
check('NewsArticle hreflang is conditional on a real alternate bundle', /const alternate = localizeNewsArticle\(article, otherLang\)/.test(seo) && /alternatePath = alternate/.test(seo));
check('News SEO restores default head state on SPA navigation', /restorers[\s\S]*reverse\(\)[\s\S]*restore/.test(seo));
check('News SEO does not invent x-default alternate', !/hreflang\s*=\s*['"]x-default/.test(seo));

check('News list uses collection SEO', /NewsCollectionSeo/.test(list));
check('News list canonical preserves real pagination', /seoPath = paginationHref\(basePath, page\)/.test(list));
check('Paginated list does not fabricate language alternate', /page === 1/.test(list) && /alternatePath/.test(list));
check('Tag hreflang checks opposite-language published content', /alternateLanguage[\s\S]*listNewsByTag\(normalizedTagSlug/.test(list) && /alternateResult[\s\S]*total > 0/.test(list));
check('Tag hreflang probe cannot break the primary page', /listNewsByTag\(normalizedTagSlug,[\s\S]*language: alternateLanguage,[\s\S]*\)\.catch\(\(\) => null\)/.test(list));
check('Tag not found and empty tag can be noindexed', /noindex = loading[\s\S]*!tag[\s\S]*total === 0/.test(list));
check('List SEO title includes page number when paginated', /Page \$\{page\}/.test(list) && /Trang \$\{page\}/.test(list));

check('News detail uses NewsArticleSeo for published article', /<NewsArticleSeo article=\{article\} lang=\{lang\}/.test(detail));
check('News detail loading/error/not-found use noindex state SEO', /NewsStateSeo/.test(detail));
check('News detail canonical normalizes requested slug for unavailable states', /normalizeNewsSlug\(slug\)/.test(detail));

check('News type contains optional localized SEO title fields', /seo_title_vi: string \| null/.test(types) && /seo_title_en: string \| null/.test(types));
check('News type contains optional localized SEO description fields', /seo_description_vi: string \| null/.test(types) && /seo_description_en: string \| null/.test(types));

check('Sitemap includes VI News root', /'\/news'/.test(sitemap));
check('Sitemap includes EN News root', /'\/en\/news'/.test(sitemap));
check('Sitemap fetches News through anon REST at build time', /fetchRows\([\s\S]*'news_articles'/.test(sitemap));
check('Sitemap explicitly requires Published News', /status=eq\.published/.test(sitemap));
check('Sitemap explicitly excludes soft-deleted News', /deleted_at=is\.null/.test(sitemap));
check('Sitemap requires published_date', /published_date=not\.is\.null/.test(sitemap));
check('Sitemap queries VI and EN article URLs independently', /viNewsArticles/.test(sitemap) && /enNewsArticles/.test(sitemap));
check('Sitemap VI bundle requires slug title excerpt content', /slug_vi=not\.is\.null/.test(sitemap) && /title_vi=not\.is\.null/.test(sitemap) && /excerpt_vi=not\.is\.null/.test(sitemap) && /content_json_vi=not\.is\.null/.test(sitemap));
check('Sitemap EN bundle requires slug title excerpt content', /slug_en=not\.is\.null/.test(sitemap) && /title_en=not\.is\.null/.test(sitemap) && /excerpt_en=not\.is\.null/.test(sitemap) && /content_json_en=not\.is\.null/.test(sitemap));
check('Sitemap does not download rich content JSON in select payload', !/'[^']*content_json_vi[^']*'/.test(sitemap.match(/fetchRows\([\s\S]*?viNewsArticles[\s\S]*?\);/)?.[0] || '') || /'id,slug_vi,published_date,updated_at'/.test(sitemap));
check('Sitemap includes News tag pages only from eligible linked articles', /news_article_tags/.test(sitemap) && /tagLastmods/.test(sitemap) && /\/news\/tag\//.test(sitemap) && /\/en\/news\/tag\//.test(sitemap));
check('Sitemap lastmod uses News update/publication timestamps', /row\.updated_at \|\| row\.published_date/.test(sitemap));
check('Existing postbuild still owns sitemap generation', /"postbuild": "node scripts\/generate-sitemap\.mjs dist"/.test(pkg));
check('Robots still advertises production sitemap', /Sitemap: https:\/\/deals68\.com\/sitemap\.xml/.test(robots));
check('No external SEO framework dependency was added', !/react-helmet|helmet-async|next-seo/.test(pkg));

const migrationsDir = path.join(root, 'supabase/migrations');
const newsMigrations = fs.readdirSync(migrationsDir).filter((name) => /news.*\.sql$/i.test(name));
check('NEWS-07 creates no new News database migration', newsMigrations.length === 1 && newsMigrations[0] === '20260814044837_news_v1_schema_security.sql');

if (failures.length) {
  console.error(`\nNEWS-07 SEO contract: ${total - failures.length}/${total} PASS`);
  console.error(`Failed: ${failures.join('; ')}`);
  process.exit(1);
}

console.log(`\nNEWS-07 SEO contract: ${total}/${total} PASS`);
