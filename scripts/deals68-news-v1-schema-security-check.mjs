#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationRel = 'supabase/migrations/20260814045746_news_v1_schema_security.sql';
const migrationPath = path.join(root, migrationRel);
const failures = [];
let total = 0;

function check(label, condition) {
  total += 1;
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failures.push(label);
    console.error(`FAIL ${label}`);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

check('NEWS-01 migration exists', fs.existsSync(migrationPath));
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const app = read('src/App.tsx');

check('news_articles table exists in migration', /create table if not exists public\.news_articles/i.test(sql));
check('news_tags table exists in migration', /create table if not exists public\.news_tags/i.test(sql));
check('news_article_tags table exists in migration', /create table if not exists public\.news_article_tags/i.test(sql));
check('published_date is editorial date', /published_date\s+date/i.test(sql));
check(
  'article status contract is draft published deleted',
  /status text not null default 'draft' check \(status in \('draft','published','deleted'\)\)/i.test(sql),
);
check(
  'soft-delete state is constrained',
  /news_articles_deleted_state/i.test(sql) &&
    /status = 'deleted' and deleted_at is not null/i.test(sql) &&
    /status <> 'deleted' and deleted_at is null/i.test(sql),
);
check('VI publish completeness is constrained', /news_articles_publish_vi_complete/i.test(sql));
check('EN published bundle is all-or-none', /news_articles_publish_en_bundle/i.test(sql));
check(
  'VI slug is case-insensitively unique for non-deleted articles',
  /news_articles_slug_vi_unique[\s\S]*lower\(slug_vi\)[\s\S]*status <> 'deleted'/i.test(sql),
);
check(
  'EN slug is case-insensitively unique for non-deleted articles',
  /news_articles_slug_en_unique[\s\S]*lower\(slug_en\)[\s\S]*status <> 'deleted'/i.test(sql),
);
check(
  'public article ordering index exists',
  /news_articles_public_order_idx[\s\S]*published_date desc, created_at desc/i.test(sql),
);
check('featured article index exists', /news_articles_featured_public_idx/i.test(sql));
check(
  'updated_at trigger exists',
  /d68_news_set_updated_at/i.test(sql) && /news_articles_set_updated_at/i.test(sql),
);

for (const table of ['news_articles', 'news_tags', 'news_article_tags']) {
  check(
    `${table} RLS is enabled`,
    new RegExp(`alter table public\\.${table} enable row level security`, 'i').test(sql),
  );
}

check(
  'public article policy exposes only published non-deleted rows',
  /news articles public read published[\s\S]*status = 'published' and deleted_at is null/i.test(sql),
);
check(
  'Admin article insert is guarded by existing is_admin helper',
  /news articles admin insert[\s\S]*with check \(\(select public\.is_admin\(\)\)\)/i.test(sql),
);
check(
  'Admin article update is guarded by existing is_admin helper',
  /news articles admin update[\s\S]*using \(\(select public\.is_admin\(\)\)\)[\s\S]*with check \(\(select public\.is_admin\(\)\)\)/i.test(sql),
);
check(
  'authenticated role has no hard-delete privilege on news_articles',
  /grant insert, update on public\.news_articles to authenticated/i.test(sql) &&
    !/grant[^;]*delete[^;]*on public\.news_articles to authenticated/i.test(sql),
);
check(
  'tags are a public-readable taxonomy',
  /news tags public read[\s\S]*using \(true\)/i.test(sql),
);
check(
  'public article-tag relations require a published non-deleted article',
  /news article tags public read published[\s\S]*a\.status = 'published'[\s\S]*a\.deleted_at is null/i.test(sql),
);
check(
  'news-media bucket is public with 10 MB limit',
  /'news-media'[\s\S]*true[\s\S]*10485760/i.test(sql),
);
check(
  'news-media MIME types are restricted to JPEG PNG WebP',
  /image\/jpeg/i.test(sql) && /image\/png/i.test(sql) && /image\/webp/i.test(sql),
);

for (const command of ['select', 'insert', 'update', 'delete']) {
  check(
    `news-media ${command} is Admin-only`,
    new RegExp(
      `news media admin ${command}[\\s\\S]*bucket_id = 'news-media'[\\s\\S]*public\\.is_admin\\(\\)`,
      'i',
    ).test(sql),
  );
}

const forbiddenRuntimeFiles = [
  'src/pages/News.tsx',
  'src/pages/NewsDetail.tsx',
  'src/services/newsService.ts',
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
check(
  'NEWS-01 does not add News runtime files',
  forbiddenRuntimeFiles.every((rel) => !fs.existsSync(path.join(root, rel))),
);
check(
  'NEWS-01 does not add public News routes yet',
  !/<Route[^>]+path=["'][^"']*\/news/i.test(app),
);

if (failures.length) {
  console.error(`\nNEWS-01 schema/security contract: ${total - failures.length}/${total} PASS`);
  console.error(`Failed: ${failures.join('; ')}`);
  process.exit(1);
}

console.log(`\nNEWS-01 schema/security contract: ${total}/${total} PASS`);
