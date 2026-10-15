# Soukromá administrace a Supabase backend

Aktualizováno 15. 10. 2026. Cílová administrace: `https://adampruska.cz/admin/`.
Původní vstup na GitHub Pages: `https://pruskaadam-hub.github.io/consulting-page/admin/`.
GitHub může původní adresu přesměrovat na nastavenou vlastní doménu.

Projekt Supabase: `lsofzsartjesgwetcpzw`, URL `https://lsofzsartjesgwetcpzw.supabase.co`.
Správce: `pruskaadam@me.com`. Obchodní pošta: `adam@adampruska.cz` přes iCloud+,
odesílání z administrace přes Resend. FORPSI spravuje DNS domény.

## Co je připravené a co vyžaduje účty

Zdrojový kód obsahuje přihlášení, povinné TOTP ověření, databázová oprávnění,
klienty, objednávky, příjmy, rezervace, úkoly, ruční faktury s tiskem do PDF,
poštu iCloud/Resend, GA4 a propojení Stripe Payments, Invoicing a Tax.

Zveřejnění statické stránky administrace nevytvoří tabulky ani nenasadí Edge
Function do Supabase. Před živým používáním musí být provedené kroky níže.
Veřejný publishable klíč dodaný vlastníkem je již součástí připojení webu.
Nasazení databáze a Edge Function potvrdil úspěšný GitHub Actions běh
`38747099021`. Přihlášení vlastníka ani skutečné propojení poskytovatelů
tímto během ověřené není.
Bez serverových tajných údajů
budou příslušná propojení označená jako čekající. Přehledy neobsahují ukázkové
klienty ani vymyšlené příjmy. Stav „Nastaveno“ u služby potvrzuje konfiguraci,
nikoli provedení skutečné platby nebo doručení e-mailu.

## 1. Připojení webu

Web již obsahuje vlastníkem dodaný **Publishable key** (`sb_publishable_…`)
pro výše uvedený projekt. Pro zveřejnění přihlašovacího formuláře není nutné
nastavovat GitHub variable. Jde o veřejný údaj určený do prohlížeče. Nesmí se
použít `secret` ani `service_role` klíč. Stripe `pk_test_…` je jiný klíč a
pro přihlášení k Supabase nefunguje.

Při změně projektu lze výchozí připojení přepsat v ignorovaném `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://lsofzsartjesgwetcpzw.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=skutecny_verejny_klic
```

Pro přepsání klíče na GitHub Pages nastavte repozitářovou **Actions variable**
`VITE_SUPABASE_PUBLISHABLE_KEY` v Settings → Secrets and variables → Actions
→ Variables. Pak znovu spusťte workflow Pages. Ostatní hodnoty `VITE_` jsou
také veřejné. Nikdy do nich nevkládejte serverové klíče ani heslo schránky.

## 2. Nasazení backendu

### Přes GitHub Actions

Tato cesta nevyžaduje propojení Personal Vaultu s prostředím Codexu.

1. Nejprve vytvořte účet `pruskaadam@me.com` v Supabase Authentication podle
   následující sekce. Nasazovací skript mu pak přidělí oprávnění správce.
2. V osobním účtu Supabase → Access Tokens vytvořte token. Pokud byl nějaký
   token zveřejněný v chatu nebo v kódu, zrušte ho a použijte nový.
3. V repozitáři otevřete **Settings → Secrets and variables → Actions →
   New repository secret**. Název je `SUPABASE_ACCESS_TOKEN`; hodnotu vložte
   pouze do chráněného pole Secret.
4. Otevřete **Actions → Deploy Supabase backend → Run workflow** a vyberte
   větev `main`. Při publikování webu jej nejprve volá workflow Pages.
5. Ověřte úspěch kroku **Deploy database and Edge Function** a zprávu
   **Owner account appointed.** Pokud účet při prvním nasazení neexistoval,
   vytvořte ho a workflow spusťte znovu.

Workflow nejprve prověří databázová oprávnění a serverové handlery bez
vytváření skutečných plateb nebo zpráv. Token dostane pouze nasazovací krok,
ne prohlížeč ani veřejné sestavení webu. Samotné nasazení nenastavuje heslo
správce, hostovaná nastavení Auth ani přístupové údaje externích služeb.
Nasazení automaticky vytvoří chybějící `EVENTS_HMAC_SECRET` pomocí bezpečného
generátoru. Existující hodnotu zachová a nikdy ji nevypisuje. Workflow Pages
čeká na úspěšné nasazení backendu, než sestaví a zveřejní veřejný web.

### Z prostředí Codexu

Pro nasazení z Codexu přidejte v bezpečném nastavení prostředí
`SUPABASE_ACCESS_TOKEN`, vytvořený v osobním účtu Supabase → Access Tokens.
Nejde o publishable klíč, databázové heslo ani projektový service_role klíč.
Token neposílejte do chatu a neukládejte ho do repozitáře.

```sh
npm run deploy:backend
```

Skript používá Management API, vytvoří nové tabulky v transakci, nastaví
oprávnění a nasadí funkci `admin-api` do uvedeného projektu. Při kolizi
se stávajícími tabulkami se zastaví. Nevypisuje klíče ani odpovědi s tajnými
údaji. Verzi migrace eviduje v chráněné tabulce.

Alternativně lze nové schéma vytvořit spuštěním migrací
`202610150001_admin.sql` a poté `202610150002_stripe_modes.sql` ze složky
`supabase/migrations` v Supabase SQL Editoru. Na existujícím schématu se
spouštějí pouze dosud neaplikované migrace, každá v transakci. Automatický
deploy tento výběr provádí podle tabulky verzí. Funkce se nasadí oficiálním CLI:

```sh
npx supabase@2.121.0 functions deploy admin-api --project-ref lsofzsartjesgwetcpzw --no-verify-jwt --use-api
```

Gateway ověření je vypnuté kvůli podepsaným webhookům a anonymním událostem.
Každá soukromá cesta uvnitř funkce samostatně ověřuje uživatele a databázové
oprávnění včetně MFA. Webhooky vyžadují podpis svého poskytovatele.

## 3. Účet správce a dvoufázové ověření

1. V Supabase Authentication → Users vytvořte uživatele `pruskaadam@me.com`
   s vlastním silným heslem. Případné potvrzení účtu proveďte v Supabase.
2. V SQL Editoru spusťte `supabase/appoint-owner.sql`. Výsledek musí obsahovat
   právě jednoho uživatele. Když účet ještě neexistuje, SQL oprávnění nepřidá.
3. V Authentication vypněte veřejnou registraci. V URL Configuration nastavte
   Site URL a povolený redirect na `https://adampruska.cz/admin/`.
4. TOTP enrollment a verification musí být v Authentication → MFA zapnuté.
5. Otevřete administraci, přihlaste se, přidejte autentizační aplikaci a
   potvrďte šestimístný kód. Data se otevřou až s úrovní `aal2`.

Ztracený druhý faktor může obnovit vlastník projektu přes Supabase správu
uživatelů. V aplikaci není skrytá výjimka, společné heslo ani veřejná registrace.
Přihlášení je uložené jen pro danou relaci prohlížeče; odhlášení odstraní
zobrazené soukromé přehledy. Samotné `noindex` ani skrytá URL nejsou ochrana:
ochranu zajišťují Supabase Auth a Row Level Security na všech tabulkách.

## 4. Serverová nastavení v Supabase Secrets

Tyto hodnoty patří výhradně do **Edge Functions → Secrets**:

| Název | Použití |
| --- | --- |
| `SITE_URL` | `https://adampruska.cz/` |
| `ALLOWED_ORIGINS` | `https://adampruska.cz` (případně také GitHub origin oddělený čárkou při přechodu) |
| `FORPSI_USERNAME` | `adam@adampruska.cz`, až je schránka aktivní |
| `FORPSI_PASSWORD` | Skutečné heslo této schránky |
| `MAIL_PROVIDER` | `icloud` (výchozí), nebo `forpsi` pro starší připojení |
| `MAIL_FROM_EMAIL` | `adam@adampruska.cz`, doména musí být ověřená pro odesílání |
| `ICLOUD_USERNAME` | Přihlašovací adresa iCloud Mail |
| `ICLOUD_APP_PASSWORD` | Heslo pro konkrétní aplikaci vytvořené u Applu |
| `RESEND_API_KEY` | Klíč pro odesílání z ověřené domény přes HTTPS |
| `GA4_PROPERTY_ID` | Volitelné přepsání číselného ID služby; výchozí je `559071834` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON služebního účtu pouze pro čtení Analytics |
| `STRIPE_SECRET_KEY` | Nejdřív testovací serverový klíč Stripe |
| `STRIPE_WEBHOOK_SECRET` | Podpisový klíč konkrétního webhooku Stripe |
| `STRIPE_AUTOMATIC_TAX` | `true` až po nastavení Stripe Tax a registrací |
| `STRIPE_PRODUCT_TAX_CODE` | Volitelný správný Stripe kód konkrétního typu služby |
| `CAL_WEBHOOK_SECRET` | Sdílené tajemství pro podpis webhooku Cal.com |
| `EVENTS_HMAC_SECRET` | Serverová hodnota automaticky vytvořená při nasazení; nevypisuje se |

Supabase samo dodává `SUPABASE_URL`, `SUPABASE_ANON_KEY` a serverový
`SUPABASE_SERVICE_ROLE_KEY`. Nikdy nekopírujte service_role do webu.

Aktuální postup pro iCloud+ a Resend je v [mail-icloud.md](mail-icloud.md).
Příjem a odesílání mají samostatné stavy. Bez schránky FORPSI není možné
použít její přístupové údaje; pro iCloud platí nové proměnné v tabulce.

Volitelné starší připojení FORPSI se připojuje s ověřováním TLS certifikátů na `imap.forpsi.com:993`
a `smtp.forpsi.com:465`. Supabase blokuje odchozí SMTP na portech 25 a 587;
proto se používá 465. Hosty ani porty nelze měnit požadavkem z prohlížeče.
Zobrazuje se posledních 25 zpráv a prostý text, bez načítání vzdálených
obrázků. Přílohy a zprávy větší než 5 MB se otevírají ve FORPSI webmailu.
Administrace eviduje stav vlastních SMTP odeslání; není to synchronizace celé
složky Odeslané. Při nejistém výsledku není automatické opakování povolené.
Přijetí zprávy SMTP serverem nepotvrzuje doručení adresátovi.

## 5. Stripe Payments, Invoicing a Tax

První propojení proveďte v testovacím režimu. Veřejný `pk_test_…` klíč není
pro hostovaný Checkout potřeba. Potřebujeme serverový klíč v Supabase Secrets
a podpisový klíč webhooku. Majitel potvrdil uložení testovacího
`STRIPE_SECRET_KEY`; webhook a zkušební platba se ověřují samostatně.

Endpoint webhooku:
`https://lsofzsartjesgwetcpzw.supabase.co/functions/v1/admin-api/stripe-webhook`

Odebírané události:

* `checkout.session.completed`
* `checkout.session.async_payment_succeeded`
* `invoice.finalized`
* `invoice.paid`
* `invoice.payment_failed`
* `charge.refunded`

Ve Stripe otevřete v testovacím režimu Workbench → Webhooks → Add destination.
Zvolte události vlastního účtu, plný objekt události (snapshot) a Webhook
endpoint. API je připnuté na `2025-06-30.basil`; stejnou verzi nastavte při tvorbě
webhook destination. Signing secret konkrétního endpointu uložte v Supabase
Edge Functions → Secrets jako `STRIPE_WEBHOOK_SECRET`. Klíč do chatu nepatří.
Podpis se ověřuje nad původními bajty, s tolerancí pěti
minut. Opakované platební události jsou idempotentní; nesouhlas částky nebo
měny neoznačí objednávku uhrazenou. Pozdější starší oznámení nepřepíše novější
stav faktury. Vrácené částky snižují evidované čisté příjmy.

Režim objednávky se rezervuje podle serverového klíče ještě před vytvořením
Checkoutu. Podepsané platby, faktury a refundace musí souhlasit s tímto
režimem. Testovací objednávky a faktury mají v administraci označení a neovlivní
příjmy ani počet čekajících skutečných objednávek. Při přechodu do ostrého
provozu nastavte ostrý serverový klíč i podpisový klíč samostatného ostrého
webhooku a vytvořte nové objednávky. Testovací objednávku nelze převést na ostrou.

Správce vytvoří klienta a objednávku, poté platební odkaz Stripe. Cena pochází
z databáze. Celkové ceny jsou včetně případné daně (`tax_behavior=inclusive`).
Checkout vyžádá fakturační adresu, umožní daňové ID, vytvoří zákazníka a po
platbě fakturu. Daň se počítá automaticky jen s aktivním `STRIPE_AUTOMATIC_TAX`.
V účtu Stripe musí být správně nastavené sídlo podnikání, daňové registrace
a klasifikace služeb. Zapnutí Tax samo o sobě registrace nenahrazuje.

Faktury Stripe se zobrazují v odděleném přehledu s oficiálními odkazy a PDF.
Pro stejnou objednávku nelze vystavit ještě místní fakturu. Objednávka se
zaplacenou kartou neoznačuje jako uhrazená na základě návratu prohlížeče.
Vrácení platby a další změny na Stripe objednávce se provádějí ve Stripe.

Veřejný rezervační formulář stále rezervuje přes Cal.com. Nevyžaduje platbu
před rezervací. Platební odkaz vytváří správce z objednávky; jeho zaslání není
automatické. Testy nevytvářejí skutečné platby, faktury u poskytovatele ani
neodesílají skutečné e-maily. Ostré transakční ověření potřebuje vlastníka účtu.

## 6. Rezervace a měření

V Cal.com vytvořte podepsaný webhook na
`https://lsofzsartjesgwetcpzw.supabase.co/functions/v1/admin-api/cal-webhook`
pro `BOOKING_CREATED`, `BOOKING_REQUESTED`, `BOOKING_RESCHEDULED` a
`BOOKING_CANCELLED`. Tajemství musí odpovídat `CAL_WEBHOOK_SECRET`.
Staré rezervace se tímto automaticky neimportují. Zrušená rezervace se
neobnoví opožděným starším oznámením.

V GA4 vytvořte službu pro web, aktivujte Google Analytics Data API a služebnímu
účtu přidělte oprávnění Viewer jen k této službě. Jeho JSON uložte do Secrets.
Číselné Property ID není totéž jako měřicí ID začínající `G-`.

Vlastní měření událostí má workflow Pages zapnuté přes `VITE_ENABLE_EVENTS=true`.
Před sestavením webu úspěšně nasadí backend a zajistí serverové tajemství.
Pro Google Analytics nastavte GitHub Actions Variable
`VITE_GA4_MEASUREMENT_ID=G-…` a znovu spusťte Pages. GA4 se bez skutečného ID
nespouští; text souhlasu pak popisuje jen vlastní měření.
Google skript ani anonymní události se nespouštějí před souhlasem. Souhlas
lze odvolat; nové události se zastaví. Respektuje se Do Not Track. Téma,
jméno, e-mail, obsah formulářů, URL dotazy ani obsah administrace se neměří.
Agregace kliknutí není účetní důkaz prodeje.

## 7. Fakturační údaje, údržba a testy

Pro ruční faktury vyplňte v administraci obchodní jméno, IČO, sídlo, bankovní
účet a stav DPH, případně DIČ. Klient musí mít adresu; plátce musí při vystavení
určit datum uskutečnění plnění. Čísla přiděluje databáze v transakci. Vystavené
údaje jsou neměnné. Opakované vystavení téže objednávky vrací stejný doklad.
Místní faktury nejsou synchronizované do Stripe; pro Stripe platby se používá
Stripe faktura. Export pro účetnictví a opravné doklady nejsou součástí této
první verze.

Přehledy zobrazují posledních 100 klientů, objednávek a faktur; souhrn příjmů
se počítá ze všech objednávek. Nastavte zálohy a retenční pravidla projektu
podle potřeb podnikání. Anonymní události lze pravidelně mazat například
po 90 dnech; plánovaná údržba se nastavuje v Supabase, sama se nezapíná.

```sh
npm ci --cache /workspace/.cache/npm
npm test
npm run test:backend
npm run build
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:ui
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:admin
```

Databázové testy používají skutečný PostgreSQL engine PGlite, role a RLS.
Backendové testy používají Deno a zakazují skutečná síťová volání. UI testy
používají izolované sestavení s testovacím veřejným klíčem a zachycené odpovědi.
Testovací data ani klíč se nevkládají do produkčního `dist/`.
