import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRICES,STUDENT_PRICES,studentPrice,currencyLabel} from '../src/pricing.mjs';
import {renderBlogMarkdown,articleStructuredData} from '../src/blog/render.mjs';
import {blogPath,blogUrl} from '../src/site-config.mjs';

test('student discounts preserve exact currency amounts, including package decimals',()=>{
 assert.equal(studentPrice(PRICES.individual,28),1296);
 assert.equal(studentPrice(PRICES.package,35),2632.5);
 assert.deepEqual(STUDENT_PRICES,{individual:1296,package:2632.5});
 assert.match(currencyLabel(2632.5,'cs').replaceAll('\u00a0',' '),/2 632,50/);
 assert.match(currencyLabel(2632.5,'en'),/2,632\.50/);
});
test('authored blog links resolve to the correct homepage and related article',()=>{
 const html=renderBlogMarkdown('[Rezervovat](#rezervace) [Firmy](#firmy)\n\nPíšu v článku o entry pointech do Švýcarska.',{home:'/consulting-page/',blogLink:slug=>'/consulting-page/blog/'+slug+'/'});
 assert.match(html,/href="\/consulting-page\/#rezervace"/);
 assert.match(html,/href="\/consulting-page\/#firmy"/);
 assert.match(html,/article-authored-cta/);
 assert.match(html,/href="\/consulting-page\/blog\/prace-ve-svycarsku-entry-point\/"/);
});
test('blog preserves editorial markers and comments without allowing scripts or unsafe links',()=>{
 const html=renderBlogMarkdown('[ověřit podmínky] [DOPLNIT]\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))',{home:'/',blogLink:slug=>'/blog/'+slug+'/'});
 assert.match(html,/\[ověřit podmínky\]/);assert.match(html,/\[DOPLNIT\]/);
 assert.equal((html.match(/TODO Adam: ověřit před publikací/g)||[]).length,2);
 assert.doesNotMatch(html,/<script>/);assert.doesNotMatch(html,/href="javascript:/);
});
test('all five authored posts have related links and honest Article metadata',async()=>{
 const metadata=JSON.parse(await readFile(new URL('../src/blog/metadata.json',import.meta.url),'utf8'));
 assert.equal(metadata.length,5);
 for(const post of metadata){
  const text=await readFile(new URL(`../src/blog/${post.slug}.md`,import.meta.url),'utf8');
  assert.doesNotMatch(text,/[—–]/);
  assert.equal(post.related.length,2);assert.ok(post.related.every(slug=>slug!==post.slug && metadata.some(p=>p.slug===slug)));
  const schema=articleStructuredData(post,blogUrl('cs',post.slug),'https://example.test/image.jpg');
  assert.equal(schema.author.name,'Adam Pruška');assert.equal('datePublished' in schema,false);
  assert.equal(blogPath('en',post.slug),'en/blog/'+post.slug+'/');
 }
});
