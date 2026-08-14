import { Link } from 'react-router-dom';
import { localizeNewsTag, type NewsLanguage, type NewsTag } from '../../lib/newsTypes';

type Props = {
  tags: NewsTag[];
  language: NewsLanguage;
  compact?: boolean;
};

export default function NewsTags({ tags, language, compact = false }: Props) {
  if (!tags.length) return null;
  const basePath = language === 'en' ? '/en/news/tag' : '/news/tag';
  return (
    <div className={`d68-news-tags ${compact ? 'is-compact' : ''}`.trim()} aria-label={language === 'en' ? 'Topics' : 'Chủ đề'}>
      {tags.map((tag) => {
        const localized = localizeNewsTag(tag, language);
        return (
          <Link key={tag.id} to={`${basePath}/${encodeURIComponent(tag.slug)}`}>
            {localized.label}
          </Link>
        );
      })}
    </div>
  );
}
