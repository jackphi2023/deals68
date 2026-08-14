import { test, expect, type Page, type Route } from '@playwright/test';
import { gotoAndWait, expectNoHorizontalOverflow } from '../helpers/deals68';

const tags = [
  { id: 'tag-ma', slug: 'ma', label_vi: 'M&A', label_en: 'M&A', created_at: '2026-08-01T00:00:00Z' },
  { id: 'tag-fundraising', slug: 'goi-von', label_vi: 'Gọi vốn', label_en: 'Fundraising', created_at: '2026-08-01T00:00:00Z' },
];

const doc = (label: string) => ({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: label, marks: [{ type: 'bold' }] }] },
    { type: 'youtube', attrs: { videoId: 'dQw4w9WgXcQ' } },
  ],
});

const articles = [
  {
    id: 'news-a1', status: 'published',
    slug_vi: 'thuong-vu-ma-viet-nam', slug_en: 'vietnam-ma-deal',
    title_vi: 'Thương vụ M&A Việt Nam', title_en: 'Vietnam M&A Deal',
    excerpt_vi: 'Phân tích một thương vụ M&A tiêu biểu.', excerpt_en: 'Analysis of a representative M&A transaction.',
    content_json_vi: doc('Nội dung bài viết NEWS-08'), content_json_en: doc('NEWS-08 article content'),
    featured_image_url: null, featured_image_alt_vi: null, featured_image_alt_en: null,
    is_featured: true, published_date: '2026-08-10', author_name: 'Deals68.com',
    seo_title_vi: 'Thương vụ M&A Việt Nam | Deals68.com', seo_title_en: 'Vietnam M&A Deal | Deals68.com',
    seo_description_vi: 'SEO description VI cho bài NEWS-08.', seo_description_en: 'NEWS-08 article SEO description.',
    created_at: '2026-08-10T02:00:00Z', updated_at: '2026-08-13T03:00:00Z', deleted_at: null,
  },
  {
    id: 'news-a2', status: 'published',
    slug_vi: 'goi-von-tang-truong', slug_en: 'growth-fundraising',
    title_vi: 'Gọi vốn tăng trưởng', title_en: 'Growth Fundraising',
    excerpt_vi: 'Góc nhìn gọi vốn cho doanh nghiệp tăng trưởng.', excerpt_en: 'Fundraising perspectives for growth companies.',
    content_json_vi: doc('Gọi vốn'), content_json_en: doc('Fundraising'),
    featured_image_url: null, featured_image_alt_vi: null, featured_image_alt_en: null,
    is_featured: true, published_date: '2026-08-12', author_name: 'Deals68.com',
    seo_title_vi: null, seo_title_en: null, seo_description_vi: null, seo_description_en: null,
    created_at: '2026-08-12T02:00:00Z', updated_at: '2026-08-12T03:00:00Z', deleted_at: null,
  },
  {
    id: 'news-a3', status: 'published',
    slug_vi: 'thi-truong-ma', slug_en: 'ma-market',
    title_vi: 'Thị trường M&A', title_en: 'M&A Market',
    excerpt_vi: 'Cập nhật thị trường M&A.', excerpt_en: 'M&A market update.',
    content_json_vi: doc('M&A market'), content_json_en: doc('M&A market'),
    featured_image_url: null, featured_image_alt_vi: null, featured_image_alt_en: null,
    is_featured: false, published_date: '2026-08-11', author_name: 'Deals68.com',
    seo_title_vi: null, seo_title_en: null, seo_description_vi: null, seo_description_en: null,
    created_at: '2026-08-11T02:00:00Z', updated_at: '2026-08-11T03:00:00Z', deleted_at: null,
  },
];

const relations = [
  { article_id: 'news-a1', tag_id: 'tag-ma' },
  { article_id: 'news-a1', tag_id: 'tag-fundraising' },
  { article_id: 'news-a2', tag_id: 'tag-ma' },
  { article_id: 'news-a2', tag_id: 'tag-fundraising' },
  { article_id: 'news-a3', tag_id: 'tag-ma' },
];

function idsFromInFilter(value: string | null) {
  if (!value) return [];
  const match = value.match(/^in\.\((.*)\)$/);
  return match ? match[1].split(',').map((id) => id.replace(/^"|"$/g, '')) : [];
}

function articleHasLanguage(article: any, lang: 'vi' | 'en') {
  return Boolean(article[`slug_${lang}`] && article[`title_${lang}`] && article[`excerpt_${lang}`] && article[`content_json_${lang}`]);
}

function postgrestHeaders(rows: any[], total: number) {
  return {
    'access-control-allow-origin': '*',
    'access-control-expose-headers': 'content-range, range-unit',
    'content-range': rows.length ? `0-${rows.length - 1}/${total}` : `*/${total}`,
    'range-unit': 'items',
  };
}

async function json(route: Route, rows: any[], total = rows.length) {
  const accept = route.request().headers()['accept'] || '';
  const wantsObject = accept.includes('application/vnd.pgrst.object+json');
  if (wantsObject && rows.length === 1) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: postgrestHeaders(rows, total),
      body: JSON.stringify(rows[0]),
    });
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: postgrestHeaders(rows, total),
    body: JSON.stringify(rows),
  });
}

async function mockNewsRest(page: Page) {
  // Registered first so the more specific News routes below take precedence.
  await page.route('https://news08.test.supabase.co/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: '[]',
    });
  });

  await page.route('**/rest/v1/news_articles*', async (route) => {
    const url = new URL(route.request().url());
    let rows = [...articles];

    const viSlug = url.searchParams.get('slug_vi');
    const enSlug = url.searchParams.get('slug_en');
    if (viSlug?.startsWith('eq.')) rows = rows.filter((row) => row.slug_vi === viSlug.slice(3));
    if (enSlug?.startsWith('eq.')) rows = rows.filter((row) => row.slug_en === enSlug.slice(3));

    const idFilter = idsFromInFilter(url.searchParams.get('id'));
    if (idFilter.length) rows = rows.filter((row) => idFilter.includes(row.id));

    const relationTag = url.searchParams.get('news_article_tags.tag_id');
    if (relationTag?.startsWith('eq.')) {
      const tagId = relationTag.slice(3);
      const articleIds = new Set(relations.filter((row) => row.tag_id === tagId).map((row) => row.article_id));
      rows = rows.filter((row) => articleIds.has(row.id));
    }

    if (url.searchParams.get('is_featured') === 'eq.true') rows = rows.filter((row) => row.is_featured);
    const isEnglish = url.searchParams.has('title_en') || url.searchParams.has('content_json_en') || Boolean(enSlug);
    rows = rows.filter((row) => articleHasLanguage(row, isEnglish ? 'en' : 'vi'));
    rows.sort((a, b) => b.published_date.localeCompare(a.published_date) || b.created_at.localeCompare(a.created_at));

    const total = rows.length;
    const offset = Number(url.searchParams.get('offset') || 0);
    const limit = Number(url.searchParams.get('limit') || rows.length || 1);
    rows = rows.slice(offset, offset + limit);

    if (relationTag) {
      rows = rows.map((row) => ({
        ...row,
        news_article_tags: relations.filter((rel) => rel.article_id === row.id).map((rel) => ({ tag_id: rel.tag_id })),
      }));
    }
    if (viSlug || enSlug) {
      console.log(`[NEWS08 mock article] ${url.search} rows=${rows.length} accept=${route.request().headers()['accept'] || ''}`);
    }
    await json(route, rows, total);
  });

  await page.route('**/rest/v1/news_tags*', async (route) => {
    const url = new URL(route.request().url());
    let rows = [...tags];
    const slug = url.searchParams.get('slug');
    if (slug?.startsWith('eq.')) rows = rows.filter((tag) => tag.slug === slug.slice(3));
    const ids = idsFromInFilter(url.searchParams.get('id'));
    if (ids.length) rows = rows.filter((tag) => ids.includes(tag.id));
    await json(route, rows);
  });

  await page.route('**/rest/v1/news_article_tags*', async (route) => {
    const url = new URL(route.request().url());
    let rows = [...relations];
    const articleFilter = url.searchParams.get('article_id');
    if (articleFilter?.startsWith('eq.')) rows = rows.filter((row) => row.article_id === articleFilter.slice(3));
    if (articleFilter?.startsWith('neq.')) rows = rows.filter((row) => row.article_id !== articleFilter.slice(4));
    const articleIds = idsFromInFilter(articleFilter);
    if (articleIds.length) rows = rows.filter((row) => articleIds.includes(row.article_id));
    const tagIds = idsFromInFilter(url.searchParams.get('tag_id'));
    if (tagIds.length) rows = rows.filter((row) => tagIds.includes(row.tag_id));

    const select = url.searchParams.get('select') || '';
    if (select === 'tag_id') rows = rows.map(({ tag_id }) => ({ tag_id }));
    await json(route, rows);
  });
}

async function logNewsState(page: Page, label: string) {
  const main = await page.locator('main').innerText().catch(() => '<no main>');
  console.log(`[NEWS08 ${label}] ${main.slice(0, 1200)}`);
}

test.describe('NEWS-08 — public News release UAT', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (error) => console.log(`[NEWS08 pageerror] ${error.message}`));
    await mockNewsRest(page);
  });

  test('VI list and tag pages render published cards, tags and responsive layout', async ({ page }) => {
    await gotoAndWait(page, '/news');
    await expect(page.getByRole('heading', { level: 1, name: 'Tin tức & Góc nhìn thị trường' })).toBeVisible();
    await expect(page.locator('.d68-news-card')).toHaveCount(3);
    await expect(page.locator('.d68-news-card').first()).toContainText('Gọi vốn tăng trưởng');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://deals68.com/news');
    await expectNoHorizontalOverflow(page);

    await gotoAndWait(page, '/news/tag/ma');
    await expect(page.getByRole('heading', { level: 1, name: 'Chủ đề: M&A' })).toBeVisible();
    await expect(page.locator('.d68-news-card')).toHaveCount(3);
    if (await page.locator('link[rel="alternate"][hreflang="en"]').count() === 0) await logNewsState(page, 'missing-tag-hreflang');
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', 'https://deals68.com/en/news/tag/ma');
    await expectNoHorizontalOverflow(page);
  });

  test('detail renders editorial date, safe rich content, Recent/Related and NewsArticle SEO', async ({ page }) => {
    await gotoAndWait(page, '/news/thuong-vu-ma-viet-nam');
    if (await page.getByRole('heading', { level: 1, name: 'Thương vụ M&A Việt Nam' }).count() === 0) await logNewsState(page, 'missing-vi-detail');
    await expect(page.getByRole('heading', { level: 1, name: 'Thương vụ M&A Việt Nam' })).toBeVisible();
    await expect(page.locator('time[datetime="2026-08-10"]').first()).toBeVisible();
    await expect(page.getByText('Nội dung bài viết NEWS-08')).toBeVisible();
    await expect(page.locator('iframe[src*="youtube-nocookie.com/embed/dQw4w9WgXcQ"]')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 2, name: 'Tin mới' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Bài viết liên quan' })).toBeVisible();

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://deals68.com/news/thuong-vu-ma-viet-nam');
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', 'https://deals68.com/en/news/vietnam-ma-deal');
    const jsonLd = await page.locator('#d68-page-jsonld').textContent();
    expect(jsonLd).toContain('"@type":"NewsArticle"');
    expect(jsonLd).toContain('"datePublished":"2026-08-10"');
    expect(jsonLd).toContain('"dateModified":"2026-08-13T03:00:00Z"');
    await expectNoHorizontalOverflow(page);
  });

  test('EN article uses the genuine language bundle and VI hreflang', async ({ page }) => {
    await gotoAndWait(page, '/en/news/vietnam-ma-deal');
    if (await page.getByRole('heading', { level: 1, name: 'Vietnam M&A Deal' }).count() === 0) await logNewsState(page, 'missing-en-detail');
    await expect(page.getByRole('heading', { level: 1, name: 'Vietnam M&A Deal' })).toBeVisible();
    await expect(page.getByText('NEWS-08 article content')).toBeVisible();
    await expect(page.locator('link[rel="alternate"][hreflang="vi"]')).toHaveAttribute('href', 'https://deals68.com/news/thuong-vu-ma-viet-nam');
    await expectNoHorizontalOverflow(page);
  });

  test('unavailable article is noindex and does not leak another article', async ({ page }) => {
    await gotoAndWait(page, '/news/khong-ton-tai');
    if (await page.getByRole('heading', { level: 1, name: 'Không tìm thấy bài viết' }).count() === 0) await logNewsState(page, 'missing-not-found');
    await expect(page.getByRole('heading', { level: 1, name: 'Không tìm thấy bài viết' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
    await expect(page.getByText('Thương vụ M&A Việt Nam')).toHaveCount(0);
  });
});
