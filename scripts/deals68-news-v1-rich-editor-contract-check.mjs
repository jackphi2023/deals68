#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
let total = 0;
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const check = (label, condition) => {
  total += 1;
  if (condition) console.log(`PASS ${label}`);
  else { failures.push(label); console.error(`FAIL ${label}`); }
};

const typesRel = 'src/lib/newsTypes.ts';
const contentRel = 'src/lib/newsContent.ts';
const editorRel = 'src/components/news/NewsEditor.tsx';
const rendererRel = 'src/components/news/NewsContentRenderer.tsx';
const adminEditorRel = 'src/components/admin/AdminNewsEditor.tsx';
const mediaRel = 'src/services/newsMediaService.ts';
const adminCssRel = 'src/styles/pages/admin-news.css';
const publicCssRel = 'src/styles/pages/news.css';
const cssIndexRel = 'src/styles/index.css';
const appRel = 'src/App.tsx';
const packageRel = 'package.json';

for (const rel of [typesRel, contentRel, editorRel, rendererRel, adminEditorRel, mediaRel, adminCssRel, publicCssRel, cssIndexRel, appRel, packageRel]) {
  check(`${rel} exists`, exists(rel));
}

const types = read(typesRel);
const content = read(contentRel);
const editor = read(editorRel);
const renderer = read(rendererRel);
const adminEditor = read(adminEditorRel);
const media = read(mediaRel);
const cssIndex = read(cssIndexRel);
const app = read(appRel);
const pkg = JSON.parse(read(packageRel));

for (const nodeType of ['paragraph','heading','blockquote','bulletList','orderedList','image','youtube']) {
  check(`Structured News content supports ${nodeType}`, types.includes(`type: '${nodeType}'`));
}
for (const mark of ['bold','italic','underline','link']) {
  check(`Structured News marks support ${mark}`, types.includes(`type: '${mark}'`));
}
check('H1 is not a stored heading level', /level: 2 \| 3/.test(types) && !/level: 1 \|/.test(types));

check('Paste sanitizer has a separate untrusted path', /pastedHtmlToNewsContent[\s\S]*domToNewsDocument\(root, false\)/.test(content));
check('Paste sanitizer normalizes H1 to H2', /tag === 'H3' \? 3 : 2/.test(content));
check('Paste sanitizer rejects executable and embed elements', /SCRIPT[\s\S]*STYLE[\s\S]*IFRAME[\s\S]*OBJECT[\s\S]*EMBED/.test(content));
check('Pasted external IMG elements are dropped', /if \(tag === 'IMG'\) return \[\]/.test(content));
check('Links are protocol-sanitized', /sanitizeNewsHref/.test(content) && /http:[\s\S]*https:[\s\S]*mailto:[\s\S]*tel:/.test(content));
check('Image sources reject arbitrary protocols', /sanitizeNewsImageSrc/.test(content) && /url\.protocol === 'https:'/.test(content));
check('YouTube parser only returns canonical video IDs', /YOUTUBE_ID_RE/.test(content) && /parseYouTubeVideoId/.test(content));

for (const token of ['Bôi đậm','In nghiêng','Gạch chân','Danh sách dấu chấm','Danh sách đánh số','Trích dẫn','Link','Ảnh','YouTube','Undo','Redo','Xóa format']) {
  check(`Editor toolbar includes ${token}`, editor.includes(token));
}
check('Editor intercepts paste and inserts sanitized HTML', /onPaste=\{handlePaste\}/.test(editor) && /sanitizePastedNewsHtml/.test(editor));
check('Editor saves DOM back to structured JSON', /editorHtmlToNewsContent\(editor\.innerHTML\)/.test(editor));
check('Editor never persists arbitrary raw HTML itself', !/dangerouslySetInnerHTML/.test(editor));
check('Inline images upload through managed News media', /adminUploadNewsInlineImage/.test(editor) && /data-news-node="image"/.test(editor));
check('YouTube is inserted as structured editor node', /data-news-node="youtube"/.test(editor) && /data-youtube-id/.test(editor));

check('Safe renderer does not use dangerouslySetInnerHTML', !/dangerouslySetInnerHTML/.test(renderer));
check('Safe renderer emits only controlled YouTube iframe', /youtube-nocookie\.com\/embed/.test(renderer) && /allowFullScreen/.test(renderer));
check('Safe renderer sanitizes links and image sources', /sanitizeNewsHref/.test(renderer) && /sanitizeNewsImageSrc/.test(renderer));
check('Safe renderer never emits H1', !/<h1/.test(renderer));

check('Admin editor stores rich JSON directly', /content_json_vi: newsContentHasMeaningfulContent\(form\.content_vi\) \? form\.content_vi : null/.test(adminEditor));
check('Admin editor uses rich editor for both VI and EN', (adminEditor.match(/<NewsEditor/g) || []).length === 2);
check('Admin editor includes safe live preview', /<NewsContentRenderer content=\{activeContent\}/.test(adminEditor));
check('NEWS-03 plain-text conversion helpers are removed', !/plainTextToContent|contentToPlainText/.test(adminEditor));

check('Media service has separate inline folder', /adminUploadNewsInlineImage/.test(media) && /'featured' \| 'inline'/.test(media));
check('News renderer CSS is registered in single CSS entry', /@import '\.\/pages\/news\.css'/.test(cssIndex));
check('Admin rich editor CSS remains in dedicated admin-news stylesheet', /@import '\.\/pages\/admin-news\.css'/.test(cssIndex));

const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const richEditorDeps = Object.keys(deps).filter((name) => /tiptap|lexical|quill|ckeditor|slate|prosemirror/i.test(name));
check('NEWS-04 adds no external rich-editor framework dependency', richEditorDeps.length === 0);
check('NEWS-04 still adds no public News routes', !/<Route[^>]+path=["']\/?(?:en\/)?news/i.test(app));

const migrationsDir = path.join(root, 'supabase/migrations');
const newsMigrations = fs.readdirSync(migrationsDir).filter((name) => /news.*\.sql$/i.test(name));
check('NEWS-04 creates no new News database migration', newsMigrations.length === 1 && newsMigrations[0] === '20260814044837_news_v1_schema_security.sql');

if (failures.length) {
  console.error(`\nNEWS-04 rich editor contract: ${total - failures.length}/${total} PASS`);
  console.error(`Failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log(`\nNEWS-04 rich editor contract: ${total}/${total} PASS`);
