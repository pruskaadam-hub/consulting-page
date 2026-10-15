import test from 'node:test';
import assert from 'node:assert/strict';
import {pagePath,pageUrl,blogUrl,LANGUAGES,SITE_URL} from '../src/site-config.mjs';
import {execFileSync} from 'node:child_process';
import {articles} from '../src/articles.mjs';
test('localized static routes share stable article identities and resolve under a project subpath',()=>{
 assert.equal(pagePath('cs'),'');assert.equal(pagePath('sk'),'sk/');assert.equal(pagePath('en','doktorat-ve-svycarsku'),'en/clanky/doktorat-ve-svycarsku/');
 assert.equal(new URL(pageUrl('en')).pathname,new URL(SITE_URL).pathname+'en/');
 for(const article of articles)for(const language of LANGUAGES){
  const copy=article.translations[language];
  assert.ok(copy.title && copy.description && copy.alt);
  assert.ok(copy.sections.length>=6);
  assert.ok(copy.sections.every(section=>section.paragraphs.length>0));
  assert.equal(new URL(pageUrl(language,article.slug)).pathname.endsWith('/clanky/'+article.slug+'/'),true);
 }
});
test('domain migration updates canonical destinations and preserves subpath deployment overrides',()=>{
 const script="import {pageUrl,blogUrl} from './src/site-config.mjs'; console.log(JSON.stringify([pageUrl('en'),blogUrl('sk','svycarske-cv')]));";
 for(const base of ['https://adampruska.cz/','https://pruskaadam-hub.github.io/consulting-page/']){
  const urls=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:new URL('..',import.meta.url),env:{...process.env,VITE_SITE_URL:base},encoding:'utf8'}));
  assert.deepEqual(urls,[base+'en/',base+'sk/blog/svycarske-cv/']);
 }
 assert.equal(new URL(blogUrl('cs','svycarske-cv')).origin,new URL(SITE_URL).origin);
});
