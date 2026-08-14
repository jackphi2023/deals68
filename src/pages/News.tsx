import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import NewsCard from '../components/news/NewsCard';
import { NewsCollectionSeo } from '../components/news/NewsSeo';
import { listNewsByTag, listNewsTags, listPublishedNews } from '../services/newsService';
import {
  NEWS_DEFAULT_PUBLIC_PAGE_SIZE,
  NEWS_MAX_PUBLIC_PAGE_SIZE,
  localizeNewsTag,
  normalizeNewsSlug,
  type NewsArticle,
  type NewsLanguage,
  type NewsTag,
} from '../lib/newsTypes';

type Props = { lang: NewsLanguage };

type NewsArchiveMonth = {
  month: string;
  count: number;
};

type NewsPopularTag = {
  tag: NewsTag;
  count: number;
};

function positivePage(value: string | null) {
  const page = Math.floor(Number(value || 1));
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function normalizeArchiveMonth(value: string | null) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return '';
  const month = Number(match[2]);
  if (month < 1 || month > 12) return '';
  return `${match[1]}-${match[2]}`;
}

function paginationHref(basePath: string, page: number, month = '') {
  const params = new URLSearchParams();
  if (month) params.set('month', month);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function archiveMonthLabel(month: string, language: NewsLanguage) {
  const [year, monthValue] = month.split('-');
  const numericMonth = Number(monthValue);
  if (!year || !numericMonth) return month;
  if (language === 'vi') return `Tháng ${numericMonth}/${year}`;
  const date = new Date(Date.UTC(Number(year), numericMonth - 1, 1));
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

async function loadAllPublishedNews(language: NewsLanguage) {
  const first = await listPublishedNews({
    page: 1,
    pageSize: NEWS_MAX_PUBLIC_PAGE_SIZE,
    language,
  });
  const rows = [...first.rows];
  const pageCount = Math.ceil(first.total / NEWS_MAX_PUBLIC_PAGE_SIZE);
  for (let page = 2; page <= pageCount; page += 1) {
    const result = await listPublishedNews({
      page,
      pageSize: NEWS_MAX_PUBLIC_PAGE_SIZE,
      language,
    });
    rows.push(...result.rows);
  }
  return rows;
}

function buildSidebarStats(articles: NewsArticle[], language: NewsLanguage) {
  const monthCounts = new Map<string, number>();
  const tagCounts = new Map<string, NewsPopularTag>();

  articles.forEach((article) => {
    const month = String(article.published_date || '').slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(month)) {
      monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
    }

    article.tags.forEach((tag) => {
      const current = tagCounts.get(tag.id);
      tagCounts.set(tag.id, { tag, count: (current?.count || 0) + 1 });
    });
  });

  const months: NewsArchiveMonth[] = Array.from(monthCounts.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => b.month.localeCompare(a.month));

  const popularTags = Array.from(tagCounts.values())
    .sort((a, b) => {
      const countDiff = b.count - a.count;
      if (countDiff) return countDiff;
      return localizeNewsTag(a.tag, language).label.localeCompare(
        localizeNewsTag(b.tag, language).label,
        language === 'vi' ? 'vi' : 'en',
      );
    })
    .slice(0, 10);

  return { months, popularTags };
}

export default function News({ lang }: Props) {
  const { tagSlug } = useParams<{ tagSlug?: string }>();
  const [searchParams] = useSearchParams();
  const normalizedTagSlug = normalizeNewsSlug(tagSlug);
  const selectedMonth = normalizedTagSlug ? '' : normalizeArchiveMonth(searchParams.get('month'));
  const page = positivePage(searchParams.get('page'));
  const [rows, setRows] = useState<NewsArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [tag, setTag] = useState<NewsTag | null>(null);
  const [archiveMonths, setArchiveMonths] = useState<NewsArchiveMonth[]>([]);
  const [popularTags, setPopularTags] = useState<NewsPopularTag[]>([]);
  const [alternateTagAvailable, setAlternateTagAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setAlternateTagAvailable(false);

    const load = async () => {
      const allPublished = await loadAllPublishedNews(lang);
      const sidebarStats = buildSidebarStats(allPublished, lang);

      let nextRows: NewsArticle[] = [];
      let nextTotal = 0;
      let resolvedTag: NewsTag | null = null;
      let hasAlternateTagContent = false;

      if (normalizedTagSlug) {
        const [result, tags] = await Promise.all([
          listNewsByTag(normalizedTagSlug, {
            page,
            pageSize: NEWS_DEFAULT_PUBLIC_PAGE_SIZE,
            language: lang,
          }),
          listNewsTags(),
        ]);
        nextRows = result.rows;
        nextTotal = result.total;
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
      } else {
        const filtered = selectedMonth
          ? allPublished.filter((article) => String(article.published_date || '').startsWith(`${selectedMonth}-`))
          : allPublished;
        nextTotal = filtered.length;
        const from = (page - 1) * NEWS_DEFAULT_PUBLIC_PAGE_SIZE;
        nextRows = filtered.slice(from, from + NEWS_DEFAULT_PUBLIC_PAGE_SIZE);
      }

      if (cancelled) return;
      setRows(nextRows);
      setTotal(nextTotal);
      setTag(resolvedTag);
      setArchiveMonths(sidebarStats.months);
      setPopularTags(sidebarStats.popularTags);
      setAlternateTagAvailable(hasAlternateTagContent);
    };

    void load()
      .catch((loadError: any) => {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
          setTag(null);
          setArchiveMonths([]);
          setPopularTags([]);
          setAlternateTagAvailable(false);
          setError(loadError?.message || (lang === 'en' ? 'Could not load News.' : 'Không tải được Tin tức.'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [lang, normalizedTagSlug, page, selectedMonth]);

  const pageCount = Math.max(1, Math.ceil(total / NEWS_DEFAULT_PUBLIC_PAGE_SIZE));
  const basePath = normalizedTagSlug
    ? `${lang === 'en' ? '/en/news/tag' : '/news/tag'}/${encodeURIComponent(normalizedTagSlug)}`
    : (lang === 'en' ? '/en/news' : '/news');
  const newsPath = lang === 'en' ? '/en/news' : '/news';
  const localizedTag = useMemo(() => tag ? localizeNewsTag(tag, lang) : null, [tag, lang]);
  const selectedMonthLabel = selectedMonth ? archiveMonthLabel(selectedMonth, lang) : '';

  const title = normalizedTagSlug
    ? localizedTag
      ? (lang === 'en' ? `Topic: ${localizedTag.label}` : `Chủ đề: ${localizedTag.label}`)
      : (lang === 'en' ? 'News topic' : 'Chủ đề Tin tức')
    : selectedMonth
      ? (lang === 'en' ? `News — ${selectedMonthLabel}` : `Tin tức ${selectedMonthLabel.toLowerCase()}`)
      : (lang === 'en' ? 'News & Market Insights' : 'Tin tức & Góc nhìn thị trường');
  const intro = normalizedTagSlug
    ? (lang === 'en' ? 'Published Deals68 articles in this topic.' : 'Các bài viết Deals68 đã xuất bản thuộc chủ đề này.')
    : (lang === 'en'
      ? 'Updates and practical perspectives on investment, M&A, fundraising and market transactions.'
      : 'Cập nhật và góc nhìn thực tiễn về đầu tư, M&A, gọi vốn và các giao dịch trên thị trường.');

  const seoPath = paginationHref(basePath, page, selectedMonth);
  const seoTitleBase = localizedTag
    ? (lang === 'en'
      ? `${localizedTag.label} News`
      : `Tin tức chủ đề ${localizedTag.label}`)
    : selectedMonth
      ? (lang === 'en' ? `News — ${selectedMonthLabel}` : `Tin tức ${selectedMonthLabel.toLowerCase()}`)
      : (lang === 'en' ? 'News & Market Insights' : 'Tin tức & Góc nhìn thị trường');
  const seoTitle = `${seoTitleBase}${page > 1 ? (lang === 'en' ? ` – Page ${page}` : ` – Trang ${page}`) : ''} | Deals68.com`;
  const alternateBasePath = normalizedTagSlug
    ? `${lang === 'en' ? '/news/tag' : '/en/news/tag'}/${encodeURIComponent(normalizedTagSlug)}`
    : (lang === 'en' ? '/news' : '/en/news');
  const alternatePath = !selectedMonth && page === 1 && (
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
          {normalizedTagSlug || selectedMonth ? <Link className="d68-news-back" to={newsPath}>← {lang === 'en' ? 'All News' : 'Tất cả Tin tức'}</Link> : null}
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
        {!loading && !error && selectedMonth && total === 0 ? (
          <div className="d68-news-state">{lang === 'en' ? 'No published articles in this month.' : 'Chưa có bài đã xuất bản trong tháng này.'}</div>
        ) : null}
        {!loading && !error && !normalizedTagSlug && !selectedMonth && total === 0 ? (
          <div className="d68-news-state">{lang === 'en' ? 'No published News yet.' : 'Chưa có Tin tức đã xuất bản.'}</div>
        ) : null}
        {!loading && !error && total > 0 && !rows.length ? (
          <div className="d68-news-state">
            <b>{lang === 'en' ? 'This page has no results.' : 'Trang này không có kết quả.'}</b>
            <Link to={paginationHref(basePath, pageCount, selectedMonth)}>{lang === 'en' ? 'Go to the last page' : 'Đi đến trang cuối'}</Link>
          </div>
        ) : null}

        {rows.length ? (
          <div className="d68-news-list-layout">
            <div className="d68-news-list-main">
              <div className="d68-news-grid">
                {rows.map((article) => <NewsCard key={article.id} article={article} language={lang} />)}
              </div>

              <nav className="d68-news-pagination" aria-label={lang === 'en' ? 'News pagination' : 'Phân trang Tin tức'}>
                {page > 1 ? <Link to={paginationHref(basePath, page - 1, selectedMonth)}>← {lang === 'en' ? 'Previous' : 'Trang trước'}</Link> : <span />}
                <b>{lang === 'en' ? `Page ${page}/${pageCount}` : `Trang ${page}/${pageCount}`}</b>
                {page < pageCount ? <Link to={paginationHref(basePath, page + 1, selectedMonth)}>{lang === 'en' ? 'Next' : 'Trang tiếp'} →</Link> : <span />}
              </nav>
            </div>

            <aside className="d68-news-list-sidebar" aria-label={lang === 'en' ? 'News filters' : 'Bộ lọc Tin tức'}>
              <section className="d68-news-filter-box">
                <h2>{lang === 'en' ? 'Time' : 'Thời gian'}</h2>
                <ul>
                  {archiveMonths.map((item) => (
                    <li key={item.month}>
                      <Link className={selectedMonth === item.month ? 'active' : ''} to={`${newsPath}?month=${item.month}`}>
                        <span>{archiveMonthLabel(item.month, lang)}</span>
                        <b>({item.count})</b>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="d68-news-filter-box">
                <h2>{lang === 'en' ? 'Topics' : 'Chủ đề'}</h2>
                <ul>
                  {popularTags.map((item) => {
                    const localized = localizeNewsTag(item.tag, lang);
                    const href = `${lang === 'en' ? '/en/news/tag' : '/news/tag'}/${encodeURIComponent(item.tag.slug)}`;
                    return (
                      <li key={item.tag.id}>
                        <Link className={normalizedTagSlug === item.tag.slug ? 'active' : ''} to={href}>
                          <span>{localized.label}</span>
                          <b>({item.count})</b>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </aside>
          </div>
        ) : null}
      </section>
    </main>
  );
}
