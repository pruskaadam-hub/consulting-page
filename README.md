# Adam Pruška — Mentoring & Consulting

Česká responzivní landing page: React, TypeScript, Vite a vlastní rezervační
rozhraní pro Cal.com přes Supabase. Obsahuje češtinu, slovenštinu, angličtinu
a původní článkové podstránky v každém jazyce. Přehled `/blog/` přidává sedm
dodaných českých článků s vlastním HTML vstupem, JSON-LD a souvisejícími odkazy. Aktuální předání, seznam
značek k doplnění a návody pro Cal.com/doménu jsou v
[docs/owner-handoff.md](docs/owner-handoff.md). Původní struktura je popsaná v
[docs/conversion-structure.md](docs/conversion-structure.md).

## Spuštění

Node.js >=22.12 (ověřeno s Node.js 24).

```sh
cd /workspace/consulting-page
npm ci --cache /workspace/.cache/npm
npm run dev -- --port 5173
```

`npm run build` provede kontrolu typů a produkční sestavení do `dist/`.
Produkční adresa je `https://adampruska.cz/`. Relativní cesty podporují také
projektový podadresář; pro test původní adresy nastavte `VITE_SITE_URL`.
Připojení domény a DNS u FORPSI: [docs/domain-forpsi.md](docs/domain-forpsi.md).
`npm test` spustí testy časových pásem, dostupnosti, kvalifikace a potvrzování rezervací.
`npm run test:ui` po `npm run build` provede HTML validaci a prohlížečové testy
všech 33 stránek na 375/1280 px s výhradně testovacími odpověďmi Cal.com.
Prohlížeč: `npx playwright install chromium`, nebo nastavte
`CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` pro systémový Chromium.

## Cal.com: vlastní kalendář a serverové API

Vlastní React kalendář zůstává zachovaný. Prohlížeč volá Supabase Edge Function
`admin-api/cal/slots`, `/bookings` a `/cancel`. Teprve server kontaktuje Cal.com
s klíčem `CAL_API_KEY` ze Supabase Secrets. Klíč nepatří do `VITE_` ani do GitHubu.
Nasazení existujícího `admin-api` přes backend workflow zahrne také tyto endpointy.

Veřejné nastavení je v `.env.example` a `.github/workflows/pages.yml`:
profil `adam-pruska`, úvod `nezavazna-konzultace` (30 minut), individuální konzultace
`individualni-konzultace` (50 minut). Balíček používá stejnou událost jako individuální
konzultace a rezervuje první setkání. Server povoluje pouze tyto služby.
`VITE_SUPABASE_URL` musí odpovídat nasazenému backendu.

Všechny rezervace vyžadují jméno, platný e-mail, téma, popis situace a časový horizont.
Financování studia a dodatečná poznámka zůstávají volitelné. Stejná validace běží
v prohlížeči i na serveru. Cal.com dostane odpovědi v poznámce a téma a jazyk
v metadatech. Platba zůstává převodem po vystavení faktury, bez online checkoutu.

Obě strany mohou přes web zrušit rezervaci nejpozději 24 hodin před začátkem.
Klient dostává soukromý podepsaný odkaz v potvrzení na webu; může si ho uložit
pro pozdější použití. Správce má tlačítko v administraci za přihlášením a MFA.
Server před každým stornem načte aktuální termín z Cal.com a ověří stejnou lhůtu.
Přesun termínu v Cal.com tedy nezneplatní kontrolu lhůty. Odkaz nevytváří storno
pouhým otevřením: vyžaduje stisknutí tlačítka. Odkaz obsahuje oprávnění ke stornu,
proto ho nesdílejte veřejně. Rotace `CAL_API_KEY` zneplatní staré odkazy.

Pravidlo této aplikace neomezuje samostatné rozhraní Cal.com ani nativní odkazy
v jeho e-mailech. Před ostrým provozem je potřeba zkontrolovat storno a změny termínu
také v nastavení obou událostí Cal.com, aby tyto cesty neobcházely lhůtu webu.
Odkaz pro správu web neposílá samostatným e-mailem; potvrzení schůzky nadále posílá Cal.com.

## Ověření

`npm test` ověřuje kontrakty, obsah a databázová oprávnění. `npm run test:backend`
ověřuje včetně serverové validace rezervací, tajného klíče a storno lhůty s izolovanými
odpověďmi poskytovatelů. `npm run test:ui` kontroluje všechny veřejné stránky a rezervace.
`node scripts/verify-cal-config.mjs` ověřuje skutečnou dostupnost přes nasazenou
Supabase funkci a její CORS, bez vytváření rezervací. `pending` zůstává žádostí,
`accepted` je potvrzení. Po neurčité odpovědi se POST automaticky neopakuje.

## Obsah

Zdroj je https://pruskaadam4.wixstudio.com/pruska, jeho blog a údaje dodané
vlastníkem. Zdroje viz [docs/content-sources.md](docs/content-sources.md).
Tři reference klientů, medailonek, konkrétní texty a odkazy na Adamovy
fotografie dodal vlastník. Deset mediálních odkazů je v `src/media.ts`.
Devět článků používá samostatné tematické AI ilustrace v `public/images/`.
Sedmi českým článkům byla podle zadání přidělena redakční data v období
listopad 2024 až září 2026; původní dva články zachovávají svá data z roku 2025.

Design používá švýcarskou červenou `#d52b1e`, šedou a černou. Úvod vyplňuje
šířku i výšku viewportu (`100svh`); na nízkých obrazovkách může růst podle
obsahu. Hover pohyb se používá pouze na zařízeních s podporou hover a bez
nastaveného `prefers-reduced-motion`. Malé nadpisy nad hlavními jsou odstraněné.

## Nasazení a prostředí

Workflow `.github/workflows/pages.yml` nejprve nasadí Supabase backend a pak publikuje sestavený `dist/` při pushi do
`main`. Pages Source musí být **GitHub Actions**. Vývojové větve se automaticky
nepublikují. Před přepnutím této nové verze ověřte Cal.com podle bodů výše.

Používejte existující checkout. Každá cloudová úloha je izolovaná; není potřeba
vytvářet další Git worktree. Instalace používá lockfile (`npm ci`). Proces Vite
je třeba po obnovení prostředí spustit znovu.

## Administrace a backend Supabase

Soukromý vstup je `/admin/`, hlavní doména `https://adampruska.cz/`.
Přihlášení pro `pruskaadam@me.com` vyžaduje povolený účet a TOTP MFA.
Celý backend běží v Supabase: Auth, PostgreSQL s RLS a Edge Function `admin-api`.
Pošta iCloud používá IMAP/TLS 993 a pro odesílání Resend přes HTTPS.
Postup: [docs/mail-icloud.md](docs/mail-icloud.md). Připravená jsou propojení
GA4, Cal.com a Stripe Payments, Invoicing a Tax.

Nasazení souborů na Pages samo neaktivuje Supabase ani externí služby.
Podrobný postup, bezpečné uložení klíčů a zbývající nastavení:
[docs/admin-setup.md](docs/admin-setup.md).

`npm run test:backend` prověří Deno handlery bez skutečných síťových volání.
`npm run test:admin` ověří přihlášení, MFA, ovládání a souhlas s měřením pomocí
izolovaného sestavení a zachycených odpovědí. `npm test` zahrnuje skutečné
PostgreSQL/RLS testy přes PGlite. Nikdy netestujte odesláním skutečné zprávy
nebo vytvořením skutečné platby bez výslovného zadání vlastníka.

`npm run deploy:backend` potřebuje `SUPABASE_ACCESS_TOKEN` v bezpečném prostředí.
Backend lze nasadit také ručně přes workflow **Deploy Supabase backend**;
token patří do stejnojmenného repository secret v GitHub Actions.
Web obsahuje veřejný publishable klíč Supabase dodaný vlastníkem. GitHub Actions
Variable `VITE_SUPABASE_PUBLISHABLE_KEY` jej může přepsat. Serverové klíče
a heslo pošty patří výhradně do Supabase Secrets.
