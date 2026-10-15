# Adam Pruška — Mentoring & Consulting

Česká responzivní landing page: React, TypeScript, Vite a vlastní rezervační
rozhraní pro veřejné API Cal.com. Obsahuje češtinu, slovenštinu, angličtinu
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

## Cal.com: vlastní kalendář, bez iframe

V `.env.local` nastavte veřejný profil a ověřené slugs událostí:

```dotenv
VITE_CAL_USERNAME=adam-pruska
VITE_CAL_INTRO_SLUG=nezavazna-konzultace
VITE_CAL_INDIVIDUAL_SLUG=soukroma-konzultace
VITE_CAL_PACKAGE_SLUG=soukroma-konzultace
```

Slug je poslední část odkazu `https://cal.com/adam-pruska/SLUG`.
Nepřidávejte API klíč do `VITE_` proměnné. Veřejná rozhraní Cal.com podporují
anonymní dotaz na volné termíny a vytvoření rezervace podle username + slug.
Použité verze API: slots `2024-09-04`, bookings `2024-08-13`.
Dokumentovaný kontrakt byl ověřen v oficiálním zdrojovém kódu:

* [Veřejné termíny](https://github.com/calcom/cal.diy/blob/v5.8.4/apps/api/v2/src/modules/slots/slots-2024-09-04/controllers/slots.controller.ts)
* [Vytvoření rezervace](https://github.com/calcom/cal.diy/blob/v5.8.4/apps/api/v2/src/ee/bookings/2024-08-13/controllers/bookings.controller.ts)

Vlastník dodal dvě veřejné události v Cal.com:

* `nezavazna-konzultace`: 30 minut online, zdarma.
* `soukroma-konzultace`: 50 minut online.

Balíček používá `soukroma-konzultace` pro první 50minutové setkání; další
dvě se domlouvají samostatně. Nabídka balíčku se předává v poznámce a
metadatech rezervace, nikoli jako potvrzení platby.

Nastavte jejich skutečnou dostupnost a zapněte kontrolu kolizí u připojených
kalendářů. Připojený účet sám o sobě neprokazuje, že každý kalendář kontroluje
obsazenost. U chráněného firemního účtu jsou rozhodující oprávnění poskytovatele.

Vlastní formulář podporuje jméno, e-mail a poznámku. U úvodu vyžaduje téma,
popis situace a časový horizont; volitelné financování pouze pro studium.
Odpovědi se spojují do `bookingFieldsResponses.notes`, téma a jazyk jsou
také v metadatech. Záměr z karty či článku se předvyplní. Pokud
událost vyžaduje další povinná pole, ověření e-mailu nebo platbu předem, je
nutné rozšířit tento průchod podle konkrétního nastavení. Stránka nyní
nevybírá platby a nepotvrzuje úhradu balíčku. Cena je nabídka služby.

Po změně proměnných restartujte Vite a znovu sestavte web. Stejné veřejné slugs jsou nastavené v build jobu
`.github/workflows/pages.yml`. Balíček používá událost individuální konzultace
pro první setkání a přidává údaje o nabídce do poznámky a metadat;
zbytek balíčku se domlouvá samostatně. Bez slugu UI pravdivě nabízí domluvení termínu e-mailem;
nezobrazuje vymyšlené volné časy ani nevytváří rezervaci.

## Ověření a aktuální omezení

Lokální testy ověřují kontrakt API s testovacími odpověďmi, včetně skutečného
průchodu rozhraním, kolizí, nepotvrzených žádostí a neurčité síťové odpovědi.
To není důkaz fungování živého účtu. Přístup k cal.com a api.cal.com z tohoto
prostředí byl blokovaný proxy (403). Potřebné domény jsou uložené v návrhu
nastavení prostředí. Nasazovací workflow provádí pouze čtení skutečné dostupnosti a kontrolu CORS
přístupu z produkční domény. To běží na GitHub runneru, zatímco lokální
prohlížečové testy používají výhradně testovací odpovědi. Výsledek živého
ověření musí být doložen dokončeným CI runem; přímý přístup z tohoto cloudového
prostředí zůstává samostatná kontrola po aplikaci nastavení. Nevytvářejte skutečné
rezervace nebo e-mailové pozvánky při běžném smoke testu bez výslovného zadání.

UI hlásí potvrzení pouze po odpovědi API se stavem `accepted` a odpovídajícím
termínem. Stav `pending` je žádost čekající na potvrzení. Při neznámém výsledku
POST se rezervace automaticky neopakuje a návštěvník je vyzván ke kontrole e-mailu.

## Obsah

Zdroj je https://pruskaadam4.wixstudio.com/pruska, jeho blog a údaje dodané
vlastníkem. Zdroje viz [docs/content-sources.md](docs/content-sources.md).
Tři reference klientů, medailonek, konkrétní texty a odkazy na Adamovy
fotografie dodal vlastník. Deset mediálních odkazů je v `src/media.ts`.
Fotografie u doktorandského
článku je pohled z ETH Zürich převzatý z původního článku.

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
