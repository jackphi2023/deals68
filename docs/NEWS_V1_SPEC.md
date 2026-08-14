# Deals68 News V1 — Product & Engineering Contract

**Session:** NEWS-00  
**Status:** Contract locked — no runtime feature implementation in this session  
**Target integration branch:** `building`  
**Production branch:** `main` — must remain untouched until NEWS-08 release gate  
**NEWS-00 baseline:** `building` at `c834767aeba27024a02e1e1ab9428c7d1ef4209f`

---

## 1. Purpose

News V1 adds a public editorial/news module to Deals68 for market content, M&A/fundraising/investment insights and long-term organic acquisition, while preserving the current marketplace architecture.

News is an independent module. It must reuse Deals68 navigation, language routing, Admin shell, design tokens, SEO primitives and QA conventions. It must not turn `Admin.tsx`, `Home.tsx` or `release-cleanup.css` into new catch-all implementation layers.

---

## 2. Non-negotiable release boundary

Development sequence:

```text
NEWS feature session
→ building
→ build + contract QA + regression
→ Netlify UAT
→ NEWS-08 release gate
→ main
→ production
```

Rules:

- NEWS-00 does not add public routes, database migrations, storage buckets, UI components or editor dependencies.
- Do not merge News V1 into `main` before NEWS-08.
- Each News session must remain independently reviewable and rollbackable.
- Stable News CSS must have one owner: `src/styles/pages/news.css`.
- Do not place News fixes in `src/styles/pages/release-cleanup.css`.

---

## 3. Public route contract

Vietnamese routes:

```text
/news
/news/:slug
/news/tag/:tagSlug
```

English routes:

```text
/en/news
/en/news/:slug
/en/news/tag/:tagSlug
```

Admin routes:

```text
/admin/news
/admin/news/new
/admin/news/:id/edit
```

Requirements:

- Public routes must be lazy-loaded consistently with existing Deals68 public pages.
- Vietnamese is the default route family; English uses `/en`.
- A News article without a publishable English version must not be exposed as an English article URL merely by falling back to Vietnamese body content.
- Draft/deleted articles are never available through public article queries.

---

## 4. Article data contract

Target table: `news_articles`.

Minimum fields:

```text
id
status: draft | published | deleted
slug_vi
slug_en
title_vi
title_en
excerpt_vi
excerpt_en
content_json_vi
content_json_en
featured_image_url
featured_image_alt_vi
featured_image_alt_en
is_featured
published_date
author_name
seo_title_vi
seo_title_en
seo_description_vi
seo_description_en
created_at
updated_at
deleted_at
```

### Published date rule

`published_date` is editorial data selected by Admin. It is not derived from `created_at` or the clock time when the Publish button is clicked.

Public ordering:

```text
published_date DESC
created_at DESC
```

The public date shown on cards/details and the SEO `datePublished` value use `published_date`.

Admin may sort work queues using `updated_at` so recently edited content remains easy to find.

---

## 5. Tag data contract

Tags are normalized entities, not a comma-separated article field.

Target tables:

```text
news_tags
news_article_tags
```

`news_tags` minimum fields:

```text
id
slug
label_vi
label_en
created_at
```

`news_article_tags`:

```text
article_id
tag_id
```

Rules:

- An article can have multiple tags.
- A tag can link to multiple articles.
- Tag links open the corresponding public tag page.
- Related News V1 is deterministic: shared tag count DESC, then `published_date DESC`.
- No AI recommendation is required in News V1.

---

## 6. Media contract

Target storage bucket: `news-media`.

### Featured image

```text
ratio: 4:3
recommended source: 1200 × 900 px
minimum intended source: 800 × 600 px
```

Public cards use a controlled 4:3 media container and `object-fit: cover`.

### Content images

- Upload into Deals68-managed News storage; do not depend on hotlinked source-site images as the normal authoring path.
- Render with responsive width and automatic height.
- Admin must be able to set meaningful alt text.
- Source HTML width/height/style attributes must not control public layout.

### YouTube

- Admin provides a supported YouTube URL.
- Editor stores a structured YouTube/video node, not arbitrary iframe HTML.
- Public renderer uses a responsive 16:9 container.
- Arbitrary iframe/embed/script input is rejected.

---

## 7. Rich editor and paste-safety contract

The News editor must use structured content as the source of truth. `content_json_vi` and `content_json_en` are the canonical body representation.

V1 supported authoring semantics:

```text
Paragraph
H2
H3
Bold
Italic
Underline
Bullet list
Numbered list
Blockquote
Link
Image
YouTube
Undo / Redo
Clear formatting
```

### Heading rule

The page title is the only H1. Article body content may use H2/H3 but cannot create a second H1.

### Paste cleanup

Copy/paste from Word, Google Docs or external websites must preserve semantic content where supported but remove source presentation and executable markup.

Remove/ignore at minimum:

```text
font-family
font-size
text/background colors
source margins/padding
source class/id
<style>
<script>
inline event handlers
arbitrary iframe/embed
unsupported HTML attributes
```

Preserve when supported:

```text
paragraphs
H2/H3
bold
italic
underline
lists
links
```

An incoming H1 inside pasted content is normalized to H2.

### Rendering rule

Do not make raw third-party HTML the rendering source of truth. The public News renderer maps approved structured nodes to Deals68-controlled React markup/styles.

---

## 8. Homepage contract

Homepage receives a `Tin nổi bật / Featured News` section in NEWS-06, not before.

Intended placement:

```text
Featured industries
→ Featured News
→ Valuation CTA
```

Rules:

- Display up to 3 newest published articles where `is_featured = true`.
- Card includes 4:3 image, title and short excerpt.
- `Xem toàn bộ / View all` opens News list.
- If there are no published featured articles, hide the entire section rather than rendering an empty box.
- News loading/query/rendering belongs in a dedicated component/service, not inline expansion of `Home.tsx`.

---

## 9. Public News list contract

List fields:

```text
featured image 4:3
title
excerpt
published date
tags
```

Rules:

- Newest editorial `published_date` first.
- Article title links to detail.
- Each tag is an independent link.
- Do not wrap the entire card in one anchor when nested tag anchors are present.
- Responsive target: desktop grid, mobile single column.
- Public pagination is allowed to use a product-appropriate page size; V1 recommendation is 12 articles/page.

---

## 10. Article detail contract

Main content:

```text
breadcrumb
H1 title
published date
excerpt
featured image
structured article body
tags
```

Secondary content:

```text
Recent News: 5 newest published articles excluding current article
Related News: up to 4, ordered by shared tag count DESC then published_date DESC
```

Desktop may use a reading column plus sidebar. Mobile stacks secondary content below the article.

---

## 11. Admin contract

News belongs in the existing Admin group:

```text
Nội dung & tăng trưởng
├─ Tin tức
├─ Banner
└─ Mã KM
```

Do not implement the News CRUD as another large monolithic block inside `Admin.tsx`.

Target components:

```text
src/components/admin/AdminNewsManager.tsx
src/components/admin/AdminNewsEditor.tsx
```

Admin list requirements:

```text
search
status filter
featured filter
newest/recently updated management order
20 articles/page
Create
Edit
Delete
Mark/unmark featured
```

Delete is soft delete in V1:

```text
status = deleted
deleted_at = now()
```

Admin editor supports separate Vietnamese and English content. No automatic translation and no automatic copying of Vietnamese body content into English.

---

## 12. SEO contract

Deals68 existing SEO primitives should be extended, not replaced.

Article detail must support dynamic:

```text
title
meta description
canonical
Open Graph
Twitter Card
featured image
article type
NewsArticle JSON-LD
datePublished
dateModified
```

### Canonical

A published article uses a self-referencing canonical URL for its language route.

### Structured data

Target JSON-LD type:

```text
NewsArticle
```

Minimum mapped properties:

```text
headline
description
image
datePublished = published_date
dateModified = updated_at
author
publisher
```

### Indexing

```text
published article → indexable when production host rules allow
draft/deleted → no public route / noindex
tag pages with insufficient content may be noindex,follow
```

### Editorial guidelines

These are authoring guidelines, not hard search-engine limits:

```text
SEO title: roughly 45–65 characters
SEO description: roughly 120–160 characters
tags: generally 3–6 meaningful tags
one H1 per article
short stable slug after publication
```

---

## 13. Sitemap contract

Current Deals68 build-time sitemap is not sufficient as the only long-term News discovery mechanism because editorial publication can change without an application rebuild.

NEWS-07 must define a News-aware sitemap strategy that includes only published articles and uses article `updated_at` as last modification metadata.

Draft/deleted News must never be included.

---

## 14. Security contract

Public/anon:

```text
SELECT published News only
SELECT public News tags/relations needed to render published pages
```

Admin:

```text
create/update/publish/feature/soft-delete News
write News media
```

Other authenticated users do not receive News authoring rights merely because they are logged in.

Additional rules:

- Never trust editor output as executable HTML.
- Sanitize links and supported URLs.
- Reject arbitrary executable embeds.
- Storage write permissions are Admin-scoped.
- Public News queries expose only fields required by public rendering.

---

## 15. Language contract

Deals68 News follows the existing route-language convention:

```text
VI default: /news/...
EN: /en/news/...
```

Rules:

- VI and EN title/excerpt/body/SEO fields are independently editable.
- No automatic translation in V1.
- No silent copying from one language to another.
- Public English article existence requires publishable English article content/slug according to the final NEWS implementation policy.
- hreflang is emitted only for genuinely available language variants.

---

## 16. Target code ownership

```text
src/components/news/
  NewsCard.tsx
  NewsContentRenderer.tsx
  NewsEditor.tsx
  NewsTags.tsx
  FeaturedNews.tsx
  NewsSidebar.tsx

src/components/admin/
  AdminNewsManager.tsx
  AdminNewsEditor.tsx

src/pages/
  News.tsx
  NewsDetail.tsx

src/services/
  newsService.ts

src/lib/
  newsTypes.ts

src/styles/pages/
  news.css
```

Business/data workflow belongs in `newsService.ts`; React pages/components should not scatter equivalent Supabase queries across multiple components.

---

## 17. Session plan

### NEWS-00 — Contract lock

Deliverables:

```text
docs/NEWS_V1_SPEC.md
scripts/deals68-news-v1-contract-check.mjs
```

No runtime feature implementation.

### NEWS-01 — Schema & security

```text
news_articles
news_tags
news_article_tags
news-media bucket
RLS/storage policies
```

No public UI.

### NEWS-02 — Service/query layer

Target service API:

```text
listPublishedNews()
getNewsBySlug()
listNewsByTag()
getFeaturedNews()
getRecentNews()
getRelatedNews()
adminListNews()
adminCreateNews()
adminUpdateNews()
adminDeleteNews()
```

### NEWS-03 — Admin basic CRUD

Admin list + create/edit shell + status/date/tags/featured, 20 rows/page. Rich editor is not introduced yet.

### NEWS-04 — Structured rich editor

Editor, paste cleanup, image nodes, YouTube nodes and controlled renderer.

### NEWS-05 — Public list/detail/tags

Public News list, article detail, tag pages, Recent News, Related News and responsive layout.

### NEWS-06 — Homepage Featured News

Add dedicated `FeaturedNews` component to Homepage.

### NEWS-07 — SEO hardening

Dynamic article metadata, NewsArticle structured data, hreflang/canonical rules and News-aware sitemap strategy.

### NEWS-08 — Release gate

Full build/regression/security/mobile/Netlify UAT. Only after NEWS-08 passes may News V1 be considered for `main`.

---

## 18. NEWS-08 minimum UAT flow

```text
Admin creates draft
→ uploads 4:3 featured image
→ pastes formatted content from an external source
→ verifies unwanted source styling is removed
→ inserts content image
→ inserts YouTube video
→ adds multiple tags
→ chooses an editorial published_date different from current time
→ marks featured
→ publishes
→ verifies Homepage Featured News
→ verifies News list order/date/tags
→ verifies tag page
→ verifies detail rendering
→ verifies Recent/Related News
→ verifies VI/EN behavior
→ verifies canonical/OG/JSON-LD
→ soft-deletes article
→ verifies it disappears from public queries/sitemap
```

---

## 19. Definition of Done for NEWS-00

NEWS-00 is complete only when:

- This contract exists in `docs/NEWS_V1_SPEC.md`.
- `scripts/deals68-news-v1-contract-check.mjs` validates the locked contract and current architectural prerequisites.
- The contract check is syntax-valid and can be executed from repository root with Node.
- NEWS-00 changes do not add migrations, News routes, News runtime components, News CSS, storage configuration or editor dependencies.
- The Git diff for NEWS-00 is limited to the two declared deliverable files.
- `main` is unchanged.
