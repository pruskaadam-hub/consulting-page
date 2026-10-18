import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';
import { SITE_URL, LANGUAGES, pagePath, pageUrl, blogPath, blogUrl } from '../src/site-config.mjs';
import { articles } from '../src/articles.mjs';
import { renderBlogMarkdown, articleStructuredData } from '../src/blog/render.mjs';
const blogMetadata=JSON.parse(await readFile(new URL('../src/blog/metadata.json',import.meta.url),'utf8'));
const blogPosts=await Promise.all(blogMetadata.map(async post=>({...post,markdown:await readFile(new URL(`../src/blog/${post.slug}.md`,import.meta.url),'utf8')})));

const args=process.argv.slice(2);
const outIndex=args.indexOf('--outDir');
const outDir=outIndex>=0 ? args[outIndex+1] : 'dist';
await build({base:'./',build:{outDir}});
const shell=await readFile(path.join(outDir,'index.html'),'utf8');
const meta={
 cs:{title:'Adam Pruška | Studium, kariéra a business ve Švýcarsku',description:'Tvůj první krok do Švýcarska. Studium na švýcarské univerzitě, práce i vlastní business. Adam Pruška nabízí konzultace pro Švýcarsko. Prvních 30 minut zdarma.'},
 sk:{title:'Adam Pruška | Štúdium, kariéra a biznis vo Švajčiarsku',description:'Tvoj prvý krok do Švajčiarska. Štúdium na švajčiarskej univerzite, práca aj vlastný biznis. Adam Pruška ponúka konzultácie pre Švajčiarsko. Prvých 30 minút zadarmo.'},
 en:{title:'Adam Pruška | Study, careers and business in Switzerland',description:'Your first step to Switzerland. University admissions, careers and business with Adam Pruška. Your first 30 minutes are free.'},
};
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const routes=LANGUAGES.flatMap(language=>[{language,slug:''},...articles.map(article=>({language,slug:article.slug,article})),{language,slug:'',blog:true},...blogPosts.map(post=>({language,slug:post.slug,blog:true,post}))]);
for(const route of routes){
 const {language,slug,article,blog,post}=route;
 const relative=blog ? blogPath(language,slug) : pagePath(language,slug);
 const url=blog ? blogUrl(language,slug) : pageUrl(language,slug);
 const depth=relative.split('/').filter(Boolean).length;
 const root=depth ? '../'.repeat(depth) : './';
 const localized=article?.translations[language];
 const title=post ? `${post.title} | Adam Pruška` : localized ? `${localized.seoTitle || localized.title} | Adam Pruška` : blog ? 'Blog | Adam Pruška' : meta[language].title;
 const description=post?.description || localized?.description || meta[language].description;
 const image=pageUrl('cs').replace(/\/$/,'')+'/images/'+(post?.image || article?.image || 'adam-noir.png');
 const seo=`<title>${escape(title)}</title>
    <meta name="description" content="${escape(description)}" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(description)}" />
    <meta property="og:type" content="${article || post ? 'article' : 'website'}" />
    <meta property="og:locale" content="${post ? 'cs_CZ' : {cs:'cs_CZ',sk:'sk_SK',en:'en_GB'}[language]}" />
    <meta property="og:url" content="${escape(url)}" />
    <meta property="og:image" content="${escape(image)}" />
    <link rel="canonical" href="${escape(url)}" />
    ${LANGUAGES.map(lang=>`<link rel="alternate" hreflang="${lang}" href="${escape(blog ? blogUrl(lang,slug) : pageUrl(lang,slug))}" />`).join('\n    ')}
    <link rel="alternate" hreflang="x-default" href="${escape(blog ? blogUrl('cs',slug) : pageUrl('cs',slug))}" />`;
 let html=shell.replace('<html lang="cs">',`<html lang="${language}" data-site-root="${root}">`)
   .replace(/<title>.*?<\/title>/s,seo)
   .replaceAll('"./assets/',`"${root}assets/`)
   .replace('href="./favicon.svg"',`href="${root}favicon.svg"`);
 if(post){
  const structured=JSON.stringify(articleStructuredData(post,url,image)).replaceAll('<','\\u003c');
  html=html.replace('</head>',`    <script type="application/ld+json">${structured}</script>\n  </head>`);
  const body=renderBlogMarkdown(post.markdown,{home:new URL(pageUrl(language)).pathname,blogLink:slug=>new URL(blogUrl(language,slug)).pathname});
  const preview=`<main class="article-detail" lang="cs"><header class="article-intro wrap"><h1>${escape(post.title)}</h1><p>Adam Pruška · <time datetime="${escape(post.published)}">${escape(new Intl.DateTimeFormat({cs:"cs-CZ",sk:"sk-SK",en:"en-GB"}[language],{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(post.published+"T12:00:00Z")))}</time></p></header><div class="article-prose authored-prose">${body}</div></main>`;
  html=html.replace('<div id="root"></div>',`<div id="root">${preview}</div>`);
 }
 const target=path.join(outDir,relative);await mkdir(target,{recursive:true});await writeFile(path.join(target,'index.html'),html);
}
await writeFile(path.join(outDir,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(route=>`<url><loc>${escape(route.blog ? blogUrl(route.language,route.slug) : pageUrl(route.language,route.slug))}</loc></url>`).join('')}</urlset>`);
const adminRoot='../';
const adminHtml=shell.replace('<html lang="cs">',`<html lang="cs" data-site-root="${adminRoot}">`)
  .replace(/<title>.*?<\/title>/s,'<title>Administrace | Adam Pruška</title>\n<meta name="robots" content="noindex, nofollow" />\n<meta name="referrer" content="no-referrer" />')
  .replaceAll('"./assets/',`"${adminRoot}assets/`).replace('href="./favicon.svg"',`href="${adminRoot}favicon.svg"`);
await mkdir(path.join(outDir,'admin'),{recursive:true});
await writeFile(path.join(outDir,'admin/index.html'),adminHtml);
await writeFile(path.join(outDir,'robots.txt'),`User-agent: *\nAllow: /\nDisallow: ${new URL('admin/',SITE_URL).pathname}\nSitemap: ${new URL('sitemap.xml',SITE_URL)}\n`);
console.log(`Generated ${routes.length} public pages and a private admin entry point.`);
