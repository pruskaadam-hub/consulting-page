// Change only this URL (or set VITE_SITE_URL at build time) when moving domains.
export const SITE_URL = (import.meta.env?.VITE_SITE_URL || (typeof process !== 'undefined' ? process.env?.VITE_SITE_URL : '') || 'https://adampruska.cz/').replace(/\/?$/, '/');
export const CONTACT_EMAIL = 'adam@adampruska.cz';
export const LANGUAGES = ['cs', 'sk', 'en'];
export const LANGUAGE_LOCALES = {cs:'cs-CZ', sk:'sk-SK', en:'en-GB'};
export function pagePath(language = 'cs', slug = '') {
  return `${language === 'cs' ? '' : language + '/'}${slug ? 'clanky/' + slug + '/' : ''}`;
}
export function pageUrl(language = 'cs', slug = '') { return new URL(pagePath(language, slug), SITE_URL).href; }

export function blogPath(language = 'cs', slug = '') {
  return `${language === 'cs' ? '' : language + '/'}blog/${slug ? slug+'/' : ''}`;
}
export function blogUrl(language = 'cs', slug = '') { return new URL(blogPath(language,slug),SITE_URL).href; }
