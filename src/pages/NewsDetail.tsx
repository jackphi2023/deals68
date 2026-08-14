import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import NewsCard from '../components/news/NewsCard';
import NewsContentRenderer from '../components/news/NewsContentRenderer';
import { NewsArticleSeo, NewsStateSeo } from '../components/news/NewsSeo';
import NewsSidebar from '../components/news/NewsSidebar';
import NewsTags from '../components/news/NewsTags';
import { getNewsBySlug, getRecentNews, getRelatedNews } from '../services/newsService';
import { localizeNewsArticle, normalizeNewsSlug, type NewsArticle, type NewsLanguage } from '../lib/newsTypes';

type Props = { lang: NewsLanguage };

function formatNewsDate(value: string, language: NewsLanguage) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date);
}

export default function NewsDetail({ lang }: Props) {
  const { slug = '' } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [recent, setRecent] = useState<NewsArticle[]>([]);
  const [related, setRelated] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setArticle(null);
    setRecent([]);
    setRelated([]);

    const load = async () => {
      const loadedArticle = await getNewsBySlug(slug, lang);
      if (cancelled) return;
      if (!loadedArticle) {
        setArticle(null);
        return;
      }
      setArticle(loadedArticle);
      const [recentResult, relatedResult] = await Promise.allSettled([
        getRecentNews(5, loadedArticle.id, lang),
        getRelatedNews(loadedArticle.id, 4, lang),
      ]);
      if (cancelled) return;
      setRecent(recentResult.status === 'fulfilled' ? recentResult.value : []);
      setRelated(relatedResult.status === 'fulfilled' ? relatedResult.value : []);
    };

    void load()
      .catch((loadError: any) => {
        if (!cancelled) setError(loadError?.message || (lang === 'en' ? 'Could not load this article.' : 'Không tải được bài viết.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [lang, slug]);

  const newsPath = lang === 'en' ? '/en/news' : '/news';
  const normalizedSlug = normalizeNewsSlug(slug);
  const currentPath = `${newsPath}/${encodeURIComponent(normalizedSlug || slug)}`;

  if (loading) {
    return (
      <main className="d68-news-page">
        <NewsStateSeo lang={lang} path={currentPath} />
        <div className="d68-news-shell"><div className="d68-news-state">{lang === 'en' ? 'Loading article...' : 'Đang tải bài viết...'}</div></div>
      </main>
    );
  }
  if (error) {
    return (
      <main className="d68-news-page">
        <NewsStateSeo
          lang={lang}
          path={currentPath}
          title={lang === 'en' ? 'Article unavailable | Deals68.com' : 'Bài viết chưa thể hiển thị | Deals68.com'}
        />
        <div className="d68-news-shell"><div className="d68-news-state is-error">{error}</div></div>
      </main>
    );
  }
  if (!article) {
    return (
      <main className="d68-news-page">
        <NewsStateSeo
          lang={lang}
          path={currentPath}
          title={lang === 'en' ? 'Article not found | Deals68.com' : 'Không tìm thấy bài viết | Deals68.com'}
          description={lang === 'en'
            ? 'This Deals68 News article is not available.'
            : 'Bài viết Tin tức Deals68 này không khả dụng.'}
        />
        <div className="d68-news-shell d68-news-not-found">
          <h1>{lang === 'en' ? 'Article not found' : 'Không tìm thấy bài viết'}</h1>
          <p>{lang === 'en' ? 'The article may not be published, may have been removed, or the URL is incorrect.' : 'Bài viết có thể chưa được xuất bản, đã bị gỡ hoặc đường dẫn không chính xác.'}</p>
          <Link className="d68-news-button" to={newsPath}>← {lang === 'en' ? 'Back to News' : 'Quay lại Tin tức'}</Link>
        </div>
      </main>
    );
  }

  const localized = localizeNewsArticle(article, lang);
  if (!localized) return null;

  return (
    <main className="d68-news-page">
      <NewsArticleSeo article={article} lang={lang} />

      <div className="d68-news-shell d68-news-detail-shell">
        <nav className="d68-news-breadcrumb" aria-label="Breadcrumb">
          <Link to={newsPath}>{lang === 'en' ? 'News' : 'Tin tức'}</Link>
          <span>/</span>
          <span aria-current="page">{localized.title}</span>
        </nav>

        <div className="d68-news-detail-layout">
          <article className="d68-news-article">
            <header className="d68-news-article__header">
              <h1>{localized.title}</h1>
              <div className="d68-news-article__meta">
                <time dateTime={localized.publishedDate}>{formatNewsDate(localized.publishedDate, lang)}</time>
                <span>•</span>
                <span>{localized.authorName}</span>
              </div>
              <p className="d68-news-article__excerpt">{localized.excerpt}</p>
              <NewsTags tags={article.tags} language={lang} />
            </header>

            <NewsContentRenderer content={localized.content} />
          </article>

          <NewsSidebar articles={recent} language={lang} />
        </div>

        {related.length ? (
          <section className="d68-news-related" aria-labelledby="d68-related-news-title">
            <div className="d68-news-related__head">
              <h2 id="d68-related-news-title">{lang === 'en' ? 'Related articles' : 'Bài viết liên quan'}</h2>
              <Link to={newsPath}>{lang === 'en' ? 'View all News' : 'Xem tất cả Tin tức'} →</Link>
            </div>
            <div className="d68-news-related__grid">
              {related.map((row) => <NewsCard key={row.id} article={row} language={lang} compact />)}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
