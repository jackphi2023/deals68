import { Link } from 'react-router-dom';
import { localizeNewsArticle, type NewsArticle, type NewsLanguage } from '../../lib/newsTypes';
import NewsTags from './NewsTags';

type Props = {
  article: NewsArticle;
  language: NewsLanguage;
  compact?: boolean;
};

function formatNewsDate(value: string, language: NewsLanguage) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export default function NewsCard({ article, language, compact = false }: Props) {
  const localized = localizeNewsArticle(article, language);
  if (!localized) return null;
  const detailPath = `${language === 'en' ? '/en/news' : '/news'}/${encodeURIComponent(localized.slug)}`;

  return (
    <article className={`d68-news-card ${compact ? 'is-compact' : ''}`.trim()}>
      <Link className="d68-news-card__image-link" to={detailPath} tabIndex={-1} aria-hidden="true">
        {localized.featuredImageUrl ? (
          <img
            src={localized.featuredImageUrl}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="d68-news-card__image-empty">Deals68 News</span>
        )}
      </Link>
      <div className="d68-news-card__body">
        <time dateTime={localized.publishedDate}>{formatNewsDate(localized.publishedDate, language)}</time>
        <h2 className="d68-news-card__title">
          <Link to={detailPath}>{localized.title}</Link>
        </h2>
        {!compact ? <p>{localized.excerpt}</p> : null}
        <NewsTags tags={article.tags} language={language} compact />
      </div>
    </article>
  );
}
