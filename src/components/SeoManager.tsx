import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applySeo } from '../lib/seo';
import {
  localizedSeoPath,
  seoForPath,
  seoLanguageFromPath,
} from '../lib/seoConfig';

export default function SeoManager() {
  const location = useLocation();

  useEffect(() => {
    const lang = seoLanguageFromPath(location.pathname);
    const definition = seoForPath(location.pathname);

    applySeo({
      lang,
      pageName:
        lang === 'en'
          ? definition.pageNameEn
          : definition.pageNameVi,
      description:
        lang === 'en'
          ? definition.descriptionEn
          : definition.descriptionVi,
      canonicalPath: localizedSeoPath(location.pathname, lang),
      type: definition.type || 'website',
      noindex: definition.noindex,
    });
  }, [location.pathname]);

  return null;
}
