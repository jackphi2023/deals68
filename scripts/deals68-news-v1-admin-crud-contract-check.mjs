#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
let total = 0;
const releaseMode = process.env.D68_NEWS_RELEASE_MODE === '1';

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

const navRel = 'src/config/adminNavigation.ts';
const mainRel = 'src/main.tsx';
const appRel = 'src/App.tsx';
const managerRel = 'src/components/admin/AdminNewsManager.tsx';
const editorRel = 'src/components/admin/AdminNewsEditor.tsx';
const portalRel = 'src/components/admin/AdminNewsPortal.tsx';
const mediaRel = 'src/services/newsMediaService.ts';
const serviceRel = 'src/services/newsService.ts';
const cssRel = 'src/styles/pages/admin-news.css';
const cssIndexRel = 'src/styles/index.css';
const packageRel = 'package.json';

for (const rel of [navRel, mainRel, appRel, managerRel, editorRel, portalRel, mediaRel, serviceRel, cssRel, cssIndexRel]) {
  check(`${rel} exists`, exists(rel));
}

const nav = read(navRel);
const main = read(mainRel);
const app = read(appRel);
const manager = read(managerRel);
const editor = read(editorRel);
const portal = read(portalRel);
const media = read(mediaRel);
const service = read(serviceRel);
const cssIndex = read(cssIndexRel);
const pkg = JSON.parse(read(packageRel));

check('AdminTab includes news', /\| 'news'/.test(nav));
check('News is registered under Admin growth navigation', /id: 'growth'[\s\S]*id: 'news'[\s\S]*href: '\/admin\/news'/.test(nav));
check('Nested /admin/news routes resolve to News tab', /aliases: \['news'\]/.test(nav) && /split\('\/'\)\[0\]/.test(nav));
check('main lazy-loads AdminNewsPortal', /React\.lazy\(\(\) => import\('\.\/components\/admin\/AdminNewsPortal'\)\)/.test(main) && /<AdminNewsPortal\s*\/>/.test(main));
check('main only activates News Admin runtime on /admin/news', /function AdminNewsPortalRuntime[\s\S]*normalized === '\/admin\/news'[\s\S]*startsWith\('\/admin\/news\/'\)/.test(main));
check('News portal only mounts under /admin/news', /normalized === '\/admin\/news'[\s\S]*startsWith\('\/admin\/news\/'\)/.test(portal));
check('News portal reuses existing Admin main shell', /document\.querySelector<HTMLElement>\('\.d68-admin-cols > main'\)/.test(portal));
check('News portal requires admin role', /profile\?\.role !== 'admin'/.test(portal));

check('Admin list uses NEWS-02 service layer', /adminListNews/.test(manager) && /adminUpdateNews/.test(manager) && /adminDeleteNews/.test(manager));
check('Admin list page size is the 20-row contract', /NEWS_DEFAULT_ADMIN_PAGE_SIZE/.test(manager));
check('Admin list supports search filter', /search: debouncedSearch/.test(manager));
check('Admin list supports status filter', /status,/.test(manager) && /option value="draft"/.test(manager) && /option value="published"/.test(manager) && /option value="deleted"/.test(manager));
check('Admin list supports featured filter', /featuredFilter/.test(manager) && /option value="featured"/.test(manager));
check('Admin list exposes create edit featured and delete actions', /\/admin\/news\/new/.test(manager) && /\/edit`/.test(manager) && /toggleFeatured/.test(manager) && /deleteArticle/.test(manager));
check('Delete action stays soft-delete through service', /adminDeleteNews\(article\.id\)/.test(manager) && /status: 'deleted'/.test(service));

check('Admin editor supports create and update service calls', /adminCreateNews/.test(editor) && /adminUpdateNews/.test(editor));
check('Admin editor loads drafts by id through service', /adminGetNewsById/.test(editor));
check('Admin editor manages normalized tags through service', /adminEnsureNewsTags/.test(editor) && /adminSetNewsArticleTags/.test(editor));
check('Admin editor has explicit VI and EN tabs', /NewsLanguage/.test(editor) && /Không tự động dịch VI → EN/.test(editor));
check('Admin editor keeps publication date independent', /type="date"[\s\S]*published_date/.test(editor));
check('Admin editor supports draft and published states', /option value="draft"/.test(editor) && /option value="published"/.test(editor));
check('Admin editor supports featured flag', /is_featured/.test(editor) && /Tin nổi bật/.test(editor));
check('Admin editor supports optional SEO VI EN fields', /seo_title_vi/.test(editor) && /seo_description_vi/.test(editor) && /seo_title_en/.test(editor) && /seo_description_en/.test(editor));
check('Admin editor requires 4:3 featured image before publish', /Ảnh đại diện 4:3/.test(editor) && /Math\.abs\(ratio - 4 \/ 3\)/.test(editor));
check('Admin editor stores provisional content as structured JSON', /type: 'doc'/.test(editor) && /type: 'paragraph'/.test(editor) && /content_json_vi: plainTextToContent/.test(editor));

if (!releaseMode) {
  check('NEWS-03 does not use raw HTML rendering', !/dangerouslySetInnerHTML|contentEditable/.test(editor));
  check('NEWS-03 does not embed arbitrary iframe or YouTube editor yet', !/<iframe|youtube/i.test(editor));
}

check('Featured image upload uses news-media service', /adminUploadNewsFeaturedImage/.test(editor) && /NEWS_MEDIA_BUCKET = 'news-media'/.test(media));
check('News media service restricts JPEG PNG WebP and 10MB', /image\/jpeg/.test(media) && /image\/png/.test(media) && /image\/webp/.test(media) && /10 \* 1024 \* 1024/.test(media));
check('News UI has no direct news table queries', !/\.from\(['"]news_/.test(manager + editor + portal));
check('News table access remains centralized in newsService', /\.from\('news_articles'\)/.test(service) && /\.from\('news_tags'\)/.test(service) && /\.from\('news_article_tags'\)/.test(service));

check('Dedicated Admin News CSS is registered in the single CSS entry', /admin-news\.css/.test(cssIndex));
if (!releaseMode) {
  check('Public /news routes are still absent in NEWS-03', !/<Route[^>]+path=["']\/?(?:en\/)?news/i.test(app));
} else {
  console.log('INFO NEWS-03 release mode: historical pre-rich-editor/pre-public assertions skipped.');
}

const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const richEditorDeps = Object.keys(deps).filter((name) => /tiptap|lexical|quill|ckeditor|slate|prosemirror/i.test(name));
check('NEWS-03 adds no rich-text editor dependency yet', richEditorDeps.length === 0);

const migrationsDir = path.join(root, 'supabase/migrations');
const newsMigrations = fs.readdirSync(migrationsDir).filter((name) => /news.*\.sql$/i.test(name));
check('NEWS-03 creates no new News database migration', newsMigrations.length === 1 && newsMigrations[0] === '20260814044837_news_v1_schema_security.sql');

if (failures.length) {
  console.error(`\nNEWS-03 Admin CRUD contract: ${total - failures.length}/${total} PASS`);
  console.error(`Failed: ${failures.join('; ')}`);
  process.exit(1);
}

console.log(`\nNEWS-03 Admin CRUD contract: ${total}/${total} PASS`);
