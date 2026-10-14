import { useState } from 'react';
import { content } from './content';
import type { Language } from './locales';

const labels = {
  cs:{title:'Zůstaňme v kontaktu.',text:'Nechceš zatím rezervovat? Napiš mi nebo se propojme na LinkedIn.',linkedin:'Propojme se na LinkedIn',email:'Zobrazit e-mail',phone:'Zobrazit telefon',at:'zavináč',dot:'tečka'},
  sk:{title:'Zostaňme v kontakte.',text:'Zatiaľ nechceš rezervovať? Napíš mi alebo sa prepojme na LinkedIn.',linkedin:'Prepojme sa na LinkedIn',email:'Zobraziť e-mail',phone:'Zobraziť telefón',at:'zavináč',dot:'bodka'},
  en:{title:'Let’s stay in touch.',text:'Not ready to book? Email me or connect with me on LinkedIn.',linkedin:'Connect with me on LinkedIn',email:'Reveal email',phone:'Reveal phone',at:'at',dot:'dot'},
};
export function ContactLinks({language,compact=false}:{language:Language;compact?:boolean}) {
  const t=labels[language];
  const [showEmail,setShowEmail]=useState(false);
  const [showPhone,setShowPhone]=useState(false);
  const [local,domain]=content.email.split('@');
  const readableEmail=`${local} [${t.at}] ${domain.replaceAll('.',` [${t.dot}] `)}`;
  return <div className={compact ? 'contact-links compact' : 'contact-links'}>
    <div>{showEmail ? <a href={`mailto:${content.email}`}>{content.email}</a> : <button type="button" aria-label={t.email} onClick={()=>setShowEmail(true)}>{readableEmail}<span aria-hidden="true">↗</span></button>}</div>
    <div>{showPhone ? <a href={`tel:${content.phone.replaceAll(' ','')}`}>{content.phone}</a> : <button type="button" aria-label={t.phone} onClick={()=>setShowPhone(true)}>{content.phone.split(' ').join(' · ')}<span aria-hidden="true">↗</span></button>}</div>
  </div>;
}
export function ContactSection({language}:{language:Language}) {
  const t=labels[language];
  return <section id="kontakt" className="contact-section section wrap" aria-labelledby="contact-title"><div><h2 id="contact-title">{t.title}</h2><p>{t.text}</p><a className="button primary" href={content.linkedIn} target="_blank" rel="noopener noreferrer">{t.linkedin} <span aria-hidden="true">↗</span></a></div><ContactLinks language={language} /></section>;
}
