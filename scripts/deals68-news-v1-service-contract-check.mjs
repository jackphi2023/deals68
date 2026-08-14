#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
let total = 0;
const releaseMode = process.env.D68_NEWS_RELEASE_MODE === '1';

function check(label, condition) {
  total += 1;
  if (condition) console.log(`PASS ${label}`);
  else {
    failures.push(label);
    console.error(`FAIL ${label}`);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

const typesRel = 'src/lib/newsTypes.ts';
const serviceRel = 'src/services/newsService.ts';
const appRel = 'src/App.tsx';
const migrationRel = 'supabase/migrations/20260814044837_news_v1_schema_security.sql';

check('NEWS-01 migration remains present', exists(migrationRel));
check('News V1 types file exists', exists(typesRel));
check('News V1 service file exists', exists(serviceRel));

const types = exists(typesRel) ? read(typesRel) : '';
const service = exists(serviceRel) ? read(serviceRel) : '';
const app = exists(appRel) ? read(appRel) : '';

check(
  'News status contract matches schema',
  /NewsArticleStatus\s*=\s*'draft'\s*\|\s*'published'\s*\|\s*'deleted'/m.test(types),
);
check(
  'News language contract is VI EN',
  /NewsLanguage\s*=\s*'vi'\s*\|\s*'en'/m.test(types),
);
check('News content stays structured JSON', /NewsContentJson\s*=\s*Record<string, unknown>/m.test(types));
check('Public News page size defaults to 12', /NEWS_DEFAULT_PUBLIC_PAGE_SIZE\s*=\s*12/.test(types));
check('Admin News page size defaults to 20', /NEWS_DEFAULT_ADMIN_PAGE_SIZE\s*=\s*20/.test(types));
check('Public list options carry language explicitly', /NewsPublicListOptions[\s\S]*language\?: NewsLanguage/.test(types));
check('News slugs are normalized centrally', /export function normalizeNewsSlug/.test(types));
check('Localization helper does not auto-copy VI article text into EN fields', (
  /language === 'en' \? article\.title_en : article\.title_vi/.test(types) &&
  /language === 'en' \? article\.excerpt_en : article\.excerpt_vi/.test(types) &&
  /language === 'en' \? article\.content_json_en : article\.content_json_vi/.test(types)
));

check(
  'News service reuses shared Deals68 Supabase client',
  /import \{ supabase \} from ['"]\.\.\/lib\/supabase['"]/.test(service),
);
check(
  'Public service enforces complete language bundles',
  /function requireLanguageBundle[\s\S]*slug_\$\{suffix\}[\s\S]*title_\$\{suffix\}[\s\S]*excerpt_\$\{suffix\}[\s\S]*content_json_\$\{suffix\}/.test(service),
);

const requiredFunctions = [
  'listPublishedNews',
  'getNewsBySlug',
  'listNewsByTag',
  'getFeaturedNews',
  'getRecentNews',
  'getRelatedNews',
  'listNewsTags',
  'adminListNews',
  'adminGetNewsById',
  'adminCreateNews',
  'adminUpdateNews',
  'adminDeleteNews',
  'adminEnsureNewsTags',
  'adminSetNewsArticleTags',
];
for (const fn of requiredFunctions) {
  check(`News service exports ${fn}`, new RegExp(`export async function ${fn}\\b`).test(service));
}

const publicFunctionNames = [
  'listPublishedNews',
  'getNewsBySlug',
  'listNewsByTag',
  'getFeaturedNews',
  'getRelatedNews',
];
for (const fn of publicFunctionNames) {
  const start = service.indexOf(`export async function ${fn}`);
  const nextExport = service.indexOf('\nexport async function ', start + 1);
  const body = start >= 0 ? service.slice(start, nextExport >= 0 ? nextExport : service.length) : '';
  check(`${fn} explicitly filters published rows`, /\.eq\('status', 'published'\)/.test(body));
  check(`${fn} explicitly excludes deleted rows`, /\.is\('deleted_at', null\)/.test(body));
  check(`${fn} applies language availability`, /requireLanguageBundle\(query, language\)/.test(body));
}

check(
  'Recent News delegates to language-aware published listing',
  /getRecentNews[\s\S]*listPublishedNews\(\{ page: 1, pageSize: requested, language \}\)/.test(service),
);
check(
  'Published News ordering uses editorial date then creation date',
  /\.order\('published_date', \{ ascending: false \}\)[\s\S]*\.order\('created_at', \{ ascending: false \}\)/.test(service),
);
check(
  'Admin News list orders by most recently updated',
  /adminListNews[\s\S]*\.order\('updated_at', \{ ascending: false \}\)/.test(service),
);
check(
  'Admin News list defaults to excluding soft-deleted rows',
  /const status = filters\.status \|\| 'active'[\s\S]*status === 'active'[\s\S]*\.neq\('status', 'deleted'\)/.test(service),
);
check(
  'Article deletion is soft delete and clears featured state',
  /adminDeleteNews[\s\S]*status: 'deleted'[\s\S]*deleted_at: new Date\(\)\.toISOString\(\)[\s\S]*is_featured: false/.test(service),
);
check(
  'News articles are never hard-deleted by service',
  !/\.from\(['"]news_articles['"]\)\s*\.delete\(/m.test(service),
);
check(
  'Related News prioritizes tag overlap',
  /overlapDiff[\s\S]*overlap\.get\(b\.id\)[\s\S]*overlap\.get\(a\.id\)/.test(service),
);
check(
  'Tag synchronization adds before removing for safer partial failure behavior',
  service.indexOf("if (toAdd.length)") >= 0 &&
    service.indexOf("if (toRemove.length)") > service.indexOf("if (toAdd.length)"),
);

const srcFiles = walk(path.join(root, 'src')).filter((file) => /\.(ts|tsx)$/.test(file));
const directNewsQueriesOutsideService = srcFiles
  .filter((file) => path.resolve(file) !== path.resolve(root, serviceRel))
  .filter((file) => /\.from\(['"]news_(?:articles|tags|article_tags)['"]\)/.test(fs.readFileSync(file, 'utf8')));
check(
  'No News table queries are scattered outside newsService',
  directNewsQueriesOutsideService.length === 0,
);

if (!releaseMode) {
  const forbiddenUiFiles = [
    'src/pages/News.tsx',
    'src/pages/NewsDetail.tsx',
    'src/components/news/NewsCard.tsx',
    'src/components/news/NewsContentRenderer.tsx',
    'src/components/news/NewsEditor.tsx',
    'src/components/news/NewsTags.tsx',
    'src/components/news/FeaturedNews.tsx',
    'src/components/news/NewsSidebar.tsx',
    'src/components/admin/AdminNewsManager.tsx',
    'src/components/admin/AdminNewsEditor.tsx',
    'src/styles/pages/news.css',
  ];
  check('NEWS-02 does not add News UI files', forbiddenUiFiles.every((rel) => !exists(rel)));
  check('NEWS-02 does not add public News routes yet', !/<Route[^>]+path=["'][^"']*\/news/i.test(app));
} else {
  console.log('INFO NEWS-02 release mode: historical no-UI assertions skipped.');
}

if (failures.length) {
  console.error(`\nNEWS-02 service/data contract: ${total - failures.length}/${total} PASS`);
  console.error(`Failed: ${failures.join('; ')}`);
  process.exit(1);
}

console.log(`\nNEWS-02 service/data contract: ${total}/${total} PASS`);
