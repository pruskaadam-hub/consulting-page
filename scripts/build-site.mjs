import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';
import { SITE_URL, LANGUAGES, pagePath, pageUrl } from '../src/site-config.mjs';
import { articles } from '../src/articles.mjs';

const args=process.argv.slice(2);
const outIndex=args.indexOf('--outDir');
const outDir=outIndex>=0 ? args[outIndex+1] : 'dist';
await build({base:'./',build:{outDir}});
const shell=await readFile(path.join(outDir,'index.html'),'utf8');
const meta={
 cs:{title:'Adam Pruška | Studium, kariéra a business ve Švýcarsku',description:'Hlásíš se na ETH, hledáš práci v Curychu nebo rozjíždíš business v CH? Adam Pruška — konzultace pro Švýcarsko. Prvních 30 minut zdarma.'},
 sk:{title:'Adam Pruška | Štúdium, kariéra a biznis vo Švajčiarsku',description:'Hlásiš sa na ETH, hľadáš prácu v Zürichu alebo rozbiehaš biznis v CH? Adam Pruška — konzultácie pre Švajčiarsko. Prvých 30 minút zadarmo.'},
 en:{title:'Adam Pruška | Study, careers and business in Switzerland',description:'Applying to ETH, looking for work in Zurich or expanding into Switzerland? Consulting with Adam Pruška. Your first 30 minutes are free.'},
};
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const routes=LANGUAGES.flatMap(language=>[{language,slug:''},...articles.map(article=>({language,slug:article.slug,article}))]);
for(const route of routes){
 const {language,slug,article}=route;
 const relative=pagePath(language,slug);
 const depth=relative.split('/').filter(Boolean).length;
 const root=depth ? '../'.repeat(depth) : './';
 const localized=article?.translations[language];
 const title=localized ? `${localized.seoTitle || localized.title} | Adam Pruška` : meta[language].title;
 const description=localized?.description || meta[language].description;
 const image=pageUrl('cs').replace(/\/$/,'')+'/images/'+(article?.image || 'adam-noir.png');
 const seo=`<title>${escape(title)}</title>
    <meta name="description" content="${escape(description)}" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(description)}" />
    <meta property="og:type" content="${article ? 'article' : 'website'}" />
    <meta property="og:locale" content="${{cs:'cs_CZ',sk:'sk_SK',en:'en_GB'}[language]}" />
    <meta property="og:url" content="${escape(pageUrl(language,slug))}" />
    <meta property="og:image" content="${escape(image)}" />
    <link rel="canonical" href="${escape(pageUrl(language,slug))}" />
    ${LANGUAGES.map(lang=>`<link rel="alternate" hreflang="${lang}" href="${escape(pageUrl(lang,slug))}" />`).join('\n    ')}
    <link rel="alternate" hreflang="x-default" href="${escape(pageUrl('cs',slug))}" />`;
 let html=shell.replace('<html lang="cs">',`<html lang="${language}" data-site-root="${root}">`)
   .replace(/<title>.*?<\/title>/s,seo)
   .replaceAll('"./assets/',`"${root}assets/`)
   .replace('href="./favicon.svg"',`href="${root}favicon.svg"`);
 const target=path.join(outDir,relative);await mkdir(target,{recursive:true});await writeFile(path.join(target,'index.html'),html);
}
await writeFile(path.join(outDir,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(route=>`<url><loc>${escape(pageUrl(route.language,route.slug))}</loc></url>`).join('')}</urlset>`);
await writeFile(path.join(outDir,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap.xml',SITE_URL)}\n`);
console.log(`Generated ${routes.length} static page routes with localized metadata.`);
