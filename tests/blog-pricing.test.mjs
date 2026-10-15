import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRICES,STUDENT_PRICES,currencyLabel,discountLabel,PACKAGE_COMPARISON_PRICE,PACKAGE_DISCOUNT,PACKAGE_SAVINGS} from '../src/pricing.mjs';
import {renderBlogMarkdown,articleStructuredData} from '../src/blog/render.mjs';
import {blogPath,blogUrl} from '../src/site-config.mjs';

test('fixed prices remain exact while discounts use the correct comparison price',()=>{
 assert.equal(PRICES.individual,1800);assert.equal(PRICES.package,4500);
 assert.deepEqual(STUDENT_PRICES,{individual:1500,package:3500});
 assert.equal(PACKAGE_COMPARISON_PRICE,5400);assert.equal(PACKAGE_SAVINGS,900);
 assert.ok(Math.abs(PRICES.studentIndividualDiscount-100/6)<1e-10);
 assert.ok(Math.abs(PACKAGE_DISCOUNT-100/6)<1e-10);
 assert.ok(Math.abs(PRICES.studentPackageDiscount-100*1000/4500)<1e-10);
 for(const lang of ['cs','sk','en']){
  assert.equal(discountLabel(PRICES.studentIndividualDiscount,lang),lang==='en'?'16.7':'16,7');
  assert.equal(discountLabel(PRICES.studentPackageDiscount,lang),lang==='en'?'22.2':'22,2');
 }
 assert.match(currencyLabel(1500,'cs').replaceAll('\u00a0',' '),/1 500/);
 assert.match(currencyLabel(3500,'en'),/3,500/);
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
test('all seven authored posts have related links and honest Article metadata',async()=>{
 const metadata=JSON.parse(await readFile(new URL('../src/blog/metadata.json',import.meta.url),'utf8'));
 assert.equal(metadata.length,7);
 for(const post of metadata){
  const text=await readFile(new URL(`../src/blog/${post.slug}.md`,import.meta.url),'utf8');
  assert.doesNotMatch(text,/[—–]/);
  assert.equal(post.related.length,2);assert.ok(post.related.every(slug=>slug!==post.slug && metadata.some(p=>p.slug===slug)));
  const schema=articleStructuredData(post,blogUrl('cs',post.slug),'https://example.test/image.jpg');
  assert.equal(schema.author.name,'Adam Pruška');assert.equal('datePublished' in schema,false);
  assert.equal(blogPath('en',post.slug),'en/blog/'+post.slug+'/');
  if(post.companion)assert.ok(metadata.some(item=>item.slug===post.companion && item.companion===post.slug));
 }
});
test('email examples are safe to copy and tables and checklists are accessible',()=>{
 const html=renderBlogMarkdown('```\nSubject: Example <email>\n```\n\n| Source | Detail |\n| --- | --- |\n| Name | Value |\n\n- [ ] Check this',{home:'/',blogLink:slug=>'/blog/'+slug+'/'});
 assert.match(html,/class="copy-email"/);assert.match(html,/&lt;email&gt;/);
 assert.match(html,/role="region".*tabindex="0"/);assert.match(html,/scope="col"/);
 assert.match(html,/<input[^>]*disabled[^>]*type="checkbox"/);
});
