# Aktuální varianta: Cal.com a iCloud, bez Resend

Vlastník zvolil 19. 10. 2026 komunikaci přímo přes Cal.com. Veřejný kontakt webu je
adam@adampruska.cz. Všechny kontaktní odkazy a poptávky dokumentů používají tuto adresu.
Rezervační potvrzení zůstávají v Cal.com (výchozí BOOKING_EMAIL_MODE=cal).
Běžná pošta se vyřizuje v iCloud Mail; administrace nabízí přímý odkaz na schránku.
Chybějící Resend není v této variantě chybou propojení rezervací.
Přístup pro čtení schránky v administraci nadále vyžaduje přihlašovací údaje iCloud IMAP.

E-mail účtu Cal.com a identita pořadatele kalendářových pozvánek jsou samostatná
nastavení. Změna veřejného kontaktu webu nemění hlavní e-mail účtu Cal.com ani Apple ID.
Diagnostika porovnává skutečný e-mail účtu Cal.com s adam@adampruska.cz.

Níže je referenční dokumentace volitelné vlastní šablony, kterou tato varianta nepoužívá.

## Referenční dokumentace vlastní šablony

Požadované nastavení vlastníka z 19. 10. 2026:

| Úloha | Adresa / služba |
| --- | --- |
| Oznámení pořadateli | adam@adampruska.cz |
| Odesílatel vlastního klientského potvrzení | Adam Pruška <adam@adampruska.cz> |
| Odpovědi na vlastní klientské potvrzení | adam@adampruska.cz |
| Příjemce klientského potvrzení | E-mail vyplněný klientem při rezervaci |
| Čtení schránky v administraci | iCloud IMAP |
| Odesílání z administrace při iCloudu | Resend HTTPS s ověřenou doménou |

Při testu na jiné vlastní adrese je tento účet klientem, zatímco účet Cal.com
je pořadatelem. Zpráva v každé z těchto schránek tedy může být očekávaná.
Pozvánka „Adam Pruska vás zve na událost…“ s Reply-To na původní adrese Yahoo
je jiná zpráva než vlastní potvrzení webu. Její identita se musí ověřit v připojeném
kalendáři / účtu Cal.com. Změna Reply-To v aplikaci nezmění pozvánky iCloudu.

## Co dělá aplikace

- Nové rezervace a storna z webu se ukládají přímo do přehledu administrace.
- Při prvním otevření sekce Rezervace se načte nejvýše 100 naposledy změněných
  rezervací přes Cal.com API, včetně starších, čekajících a zrušených.
- Tlačítko „Načíst rezervace z Cal.com“ obnoví přehled; opakování nevytváří duplicity.
- Podepsané webhooky zůstávají podporované pro průběžné změny mimo web,
  ale nejsou podmínkou ručního importu ani ukládání rezervací vytvořených na webu.
- „Ověřit e-mailovou komunikaci“ načte identitu účtu Cal.com a stav pošty administrace.
- Web ukáže dostupný HTTPS odkaz na schůzku vedle soukromého odkazu ke zrušení.
- Chyba ukládání do přehledu ani chyba e-mailu nepromění již vytvořenou rezervaci
  na neúspěch vybízející klienta k opakovanému vytvoření schůzky.

## Vlastní klientské potvrzení je připravené, standardně vypnuté

`BOOKING_EMAIL_MODE=cal` (výchozí): potvrzení nadále posílá Cal.com.
Aplikace neposílá další automatické potvrzení.

`BOOKING_EMAIL_MODE=app`: web po nové rezervaci odešle potvrzení klientovi.
Vyžaduje fungující odesílání a `MAIL_FROM_EMAIL=adam@adampruska.cz`.
Obsahuje termín s časovým pásmem, dostupný odkaz na online schůzku,
soukromý odkaz ke zrušení, lhůtu 24 hodin a informaci o platbě fakturou.
Čekající žádost není označená za potvrzenou schůzku.

Jedno UID rezervace a stav mají jeden stabilní identifikátor zprávy. Odesílání
používá existující outbox a idempotenci Resend. Nejistý výsledek se automaticky
neopakuje; klient dostane odkazy na webu a upozornění na neověřené doručení.
Synchronizace historických rezervací žádné e-maily neposílá.

## Nastavení před zapnutím vlastního potvrzení

1. V Cal.com ověřit hlavní adresu pořadatele adam@adampruska.cz. Je-li potřeba
   potvrzení vlastnictví adresy, musí ho dokončit vlastník ve své schránce.
2. U obou událostí ověřit online umístění (Cal Video, Meet nebo Zoom),
   cílový kalendář, příjemce oznámení a aktivní e-mailové workflow.
3. U pozvánky iCloudu ověřit identitu pořadatele a případné přeposílání.
   Nezaměňovat přihlašovací Apple ID s adresou, ze které má být vystavena pozvánka.
   Účet Apple se nesmí měnit naslepo jen kvůli jednomu poli Reply-To.
4. V Resend ověřit doménu adampruska.cz a oprávnění odesílat z požadované adresy.
   V Supabase nastavit MAIL_FROM_EMAIL=adam@adampruska.cz a RESEND_API_KEY.
   Heslo pro aplikaci ICLOUD_APP_PASSWORD slouží čtení iCloudu, nenahrazuje Resend.
   ICLOUD_USERNAME může zůstat přihlašovacím jménem schránky; není to pole odesílatele.
5. Zkontrolovat SITE_URL: musí být skutečná veřejná adresa webu, protože z ní
   vznikají odkazy pro správu v e-mailu.
6. Sladit / vypnout duplicitní potvrzovací e-maily Cal.com a jeho workflow.
   Kalendářová pozvánka může zůstat samostatnou zprávou k vložení do kalendáře.
7. Teprve potom zapnout BOOKING_EMAIL_MODE=app v Supabase Secrets.
   Do té doby zůstává výchozí režim cal, aby nepřibylo další potvrzení.
8. Pro přijetí původně čekajících žádostí, přesuny a externí storna zachovat
   odpovídající oznámení Cal.com / jeho workflow. Vlastní šablona této verze se
   spouští při vytvoření rezervace, ne při importu historických záznamů.

Po nastavení provést jednu výslovně dohodnutou testovací rezervaci: zkontrolovat
adresáta pořadatele, klientské potvrzení, Reply-To, funkčnost obou odkazů a storno.
Automatické testy tyto zprávy neposílají a nevytvářejí živé rezervace.

Ověření „Mail readiness“ pouze čte nastavení domény v Resend; neposílá e-maily.
`missing_key` znamená chybějící RESEND_API_KEY, `domain_pending` čekající DNS,
`ready` ověřenou doménu. `key_scope_unknown` znamená, že klíč nemá oprávnění
číst domény; neznamená automaticky nefunkční odesílání. Soukromý seznam domén
ani API klíče se do diagnostiky nevracejí.

### Čtení iCloud pošty v administraci

V Supabase → Edge Functions → Secrets ulož `ICLOUD_USERNAME` (adresa iCloud Mail, např. `pruskaadam@me.com`; nikoli Yahoo adresa používaná jako přihlášení k účtu Apple) a `ICLOUD_APP_PASSWORD` (heslo pro aplikaci z account.apple.com → Přihlášení a zabezpečení). Běžné heslo Apple nepoužívej. Volitelné `MAIL_PROVIDER=icloud` a `MAIL_FROM_EMAIL=adam@adampruska.cz` odpovídají výchozím hodnotám. Po obnovení administrace otevři Poštu a načti posledních 25 zpráv. IMAP používá TLS a schránku otevírá pouze pro čtení; zprávy se nekopírují do databáze. Z této společné schránky backend vrací pouze zprávy s přesnou adresou `adam@adampruska.cz` v Komu nebo Kopii; kontrola platí i pro detail podle UID. Vyhledává před omezením na 25 zpráv. Zprávy pouze se skrytou kopií se nezobrazují. Čtení nevyžaduje Resend, odpovědi otevři v iCloud Mail.
