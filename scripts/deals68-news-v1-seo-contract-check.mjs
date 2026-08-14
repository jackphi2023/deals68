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
const edgeRel = 'netlify/edge-functions/seo.ts';
const netlifyRel = 'netlify.toml';
const packageRel = 'package.json';
const robotsRel = 'public/robots.txt';

for (const rel of [seoRel, listRel, detailRel, typesRel, sitemapRel, edgeRel, netlifyRel, packageRel, robotsRel]) {
  check(`${rel} exists`, exists(rel));
}

const seo = read(seoRel);
const list = read(listRel);
const detail = read(detailRel);
const types = read(typesRel);
const sitemap = read(sitemapRel);
const edge = read(edgeRel);
const netlify = read(netlifyRel);
const pkg = read(packageRel);
const robots = read(robotsRel);

// Browser/SPA SEO owner.
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
check('Browser News SEO does not invent x-default alternate', !/hreflang\s*=\s*['"]x-default/.test(seo));

check('News list uses collection SEO', /NewsCollectionSeo/.test(list));
check('News list canonical preserves real pagination', /seoPath = paginationHref\(basePath, page(?:, selectedMonth)?\)/.test(list));
check('Month-filtered canonical preserves the selected archive month', /seoPath = paginationHref\(basePath, page, selectedMonth\)/.test(list));
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

// Initial HTML / social unfurl SEO owner.
check('Netlify routes all requests through the existing SEO Edge function', /\[\[edge_functions\]\][\s\S]*function\s*=\s*"seo"[\s\S]*path\s*=\s*"\/\*"/.test(netlify));
check('Edge News SEO uses anon credentials only', /VITE_SUPABASE_ANON_KEY/.test(edge) && /SUPABASE_ANON_KEY/.test(edge) && !/SERVICE_ROLE|service_role/i.test(edge));
check('Edge handles News root', /basePath === '\/news'/.test(edge));
check('Edge handles News tag route before article route', edge.indexOf('newsTagMatch') >= 0 && edge.indexOf('newsArticleMatch') > edge.indexOf('newsTagMatch'));
check('Edge article lookup explicitly requires Published state', /addPublishedNewsFilters[\s\S]*status.*eq\.published/.test(edge));
check('Edge article lookup explicitly excludes soft-deleted rows', /addPublishedNewsFilters[\s\S]*deleted_at.*is\.null/.test(edge));
check('Edge article lookup requires editorial published_date', /addPublishedNewsFilters[\s\S]*published_date.*not\.is\.null/.test(edge));
check('Edge language bundle requires slug title excerpt and body', /const slugKey = `slug_\$\{suffix\}`[\s\S]*title_\$\{suffix\}[\s\S]*excerpt_\$\{suffix\}[\s\S]*content_json_\$\{suffix\}/.test(edge));
check('Edge requested article slug cannot be overwritten by bundle filter', /if \(!params\.has\(slugKey\)\) params\.set\(slugKey, 'not\.is\.null'\)/.test(edge) && /params\.set\(`slug_\$\{suffix\}`, `eq\.\$\{slug\}`\)[\s\S]*addPublishedNewsFilters\(params, lang\)/.test(edge));
check('Edge article uses Admin SEO title with fallback', /seoTitle \|\| `\$\{articleTitle\} \| Deals68\.com`/.test(edge));
check('Edge article uses Admin SEO description with excerpt fallback', /seoDescription \|\| excerpt/.test(edge));
check('Edge article emits NewsArticle JSON-LD', /'@type': 'NewsArticle'/.test(edge));
check('Edge NewsArticle datePublished uses published_date', /datePublished: article\.published_date/.test(edge));
check('Edge NewsArticle dateModified uses updated_at', /dateModified: article\.updated_at/.test(edge));
check('Edge NewsArticle canonical is mainEntityOfPage', /mainEntityOfPage[\s\S]*'@id': canonical/.test(edge));
check('Edge article hreflang requires opposite complete bundle', /newsAlternateForArticle/.test(edge) && /addPublishedNewsFilters\(params, lang\)/.test(edge) && /if \(alternateSlug\)/.test(edge));
check('Edge News alternates are typed VI/EN only', /type SeoAlternate = \{ hreflang: SeoLanguage; path: string \}/.test(edge));
check('Legacy x-default remains isolated to non-News automatic SEO', /input\.alternates === undefined[\s\S]*'x-default'/.test(edge));
check('Edge emits OG and Twitter metadata in initial HTML', /og:title/.test(edge) && /twitter:card/.test(edge));
check('Edge emits article published and modified meta', /article:published_time/.test(edge) && /article:modified_time/.test(edge));
check('Edge escapes CMS strings before HTML attributes/text', /function escapeHtml/.test(edge) && /escapeHtml\(input\.imageAlt \|\| input\.pageName\)/.test(edge));
check('Edge JSON-LD prevents script breakout', /function safeJson[\s\S]*\\u003c/.test(edge));
check('Unavailable Edge News article is noindex', /Article not found[\s\S]*noindex = true/.test(edge));
check('Empty or unavailable Edge tag is noindex', /newsTagSeo[\s\S]*!currentEligible[\s\S]*noindex: true/.test(edge));
check('Preview hosts remain noindex', /previewHost[\s\S]*noindex = noindex \|\| previewHost/.test(edge));

// Build-time fallback sitemap.
check('Sitemap includes VI News root', /'\/news'/.test(sitemap));
check('Sitemap includes EN News root', /'\/en\/news'/.test(sitemap));
check('Sitemap fetches News through anon REST at build time', /fetchRows\([\s\S]*'news_articles'/.test(sitemap));
check('Sitemap explicitly requires Published News', /status=eq\.published/.test(sitemap));
check('Sitemap explicitly excludes soft-deleted News', /deleted_at=is\.null/.test(sitemap));
check('Sitemap requires published_date', /published_date=not\.is\.null/.test(sitemap));
check('Sitemap queries VI and EN article URLs independently', /viNewsArticles/.test(sitemap) && /enNewsArticles/.test(sitemap));
check('Sitemap VI bundle requires slug title excerpt content', /slug_vi=not\.is\.null/.test(sitemap) && /title_vi=not\.is\.null/.test(sitemap) && /excerpt_vi=not\.is\.null/.test(sitemap) && /content_json_vi=not\.is\.null/.test(sitemap));
check('Sitemap EN bundle requires slug title excerpt content', /slug_en=not\.is\.null/.test(sitemap) && /title_en=not\.is\.null/.test(sitemap) && /excerpt_en=not\.is\.null/.test(sitemap) && /content_json_en=not\.is\.null/.test(sitemap));
check('Sitemap selects only lightweight News metadata', /'id,slug_vi,published_date,updated_at'/.test(sitemap) && /'id,slug_en,published_date,updated_at'/.test(sitemap));
check('Sitemap includes News tag pages only from eligible linked articles', /news_article_tags/.test(sitemap) && /tagLastmods/.test(sitemap) && /\/news\/tag\//.test(sitemap) && /\/en\/news\/tag\//.test(sitemap));
check('Sitemap lastmod uses News update/publication timestamps', /row\.updated_at \|\| row\.published_date/.test(sitemap));
check('Existing postbuild still owns fallback sitemap generation', /"postbuild": "node scripts\/generate-sitemap\.mjs dist"/.test(pkg));

// Live editorial sitemap overlay.
check('Edge intercepts sitemap.xml', /url\.pathname === '\/sitemap\.xml'/.test(edge));
check('Live sitemap uses strict anon reads so failures preserve fallback', /fetchRowsStrict/.test(edge) && /catch \{[\s\S]*return response/.test(edge));
check('Live sitemap queries VI and EN bundles independently', /liveNewsSitemapEntries[\s\S]*buildLanguageParams\('vi'\)[\s\S]*buildLanguageParams\('en'\)/.test(edge));
check('Live sitemap strips stale News URLs before overlay', /overlayLiveNewsSitemap[\s\S]*isNewsSitemapLoc/.test(edge));
check('Live sitemap adds article and tag URLs by available language', /\/news\/\$\{encodeURIComponent\(slug\)\}/.test(edge) && /\/en\/news\/\$\{encodeURIComponent\(slug\)\}/.test(edge) && /\/news\/tag\/\$\{encoded\}/.test(edge) && /\/en\/news\/tag\/\$\{encoded\}/.test(edge));
check('Live sitemap uses updated_at with published_date fallback', /row\.updated_at \|\| row\.published_date/.test(edge));
check('Live sitemap has short cache window for editorial changes', /max-age=300/.test(edge));
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
