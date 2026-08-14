#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
let total = 0;

function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function check(label, condition) {
  total += 1;
  if (condition) console.log(`PASS ${label}`);
  else { failures.push(label); console.error(`FAIL ${label}`); }
}
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const appRel = 'src/App.tsx';
const listRel = 'src/pages/News.tsx';
const detailRel = 'src/pages/NewsDetail.tsx';
const cardRel = 'src/components/news/NewsCard.tsx';
const tagsRel = 'src/components/news/NewsTags.tsx';
const sidebarRel = 'src/components/news/NewsSidebar.tsx';
const rendererRel = 'src/components/news/NewsContentRenderer.tsx';
const serviceRel = 'src/services/newsService.ts';
const cssRel = 'src/styles/pages/news.css';
const homeRel = 'src/pages/Home.tsx';
const migrationRel = 'supabase/migrations/20260814044837_news_v1_schema_security.sql';

for (const rel of [appRel, listRel, detailRel, cardRel, tagsRel, sidebarRel, rendererRel, serviceRel, cssRel, homeRel, migrationRel]) {
  check(`${rel} exists`, exists(rel));
}

const app = read(appRel);
const list = read(listRel);
const detail = read(detailRel);
const card = read(cardRel);
const tags = read(tagsRel);
const sidebar = read(sidebarRel);
const renderer = read(rendererRel);
const service = read(serviceRel);
const css = read(cssRel);
const home = read(homeRel);

check('News list and detail are lazy-loaded', /const loadNews = \(\) => import\('\.\/pages\/News'\)/.test(app) && /const News = lazy\(loadNews\)/.test(app) && /const NewsDetail = lazy\(loadNewsDetail\)/.test(app));
for (const route of ['/news', '/news/tag/:tagSlug', '/news/:slug', '/en/news', '/en/news/tag/:tagSlug', '/en/news/:slug']) {
  check(`Public route ${route} exists`, app.includes(`path="${route}"`));
}
check('News public routes are not wrapped in auth gates', !/path="\/(?:en\/)?news[^\"]*"[^\n]*Gate>/.test(app));
check('Route prefetch understands News list/detail', /path === '\/news'[^\n]*loadNewsDetail/.test(app) && /path\.startsWith\('\/news\/'\)[^\n]*loadNews/.test(app));

check('News list uses service layer only', /listPublishedNews/.test(list) && /listNewsByTag/.test(list) && /listNewsTags/.test(list));
check('News list uses 12-row public page contract', /NEWS_DEFAULT_PUBLIC_PAGE_SIZE/.test(list));
check('Tag slug is normalized before querying', /normalizeNewsSlug\(tagSlug\)/.test(list));
check('Tag page handles unknown topic', /Topic not found/.test(list) && /Không tìm thấy chủ đề/.test(list));
check('Out-of-range pagination is handled without claiming zero News', /total > 0 && !rows\.length/.test(list) && /Go to the last page/.test(list));

check('News cards use localized article data', /localizeNewsArticle\(article, language\)/.test(card));
check('News card title is its own link', /d68-news-card__title[\s\S]*<Link to=\{detailPath\}>\{localized\.title\}<\/Link>/.test(card));
check('News tags are separate links', /<NewsTags tags=\{article\.tags\}/.test(card) && /\/news\/tag/.test(tags));
check('News card image is not the whole-card anchor', !/<Link[^>]*className="d68-news-card"/.test(card));

check('News detail loads published article through service', /getNewsBySlug\(slug, lang\)/.test(detail));
check('Recent News is capped at 5 and excludes current article', /getRecentNews\(5, loadedArticle\.id, lang\)/.test(detail));
check('Related News is capped at 4', /getRelatedNews\(loadedArticle\.id, 4, lang\)/.test(detail));
check('Recent/Related failures do not hide core article', /Promise\.allSettled/.test(detail));
check('Detail renders breadcrumb, H1, date, excerpt, tags and hero image', /d68-news-breadcrumb/.test(detail) && /<h1>\{localized\.title\}<\/h1>/.test(detail) && /dateTime=\{localized\.publishedDate\}/.test(detail) && /d68-news-article__excerpt/.test(detail) && /<NewsTags/.test(detail) && /d68-news-article__hero/.test(detail));
check('Detail uses NEWS-04 safe renderer', /<NewsContentRenderer content=\{localized\.content\}/.test(detail));
check('Recent sidebar localizes per language', /localizeNewsArticle\(article, language\)/.test(sidebar));
check('Safe renderer still avoids raw HTML injection', !/dangerouslySetInnerHTML/.test(renderer));

check('Public News grid is 3 columns desktop', /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(css));
check('News card media keeps 4:3 ratio', /d68-news-card__image-link\{[^}]*aspect-ratio:4\/3/.test(css));
check('Detail has desktop content/sidebar layout', /d68-news-detail-layout\{[^}]*grid-template-columns:minmax\(0,1fr\) 310px/.test(css));
check('Public News has tablet breakpoint', /@media\(max-width:980px\)/.test(css));
check('Public News has mobile single-column breakpoint', /@media\(max-width:700px\)[\s\S]*d68-news-grid\{grid-template-columns:1fr/.test(css));
check('Related News has four-card desktop grid', /d68-news-related__grid\{[^}]*repeat\(4,minmax\(0,1fr\)\)/.test(css));

const srcFiles = walk(path.join(root, 'src')).filter((file) => /\.(ts|tsx)$/.test(file));
const directNewsQueries = srcFiles
  .filter((file) => path.resolve(file) !== path.resolve(root, serviceRel))
  .filter((file) => /\.from\(['"]news_(?:articles|tags|article_tags)['"]\)/.test(fs.readFileSync(file, 'utf8')));
check('News table access is not scattered outside newsService', directNewsQueries.length === 0);
check('NEWS-05 does not add Homepage FeaturedNews yet', !/FeaturedNews|d68-home-featured-news/.test(home));

const migrationsDir = path.join(root, 'supabase/migrations');
const newsMigrations = fs.readdirSync(migrationsDir).filter((name) => /news.*\.sql$/i.test(name));
check('NEWS-05 creates no new News migration', newsMigrations.length === 1 && newsMigrations[0] === '20260814044837_news_v1_schema_security.sql');

if (failures.length) {
  console.error(`\nNEWS-05 public pages contract: ${total - failures.length}/${total} PASS`);
  console.error(`Failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log(`\nNEWS-05 public pages contract: ${total}/${total} PASS`);
