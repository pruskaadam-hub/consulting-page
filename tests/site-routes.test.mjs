import test from 'node:test';
import assert from 'node:assert/strict';
import {pagePath,pageUrl,LANGUAGES,SITE_URL} from '../src/site-config.mjs';
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
