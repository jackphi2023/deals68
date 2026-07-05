import type { Lang } from './i18n';

const LANG_PREFIX_RE = /^\/(en|vi)(?=\/|$)/;

export function getLangFromPath(pathname: string): Lang {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'vi';
}

export function stripLangPrefix(pathname: string): string {
  const raw = pathname || '/';
  const stripped = raw.replace(LANG_PREFIX_RE, '') || '/';
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

export function localizedPath(path: string, lang: Lang): string {
  const raw = path || '/';
  const match = raw.match(/^([^?#]*)([?#].*)?$/);
  const base = stripLangPrefix(match?.[1] || '/');
  const suffix = match?.[2] || '';
  if (lang === 'en') return base === '/' ? `/en${suffix}` : `/en${base}${suffix}`;
  return `${base}${suffix}`;
}

export function switchLangPath(pathname: string, search: string, hash: string, targetLang: Lang): string {
  return localizedPath(`${pathname || '/'}${search || ''}${hash || ''}`, targetLang);
}
