import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import NewsCard from '../components/news/NewsCard';
import { NewsCollectionSeo } from '../components/news/NewsSeo';
import { listNewsByTag, listNewsTags, listPublishedNews } from '../services/newsService';
import {
  NEWS_DEFAULT_PUBLIC_PAGE_SIZE,
  localizeNewsTag,
  normalizeNewsSlug,
  type NewsArticle,
  type NewsLanguage,
  type NewsTag,
} from '../lib/newsTypes';

type Props = { lang: NewsLanguage };

function positivePage(value: string | null) {
  const page = Math.floor(Number(value || 1));
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function paginationHref(basePath: string, page: number) {
  return page > 1 ? `${basePath}?page=${page}` : basePath;
}

export default function News({ lang }: Props) {
  const { tagSlug } = useParams<{ tagSlug?: string }>();
  const [searchParams] = useSearchParams();
  const normalizedTagSlug = normalizeNewsSlug(tagSlug);
  const page = positivePage(searchParams.get('page'));
  const [rows, setRows] = useState<NewsArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [tag, setTag] = useState<NewsTag | null>(null);
  const [alternateTagAvailable, setAlternateTagAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setAlternateTagAvailable(false);

    const load = async () => {
      const result = normalizedTagSlug
        ? await listNewsByTag(normalizedTagSlug, { page, pageSize: NEWS_DEFAULT_PUBLIC_PAGE_SIZE, language: lang })
        : await listPublishedNews({ page, pageSize: NEWS_DEFAULT_PUBLIC_PAGE_SIZE, language: lang });

      let resolvedTag: NewsTag | null = null;
      let hasAlternateTagContent = false;
      if (normalizedTagSlug) {
        const tags = await listNewsTags();
        resolvedTag = tags.find((item) => item.slug === normalizedTagSlug) || null;

        if (resolvedTag && page === 1) {
          const alternateLanguage: NewsLanguage = lang === 'en' ? 'vi' : 'en';
          const alternateResult = await listNewsByTag(normalizedTagSlug, {
            page: 1,
            pageSize: 1,
            language: alternateLanguage,
          }).catch(() => null);
          hasAlternateTagContent = Boolean(alternateResult && alternateResult.total > 0);
        }
      }

      if (cancelled) return;
      setRows(result.rows);
      setTotal(result.total);
      setTag(resolvedTag);
      setAlternateTagAvailable(hasAlternateTagContent);
    };

    void load()
      .catch((loadError: any) => {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
          setTag(null);
          setAlternateTagAvailable(false);
          setError(loadError?.message || (lang === 'en' ? 'Could not load News.' : 'Không tải được Tin tức.'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [lang, normalizedTagSlug, page]);

  const pageCount = Math.max(1, Math.ceil(total / NEWS_DEFAULT_PUBLIC_PAGE_SIZE));
  const basePath = normalizedTagSlug
    ? `${lang === 'en' ? '/en/news/tag' : '/news/tag'}/${encodeURIComponent(normalizedTagSlug)}`
    : (lang === 'en' ? '/en/news' : '/news');
  const newsPath = lang === 'en' ? '/en/news' : '/news';
  const localizedTag = useMemo(() => tag ? localizeNewsTag(tag, lang) : null, [tag, lang]);

  const title = normalizedTagSlug
    ? localizedTag
      ? (lang === 'en' ? `Topic: ${localizedTag.label}` : `Chủ đề: ${localizedTag.label}`)
      : (lang === 'en' ? 'News topic' : 'Chủ đề Tin tức')
    : (lang === 'en' ? 'News & Market Insights' : 'Tin tức & Góc nhìn thị trường');
  const intro = normalizedTagSlug
    ? (lang === 'en' ? 'Published Deals68 articles in this topic.' : 'Các bài viết Deals68 đã xuất bản thuộc chủ đề này.')
    : (lang === 'en'
      ? 'Updates and practical perspectives on investment, M&A, fundraising and private-market transactions.'
      : 'Cập nhật và góc nhìn thực tiễn về đầu tư, M&A, gọi vốn và các giao dịch trên thị trường tư nhân.');

  const seoPath = paginationHref(basePath, page);
  const seoTitleBase = localizedTag
    ? (lang === 'en'
      ? `${localizedTag.label} News`
      : `Tin tức chủ đề ${localizedTag.label}`)
    : (lang === 'en' ? 'News & Market Insights' : 'Tin tức & Góc nhìn thị trường');
  const seoTitle = `${seoTitleBase}${page > 1 ? (lang === 'en' ? ` – Page ${page}` : ` – Trang ${page}`) : ''} | Deals68.com`;
  const alternateBasePath = normalizedTagSlug
    ? `${lang === 'en' ? '/news/tag' : '/en/news/tag'}/${encodeURIComponent(normalizedTagSlug)}`
    : (lang === 'en' ? '/news' : '/en/news');
  const alternatePath = page === 1 && (
    !normalizedTagSlug || (Boolean(tag) && alternateTagAvailable)
  ) ? alternateBasePath : null;
  const noindex = loading
    || Boolean(error)
    || (Boolean(normalizedTagSlug) && !tag)
    || (Boolean(normalizedTagSlug) && Boolean(tag) && total === 0)
    || (!loading && total > 0 && rows.length === 0);

  return (
    <main className="d68-news-page">
      <NewsCollectionSeo
        lang={lang}
        title={seoTitle}
        description={intro}
        path={seoPath}
        alternatePath={alternatePath}
        noindex={noindex}
      />

      <section className="d68-news-hero">
        <div className="d68-news-shell">
          {normalizedTagSlug ? <Link className="d68-news-back" to={newsPath}>← {lang === 'en' ? 'All News' : 'Tất cả Tin tức'}</Link> : null}
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
      </section>

      <section className="d68-news-shell d68-news-list-section">
        {error ? <div className="d68-news-state is-error">{error}</div> : null}
        {loading ? <div className="d68-news-state">{lang === 'en' ? 'Loading News...' : 'Đang tải Tin tức...'}</div> : null}
        {!loading && !error && normalizedTagSlug && !tag ? (
          <div className="d68-news-state">
            <b>{lang === 'en' ? 'Topic not found.' : 'Không tìm thấy chủ đề.'}</b>
            <Link to={newsPath}>{lang === 'en' ? 'View all News' : 'Xem tất cả Tin tức'}</Link>
          </div>
        ) : null}
        {!loading && !error && tag && total === 0 ? (
          <div className="d68-news-state">{lang === 'en' ? 'No published articles in this topic yet.' : 'Chưa có bài đã xuất bản trong chủ đề này.'}</div>
        ) : null}
        {!loading && !error && !normalizedTagSlug && total === 0 ? (
          <div className="d68-news-state">{lang === 'en' ? 'No published News yet.' : 'Chưa có Tin tức đã xuất bản.'}</div>
        ) : null}
        {!loading && !error && total > 0 && !rows.length ? (
          <div className="d68-news-state">
            <b>{lang === 'en' ? 'This page has no results.' : 'Trang này không có kết quả.'}</b>
            <Link to={paginationHref(basePath, pageCount)}>{lang === 'en' ? 'Go to the last page' : 'Đi đến trang cuối'}</Link>
          </div>
        ) : null}

        {rows.length ? (
          <>
            <div className="d68-news-list-meta">
              <span>{lang === 'en' ? `${total} published articles` : `${total} bài đã xuất bản`}</span>
              <span>{lang === 'en' ? `Page ${page}/${pageCount}` : `Trang ${page}/${pageCount}`}</span>
            </div>
            <div className="d68-news-grid">
              {rows.map((article) => <NewsCard key={article.id} article={article} language={lang} />)}
            </div>
          </>
        ) : null}

        {pageCount > 1 ? (
          <nav className="d68-news-pagination" aria-label={lang === 'en' ? 'News pagination' : 'Phân trang Tin tức'}>
            {page > 1 ? <Link to={paginationHref(basePath, page - 1)}>← {lang === 'en' ? 'Previous' : 'Trang trước'}</Link> : <span />}
            <b>{page} / {pageCount}</b>
            {page < pageCount ? <Link to={paginationHref(basePath, page + 1)}>{lang === 'en' ? 'Next' : 'Trang tiếp'} →</Link> : <span />}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
