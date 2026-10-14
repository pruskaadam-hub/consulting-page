import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { content } from './content';
import { calendlyUrl, calendlyEmbedUrl } from './booking.mjs';
import './styles.css';

const imagePath = (name: string) => `${import.meta.env.BASE_URL}images/${name}`;

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? 'M6 18 18 6M6 6h12v12' : 'M4 12h15m-6-6 6 6-6 6'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Booking() {
  const [consent, setConsent] = useState(false);
  const rawUrl = import.meta.env.VITE_CALENDLY_URL;
  const url = calendlyUrl(rawUrl);
  const embed = calendlyEmbedUrl(rawUrl, window.location.hostname);

  return <section className="booking section" id="rezervace" aria-labelledby="booking-title">
    <div className="booking-intro">
      <p className="eyebrow">Rezervace</p>
      <h2 id="booking-title">Najděme si čas<br />na rozhovor.</h2>
      <p>Vyberte si termín, který vám vyhovuje. Délku a podmínky konkrétní schůzky najdete v Calendly před potvrzením rezervace.</p>
      <div className="booking-note"><span className="small-mark" aria-hidden="true"><Arrow diagonal /></span><span>Jeden první krok.<br /><strong>Nový pohled na to, co je před vámi.</strong></span></div>
    </div>
    <div className="booking-panel">
      {url && embed ? <>
        {consent ? <iframe className="calendly-frame" src={embed} title="Rezervační kalendář konzultace v Calendly" /> : <div className="booking-placeholder">
          <CalendarMark />
          <h3>Vyberte si svůj termín</h3>
          <p>Kalendář poskytuje Calendly. Po jeho načtení se připojíte k této službě, která zpracovává údaje potřebné k rezervaci.</p>
          <button className="button primary" onClick={() => setConsent(true)}>Načíst kalendář <Arrow /></button>
          <a className="text-link" href={url} target="_blank" rel="noopener noreferrer">Otevřít přímo v Calendly <Arrow diagonal /></a>
        </div>}
        {consent && <a className="calendar-fallback text-link" href={url} target="_blank" rel="noopener noreferrer">Pokud se kalendář nenačítá, otevřete Calendly <Arrow diagonal /></a>}
      </> : <div className="booking-placeholder">
        <CalendarMark />
        <span className="draft-label">Pracovní návrh</span>
        <h3>Místo pro váš kalendář</h3>
        <p>Zde bude rezervační kalendář Calendly s vašimi skutečnými volnými termíny. Čekáme na rezervační odkaz.</p>
        <a className="text-link" href={content.sourceUrl} target="_blank" rel="noopener noreferrer">Přejít na současný web <Arrow diagonal /></a>
      </div>}
    </div>
  </section>;
}

function CalendarMark() {
  return <svg className="calendar-mark" width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="8" y="11" width="32" height="29" rx="5" stroke="currentColor" strokeWidth="1.5" /><path d="M8 20h32M16 7v8m16-8v8m-16 13h4m8 0h4m-16 6h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return <div className="site-shell">
    <a className="skip-link" href="#obsah">Přejít na obsah</a>
    {content.draft && <div className="draft-banner">První pracovní verze · texty a fotografie čekají na převzetí ze současného webu</div>}
    <header className="header wrap">
      <a className="brand" href="#" aria-label="Adam Pruška — úvod"><span className="brand-mark" aria-hidden="true">ap.</span>{content.brand}</a>
      <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="navigation" aria-label={menuOpen ? 'Zavřít menu' : 'Otevřít menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Zavřít' : 'Menu'}<span aria-hidden="true">{menuOpen ? '−' : '+'}</span></button>
      <nav id="navigation" className={menuOpen ? 'navigation open' : 'navigation'} aria-label="Hlavní navigace">
        <a href="#konzultace" onClick={closeMenu}>Konzultace</a>
        <a href="#o-mne" onClick={closeMenu}>O mně</a>
        <a className="nav-cta" href="#rezervace" onClick={closeMenu}>Domluvit konzultaci <Arrow diagonal /></a>
      </nav>
    </header>
    <main id="obsah">
      <section className="hero wrap" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" />{content.hero.eyebrow}</p>
          <h1 id="hero-title">Váš další krok<br />do <em>zahraničí.</em></h1>
          <p className="hero-description">{content.hero.description}</p>
          <a className="button primary" href="#rezervace">Domluvit konzultaci <Arrow diagonal /></a>
          <a className="hero-secondary" href="#konzultace">První konzultace zdarma <span aria-hidden="true">↓</span></a>
        </div>
        <div className="hero-art hero-photo">
          <img src={imagePath('consultation.jpg')} alt="Rozhovor u stolu — fotografie ze současného webu" fetchPriority="high" width="1600" height="1067" />
          <div className="art-label"><span>Všechno začíná</span><strong>jedním rozhovorem.</strong></div>
        </div>
      </section>
      <section className="intro section wrap" id="konzultace" aria-labelledby="intro-title">
        <div><p className="eyebrow">Mentoring pro cestu do zahraničí</p><h2 id="intro-title">Najděte směr.<br />A správná <em>spojení.</em></h2></div>
        <div className="intro-copy"><p>Pomáhám lidem najít směr, spojení a příležitosti — ať už míří do vědy, firemního světa nebo vlastního projektu.</p><p className="muted">Využijte mé zkušenosti z akademického prostředí, byznysu i neziskového sektoru. Získejte praktické rady, jak se prosadit ve Švýcarsku i dalších zemích.</p></div>
      </section>
      <section className="services section wrap" aria-labelledby="services-title">
        <p className="eyebrow">Konzultace online</p><h2 id="services-title">Začněme <em>rozhovorem.</em></h2>
        <div className="service-grid">{content.services.map(service => <article className="service-card" key={service.title}>
          <img src={imagePath(service.image)} alt="" width="960" height="640" loading="lazy" />
          <div className="service-body"><p className="eyebrow">{service.duration}</p><h3>{service.title}</h3><p>{service.description}</p><strong className="service-price">{service.price}</strong></div>
        </article>)}</div>
        <p className="service-note">Vyberte termín v Calendly. Dostupnost a podmínky konkrétní události se zobrazí před rezervací.</p>
        <a className="text-link" href="#rezervace">Přejít na rezervační kalendář <Arrow /></a>
      </section>
      <section className="about section wrap" id="o-mne" aria-labelledby="about-title">
        <div className="about-logo"><img src={imagePath('logo.jpg')} alt="Adam Pruška — Mentoring & Consulting" width="816" height="946" loading="lazy" /></div>
        <div className="about-copy"><p className="eyebrow">O mně</p><h2 id="about-title">Adam Pruška.<br /><em>Mentoring & Consulting.</em></h2><p>Pomáhám lidem hledat příležitosti v zahraničí. Propojuji zkušenosti z akademického prostředí, byznysu a neziskového sektoru s praktickými radami pro váš další krok.</p><a className="text-link" href={`tel:${content.phone.replaceAll(' ', '')}`}>Zavolejte mi: {content.phone} <Arrow diagonal /></a></div>
      </section>
      <div className="booking-wrap"><div className="wrap"><Booking /></div></div>
    </main>
    <footer className="footer wrap"><a className="brand" href="#"><span className="brand-mark" aria-hidden="true">ap.</span>{content.brand}</a><span>Mentoring & Consulting</span><a href="https://calendly.com/legal/privacy-notice" target="_blank" rel="noopener noreferrer">Ochrana údajů v Calendly <Arrow diagonal /></a></footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
