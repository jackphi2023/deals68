import { supabase } from '../lib/supabase';
import {
  NEWS_DEFAULT_ADMIN_PAGE_SIZE,
  NEWS_DEFAULT_PUBLIC_PAGE_SIZE,
  NEWS_MAX_ADMIN_PAGE_SIZE,
  NEWS_MAX_PUBLIC_PAGE_SIZE,
  normalizeNewsSlug,
  type NewsAdminListFilters,
  type NewsArticle,
  type NewsArticleRow,
  type NewsArticleUpdateInput,
  type NewsArticleWriteInput,
  type NewsLanguage,
  type NewsListResult,
  type NewsPublicListOptions,
  type NewsTag,
  type NewsTagWriteInput,
} from '../lib/newsTypes';

const NEWS_ARTICLE_SELECT = 'id,status,slug_vi,slug_en,title_vi,title_en,excerpt_vi,excerpt_en,content_json_vi,content_json_en,featured_image_url,featured_image_alt_vi,featured_image_alt_en,is_featured,published_date,author_name,seo_title_vi,seo_title_en,seo_description_vi,seo_description_en,created_at,updated_at,deleted_at' as const;

const NEWS_TAG_SELECT = 'id,slug,label_vi,label_en,created_at';
const MAX_RELATED_RELATIONS = 500;
const MAX_RELATED_ARTICLES = 200;

export class NewsServiceError extends Error {
  code?: string;
  details?: string;

  constructor(context: string, error: any) {
    const reason = String(error?.message || error || 'Unknown News service error');
    super(`${context}: ${reason}`);
    this.name = 'NewsServiceError';
    this.code = error?.code;
    this.details = error?.details;
  }
}

function throwIfError(context: string, error: any) {
  if (error) throw new NewsServiceError(context, error);
}

function positiveInt(value: unknown, fallback: number, max: number) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function publicPaging(options: NewsPublicListOptions = {}) {
  const page = positiveInt(options.page, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = positiveInt(
    options.pageSize,
    NEWS_DEFAULT_PUBLIC_PAGE_SIZE,
    NEWS_MAX_PUBLIC_PAGE_SIZE,
  );
  const from = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    from,
    to: from + pageSize - 1,
    language: options.language || 'vi',
  } as const;
}

function adminPaging(filters: NewsAdminListFilters = {}) {
  const page = positiveInt(filters.page, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = positiveInt(
    filters.pageSize,
    NEWS_DEFAULT_ADMIN_PAGE_SIZE,
    NEWS_MAX_ADMIN_PAGE_SIZE,
  );
  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
}

function requireLanguageBundle(query: any, language: NewsLanguage) {
  const suffix = language === 'en' ? 'en' : 'vi';
  return query
    .not(`slug_${suffix}`, 'is', null)
    .not(`title_${suffix}`, 'is', null)
    .not(`excerpt_${suffix}`, 'is', null)
    .not(`content_json_${suffix}`, 'is', null);
}

function nullableText(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const cleaned = String(value).trim();
  return cleaned || null;
}

function sanitizedAdminSearch(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 120)
    .trim();
}

function normalizeWriteInput(input: NewsArticleWriteInput | NewsArticleUpdateInput) {
  const payload: Record<string, unknown> = {};
  const textFields = [
    'title_vi',
    'title_en',
    'excerpt_vi',
    'excerpt_en',
    'featured_image_url',
    'featured_image_alt_vi',
    'featured_image_alt_en',
    'published_date',
    'author_name',
    'seo_title_vi',
    'seo_title_en',
    'seo_description_vi',
    'seo_description_en',
  ] as const;

  for (const field of textFields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      payload[field] = nullableText(input[field]);
    }
  }

  for (const field of ['slug_vi', 'slug_en'] as const) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      const normalized = normalizeNewsSlug(input[field]);
      payload[field] = normalized || null;
    }
  }

  for (const field of ['content_json_vi', 'content_json_en'] as const) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      payload[field] = input[field] ?? null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'is_featured')) {
    payload.is_featured = Boolean(input.is_featured);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'status') && input.status) {
    payload.status = input.status;
  }

  return payload;
}

async function loadTagsForArticleIds(articleIds: string[]) {
  const uniqueIds = Array.from(new Set(articleIds.filter(Boolean)));
  const result = new Map<string, NewsTag[]>();
  uniqueIds.forEach((id) => result.set(id, []));
  if (!uniqueIds.length) return result;

  const { data: relations, error: relationError } = await supabase
    .from('news_article_tags')
    .select('article_id,tag_id')
    .in('article_id', uniqueIds);
  throwIfError('Load News article-tag relations', relationError);

  const relationRows = Array.isArray(relations) ? relations : [];
  const tagIds = Array.from(
    new Set(relationRows.map((row: any) => String(row.tag_id || '')).filter(Boolean)),
  );
  if (!tagIds.length) return result;

  const { data: tags, error: tagError } = await supabase
    .from('news_tags')
    .select(NEWS_TAG_SELECT)
    .in('id', tagIds);
  throwIfError('Load News tags', tagError);

  const tagById = new Map<string, NewsTag>();
  (Array.isArray(tags) ? tags : []).forEach((tag: any) => {
    tagById.set(String(tag.id), tag as NewsTag);
  });

  relationRows.forEach((relation: any) => {
    const articleId = String(relation.article_id || '');
    const tag = tagById.get(String(relation.tag_id || ''));
    if (!articleId || !tag) return;
    const current = result.get(articleId) || [];
    current.push(tag);
    result.set(articleId, current);
  });

  for (const tagsForArticle of result.values()) {
    tagsForArticle.sort((a, b) => a.label_vi.localeCompare(b.label_vi, 'vi'));
  }

  return result;
}

async function attachTags(rows: NewsArticleRow[]): Promise<NewsArticle[]> {
  if (!rows.length) return [];
  const tagMap = await loadTagsForArticleIds(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, tags: tagMap.get(row.id) || [] }));
}

function rowsWithoutJoinPayload(rows: any[]): NewsArticleRow[] {
  return rows.map((row) => {
    const { news_article_tags: _relations, ...article } = row || {};
    return article as NewsArticleRow;
  });
}

export async function listPublishedNews(
  options: NewsPublicListOptions = {},
): Promise<NewsListResult> {
  const { page, pageSize, from, to, language } = publicPaging(options);
  let query = supabase
    .from('news_articles')
    .select(NEWS_ARTICLE_SELECT, { count: 'exact' })
    .eq('status', 'published')
    .is('deleted_at', null);
  query = requireLanguageBundle(query, language);

  const { data, error, count } = await query
    .order('published_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);
  throwIfError('List published News', error);

  const rows = await attachTags((Array.isArray(data) ? data : []) as NewsArticleRow[]);
  return { rows, total: count || 0, page, pageSize };
}

export async function getNewsBySlug(
  slug: string,
  language: NewsLanguage = 'vi',
): Promise<NewsArticle | null> {
  const normalized = normalizeNewsSlug(slug);
  if (!normalized) return null;
  const slugColumn = language === 'en' ? 'slug_en' : 'slug_vi';

  let query = supabase
    .from('news_articles')
    .select(NEWS_ARTICLE_SELECT)
    .eq('status', 'published')
    .is('deleted_at', null);
  query = requireLanguageBundle(query, language);

  const { data, error } = await query
    .eq(slugColumn, normalized)
    .maybeSingle();
  throwIfError('Get News by slug', error);
  if (!data) return null;

  const [article] = await attachTags([data as NewsArticleRow]);
  return article || null;
}

export async function listNewsByTag(
  tagSlug: string,
  options: NewsPublicListOptions = {},
): Promise<NewsListResult> {
  const normalizedTagSlug = normalizeNewsSlug(tagSlug);
  const { page, pageSize, from, to, language } = publicPaging(options);
  if (!normalizedTagSlug) return { rows: [], total: 0, page, pageSize };

  const { data: tag, error: tagError } = await supabase
    .from('news_tags')
    .select(NEWS_TAG_SELECT)
    .eq('slug', normalizedTagSlug)
    .maybeSingle();
  throwIfError('Get News tag', tagError);
  if (!tag) return { rows: [], total: 0, page, pageSize };

  const selectWithTagRelation = `${NEWS_ARTICLE_SELECT},news_article_tags!inner(tag_id)`;
  let query = supabase
    .from('news_articles')
    .select(selectWithTagRelation, { count: 'exact' })
    .eq('status', 'published')
    .is('deleted_at', null)
    .eq('news_article_tags.tag_id', tag.id);
  query = requireLanguageBundle(query, language);

  const { data, error, count } = await query
    .order('published_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);
  throwIfError('List News by tag', error);

  const rows = await attachTags(rowsWithoutJoinPayload(Array.isArray(data) ? data : []));
  return { rows, total: count || 0, page, pageSize };
}

export async function getFeaturedNews(
  limit = 3,
  language: NewsLanguage = 'vi',
): Promise<NewsArticle[]> {
  const safeLimit = positiveInt(limit, 3, 12);
  let query = supabase
    .from('news_articles')
    .select(NEWS_ARTICLE_SELECT)
    .eq('status', 'published')
    .is('deleted_at', null)
    .eq('is_featured', true);
  query = requireLanguageBundle(query, language);

  const { data, error } = await query
    .order('published_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  throwIfError('Get featured News', error);
  return attachTags((Array.isArray(data) ? data : []) as NewsArticleRow[]);
}

export async function getRecentNews(
  limit = 5,
  excludeArticleId?: string,
  language: NewsLanguage = 'vi',
): Promise<NewsArticle[]> {
  const safeLimit = positiveInt(limit, 5, 20);
  const requested = Math.min(safeLimit + (excludeArticleId ? 1 : 0), NEWS_MAX_PUBLIC_PAGE_SIZE);
  const result = await listPublishedNews({ page: 1, pageSize: requested, language });
  return result.rows
    .filter((article) => !excludeArticleId || article.id !== excludeArticleId)
    .slice(0, safeLimit);
}

export async function getRelatedNews(
  articleId: string,
  limit = 4,
  language: NewsLanguage = 'vi',
): Promise<NewsArticle[]> {
  const currentId = String(articleId || '').trim();
  if (!currentId) return [];
  const safeLimit = positiveInt(limit, 4, 12);

  const { data: currentRelations, error: currentRelationError } = await supabase
    .from('news_article_tags')
    .select('tag_id')
    .eq('article_id', currentId);
  throwIfError('Load current News tags', currentRelationError);

  const tagIds = Array.from(
    new Set(
      (Array.isArray(currentRelations) ? currentRelations : [])
        .map((row: any) => String(row.tag_id || ''))
        .filter(Boolean),
    ),
  );
  if (!tagIds.length) return [];

  const { data: candidateRelations, error: candidateRelationError } = await supabase
    .from('news_article_tags')
    .select('article_id,tag_id')
    .in('tag_id', tagIds)
    .neq('article_id', currentId)
    .limit(MAX_RELATED_RELATIONS);
  throwIfError('Load related News candidates', candidateRelationError);

  const overlap = new Map<string, number>();
  (Array.isArray(candidateRelations) ? candidateRelations : []).forEach((row: any) => {
    const candidateId = String(row.article_id || '');
    if (!candidateId) return;
    overlap.set(candidateId, (overlap.get(candidateId) || 0) + 1);
  });

  const candidateIds = Array.from(overlap.keys()).slice(0, MAX_RELATED_ARTICLES);
  if (!candidateIds.length) return [];

  let query = supabase
    .from('news_articles')
    .select(NEWS_ARTICLE_SELECT)
    .in('id', candidateIds)
    .eq('status', 'published')
    .is('deleted_at', null);
  query = requireLanguageBundle(query, language);

  const { data: candidates, error: candidateError } = await query
    .limit(MAX_RELATED_ARTICLES);
  throwIfError('Load related News articles', candidateError);

  const rows = ((Array.isArray(candidates) ? candidates : []) as NewsArticleRow[]).sort((a, b) => {
    const overlapDiff = (overlap.get(b.id) || 0) - (overlap.get(a.id) || 0);
    if (overlapDiff) return overlapDiff;
    const publishedDiff = String(b.published_date || '').localeCompare(String(a.published_date || ''));
    if (publishedDiff) return publishedDiff;
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });

  return attachTags(rows.slice(0, safeLimit));
}

export async function listNewsTags(): Promise<NewsTag[]> {
  const { data, error } = await supabase
    .from('news_tags')
    .select(NEWS_TAG_SELECT)
    .order('label_vi', { ascending: true });
  throwIfError('List News tags', error);
  return (Array.isArray(data) ? data : []) as NewsTag[];
}

export async function adminListNews(
  filters: NewsAdminListFilters = {},
): Promise<NewsListResult> {
  const { page, pageSize, from, to } = adminPaging(filters);
  let query = supabase
    .from('news_articles')
    .select(NEWS_ARTICLE_SELECT, { count: 'exact' });

  const status = filters.status || 'active';
  if (status === 'active') query = query.neq('status', 'deleted');
  else if (status !== 'all') query = query.eq('status', status);

  if (typeof filters.featured === 'boolean') {
    query = query.eq('is_featured', filters.featured);
  }

  const search = sanitizedAdminSearch(filters.search);
  if (search) {
    const pattern = `%${search}%`;
    query = query.or([
      `title_vi.ilike.${pattern}`,
      `title_en.ilike.${pattern}`,
      `slug_vi.ilike.${pattern}`,
      `slug_en.ilike.${pattern}`,
    ].join(','));
  }

  const { data, error, count } = await query
    .order('updated_at', { ascending: false })
    .range(from, to);
  throwIfError('Admin list News', error);

  const rows = await attachTags((Array.isArray(data) ? data : []) as NewsArticleRow[]);
  return { rows, total: count || 0, page, pageSize };
}

export async function adminGetNewsById(articleId: string): Promise<NewsArticle | null> {
  const id = String(articleId || '').trim();
  if (!id) return null;

  const { data, error } = await supabase
    .from('news_articles')
    .select(NEWS_ARTICLE_SELECT)
    .eq('id', id)
    .maybeSingle();
  throwIfError('Admin get News by id', error);
  if (!data) return null;

  const [article] = await attachTags([data as NewsArticleRow]);
  return article || null;
}

export async function adminCreateNews(input: NewsArticleWriteInput): Promise<NewsArticle> {
  const payload = normalizeWriteInput(input);
  if (!payload.status) payload.status = 'draft';

  const { data, error } = await supabase
    .from('news_articles')
    .insert(payload)
    .select(NEWS_ARTICLE_SELECT)
    .single();
  throwIfError('Admin create News', error);

  const [article] = await attachTags([data as NewsArticleRow]);
  return article;
}

export async function adminUpdateNews(
  articleId: string,
  input: NewsArticleUpdateInput,
): Promise<NewsArticle> {
  const id = String(articleId || '').trim();
  if (!id) throw new NewsServiceError('Admin update News', new Error('articleId is required'));

  const payload = normalizeWriteInput(input);
  if (!Object.keys(payload).length) {
    const article = await adminGetNewsById(id);
    if (!article) throw new NewsServiceError('Admin update News', new Error('Article not found'));
    return article;
  }

  const { data, error } = await supabase
    .from('news_articles')
    .update(payload)
    .eq('id', id)
    .select(NEWS_ARTICLE_SELECT)
    .single();
  throwIfError('Admin update News', error);

  const [article] = await attachTags([data as NewsArticleRow]);
  return article;
}

export async function adminDeleteNews(articleId: string): Promise<NewsArticle> {
  const id = String(articleId || '').trim();
  if (!id) throw new NewsServiceError('Admin delete News', new Error('articleId is required'));

  const { data, error } = await supabase
    .from('news_articles')
    .update({
      status: 'deleted',
      deleted_at: new Date().toISOString(),
      is_featured: false,
    })
    .eq('id', id)
    .select(NEWS_ARTICLE_SELECT)
    .single();
  throwIfError('Admin soft-delete News', error);

  const [article] = await attachTags([data as NewsArticleRow]);
  return article;
}

export async function adminEnsureNewsTags(inputs: NewsTagWriteInput[]): Promise<NewsTag[]> {
  const normalizedInputs = inputs
    .map((input) => {
      const labelVi = String(input?.label_vi || '').trim();
      const slug = normalizeNewsSlug(input?.slug || labelVi);
      if (!labelVi || !slug) return null;
      return {
        slug,
        label_vi: labelVi,
        label_en: nullableText(input?.label_en) ?? null,
      };
    })
    .filter(Boolean) as Array<{ slug: string; label_vi: string; label_en: string | null }>;

  const deduped = Array.from(
    new Map(normalizedInputs.map((item) => [item.slug, item])).values(),
  );
  if (!deduped.length) return [];

  const existingTags = await listNewsTags();
  const bySlug = new Map(existingTags.map((tag) => [tag.slug.toLowerCase(), tag]));

  for (const input of deduped) {
    if (bySlug.has(input.slug)) continue;
    const { data, error } = await supabase
      .from('news_tags')
      .insert(input)
      .select(NEWS_TAG_SELECT)
      .single();

    if (error) {
      if (error.code !== '23505') throw new NewsServiceError('Admin create News tag', error);
      const { data: concurrentTag, error: concurrentError } = await supabase
        .from('news_tags')
        .select(NEWS_TAG_SELECT)
        .eq('slug', input.slug)
        .maybeSingle();
      throwIfError('Admin reload concurrent News tag', concurrentError);
      if (!concurrentTag) throw new NewsServiceError('Admin reload concurrent News tag', error);
      bySlug.set(input.slug, concurrentTag as NewsTag);
      continue;
    }

    bySlug.set(input.slug, data as NewsTag);
  }

  return deduped.map((input) => bySlug.get(input.slug)).filter(Boolean) as NewsTag[];
}

export async function adminSetNewsArticleTags(
  articleId: string,
  tagIds: string[],
): Promise<NewsTag[]> {
  const id = String(articleId || '').trim();
  if (!id) throw new NewsServiceError('Admin set News tags', new Error('articleId is required'));

  const wanted = Array.from(
    new Set((tagIds || []).map((tagId) => String(tagId || '').trim()).filter(Boolean)),
  );

  const { data: currentRelations, error: currentError } = await supabase
    .from('news_article_tags')
    .select('tag_id')
    .eq('article_id', id);
  throwIfError('Admin load current News tags', currentError);

  const current = new Set(
    (Array.isArray(currentRelations) ? currentRelations : [])
      .map((row: any) => String(row.tag_id || ''))
      .filter(Boolean),
  );
  const toAdd = wanted.filter((tagId) => !current.has(tagId));
  const toRemove = Array.from(current).filter((tagId) => !wanted.includes(tagId));

  if (toAdd.length) {
    const { error } = await supabase
      .from('news_article_tags')
      .insert(toAdd.map((tagId) => ({ article_id: id, tag_id: tagId })));
    throwIfError('Admin add News article tags', error);
  }

  if (toRemove.length) {
    const { error } = await supabase
      .from('news_article_tags')
      .delete()
      .eq('article_id', id)
      .in('tag_id', toRemove);
    throwIfError('Admin remove News article tags', error);
  }

  const tagMap = await loadTagsForArticleIds([id]);
  return tagMap.get(id) || [];
}
