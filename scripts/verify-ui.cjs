// All Cal.com responses are fixtures. This script never creates real bookings.
const {chromium}=require('playwright');
const {HtmlValidate}=require('html-validate');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');

(async()=>{
 const {SITE_URL}=await import('../src/site-config.mjs');
 const productionPath=new URL(SITE_URL).pathname;
 const root=path.resolve('dist');
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');
   if(!url.pathname.startsWith(productionPath)){res.writeHead(404);res.end();return;}
   let relative=decodeURIComponent(url.pathname.slice(productionPath.length));
   if(!relative || relative.endsWith('/'))relative+='index.html';
   const file=path.resolve(root,relative);
   if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
   const data=await fs.readFile(file);
   const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.xml':'application/xml'}[path.extname(file)] || 'application/octet-stream';
   res.writeHead(200,{'Content-Type':type});res.end(data);
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}${productionPath}`;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.CHROMIUM_EXECUTABLE_PATH} : {})});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.context().grantPermissions(['clipboard-read','clipboard-write']);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 let reads=0,posts=0,mode='accepted',lastPayload;
 const {bookingPayload}=await import('../src/cal-client.mjs');
 await page.route('https://*.supabase.co/functions/v1/admin-api/cal/**',async route=>{
  const request=route.request(),url=new URL(request.url());
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'cal-api-version,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
  assert.equal(request.headers()['authorization'],undefined);
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(url.pathname.endsWith('/cal/slots')){
   reads++;
   const start=new Date(url.searchParams.get('start'));start.setUTCDate(start.getUTCDate()+1);
   const year=start.getUTCFullYear(),month=start.getUTCMonth(),today=new Date();
   const last=new Date(Date.UTC(year,month+1,0)).getUTCDate();
   const day=year===today.getUTCFullYear()&&month===today.getUTCMonth()?Math.min(today.getUTCDate()+2,last):8;
   const duration=url.searchParams.get('eventTypeSlug')==='nezavazna-konzultace'?30:50;
   const times=[14,15].map(hour=>new Date(Date.UTC(year,month,day,hour))).filter(date=>date>Date.now());
   return route.fulfill({headers,contentType:'application/json',body:JSON.stringify({status:'success',data:{fixture:times.map(date=>({start:date.toISOString(),end:new Date(+date+duration*60000).toISOString()}))}})});
  }
  if(request.method()==='POST' && url.pathname.endsWith('/cal/bookings')){
   posts++;lastPayload=bookingPayload(request.postDataJSON());
   await new Promise(resolve=>setTimeout(resolve,150));
   if(mode==='conflict')return route.fulfill({status:409,headers,contentType:'application/json',body:'{"status":"error"}'});
   if(mode==='uncertain')return route.abort('failed');
   return route.fulfill({headers,contentType:'application/json',body:JSON.stringify({status:'success',data:{uid:'fixture-only',start:lastPayload.start,status:mode}})});
  }
  throw new Error('Unexpected API call: '+url.pathname);
 });
 const validator=new HtmlValidate(require('../.htmlvalidate.json'));
 async function validate(label){
  const html=await page.content();
  const report=await validator.validateString(html);
  if(!report.valid){
   console.error('HTML errors:',label,JSON.stringify(report.results.map(result=>result.messages),null,2));
   throw new Error('Invalid HTML: '+label);
  }
 }
 async function go(relative=''){
  await page.goto(base+relative,{waitUntil:'networkidle'});
  // The full consent contract is exercised in verify-admin; these page checks
  // continue with measurement declined and never send production telemetry.
  if(await page.locator('.analytics-consent').count())
   await page.locator('.analytics-consent button').first().click();
 }
 async function selectTime(){
  await page.waitForFunction(()=>!document.querySelector('.native-calendar[aria-busy="true"]'));
  if(await page.locator('.calendar-days button:not([disabled])').count()===0){await page.locator('.calendar-controls button').last().click();await page.waitForFunction(()=>!document.querySelector('.native-calendar[aria-busy="true"]'));}
  await page.locator('.calendar-days button:not([disabled])').first().click();
  await page.locator('.slot-picker button').first().click();
 }
 async function intake(language='cs'){
  await page.locator('input[name="name"]').fill('Test visitor');
  await page.locator('input[name="email"]').fill('test@example.invalid');
  if(await page.locator('textarea[name="situation"]').count()){
   if(await page.locator('select[name="consultationTopic"]').inputValue()==='')await page.locator('select[name="consultationTopic"]').selectOption('other');
   await page.locator('textarea[name="situation"]').fill('Preparing an application and deciding on the next steps.');
   await page.locator('select[name="horizon"]').selectOption('soon');
  }
 }
 const metadata=JSON.parse(await fs.readFile('src/blog/metadata.json','utf8'));
 const slugs=['','clanky/kulturni-rozdily-ve-svycarsku/','clanky/doktorat-ve-svycarsku/','blog/',...metadata.map(post=>'blog/'+post.slug+'/')];
 for(const language of ['cs','sk','en']){
  const prefix=language==='cs'?'':language+'/';
  for(const slug of slugs){
   await go(prefix+slug);
   assert.equal(await page.locator('html').getAttribute('lang'),language);
   assert.equal(await page.locator('h1').count(),1);
   assert.equal(await page.locator('link[rel="canonical"]').count(),1);
   assert.equal(await page.locator('meta[property="og:url"]').count(),1);
   assert.equal(await page.locator('link[hreflang]').count(),4);
   assert.equal(await page.locator('.language-switch a').count(),3);
   const canonical=await page.locator('link[rel="canonical"]').getAttribute('href');
   assert.equal(new URL(canonical).origin,new URL(SITE_URL).origin);
   assert.equal(new URL(canonical).pathname,productionPath+prefix+slug);
   for(const img of await page.locator('img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());assert.ok((await img.getAttribute('alt'))?.trim());}
   for(const width of [375,1280]){
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${language}/${slug} at ${width}`);
    if(!slug)for(const heading of await page.locator('.section-heading:has(> p)').all()){
     const title=await heading.locator('h2').boundingBox(),intro=await heading.locator(':scope > p').boundingBox();
     assert.ok(intro.y>=title.y+title.height,`section introduction below heading at ${width}`);
    }
   }
   if(!slug){
    assert.equal(await page.locator('.help-card').count(),3);
    assert.equal(await page.locator('.expectations').count(),0);
    assert.equal(await page.locator('.card-number').count(),0);
    assert.equal(await page.locator('.blog-card').count(),metadata.length);
    assert.equal(await page.locator('.credential-large').first().innerText(),'7');
    assert.equal(await page.locator('.credential-eth').innerText(),'ETH');
    assert.equal(await page.locator('.additional-services').isVisible(),true);
    assert.equal(await page.locator('.media-grid > a').count(),8);
    assert.equal(await page.locator('.native-calendar').count(),0);
    assert.equal(await page.locator('a[href^="mailto:"],a[href^="tel:"]').count(),0);
    assert.equal(await page.locator('body').innerText().then(text=>text.includes('adam@adampruska.cz')),false);
    assert.equal(await page.locator('#blog').evaluate(el=>el.compareDocumentPosition(document.querySelector('.faq'))&Node.DOCUMENT_POSITION_FOLLOWING ? true : false),true);
    const comments=await page.evaluate(()=>{const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_COMMENT);let node,count=0;while(node=walker.nextNode())if(node.textContent.includes('TODO Adam:'))count++;return count;});
    assert.equal(comments,0,'publication dates no longer contain editorial placeholders');
    for(const summary of await page.locator('.faq-list summary').all()){await summary.click();assert.equal(await summary.evaluate(el=>el.parentElement.open),true);assert.ok(await summary.evaluate(el=>el.parentElement.querySelector('p').textContent.trim()));}
   }
   if(slug.startsWith('blog/') && slug!=='blog/'){
    const post=metadata.find(item=>slug==='blog/'+item.slug+'/');
    assert.equal(await page.title(),post.title+' | Adam Pruška');
    assert.equal(await page.locator('meta[name="description"]').getAttribute('content'),post.description);
    const structured=JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    assert.equal(structured['@type'],'Article');assert.equal(structured.author.name,'Adam Pruška');
    assert.equal(structured.datePublished,post.published);
    assert.equal(await page.locator('.related-articles > a').count(),2);
    assert.equal(await page.locator('.authored-prose .article-authored-cta').count(),1);
    assert.equal(await page.locator('.authored-prose .article-authored-cta').getAttribute('href'),productionPath+prefix+(['ceska-firma-ve-svycarsku','firma-kontakty-pres-komunitu'].includes(post.slug)?'#firmy':'#rezervace'));
    assert.equal((await page.locator('.authored-prose').innerText()).includes('Meta popis:'),false);
    if(post.companion){
     assert.equal(await page.locator('.article-companion a').getAttribute('href'),productionPath+prefix+'blog/'+post.companion+'/');
    }
    if(post.slug==='email-profesorovi-eth'){
     await page.getByRole('button',{name:'Kopírovat',exact:true}).click();
     await page.getByRole('status').filter({hasText:'byl zkopírován'}).waitFor();
     assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),await page.locator('.article-code code').textContent());
    }
    if(post.slug==='ceska-firma-ve-svycarsku')assert.equal(await page.locator('.authored-prose input[type="checkbox"][disabled]').count(),7);
    if(post.slug==='svycarske-cv')assert.equal(await page.locator('.authored-prose a[href$="/blog/prace-ve-svycarsku-entry-point/"]').count(),1);
    for(const anchor of await page.locator('.related-articles > a').all()){
      const target=await anchor.getAttribute('href');const response=await page.request.get(new URL(target,base).href);assert.equal(response.status(),200);
    }
   }
   assert.doesNotMatch(await page.locator('body').innerText(),/[—–]/,'no long dashes in website text');
   await validate(language+'/'+slug);
  }
 }
 assert.equal(reads,0,'Cal.com is not loaded before booking interaction');
 await go();
 await page.locator('.help-card').first().getByRole('link').click();
 assert.equal(await page.locator('.calendar-toggle').getAttribute('aria-expanded'),'true');
 assert.match(await page.locator('.intent-label').innerText(),/Studium/);
 await selectTime();
 assert.equal(await page.locator('select[name="consultationTopic"]').inputValue(),'study');
 assert.equal(await page.locator('input[name="financing"]').count(),1);
 assert.equal(await page.locator('.booking-form').evaluate(form=>form.checkValidity()),false);
 assert.equal(posts,0);
 await intake();await page.locator('input[name="financing"]').fill('Scholarship');
 await validate('open qualified calendar');
 await page.locator('.calendar-toggle').click();
 assert.equal(await page.locator('#booking-panel').isVisible(),false);
 await page.locator('.calendar-toggle').click();
 assert.equal(await page.locator('textarea[name="situation"]').inputValue(),'Preparing an application and deciding on the next steps.');
 await page.locator('.booking-form button[type="submit"]').evaluate(button=>{button.click();button.click();});
 await page.getByRole('heading',{name:'Máme domluveno.'}).waitFor();
 assert.equal(posts,1);assert.equal(lastPayload.metadata.topic,'study');
 assert.match(lastPayload.bookingFieldsResponses.notes,/Financování: Scholarship/);
 assert.equal(lastPayload.attendee.language,'cs');
 await go();await page.locator('.help-card').nth(1).getByRole('link').click();await selectTime();
 assert.equal(await page.locator('select[name="consultationTopic"]').inputValue(),'career');
 assert.equal(await page.locator('input[name="financing"]').count(),0);
 await go();await page.locator('.help-card').nth(2).getByRole('link').click();
 assert.equal(new URL(page.url()).hash,'#firmy');assert.equal(await page.locator('.native-calendar').count(),0);
 await page.getByRole('button',{name:'Zobrazit e-mail',exact:true}).first().click();
 assert.ok(await page.getByRole('link',{name:'adam[at]adampruska.cz',exact:true}).first().isVisible());
 await page.getByRole('button',{name:'Zobrazit telefon',exact:true}).first().click();
 assert.ok(await page.getByRole('link',{name:'+420 735 891 769',exact:true}).first().isVisible());
 for(const relative of ['','sk/','en/']){
  await go(relative);
  const selectors=['.hero-copy .button','.header .nav-cta','.credential-free','.help-card:nth-child(1) .text-link','.help-card:nth-child(2) .text-link','.about-copy .button','.testimonials .section-heading .text-link','.process > .button','.offer-card:nth-child(1) .button','.offer-card:nth-child(2) .button','.offer-card:nth-child(3) .button','.final-cta > .button'];
  for(const selector of selectors){
   const link=page.locator(selector);
   const offer=await link.evaluate(el=>el.closest('.offer-card')?.querySelector('h3').textContent || null);
   await link.click();
   assert.equal(await page.locator('#booking-panel').isVisible(),true);
   if(offer)assert.equal(await page.locator('.calendar-heading h3').innerText(),offer);
   else assert.equal(await page.locator('.calendar-heading h3').innerText(),relative==='en/'?'Introductory consultation':relative==='sk/'?'Nezáväzná konzultácia':'Nezávazná konzultace');
  }
 }
 await go();
 for(const index of [1,2,0]){
  const card=page.locator('a.offer-card').nth(index);
  const title=await card.locator('h3').innerText();
  await card.locator('h3').click();assert.equal(await page.locator('.calendar-heading h3').innerText(),title);
  await card.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.calendar-heading h3').innerText(),title);
 }
 const studentIndividual=await page.locator('.offer-card').nth(1).locator('.student-price').innerText();
 const studentPackage=await page.locator('.offer-card').nth(2).locator('.student-price').innerText();
 assert.match(studentIndividual.replaceAll('\u00a0',' '),/1 500/);assert.match(studentIndividual,/16,7/);
 assert.match(studentPackage.replaceAll('\u00a0',' '),/3 500/);assert.match(studentPackage,/22,2/);
 await page.locator('.offer-card').last().click();await selectTime();await intake();
 await page.locator('.booking-form button[type="submit"]').click();await page.getByRole('heading',{name:'Máme domluveno.'}).waitFor();
 assert.equal(lastPayload.metadata.service,'package');assert.match(lastPayload.bookingFieldsResponses.notes,/4\s500\sKč/);
 for(const [responseMode,selector] of [['pending','Ozvu se s potvrzením.'],['conflict','Tento termín už není volný'],['uncertain','Zkontroluj prosím e-mail']]){
  mode=responseMode;await go();await page.locator('.hero-copy .button').click();await selectTime();await intake();
  await page.locator('.booking-form button[type="submit"]').click();
  if(responseMode==='pending')await page.getByRole('heading',{name:selector}).waitFor();
  else await page.getByRole('alert').filter({hasText:selector}).waitFor();
  assert.equal(await page.getByText('Rezervace potvrzena',{exact:true}).count(),0);
  if(responseMode==='uncertain')assert.equal(await page.locator('.booking-form button[type="submit"]').isDisabled(),true);
 }
 mode='accepted';
 await go('en/clanky/doktorat-ve-svycarsku/');
 await page.locator('.language-switch a').filter({hasText:'SK'}).click();
 assert.match(page.url(),/sk\/clanky\/doktorat-ve-svycarsku/);
 await page.locator('.article-header-cta').click();
 assert.match(page.url(),/sk\/\?tema=study#kalendar/);await selectTime();await intake('sk');
 assert.equal(await page.locator('select[name="consultationTopic"]').inputValue(),'study');
 await page.locator('.booking-form button[type="submit"]').click();await page.getByRole('heading',{name:'Máme dohodnuté.'}).waitFor();
 assert.equal(lastPayload.attendee.language,'sk');
 await go('en/');await page.locator('.hero-copy .button').click();await selectTime();await intake('en');
 await page.locator('.booking-form button[type="submit"]').click();await page.getByRole('heading',{name:'We’re booked.'}).waitFor();
 assert.equal(lastPayload.attendee.language,'en');
 await go();await page.setViewportSize({width:375,height:812});
 await page.getByRole('button',{name:'Otevřít menu'}).click();await page.locator('#navigation a[href="#firmy"]').click();
 assert.equal(new URL(page.url()).hash,'#firmy');assert.equal(await page.getByRole('button',{name:'Otevřít menu'}).getAttribute('aria-expanded'),'false');
 await page.locator('.sticky-header').waitFor();const sticky=await page.locator('.sticky-header').boundingBox();assert.ok(sticky.x>=0 && sticky.x+sticky.width<=375);
 await page.setViewportSize({width:1280,height:900});await go();
 await page.locator('.help-card').first().hover();await page.waitForTimeout(300);assert.notEqual(await page.locator('.help-card').first().evaluate(el=>getComputedStyle(el).transform),'none');
 await page.locator('.about-link').hover();await page.waitForTimeout(250);
 const arrowRotation=await page.locator('.about-link svg').evaluate(el=>{const matrix=new DOMMatrix(getComputedStyle(el).transform);return Math.atan2(matrix.b,matrix.a)*180/Math.PI;});
 assert.ok(Math.abs(arrowRotation-45)<1,'diagonal link arrow points horizontally on hover');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.help-card').first().evaluate(el=>getComputedStyle(el).transform),'none');
 if(process.env.SCREENSHOT_DIR){
  await fs.mkdir(process.env.SCREENSHOT_DIR,{recursive:true});
  await go();await page.locator('.hero img').evaluate(el=>el.decode());await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'noir-hero.png')});
  for(const img of await page.locator('img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());}
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo(0,0);});await page.waitForFunction(()=>scrollY===0);
  await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'updated-page.png'),fullPage:true});
  await page.setViewportSize({width:375,height:812});await go();await page.locator('.hero img').evaluate(el=>el.decode());await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'noir-mobile.png')});
 }
 assert.deepEqual(errors,[]);
 await browser.close();await new Promise(resolve=>server.close(resolve));
 console.log('PASS: 33 static pages, full-card and keyboard selection, exact student prices, seven blog posts and JSON-LD, CZ/SK/EN metadata, 375/1280px, HTML validation, collapsed calendar, preserved topic and required intake, all consultation CTAs, safe booking states, contact reveal, 8 media links, article/language navigation, menu and reduced motion. All calendar responses mocked; no real booking created.');
})().catch(error=>{console.error(error);process.exit(1)});
