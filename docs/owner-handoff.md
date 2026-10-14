# Další úpravy a co doplnit

Aktualizováno 15. 10. 2026. Veřejná stránka:
https://pruskaadam-hub.github.io/consulting-page/

## Co je hotové

* Kalendář je při běžném načtení skrytý. Konzultační CTA ho otevře s vybraným
  typem; tlačítko ho znovu skryje, aniž by smazalo rozepsané údaje. Odkaz
  s `#kalendar` jej otevře přímo. Před interakcí se nenačítají termíny Cal.com.
* Sloučené oblasti pomoci mají tři karty. Studium a kariéra předávají svůj
  záměr do rezervace; firemní karta směřuje na samostatné `#firmy` s vykáním.
* Úvodní rezervace vyžaduje téma, situaci a časový horizont. Financování
  je nepovinné a zobrazuje se jen při studiu. Zvolený záměr je vidět vedle
  kalendáře a uloží se do poznámky a metadat rezervace.
* Individuální konzultace ukazuje studentskou cenu 900 Kč. U placených nabídek
  je konkrétní výstup: plán dalších kroků. Platební podmínky nejsou vymyšlené.
* Medailonek zmiňuje pomoc se studiem i hledáním práce pro absolventy a
  zkušené profesionály. Přeformulovaná položka startupových zkušeností.
* Sticky lišta obsahuje claim „Nemusíš na všechno přicházet sám.“; navigace
  má také vstup pro firmy. Nový hero je noir úprava vlastní dodané fotografie,
  s monochromatickým portrétem a červenými akcenty.
* Čeština `/`, slovenština `/sk/`, angličtina `/en/`. Překládá se celý
  rezervační formulář, stavové zprávy a oba články. Původní titulky mediálních
  zdrojů zůstávají v jazyce zdroje, formáty a ovládání jsou přeložené.
* Dva původní články mají vlastní podstránky ve všech třech jazycích. Jsou to
  redakční úpravy článků z Wixu, s odkazem na originál a relevantními fotografiemi.
  Blog je před FAQ. Externí zdroje se otevírají v novém panelu.
* Závěrečná sekce médií obsahuje všech deset dodaných odkazů. Nejsou přidávána
  neověřená loga ani názvy videí. Čtení těchto domén blokovala proxy; odkazy
  jsou převzaté od vlastníka a u videí/dokumentů mají neutrální popisky.
* Kontaktní sekce zve k propojení na LinkedIn. Zobrazuje e-mail jako
  `pruskaadam [zavináč] me [tečka] com` a telefon po oddělených skupinách.
  Kliknutí odhalí přímý `mailto:` / `tel:`. Firma otevře e-mail až kliknutím
  na poptávku. To omezuje jednoduché sběrače, nikoli všechny boty; adresa je
  potřebná ve veřejném klientském kódu.

## Viditelné značky k doplnění

Všechny texty jsou v `src/placeholders.ts`; komponenta `src/Placeholder.tsx`
vedle každého vloží také DOM komentář `<!-- TODO Adam: … -->`. Stejné značky
jsou záměrně viditelné v každé jazykové verzi, aby se neztratily při doplňování.

| Značka | Umístění | Co dodat |
| --- | --- | --- |
| `[DOPLNIT: studentská cena balíčku]` | `src/main.tsx`, nabídka balíčku | Skutečnou studentskou cenu a podmínky. Neodvozujeme kombinaci slev. |
| `[DOPLNIT: cena / podmínky]` | `src/main.tsx`, pod ceníkem | Cenu nebo pravidla úprav CV a dokumentů. |
| `[DOPLNIT: předem přes Cal.com / převodem na fakturu]` | `src/main.tsx`, pod ceníkem a platební FAQ | Zvolený způsob platby, splatnost a případné potřebné údaje. |
| `[DOPLNIT: konkrétní výsledek]` | `src/main.tsx`, všechny tři reference | Skutečný výsledek pro každou referenci. |
| `[DOPLNIT: počet]` | `src/main.tsx`, řádek nad referencemi, klienti | Doložitelný počet klientů. |
| `[DOPLNIT: počet]` | `src/main.tsx`, řádek nad referencemi, přihlášky | Doložitelný počet úspěšných přihlášek. |

Reference jsou uložené v `src/content.ts` a překlady v
`src/localized-content.ts`. Každá nyní podporuje `name` (i celé jméno),
`context` (role), `photo`, `linkedIn`, `result`, `quote` a iniciály jako
fallback. Neznámé celé jméno nebo fotografie nejsou domýšlené. Marie Č. má
TODO k nahrazení referencí s měřitelným výsledkem. Při změně originální
reference současně upravte oba překlady.

## Cal.com: aktuální nastavení a přesná pole

Aktuálně fungují veřejné události:

* `https://cal.com/adam-pruska/nezavazna-konzultace` — 30 minut.
* `https://cal.com/adam-pruska/soukroma-konzultace` — 50 minut.

Balíček rezervuje první setkání přes druhou událost. Zbylé dva termíny a
osobní setkání se domlouvají samostatně. Web nevybírá platbu.

**Pro tuto implementaci nepřidávejte do Cal.com nová povinná vlastní pole.**
Kvalifikační otázky jsou povinné na webu a jejich odpovědi se předávají do
stávající poznámky `bookingFieldsResponses.notes`. Do `metadata` se ukládá
stabilní identifikátor tématu a jazyk. Nové povinné slugs nastavené v Cal.com
by vyžadovaly současnou úpravu API payloadu; samotný stejný popisek nestačí.

V nastavení každé události:

1. Ověřte délku 30 / 50 minut a umístění online schůzky.
2. V Booking Questions (obvykle Advanced / Pokročilé) ponechte jméno,
   e-mail a výchozí pole Additional notes / Poznámky s identifikátorem `notes`.
   Poznámky mohou být nepovinné; naše úvodní otázky ověřuje web před odesláním.
3. Ověřte dostupnost, kalendáře pro kontrolu kolizí a potvrzovací e-mail.
   Pokud vyžadujete schvalování, web správně ukáže čekající žádost.
4. Nezapínejte nová povinná pole, ověřování e-mailu nebo povinnou platbu bez
   odpovídající úpravy průchodu webem. Tato verze nesimulovala platbu ani ji
   nepotvrzuje. Živá CI kontrola čte dostupnost a CORS, nevytváří schůzky.

| Otázka na webu | HTML `name` | Předání Cal.com |
| --- | --- | --- |
| S čím přicházíš? | `consultationTopic` | `metadata.topic`: `study`, `career`, `project`, `other`; čitelný název v `notes` |
| Kde teď jsi…? | `situation` | Řádek „Situace:“ v `notes`; povinný u úvodu |
| Jaký máš časový horizont? | `horizon` | `soon`, `year`, `later`; čitelná hodnota v `notes` |
| Jak plánuješ financování? | `financing` | „Financování:“ v `notes`, pouze pro studium, nepovinné |
| Další poznámka u placené konzultace | `notes` | Součást `bookingFieldsResponses.notes` |

Téma se předvyplní ze studijní nebo kariérní karty. Odkazy z článků používají
`?tema=study#kalendar` nebo `?tema=career#kalendar`. API potvrzení dostane jazyk
`cs`, `sk` nebo `en`; interní souhrn pro Adama používá české názvy položek.

## Vlastní doména: až bude zvolená

**Aktivní CNAME nebyl vytvořen.** Hodnotu `[DOPLNIT: doména]` nevkládejte do
DNS ani do aktivního souboru; nahraďte ji skutečnou doménou.

1. Vlastní doménu kupte/spravujte u registrátora. Na GitHubu lze nejprve
   ověřit její vlastnictví v osobním Settings → Pages → Add a domain pomocí
   předepsaného TXT záznamu.
2. Pro doménu bez `www` nastavte čtyři DNS záznamy typu **A**, host `@`:
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
   Pro `www` nastavte **CNAME**, host `www`, cíl `pruskaadam-hub.github.io`.
   Do cíle nepatří `https://` ani `/consulting-page/`. Nahraďte konfliktní
   záznamy pro tento host podle možností svého DNS správce.
3. V repozitáři Settings → Pages → Custom domain zadejte skutečnou doménu
   (například `www.vasadomena.cz`), uložte a počkejte na DNS kontrolu a certifikát.
4. Teprve pak vytvořte `public/CNAME`, jeden řádek se skutečnou doménou, bez
   protokolu a cesty. Vite jej zkopíruje do publikovaného `dist/CNAME`.
5. V `src/site-config.mjs` změňte jediný výchozí `SITE_URL` na
   `https://vasadomena.cz/` nebo `https://www.vasadomena.cz/`, podle nastavení
   v Pages. Alternativně nastavte veřejnou build proměnnou `VITE_SITE_URL` v
   prostředí/workflow. Při její změně je nutné znovu sestavit a publikovat web.
6. Canonical, Open Graph, jazykové alternativy, sitemap, robots.txt i původ
   pro živou CORS kontrolu se přepočítají ze stejného nastavení. Relativní
   cesty assetů fungují i bez projektového podadresáře. E-mail je na jediném
   místě `CONTACT_EMAIL` v tomtéž souboru a může zůstat `pruskaadam@me.com`.
7. Po zpřístupnění certifikátu zapněte Enforce HTTPS. Ověřte základní stránku,
   `/sk/`, `/en/` a přímé adresy článků i rezervace po změně domény.

## Články a původní Wix slug

Texty a zdrojové odkazy: `src/articles.mjs`. Články jsou pod
`/clanky/kulturni-rozdily-ve-svycarsku/` a `/clanky/doktorat-ve-svycarsku/`,
se stejnými slugs i v jazykových podadresářích. Původní Wix odkaz kulturního
článku obsahuje `kopie-jak-na-doktorát…`; v kódu je TODO k opravě slugu na
Wixu. Do té doby zůstává zdrojový odkaz beze změny.

## Ověření

`npm test` kontroluje časová pásma, dostupnost, stavy potvrzení, kvalifikační
pole a konzistentní jazykové adresy. `npm run build` provede TypeScript a
vygeneruje devět samostatných HTML vstupů s vlastními metadaty.

`npm run test:ui` spustí lokální statický server, otevře Chromium a ověří
všechny stránky a konzultační CTA v češtině, slovenštině a angličtině.
Kontroluje HTML, konzoli, šířky 375 / 1280 px, rozbalení a uchování formuláře,
kvalifikační pole, úspěch/čekání/kolizi/nejistotu, kontakty, média a jazykové
přepnutí. Veškeré odpovědi Cal.com jsou testovací; nevzniknou skutečné rezervace.

Pro první instalaci prohlížeče: `npx playwright install chromium`.
Pokud prostředí poskytuje systémový Chromium:
`CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:ui`.
Nasazovací workflow provádí stejné kontroly před publikováním.
