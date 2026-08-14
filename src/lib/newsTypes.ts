export type NewsLanguage = 'vi' | 'en';
export type NewsArticleStatus = 'draft' | 'published' | 'deleted';
export type NewsEditableStatus = Exclude<NewsArticleStatus, 'deleted'>;
export type NewsContentJson = Record<string, unknown>;

export const NEWS_DEFAULT_PUBLIC_PAGE_SIZE = 12;
export const NEWS_MAX_PUBLIC_PAGE_SIZE = 50;
export const NEWS_DEFAULT_ADMIN_PAGE_SIZE = 20;
export const NEWS_MAX_ADMIN_PAGE_SIZE = 100;

export type NewsTag = {
  id: string;
  slug: string;
  label_vi: string;
  label_en: string | null;
  created_at: string;
};

export type NewsArticleRow = {
  id: string;
  status: NewsArticleStatus;
  slug_vi: string | null;
  slug_en: string | null;
  title_vi: string | null;
  title_en: string | null;
  excerpt_vi: string | null;
  excerpt_en: string | null;
  content_json_vi: NewsContentJson | null;
  content_json_en: NewsContentJson | null;
  featured_image_url: string | null;
  featured_image_alt_vi: string | null;
  featured_image_alt_en: string | null;
  is_featured: boolean;
  published_date: string | null;
  author_name: string;
  seo_title_vi: string | null;
  seo_title_en: string | null;
  seo_description_vi: string | null;
  seo_description_en: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type NewsArticle = NewsArticleRow & {
  tags: NewsTag[];
};

export type LocalizedNewsTag = {
  id: string;
  slug: string;
  label: string;
};

export type LocalizedNewsArticle = {
  id: string;
  language: NewsLanguage;
  slug: string;
  title: string;
  excerpt: string;
  content: NewsContentJson;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  isFeatured: boolean;
  publishedDate: string;
  authorName: string;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
  tags: LocalizedNewsTag[];
};

export type NewsPublicListOptions = {
  page?: number;
  pageSize?: number;
  language?: NewsLanguage;
};

export type NewsListResult = {
  rows: NewsArticle[];
  total: number;
  page: number;
  pageSize: number;
};

export type NewsAdminStatusFilter = NewsArticleStatus | 'active' | 'all';

export type NewsAdminListFilters = {
  page?: number;
  pageSize?: number;
  status?: NewsAdminStatusFilter;
  featured?: boolean;
  search?: string;
};

export type NewsArticleWriteInput = {
  status?: NewsEditableStatus;
  slug_vi?: string | null;
  slug_en?: string | null;
  title_vi?: string | null;
  title_en?: string | null;
  excerpt_vi?: string | null;
  excerpt_en?: string | null;
  content_json_vi?: NewsContentJson | null;
  content_json_en?: NewsContentJson | null;
  featured_image_url?: string | null;
  featured_image_alt_vi?: string | null;
  featured_image_alt_en?: string | null;
  is_featured?: boolean;
  published_date?: string | null;
  author_name?: string | null;
  seo_title_vi?: string | null;
  seo_title_en?: string | null;
  seo_description_vi?: string | null;
  seo_description_en?: string | null;
};

export type NewsArticleUpdateInput = Partial<NewsArticleWriteInput>;

export type NewsTagWriteInput = {
  slug?: string | null;
  label_vi: string;
  label_en?: string | null;
};

export function normalizeNewsSlug(value: string | null | undefined) {
  const source = String(value || '').trim().toLowerCase();
  if (!source) return '';

  return source
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function localizeNewsTag(tag: NewsTag, language: NewsLanguage): LocalizedNewsTag {
  return {
    id: tag.id,
    slug: tag.slug,
    label: language === 'en' ? (tag.label_en || tag.slug) : tag.label_vi,
  };
}

export function localizeNewsArticle(
  article: NewsArticle,
  language: NewsLanguage,
): LocalizedNewsArticle | null {
  const slug = language === 'en' ? article.slug_en : article.slug_vi;
  const title = language === 'en' ? article.title_en : article.title_vi;
  const excerpt = language === 'en' ? article.excerpt_en : article.excerpt_vi;
  const content = language === 'en' ? article.content_json_en : article.content_json_vi;
  const publishedDate = article.published_date;

  if (!slug || !title || !excerpt || !content || !publishedDate) return null;

  return {
    id: article.id,
    language,
    slug,
    title,
    excerpt,
    content,
    featuredImageUrl: article.featured_image_url,
    featuredImageAlt:
      language === 'en' ? article.featured_image_alt_en : article.featured_image_alt_vi,
    isFeatured: article.is_featured,
    publishedDate,
    authorName: article.author_name,
    seoTitle: language === 'en' ? article.seo_title_en : article.seo_title_vi,
    seoDescription:
      language === 'en' ? article.seo_description_en : article.seo_description_vi,
    createdAt: article.created_at,
    updatedAt: article.updated_at,
    tags: article.tags.map((tag) => localizeNewsTag(tag, language)),
  };
}
