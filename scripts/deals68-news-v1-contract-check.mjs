#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const checks = [];
function check(name, condition) {
  checks.push({ name, pass: Boolean(condition) });
}

function includesAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

const specPath = 'docs/NEWS_V1_SPEC.md';
const appPath = 'src/App.tsx';
const seoPath = 'src/lib/seo.ts';
const seoManagerPath = 'src/components/SeoManager.tsx';
const adminNavigationPath = 'src/config/adminNavigation.ts';

for (const file of [specPath, appPath, seoPath, seoManagerPath, adminNavigationPath]) {
  check(`required file exists: ${file}`, fs.existsSync(path.join(root, file)));
}

if (checks.some((item) => !item.pass)) {
  for (const item of checks) console.log(`${item.pass ? 'PASS' : 'FAIL'}  ${item.name}`);
  process.exit(1);
}

const spec = read(specPath);
const app = read(appPath);
const seo = read(seoPath);
const seoManager = read(seoManagerPath);
const adminNavigation = read(adminNavigationPath);

check(
  'route contract locked',
  includesAll(spec, [
    '/news',
    '/news/:slug',
    '/news/tag/:tagSlug',
    '/en/news',
    '/en/news/:slug',
    '/en/news/tag/:tagSlug',
    '/admin/news',
    '/admin/news/new',
    '/admin/news/:id/edit',
  ]),
);

check(
  'article schema contract locked',
  includesAll(spec, [
    'news_articles',
    'content_json_vi',
    'content_json_en',
    'published_date',
    'featured_image_url',
    'is_featured',
    'status: draft | published | deleted',
  ]),
);

check(
  'tag normalization contract locked',
  includesAll(spec, ['news_tags', 'news_article_tags', 'shared tag count DESC']),
);

check(
  'media contract locked',
  includesAll(spec, ['news-media', '4:3', '1200 × 900 px', 'YouTube', '16:9']),
);

check(
  'paste safety contract locked',
  includesAll(spec, [
    'content_json_vi',
    'content_json_en',
    '<style>',
    '<script>',
    'inline event handlers',
    'An incoming H1 inside pasted content is normalized to H2.',
  ]),
);

check(
  'admin contract locked',
  includesAll(spec, [
    'Nội dung & tăng trưởng',
    '20 articles/page',
    'AdminNewsManager.tsx',
    'AdminNewsEditor.tsx',
    'status = deleted',
    'deleted_at = now()',
  ]),
);

check(
  'SEO contract locked',
  includesAll(spec, [
    'NewsArticle',
    'datePublished = published_date',
    'dateModified = updated_at',
    'canonical',
    'Open Graph',
    'Twitter Card',
  ]),
);

check(
  'session sequencing locked',
  includesAll(spec, [
    'NEWS-00 — Contract lock',
    'NEWS-01 — Schema & security',
    'NEWS-02 — Service/query layer',
    'NEWS-03 — Admin basic CRUD',
    'NEWS-04 — Structured rich editor',
    'NEWS-05 — Public list/detail/tags',
    'NEWS-06 — Homepage Featured News',
    'NEWS-07 — SEO hardening',
    'NEWS-08 — Release gate',
  ]),
);

check(
  'existing router supports lazy route pattern',
  app.includes("import { lazy, Suspense") && app.includes('const Businesses = lazy('),
);

check(
  'existing SEO primitive supports article metadata',
  seo.includes("type?: 'website' | 'article'") &&
    seo.includes('structuredData?:') &&
    seo.includes('application/ld+json'),
);

check(
  'existing SeoManager remains route-level baseline',
  seoManager.includes('applySeo({') && seoManager.includes('seoForPath(location.pathname)'),
);

check(
  'existing Admin growth section is present',
  adminNavigation.includes("id: 'growth'") &&
    adminNavigation.includes("label: 'Nội dung & tăng trưởng'"),
);

const failed = checks.filter((item) => !item.pass);
for (const item of checks) {
  console.log(`${item.pass ? 'PASS' : 'FAIL'}  ${item.name}`);
}

console.log(`\nNEWS-00 contract: ${checks.length - failed.length}/${checks.length} checks passed.`);

if (failed.length) {
  console.error(`NEWS-00 contract FAILED with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log('NEWS-00 contract PASS. Runtime News implementation remains deferred to NEWS-01+ sessions.');
