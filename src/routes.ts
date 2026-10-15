import { pagePath, blogPath } from './site-config.mjs';
import type { Language } from './locales';

// Static HTML supplies the relative root, so assets work on Pages and custom domains.
const root = new URL(document.documentElement.dataset.siteRoot || (import.meta.env.DEV ? '/' : import.meta.env.BASE_URL), document.baseURI);
export const assetUrl = (name:string) => new URL(`images/${name}`,root).href;
export const internalUrl = (language:Language,slug='') => new URL(pagePath(language,slug),root).pathname;
export const blogInternalUrl=(language:Language,slug='')=>new URL(blogPath(language,slug),root).pathname;
export function currentRoute():{language:Language;slug:string;blog:boolean;admin:boolean} {
  const path=location.pathname.slice(root.pathname.length).split('/').filter(Boolean);
  const language=path[0]==='sk' || path[0]==='en' ? path.shift() as Language : 'cs';
  return {language,slug:path[0]==='clanky' || path[0]==='blog' ? path[1] || '' : '',blog:path[0]==='blog',admin:path[0]==='admin'};
}
