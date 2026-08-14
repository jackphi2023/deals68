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

const homeRel = 'src/pages/Home.tsx';
const featuredRel = 'src/components/news/FeaturedNews.tsx';
const cardRel = 'src/components/news/NewsCard.tsx';
const serviceRel = 'src/services/newsService.ts';
const appRel = 'src/App.tsx';
const newsCssRel = 'src/styles/pages/news.css';

for (const rel of [homeRel, featuredRel, cardRel, serviceRel, appRel, newsCssRel]) {
  check(`${rel} exists`, exists(rel));
}

const home = read(homeRel);
const featured = read(featuredRel);
const card = read(cardRel);
const service = read(serviceRel);
const app = read(appRel);
const newsCss = read(newsCssRel);

check('Homepage imports FeaturedNews', /import FeaturedNews from ['"]\.\.\/components\/news\/FeaturedNews['"]/.test(home));
check('Homepage renders FeaturedNews with current language', /<FeaturedNews\s+lang=\{lang\}\s*\/>/.test(home));

const howIndex = home.indexOf('d68-home-how');
const featuredIndex = home.indexOf('<FeaturedNews lang={lang} />');
const mainCloseIndex = home.lastIndexOf('</main>');
check('Featured News is after How it works', howIndex >= 0 && featuredIndex > howIndex);
check('Featured News is the final Homepage content block above Footer', featuredIndex >= 0 && featuredIndex < mainCloseIndex && /<FeaturedNews\s+lang=\{lang\}\s*\/>\s*<\/main>/.test(home));
check('Homepage has exactly one FeaturedNews render', (home.match(/<FeaturedNews\s+lang=\{lang\}\s*\/>/g) || []).length === 1);

check('FeaturedNews uses NEWS-02 service instead of direct Supabase query', /getFeaturedNews/.test(featured) && !/\.from\(['"]news_/.test(featured));
check('FeaturedNews requests at most 3 rows', /getFeaturedNews\(3,\s*lang\)/.test(featured) && /slice\(0,\s*3\)/.test(featured));
check('FeaturedNews resets on language changes', /setRows\(\[\]\)/.test(featured) && /\[lang\]/.test(featured));
check('FeaturedNews hides when no eligible rows exist', /if \(!rows\.length\) return null/.test(featured));
check('FeaturedNews fails closed on query error', /\.catch\(\(\) =>[\s\S]*setRows\(\[\]\)/.test(featured));
check('FeaturedNews links VI to /news and EN to /en/news', /lang === 'en' \? '\/en\/news' : '\/news'/.test(featured));
check('FeaturedNews renders localized section title', /'Featured News'/.test(featured) && /'Tin nổi bật'/.test(featured));
check('FeaturedNews exposes View all action', /'View all'/.test(featured) && /'Xem tất cả'/.test(featured));
check('FeaturedNews reuses NewsCard', /import NewsCard/.test(featured) && /<NewsCard/.test(featured));
check('Homepage News cards show image title excerpt only', /showDate=\{false\}/.test(featured) && /showTags=\{false\}/.test(featured));

check('NewsCard keeps date visible by default outside Homepage', /showDate = true/.test(card));
check('NewsCard keeps tags visible by default outside Homepage', /showTags = true/.test(card));
check('NewsCard keeps excerpt for non-compact cards', /!compact \? <p>\{localized\.excerpt\}<\/p> : null/.test(card));

check('Homepage Featured News section uses transparent shared canvas', /\.d68-featured-news-home\{background:transparent\}/.test(newsCss));
check('Homepage Featured News cards remove border', /\.d68-featured-news-home \.d68-news-card\{[^}]*border:0/.test(newsCss));
check('Homepage Featured News cards remove card background', /\.d68-featured-news-home \.d68-news-card\{[^}]*background:transparent/.test(newsCss));
check('Homepage Featured News cards remove shadow', /\.d68-featured-news-home \.d68-news-card\{[^}]*box-shadow:none/.test(newsCss));
check('Homepage Featured News keeps image as the visual surface', /\.d68-featured-news-home \.d68-news-card__image-link\{[^}]*border-radius:14px/.test(newsCss));
check('Homepage Featured News body has no card-side padding', /\.d68-featured-news-home \.d68-news-card__body\{padding:14px 0 0\}/.test(newsCss));

check('Featured service requires published status', /getFeaturedNews[\s\S]*\.eq\('status', 'published'\)/.test(service));
check('Featured service excludes soft-deleted rows', /getFeaturedNews[\s\S]*\.is\('deleted_at', null\)/.test(service));
check('Featured service requires is_featured true', /getFeaturedNews[\s\S]*\.eq\('is_featured', true\)/.test(service));
check('Featured service is language-bundle aware', /getFeaturedNews[\s\S]*requireLanguageBundle\(query, language\)/.test(service));
check('Featured service orders by editorial date then creation date', /getFeaturedNews[\s\S]*\.order\('published_date', \{ ascending: false \}\)[\s\S]*\.order\('created_at', \{ ascending: false \}\)/.test(service));
check('Featured service enforces requested limit', /getFeaturedNews[\s\S]*\.limit\(safeLimit\)/.test(service));

check('NEWS-06 does not add another Homepage News route', (app.match(/path="\/news"/g) || []).length === 1 && (app.match(/path="\/en\/news"/g) || []).length === 1);
check('NEWS-06 leaves public News pages available', /path="\/news"[\s\S]*<News lang="vi"/.test(app) && /path="\/en\/news"[\s\S]*<News lang="en"/.test(app));

const migrationsDir = path.join(root, 'supabase/migrations');
const newsMigrations = fs.readdirSync(migrationsDir).filter((name) => /news.*\.sql$/i.test(name));
check('NEWS-06 creates no new News database migration', newsMigrations.length === 1 && newsMigrations[0] === '20260814044837_news_v1_schema_security.sql');

if (failures.length) {
  console.error(`\nNEWS-06 Homepage Featured News contract: ${total - failures.length}/${total} PASS`);
  console.error(`Failed: ${failures.join('; ')}`);
  process.exit(1);
}

console.log(`\nNEWS-06 Homepage Featured News contract: ${total}/${total} PASS`);
