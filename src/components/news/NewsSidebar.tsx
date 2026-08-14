import { Link } from 'react-router-dom';
import { localizeNewsArticle, type NewsArticle, type NewsLanguage } from '../../lib/newsTypes';

type Props = {
  articles: NewsArticle[];
  language: NewsLanguage;
};

function formatNewsDate(value: string, language: NewsLanguage) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date);
}

export default function NewsSidebar({ articles, language }: Props) {
  if (!articles.length) return null;
  const basePath = language === 'en' ? '/en/news' : '/news';
  return (
    <aside className="d68-news-sidebar" aria-label={language === 'en' ? 'Recent News' : 'Tin mới'}>
      <h2>{language === 'en' ? 'Recent News' : 'Tin mới'}</h2>
      <div className="d68-news-sidebar__list">
        {articles.map((article) => {
          const localized = localizeNewsArticle(article, language);
          if (!localized) return null;
          return (
            <article key={article.id}>
              {localized.featuredImageUrl ? (
                <Link className="d68-news-sidebar__image" to={`${basePath}/${encodeURIComponent(localized.slug)}`} tabIndex={-1} aria-hidden="true">
                  <img src={localized.featuredImageUrl} alt="" loading="lazy" decoding="async" />
                </Link>
              ) : null}
              <div>
                <time dateTime={localized.publishedDate}>{formatNewsDate(localized.publishedDate, language)}</time>
                <h3><Link to={`${basePath}/${encodeURIComponent(localized.slug)}`}>{localized.title}</Link></h3>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
