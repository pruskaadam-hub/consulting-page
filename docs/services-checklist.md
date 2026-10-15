# Postupné propojení služeb

Stav konfigurace v administraci znamená přítomnost nastavení. Úspěšné
přihlášení poskytovatele, skutečné doručení nebo platbu ověřujeme samostatně.
Nikdy nevkládejte soukromé klíče do chatu ani do proměnných `VITE_`.

## 1. Vlastní měření kliknutí

Nevyžaduje Google účet. Při nasazení backend vytvoří chybějící
`EVENTS_HMAC_SECRET`; existující hodnotu zachová. Pages čeká na backend,
pak sestaví web s `VITE_ENABLE_EVENTS=true`. Před souhlasem ani po jeho
odvolání se žádné události neposílají. Respektujeme Do Not Track a administraci
neměříme. Ukládají se návštěvy, kliknutí na konzultace a potvrzení rezervace
v prohlížeči. Nejde o důkaz zaplacení ani o potvrzení webhookem poskytovatele.

Pro skutečné ověření otevřete veřejný web, povolte měření a klikněte na
konzultaci. Potom v administraci obnovte přehled **Zájem o konzultace**.
Bez souhlasu nebo s blokátorem zůstane přehled neúplný. Automatické testy
používají pouze zachycené odpovědi a do produkčních statistik nic nevkládají.

## 2. Google Analytics 4

Vlastník dodal veřejné měřicí ID `G-L6HVJMS1XE`. Workflow Pages ho používá
jako výchozí hodnotu; GitHub Actions Variable `VITE_GA4_MEASUREMENT_ID` ji
může přepsat. Google tag se načte pouze po souhlasu. Přehledy přímo
v administraci navíc potřebují Property ID a služební účet podle kroků níže.
Property ID `559071834` je výchozí hodnota backendu; `GA4_PROPERTY_ID`
v Supabase Secrets ji může přepsat. Postup připojení přehledů:
[ga4-setup.md](ga4-setup.md).
Administrace proto ukazuje samostatně **GA4: sběr dat na webu** a
**GA4: přehledy v administraci**. Nastavení měřicího ID nepotvrzuje doručení
událostí do Google ani oprávnění k reportům.

1. Na https://analytics.google.com/ založte účet a službu pro Adam Pruška.
   Zvolte časové pásmo Praha a měnu CZK.
2. Vytvořte webový datový stream pro `https://adampruska.cz`.
3. Zkopírujte veřejné měřicí ID `G-…`. Do webu se přidává právě toto ID,
   ne číselné Property ID. ID patří do GitHub Actions Variable
   `VITE_GA4_MEASUREMENT_ID`, po změně znovu spusťte workflow Pages.
4. Po nasazení ověřte Realtime v GA4 s povoleným souhlasem na webu.
   Zkontrolujte nastavení Enhanced Measurement, aby automatické události
   neduplikovaly vlastní měření a neposílaly informace, které nechcete měřit.

Pro přehledy přímo v administraci je potřeba navíc Google Cloud projekt
s aktivním **Google Analytics Data API**. Vytvořte služební účet a jeho
adresu přidejte v GA4 → Správa přístupů ke službě s rolí **Viewer** jen
k požadované službě. Vygenerovaný JSON klíč patří výhradně do Supabase
Edge Functions → Secrets jako `GOOGLE_SERVICE_ACCOUNT_JSON`.
Číselné Property ID patří do `GA4_PROPERTY_ID`. Soubor se soukromým klíčem
neposílejte do chatu. Report v administraci zahrnuje posledních 30 dní
do včerejška, takže aktuální návštěvu kontrolujte v Realtime GA4.

## 3. Stripe Payments a Invoicing

Nejprve použijte testovací režim. Do Supabase Secrets patří serverový
`STRIPE_SECRET_KEY` a podpis `STRIPE_WEBHOOK_SECRET` konkrétního webhooku.
Veřejný `pk_test_…` samotné serverové připojení neaktivuje.
Payments a Invoicing používají stejné propojení. Webhook, konkrétní události
a ověření jsou popsány v [admin-setup.md](admin-setup.md#5-stripe-payments-invoicing-a-tax).
Skutečný nákup, refundaci a doručení faktury ověřuje vlastník v testovacím
režimu; automatické testy žádné transakce u poskytovatele nevytvářejí.

## 4. Stripe Tax

Nezapínejte automaticky jen proto, že je připojené Stripe. Nejprve nastavte
sídlo, správné daňové registrace a klasifikaci služeb ve Stripe. Potom se
zapne `STRIPE_AUTOMATIC_TAX=true` a případný správný `STRIPE_PRODUCT_TAX_CODE`.
Nastavení Tax neurčuje ani nenahrazuje skutečné povinnosti podnikatele.

## 5. Synchronizace Cal.com do administrace

Veřejný rezervační kalendář už používá Cal.com. K evidenci rezervací
v administraci je navíc potřeba podepsaný webhook:

`https://lsofzsartjesgwetcpzw.supabase.co/functions/v1/admin-api/cal-webhook`

Události: `BOOKING_CREATED`, `BOOKING_REQUESTED`, `BOOKING_RESCHEDULED`,
`BOOKING_CANCELLED`. Stejné tajemství patří do Cal.com i do Supabase Secrets
pod názvem `CAL_WEBHOOK_SECRET`. Staré rezervace se samy neimportují.

## 6. Příjem a odesílání pošty

Vlastník má iCloud+; ověření DNS u Applu ještě nebylo potvrzené. Příjem
zajišťuje iCloud, odesílání z webu Resend. FORPSI spravuje DNS a nemá
založenou schránku. Postup a názvy tajných údajů: [mail-icloud.md](mail-icloud.md).
Aktuální administrace má samostatné položky **Příjem pošty** a **Odesílání
pošty**, nikoli jednu položku „Pošta FORPSI“.
