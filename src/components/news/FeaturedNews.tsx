import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFeaturedNews } from '../../services/newsService';
import type { NewsArticle, NewsLanguage } from '../../lib/newsTypes';
import NewsCard from './NewsCard';

type Props = {
  lang: NewsLanguage;
};

export default function FeaturedNews({ lang }: Props) {
  const [rows, setRows] = useState<NewsArticle[]>([]);

  useEffect(() => {
    let cancelled = false;
    setRows([]);

    void getFeaturedNews(3, lang)
      .then((articles) => {
        if (!cancelled) setRows(articles.slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });

    return () => {
      cancelled = true;
    };
  }, [lang]);

  if (!rows.length) return null;

  const newsPath = lang === 'en' ? '/en/news' : '/news';
  const title = lang === 'en' ? 'Featured News' : 'Tin nổi bật';
  const allLabel = lang === 'en' ? 'View all' : 'Xem tất cả';

  return (
    <section className="d68-home-container d68-home-block d68-featured-news-home" aria-labelledby="d68-featured-news-title">
      <div className="d68-home-title d68-home-title--row">
        <div>
          <span className="d68-home-badge d68-home-badge--blue">News</span>
          <h2 id="d68-featured-news-title">{title}</h2>
        </div>
        <Link to={newsPath}>{allLabel} →</Link>
      </div>
      <div className="d68-news-grid d68-featured-news-home__grid">
        {rows.map((article) => (
          <NewsCard
            key={article.id}
            article={article}
            language={lang}
            showDate={false}
            showTags={false}
          />
        ))}
      </div>
    </section>
  );
}
