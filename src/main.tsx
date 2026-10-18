import { Cancellation } from './Cancellation';
import { lazy, Suspense, useEffect, useRef, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { DOCUMENT_PRICES, PACKAGE_COMPARISON_PRICE, discountLabel } from './pricing.mjs';
import { Calendar } from './Calendar';
import { content as shared, type ServiceId } from './content';
import { localizedContent, localizedServices, formatPrice } from './localized-content';
import { copies, topicLabel, type Language, type Topic } from './locales';
import { articles } from './articles.mjs';
import { blogPosts } from './blog-posts.mjs';
import { renderBlogMarkdown } from './blog/render.mjs';
import { media, mediaFormats } from './media';
import { assetUrl, internalUrl, blogInternalUrl, currentRoute } from './routes';
import { ContactLinks, ContactSection } from './Contact';
import { AnalyticsConsent, trackEvent } from './Analytics';
import './styles.css';

const route=currentRoute();
const Admin=lazy(()=>import('./admin/Admin'));
function Arrow({diagonal=false}:{diagonal?:boolean}) {
  return <svg className={`link-arrow${diagonal ? ' is-diagonal' : ''}`} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? 'M6 18 18 6M6 6h12v12' : 'M4 12h15m-6-6 6 6-6 6'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function TopicIcon({kind}:{kind:string}) {
  const paths:Record<string,string>={study:'M2 9l10-5 10 5-10 5-10-5zm4 2v6c4 3 8 3 12 0v-6M22 9v8',career:'M8 7V4h8v3M3 7h18v14H3V7zm0 6c6 3 12 3 18 0M10 14h4',business:'M14 4c3-2 6-2 6-2s0 3-2 6l-6 6-4-4 6-6zM8 10H4l-2 5 6-1m4 0-1 6 5-2v-4M6 18l-3 3'};
  return <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={paths[kind]} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function Brand({language}:{language:Language}) {
  return <a className="brand" href={internalUrl(language)} aria-label={copies[language].home}><span className="brand-mark" aria-hidden="true">ap.</span>{shared.brand}</a>;
}
function LanguageSwitch({language,slug='',busy=false,blog=false}:{language:Language;slug?:string;busy?:boolean;blog?:boolean}) {
  return <nav className="language-switch" aria-label={copies[language].language}>{(['cs','sk','en'] as Language[]).map(lang=><a key={lang} href={blog ? blogInternalUrl(lang,slug) : internalUrl(lang,slug)} hrefLang={lang} lang={lang} aria-current={lang===language ? 'page' : undefined} aria-disabled={busy || undefined} onClick={e=>{if(busy)e.preventDefault();}}>{lang.toUpperCase()}</a>)}</nav>;
}
function Footer({language}:{language:Language}) {
  return <footer className="footer wrap"><Brand language={language} /><ContactLinks language={language} compact /><div className="footer-social"><a href={shared.linkedIn} target="_blank" rel="noopener noreferrer">LinkedIn <Arrow diagonal /></a><a href="https://cal.com/privacy" target="_blank" rel="noopener noreferrer">{copies[language].privacy} <Arrow diagonal /></a></div></footer>;
}
function BlogCards({language,exclude='',limit}: {language:Language;exclude?:string;limit?:number}) {
  const c=copies[language];
  return <div className="blog-grid">{blogPosts.filter(post=>post.slug!==exclude).slice(0,limit).map(post=><article className="blog-card" key={post.slug}><a href={blogInternalUrl(language,post.slug)}><img src={assetUrl(post.image)} alt={post.alt} loading="lazy" width="960" height="640" /><div><p className="blog-date"><time dateTime={post.published}>{new Intl.DateTimeFormat(c.locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(post.published+'T12:00:00Z'))}</time></p><h3 lang="cs">{post.title}</h3><p lang="cs">{post.description}</p><span className="text-link">{c.read}<Arrow /></span></div></a></article>)}</div>;
}
function App({language}:{language:Language}) {
  const c=copies[language];
  const content=localizedContent(language);
  const services=localizedServices(language);
  const initialTopic=new URLSearchParams(location.search).get('tema');
  const [menuOpen,setMenuOpen]=useState(false);
  const [sticky,setSticky]=useState(false);
  const [selected,setSelected]=useState<ServiceId>('intro');
  const [intentTopic,setIntentTopic]=useState<Topic>(['study','career','project','other'].includes(initialTopic || '') ? initialTopic as Topic : '');
  const [bookingOpen,setBookingOpen]=useState(location.hash==='#kalendar');
  const [bookingStarted,setBookingStarted]=useState(location.hash==='#kalendar');
  const [bookingBusy,setBookingBusy]=useState(false);
  const [scrollRequest,setScrollRequest]=useState(0);
  const heroAction=useRef<HTMLAnchorElement>(null);
  const service=services.find(item=>item.id===selected)!;
  const choose=(id:ServiceId,topic?:Topic)=>(event:MouseEvent<HTMLAnchorElement>)=>{
    event.preventDefault();if(bookingBusy)return;
    trackEvent('consultation_click',{service:id,language,placement:event.currentTarget.closest('.hero-copy')?'hero':event.currentTarget.closest('.offer-card')?'offer':'cta'});
    setSelected(id);setMenuOpen(false);setBookingOpen(true);setBookingStarted(true);
    if(topic!==undefined)setIntentTopic(topic);
    history.replaceState(null,'',location.pathname+location.search+'#kalendar');
    setScrollRequest(value=>value+1);
  };
  useEffect(()=>{
    const observer=new IntersectionObserver(([entry])=>setSticky(!entry.isIntersecting && entry.boundingClientRect.top<0),{threshold:0});
    if(heroAction.current)observer.observe(heroAction.current);
    return ()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!bookingOpen)return;
    const id=requestAnimationFrame(()=>document.getElementById('kalendar')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'}));
    return ()=>cancelAnimationFrame(id);
  },[bookingOpen,scrollRequest]);

  return <div className="site-shell">
    <a className="skip-link" href="#obsah">{c.skip}</a>
    {sticky && <div className="sticky-header" role="region" aria-label={c.freeShort}><Brand language={language} /><p className="sticky-claim">{c.claimFirst} <strong>{c.claimLast}</strong></p><a className="button primary" href="#kalendar" onClick={choose('intro')} aria-disabled={bookingBusy || undefined}>{c.freeShort}<Arrow diagonal /></a></div>}
    <header className="header wrap">
      <Brand language={language} />
      <div className="header-actions"><LanguageSwitch language={language} busy={bookingBusy} /><button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="navigation" aria-label={menuOpen ? c.closeMenu : c.openMenu} onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen ? c.close : c.menu}<span aria-hidden="true">{menuOpen ? '−' : '+'}</span></button></div>
      <nav id="navigation" className={menuOpen ? 'navigation open' : 'navigation'} aria-label={c.menu}><a href="#pomoc" onClick={()=>setMenuOpen(false)}>{c.navHelp}</a><a href="#postup" onClick={()=>setMenuOpen(false)}>{c.navProcess}</a><a href="#o-mne" onClick={()=>setMenuOpen(false)}>{c.navAbout}</a><a href="#firmy" onClick={()=>setMenuOpen(false)}>{c.navBusiness}</a><a className="nav-cta" href="#kalendar" onClick={choose('intro')} aria-disabled={bookingBusy || undefined}>{c.freeShort}<Arrow diagonal /></a></nav>
    </header>
    <main id="obsah">
      <section className="hero wrap" aria-labelledby="hero-title"><div className="hero-copy"><h1 id="hero-title">{c.heroFirst}<br />{c.heroTo} <em>{c.heroCountry}</em></h1><p className="hero-description">{c.heroDescription}</p><a ref={heroAction} className="button primary" href="#kalendar" onClick={choose('intro')} aria-disabled={bookingBusy || undefined}>{c.freeCta}<Arrow diagonal /></a><p className="hero-reassurance">{c.reassurance}</p><a className="hero-secondary" href="#pomoc">{c.heroSecondary}<span aria-hidden="true">↓</span></a></div><div className="hero-art hero-photo"><img src={assetUrl('adam-noir.png')} alt={c.heroAlt} fetchPriority="high" width="1122" height="1402" /><div className="art-label"><span>{c.claimFirst}</span><strong>{c.claimLast}</strong></div></div><a className="hero-scroll" href="#pomoc" aria-label={c.continue}><span aria-hidden="true">↓</span></a></section>
      <section className="credential-strip" aria-label={c.credibility}>
        <div className="credential-card"><span className="swiss-mark" aria-hidden="true"><span /></span><strong className="credential-large">7</strong><p className="credential-caption">{c.years} {c.swiss}</p></div>
        <div className="credential-card"><span className="credential-symbol" aria-hidden="true"><TopicIcon kind="study" /></span><strong className="credential-large credential-eth">ETH</strong><p className="credential-caption">Zürich · {c.eth}</p></div>
        <div className="credential-card"><span className="credential-symbol" aria-hidden="true"><TopicIcon kind="business" /></span><strong>{c.research}<br />{c.business}</strong><p>{c.worlds}</p></div>
        <a className="credential-card credential-free" href="#kalendar" onClick={choose('intro')} aria-disabled={bookingBusy || undefined}><span className="credential-symbol"><Arrow diagonal /></span><strong>{c.firstMeeting}<br />{c.free}</strong><p>{c.thirty}<Arrow /></p></a>
      </section>
      <section id="pomoc" className="section wrap" aria-labelledby="help-title"><div className="section-heading"><h2 id="help-title">{c.helpFirst}<br /><em>{c.helpLast}</em></h2><p>{c.helpDescription}</p></div><div className="help-grid">{content.help.map((item,index)=><article className="help-card" key={item.icon}><div className="card-topline"><span className="topic-icon"><TopicIcon kind={item.icon} /></span></div><h3>{item.title}</h3><p>{item.text}</p><ul className="topic-tags">{item.tags.map(tag=><li key={tag}>{tag}</li>)}</ul><a className="text-link" href={index===2 ? '#firmy' : '#kalendar'} onClick={index===2 ? undefined : choose('intro',index===0 ? 'study' : 'career')} aria-disabled={index!==2 && bookingBusy || undefined}>{item.cta}<Arrow /></a></article>)}</div></section>
      <section id="o-mne" className="about section wrap" aria-labelledby="about-title"><div className="about-gallery"><img className="about-main-photo" src={assetUrl('adam-switzerland.jpeg')} alt={c.aboutAlt} width="900" height="1200" loading="lazy" /><div className="about-gallery-bottom"><img src={assetUrl('eth-study.jpg')} alt={c.studyAlt} width="600" height="450" loading="lazy" /><img src={assetUrl('adam-portrait.jpg')} alt={c.portraitAlt} width="600" height="450" loading="lazy" /></div></div><div className="about-copy"><h2 id="about-title">{c.aboutFirst}<br />{c.aboutSecond}<br />{c.aboutJoin} <em>{c.aboutLast}</em></h2>{c.aboutParagraphs.map(p=><p key={p}>{p}</p>)}<ul className="about-roles">{c.roles.map(role=><li key={role}>{role}</li>)}</ul><a className="button primary" href="#kalendar" onClick={choose('intro')} aria-disabled={bookingBusy || undefined}>{c.aboutCta}<Arrow diagonal /></a><a className="about-link text-link" href={content.linkedIn} target="_blank" rel="noopener noreferrer">{c.linkedIn}<Arrow diagonal /></a></div></section>
      <section className="testimonials section wrap" aria-labelledby="testimonials-title"><div className="section-heading"><h2 id="testimonials-title">{c.referencesFirst}<br /><em>{c.referencesLast}</em></h2><a className="text-link" href="#kalendar" onClick={choose('intro')} aria-disabled={bookingBusy || undefined}>{c.join}<Arrow /></a></div>{language!=='cs' && <p className="translation-note">{c.translation}</p>}<div className="testimonial-grid">{content.testimonials.map(item=><figure key={item.name}><strong className="testimonial-result">{item.result}</strong><span className="quote-mark" aria-hidden="true">“</span><blockquote>{item.quote}</blockquote><figcaption>{item.photo ? <img className="client-photo" src={item.photo} alt={item.name} loading="lazy" width="40" height="40" onError={e=>{e.currentTarget.hidden=true;const fallback=e.currentTarget.nextElementSibling as HTMLElement;fallback.hidden=false;}} /> : null}<span className="client-initials" aria-hidden="true" hidden={Boolean(item.photo)}>{item.initials}</span><div><strong>{item.name}</strong><span>{item.context}</span>{item.linkedIn && <a href={item.linkedIn} target="_blank" rel="noopener noreferrer">{c.testimonialLinkedIn} <Arrow diagonal /></a>}{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{c.testimonialSource} <Arrow diagonal /></a>}</div></figcaption></figure>)}</div></section>
      <section id="postup" className="process section wrap" aria-labelledby="process-title"><div className="section-heading"><h2 id="process-title">{c.processFirst} <em>{c.processLast}</em></h2><p>{c.processDescription}</p></div><div className="process-grid">{content.process.map((item,index)=><article key={index}><span className="process-number">{index+1}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div><a className="button primary" href="#kalendar" onClick={choose('intro')} aria-disabled={bookingBusy || undefined}>{c.processCta}<Arrow diagonal /></a></section>
      <section id="firmy" className="company-section section" aria-labelledby="company-title"><div className="wrap company-content"><div><h2 id="company-title">{c.companyTitle}</h2><p>{c.companyText}</p></div><div><p className="company-price">{c.companyPrice}</p><button className="button primary" type="button" onClick={()=>{location.href=`mailto:${content.email}?subject=${encodeURIComponent(c.companySubject)}`;}}>{c.companyCta}<Arrow diagonal /></button></div></div></section>
      <section id="rezervace" className="reservation-section section" aria-labelledby="reservation-title"><div className="wrap"><div className="section-heading"><h2 id="reservation-title">{c.reservationFirst}<br /><em>{c.reservationLast}</em></h2><p>{c.reservationDescription}</p></div><div className="offers-grid" role="group" aria-label={c.consultationTypes}>{services.map(item=><a className={`offer-card ${selected===item.id ? 'active' : ''}`} key={item.id} href="#kalendar" onClick={choose(item.id)} aria-label={`${c.choose}: ${item.title}`} aria-current={selected===item.id ? 'true' : undefined} aria-disabled={bookingBusy || undefined}><span className="offer-badge">{item.label}</span><h3>{item.title}</h3><p className="offer-description">{item.description}</p><div className="offer-price">{item.id==='package' && <s>{formatPrice(PACKAGE_COMPARISON_PRICE,language)}</s>}<strong>{formatPrice(item.price,language)}</strong><span>{item.id==='package' ? c.packagePrice : c.forMinutes.replace('{minutes}',String(item.minutes))}</span>{item.price>0 && <span className="price-vat">{c.vatIncluded}</span>}{item.studentPrice!==undefined && <p className="student-price"><span>{c.studentIndividual}</span><strong>{formatPrice(item.studentPrice,language)}</strong><span className="student-discount">{c.studentDiscount.replace('{percent}',discountLabel(item.studentDiscount ?? 0,language))}</span></p>}</div><ul>{item.features.map(feature=><li key={feature}>{feature}</li>)}</ul><span className={selected===item.id ? 'button primary' : 'button offer-button'}>{bookingOpen && selected===item.id ? c.selected : item.id==='intro' ? c.startFree : c.choose}<Arrow /></span></a>)}</div><p className="student-note">{c.inPerson}</p><aside className="additional-services" aria-labelledby="additional-title"><div><h3 id="additional-title">{c.extraServices}</h3><h4>{c.documents}</h4><p>{c.extraServicesText}</p></div><div><dl className="document-prices"><div><dt>{c.documentReview}</dt><dd>{formatPrice(DOCUMENT_PRICES.review,language)}</dd></div><div><dt>{c.documentFinal}</dt><dd>{formatPrice(DOCUMENT_PRICES.final,language)}</dd></div></dl><p className="document-vat">{c.vatIncluded}</p><button className="text-link" type="button" onClick={()=>{location.href=`mailto:${content.email}?subject=${encodeURIComponent(c.extraSubject)}`;}}>{c.extraCta}<Arrow diagonal /></button></div></aside><p className="payment-note">{c.paymentDescription}</p>
        <div className="booking-disclosure"><button className="text-link calendar-toggle" type="button" aria-expanded={bookingOpen} aria-controls="booking-panel" disabled={bookingBusy} onClick={()=>{if(bookingOpen){setBookingOpen(false);history.replaceState(null,'',location.pathname+location.search+'#rezervace');}else{setBookingOpen(true);setBookingStarted(true);setScrollRequest(v=>v+1);}}}>{bookingOpen ? c.collapse : c.expand}<span aria-hidden="true">{bookingOpen ? '−' : '+'}</span></button></div>
        <div id="booking-panel" hidden={!bookingOpen}><div id="kalendar" className="calendar-layout">{bookingStarted && <><div className="calendar-intro"><h3>{c.calendarFirst}<br /><em>{c.calendarLast}</em></h3><p>{c.calendarIntro}</p>{intentTopic && <p className="intent-label" aria-live="polite"><strong>{c.topicPrefix}</strong> {topicLabel(c,intentTopic)}</p>}{service.id==='package' && <p>{c.packageIntro}</p>}<button className="text-link" type="button" onClick={()=>{location.href=`mailto:${content.email}`;}}>{c.emailQuestion}<Arrow diagonal /></button></div><Calendar key={service.id} service={service} language={language} intentTopic={intentTopic} onTopicChange={setIntentTopic} onSubmittingChange={setBookingBusy} /></>}</div></div>
      </div></section>
      <section id="blog" className="blog section wrap" aria-labelledby="blog-title"><div className="section-heading"><h2 id="blog-title">{c.blogFirst}<br />{c.blogTo} <em>{c.blogLast}</em></h2><a className="text-link" href={blogInternalUrl(language)}>{c.allArticles}<Arrow /></a></div><BlogCards language={language} /></section>
      <section className="faq section wrap" aria-labelledby="faq-title"><h2 id="faq-title">{c.faqFirst}<br />{c.faqSecond} <em>{c.faqLast}</em></h2><div className="faq-list">{content.faq.map((item,index)=><details key={index}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>
      <section className="final-cta wrap"><div><h2>{c.finalFirst}<br />{c.finalTo} <em>{c.finalLast}</em></h2><p>{c.finalDescription}</p></div><a className="button primary" href="#kalendar" onClick={choose('intro')} aria-disabled={bookingBusy || undefined}>{c.freeCta}<Arrow diagonal /></a></section>
      <ContactSection language={language} />
      <section id="media" className="media section wrap" aria-labelledby="media-title"><div className="section-heading"><h2 id="media-title">{c.mediaFirst}<br /><em>{c.mediaLast}</em></h2><p>{c.mediaDescription}</p></div><div className="media-grid media-compact">{media.map(item=><a href={item.url} target="_blank" rel="noopener noreferrer" key={item.url}><span className="media-format">{mediaFormats[language][item.format as keyof typeof mediaFormats.cs]}</span><div className="media-copy"><span className="media-outlet">{item.outlet}</span><h3>{item.title}</h3></div><span className="media-arrow"><Arrow diagonal /></span></a>)}</div></section>
    </main><Footer language={language} />
  </div>;
}
function ArticlePage({language,slug}:{language:Language;slug:string}) {
  const c=copies[language];
  const article=articles.find(post=>post.slug===slug);
  if(!article)return <App language={language} />;
  const text=article.translations[language];
  return <div className="site-shell article-page"><a className="skip-link" href="#obsah">{c.skip}</a><header className="header wrap"><Brand language={language} /><LanguageSwitch language={language} slug={slug} /><a className="button primary article-header-cta" href={internalUrl(language)+'?tema='+(article.slug==='doktorat-ve-svycarsku' ? 'study' : 'career')+'#kalendar'}>{c.freeShort}<Arrow diagonal /></a></header><main id="obsah"><article className="article-detail"><header className="article-intro wrap"><a className="text-link" href={internalUrl(language)+'#blog'}>← {c.back}</a><p className="article-byline">Adam Pruška · <time dateTime={article.published}>{new Intl.DateTimeFormat(c.locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(article.published+'T12:00:00Z'))}</time></p><h1>{text.title}</h1><p className="article-lead">{text.description}</p></header><figure className="article-image wrap"><img src={assetUrl(article.image)} alt={text.alt} width="960" height="640" fetchPriority="high" /></figure><div className="article-prose">{text.sections.map((section,index)=><section key={index}>{'heading' in section && <h2>{section.heading}</h2>}{section.paragraphs.map(p=><p key={p}>{p}</p>)}{'bullets' in section && <ul>{section.bullets?.map(p=><li key={p}>{p}</li>)}</ul>}</section>)}<p className="article-source">{c.adapted} <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer">{c.source} <Arrow diagonal /></a></p></div></article><section className="final-cta wrap"><div><h2>{c.articleCta}</h2><p>{c.articleDescription}</p></div><a className="button primary" href={internalUrl(language)+'?tema='+(article.slug==='doktorat-ve-svycarsku' ? 'study' : 'career')+'#kalendar'}>{c.freeCta}<Arrow diagonal /></a></section><section className="section wrap" aria-labelledby="related-title"><h2 id="related-title">{c.related}</h2><BlogCards language={language} exclude={slug} /></section><ContactSection language={language} /></main><Footer language={language} /></div>;
}
function NewBlogPage({language,slug}:{language:Language;slug:string}) {
  const c=copies[language];
  const [copyStatus,setCopyStatus]=useState('');
  const copyEmail=async(event:MouseEvent<HTMLDivElement>)=>{
    const button=(event.target as HTMLElement).closest('.copy-email');
    if(!button)return;
    const email=button.closest('.article-code')?.querySelector('code')?.textContent;
    if(!email)return;
    try{await navigator.clipboard.writeText(email);setCopyStatus('Vzorový e-mail byl zkopírován.');}
    catch{setCopyStatus('Kopírování se nepodařilo. Text můžeš označit a zkopírovat ručně.');}
  };
  const post=blogPosts.find(item=>item.slug===slug);
  const html=post ? renderBlogMarkdown(post.markdown,{home:internalUrl(language),blogLink:(slug:string)=>blogInternalUrl(language,slug)}) : '';
  const related=post ? blogPosts.filter(item=>post.related.includes(item.slug)) : [];
  return <div className="site-shell article-page"><a className="skip-link" href="#obsah">{c.skip}</a><header className="header wrap"><Brand language={language} /><LanguageSwitch language={language} slug={slug} blog /><a className="button primary article-header-cta" href={internalUrl(language)+'#rezervace'}>{c.freeShort}<Arrow diagonal /></a></header><main id="obsah">
    {post ? <><article className="article-detail" lang="cs"><header className="article-intro wrap"><a className="text-link" href={blogInternalUrl(language)}>{c.allArticles}</a><p className="article-byline">Adam Pruška · <time dateTime={post.published}>{new Intl.DateTimeFormat(c.locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(post.published+'T12:00:00Z'))}</time></p><h1>{post.title}</h1></header><figure className="article-image wrap"><img src={assetUrl(post.image)} alt={post.alt} width="960" height="640" fetchPriority="high" /></figure><div className="article-prose authored-prose"><div onClick={copyEmail} dangerouslySetInnerHTML={{__html:html}} /><p className="copy-status" role="status">{copyStatus}</p>{'companion' in post && <aside className="article-companion"><a href={blogInternalUrl(language,post.companion)}>{post.companionLabel}<Arrow diagonal /></a></aside>}</div></article><section className="section wrap" aria-labelledby="related-title"><h2 id="related-title">{c.related}</h2><div className="related-articles">{related.map(item=><a href={blogInternalUrl(language,item.slug)} key={item.slug}><h3 lang="cs">{item.title}</h3><Arrow /></a>)}</div></section></> : <section className="blog-index section wrap" aria-labelledby="blog-index-title"><div className="section-heading"><h1 id="blog-index-title">Blog</h1><a className="text-link" href={internalUrl(language)}>{c.back}<Arrow /></a></div><BlogCards language={language} /></section>}
    <ContactSection language={language} /></main><Footer language={language} /></div>;
}
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).has('sprava-rezervace') ? <Cancellation language={route.language} /> : route.admin ? <Suspense fallback={<p role="status">Načítám administraci…</p>}><Admin /></Suspense> : <>{route.blog ? <NewBlogPage {...route} /> : route.slug ? <ArticlePage {...route} /> : <App language={route.language} />}<AnalyticsConsent language={route.language} /></>);
