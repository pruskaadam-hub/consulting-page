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
* Individuální konzultace ukazuje studentskou cenu 1 500 Kč se slevou 16,7 %.
  Studentský balíček stojí 3 500 Kč po slevě 22,2 % z běžných 4 500 Kč. U placených nabídek
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
  Blog je před FAQ. Externí zdroje se otevírají v novém panelu. Nový přehled
  `/blog/` představuje sedm dodaných českých článků; české texty zůstávají
  označené `lang="cs"` i při přepnutí jazyka okolního rozhraní.
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
| `[DOPLNIT: datum publikace]` | Nový blog, karty a záhlaví sedmi článků | Skutečná data publikace; nevkládají se do JSON-LD, dokud nejsou známá. |

Reference jsou uložené v `src/content.ts` a překlady v
`src/localized-content.ts`. Každá nyní podporuje `name` (i celé jméno),
`context` (role), `photo`, `linkedIn`, `result`, `quote` a iniciály jako
fallback. Neznámé celé jméno nebo fotografie nejsou domýšlené. Konkrétní
výsledky všech tří referencí doplnil vlastník. Při změně originální reference
současně upravte oba překlady. Souhrnný řádek s neznámými počty byl odstraněn.

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

## Vlastní doména adampruska.cz (FORPSI)

Vlastník zvolil `adampruska.cz` a uvedl správu DNS u FORPSI. Produkční
`SITE_URL` je připravený na `https://adampruska.cz/`. Připojení domény v Pages,
DNS a certifikát vyžadují dokončení v účtech vlastníka a nejsou touto změnou
kódu potvrzené. Přesný postup a DNS záznamy jsou v
[domain-forpsi.md](domain-forpsi.md).

Canonical, Open Graph, jazykové alternativy, JSON-LD, sitemap, robots.txt
a původ pro živou CORS kontrolu vycházejí z téhož `SITE_URL`. Relativní
assety fungují v kořeni domény i pod projektovým adresářem. Veřejná proměnná
`VITE_SITE_URL` umožňuje použít jinou adresu při sestavení; po její změně je
nutné znovu sestavit a publikovat. Testovací server používá cestu vybranou
stejným nastavením. Při nasazení přes GitHub Actions soubor `CNAME` doménu
v nastavení Pages nezapíná; je nutné vyplnit Custom domain přímo na GitHubu.

## Články a původní Wix slug

Texty a zdrojové odkazy: `src/articles.mjs`. Články jsou pod
`/clanky/kulturni-rozdily-ve-svycarsku/` a `/clanky/doktorat-ve-svycarsku/`,
se stejnými slugs i v jazykových podadresářích. Původní Wix odkaz kulturního
článku obsahuje `kopie-jak-na-doktorát…`; v kódu je TODO k opravě slugu na
Wixu. Do té doby zůstává zdrojový odkaz beze změny.

## Ověření

`npm test` kontroluje časová pásma, dostupnost, stavy potvrzení, kvalifikační
pole a konzistentní jazykové adresy. `npm run build` provede TypeScript a
vygeneruje 33 samostatných HTML vstupů s vlastními metadaty.

`npm run test:ui` spustí lokální statický server, otevře Chromium a ověří
všechny stránky a konzultační CTA v češtině, slovenštině a angličtině.
Kontroluje HTML, konzoli, šířky 375 / 1280 px, rozbalení a uchování formuláře,
kvalifikační pole, úspěch/čekání/kolizi/nejistotu, kontakty, média a jazykové
přepnutí. Veškeré odpovědi Cal.com jsou testovací; nevzniknou skutečné rezervace.

Pro první instalaci prohlížeče: `npx playwright install chromium`.
Pokud prostředí poskytuje systémový Chromium:
`CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:ui`.
Nasazovací workflow provádí stejné kontroly před publikováním.

## Nejnovější úpravy

Karty pomoci nemají malé číslování. Zkušenosti zvýrazňuje velká 7 a velké ETH.
Mediální odkazy mají kompaktní řádkové uspořádání ve dvou sloupcích, na mobilu
v jednom. Celé karty konzultací jsou nativní odkazy, takže fungují kliknutím
na libovolnou část i klávesou Enter. Během odesílání je změna nabídky blokovaná.
Revize a úprava CV a dokumentů je samostatný výrazný blok praktických služeb.
Revize dokumentu stojí 800 Kč, celková úprava dokumentu 1 500 Kč. Veřejné ceny jsou včetně DPH.
Platba je převodem po vystavení faktury po ukončení spolupráce.

Úvodní popisy sekcí jsou pod hlavními nadpisy. Favicon používá značku ap.
Šikmé šipky odkazů se při hoveru otáčejí vodorovně; respektují omezení animací.
Média mají osm odkazů s názvy dodanými vlastníkem, bez duplicity a Senátu.
Medailonek zahrnuje VŠCHT, práci mezi Prahou a Brnem, projektové řízení a volejbal.

Pevné ceny a odvozené slevy jsou v `src/pricing.mjs`. Individuální konzultace
stojí 1 800 Kč, pro studenty 1 500 Kč (sleva 16,7 %). Balíček tří konzultací
stojí 4 500 Kč místo 5 400 Kč za tři jednotlivé konzultace (úspora 900 Kč,
sleva 16,7 %). Studentský balíček stojí 3 500 Kč (sleva 22,2 % z běžného balíčku).
Procenta se zaokrouhlují jen pro zobrazení; pevné ceny se z nich nepočítají.

Živé texty webu včetně článků nepoužívají dlouhé pomlčky. Články byly podle
následného upřesnění vlastníka upravené také: číselné rozsahy jsou slovem
„až“, ukázkový předmět e-mailu používá dvojtečku. Ostatní dodané znění zůstává.

Nové články a přesný seznam značek k ověření viz
[blog-publication.md](blog-publication.md).

## Soukromá administrace

Vlastník zvolil Supabase projekt `lsofzsartjesgwetcpzw`, přihlašovací e-mail
`pruskaadam@me.com` a schránku FORPSI `adam@adampruska.cz`. Administrace má
vstup `/admin/`, není v sitemapě a vyžaduje vlastnické oprávnění a MFA.
Byly připravené databázové tabulky, Edge Function a propojení Stripe Payments,
Invoicing, Tax, GA4, pošty a Cal.com. Zveřejnění frontendu nenahrazuje nasazení
Supabase backendu a konfiguraci účtů. Stav propojení a přesné kroky viz
[admin-setup.md](admin-setup.md).

Vlastník potvrdil uložení `adampruska.cz` do Custom domain v GitHub Pages.
GitHub následně hlásil DNS check in progress. DNS a přímý HTTPS přístup
z tohoto prostředí blokuje síťová proxy; jejich dokončení tím není ověřené.
Cílové canonical adresy zůstávají `https://adampruska.cz/`.
