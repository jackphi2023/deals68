import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Lang } from '../../lib/i18n';
import { toLocalizedPath } from '../../lib/i18nRoutes';

type Props = {
  business: Record<string, any>;
  lang: Lang;
  className?: string;
  children?: ReactNode;
};

function businessTitle(
  business: Record<string, any>,
  lang: Lang,
) {
  if (lang === 'en') {
    return (
      business.title_en ||
      business.title_vi ||
      business.public_code ||
      'Business'
    );
  }

  return (
    business.title_vi ||
    business.title_en ||
    business.public_code ||
    'Doanh nghiệp'
  );
}

export default function BusinessTitleLink({
  business,
  lang,
  className = '',
  children,
}: Props) {
  const title = children || businessTitle(business, lang);
  const slug = String(business?.slug || '').trim();
  const classes = [
    'd68-investor-business-title-link',
    'd68-entity-title-link',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (!slug) {
    return <span className={classes}>{title}</span>;
  }

  return (
    <Link
      className={classes}
      to={toLocalizedPath(`/businesses/${slug}`, lang)}
      target="_blank"
      rel="noopener noreferrer"
    >
      {title}
    </Link>
  );
}
