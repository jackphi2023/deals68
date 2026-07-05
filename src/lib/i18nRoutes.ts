import type { Lang } from './i18n';

const LANG_PREFIX_RE = /^\/(en|vi)(?=\/|$)/;

function splitPathSuffix(path: string) {
  const m = String(path || '/').match(/^([^?#]*)(.*)$/);
  const pathname = m?.[1] || '/';
  const suffix = m?.[2] || '';
  return { pathname: pathname || '/', suffix };
}

export function langFromPath(pathname: string): Lang {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'vi';
}

export function stripLangPrefix(pathname: string) {
  const clean = String(pathname || '/').replace(LANG_PREFIX_RE, '') || '/';
  return clean.startsWith('/') ? clean : `/${clean}`;
}

export function toLocalizedPath(path: string, lang: Lang) {
  if (!path) return lang === 'en' ? '/en' : '/';
  if (/^(https?:|mailto:|tel:)/i.test(path)) return path;
  const { pathname, suffix } = splitPathSuffix(path);
  const base = stripLangPrefix(pathname);
  if (lang === 'en') return `${base === '/' ? '/en' : `/en${base}`}${suffix}`;
  return `${base}${suffix}`;
}

export function switchLanguagePath(pathname: string, search: string, targetLang: Lang) {
  return `${toLocalizedPath(stripLangPrefix(pathname), targetLang)}${search || ''}`;
}
