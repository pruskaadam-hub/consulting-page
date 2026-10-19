# iCloud SMTP relay

Malý HTTP server pro odesílání z administrace přes **stejný iCloud účet**.
Nepoužívá Resend ani jinou odesílací službu. Supabase čte schránku a kopíruje
odeslané zprávy do iCloudu; relay pouze provede SMTP STARTTLS na portu 587.

Aktuální ověření z produkčního Supabase: IMAP 993, přihlášení i složky fungují;
SMTP 465 je nedostupné. Port 587 hostované Edge Functions blokují. Proto je
pro přímé odesílání potřeba hosting této relay mimo Supabase.

## Hosting a konfigurace

Lze použít vlastní VPS s Dockerem nebo Node.js hosting s povoleným odchozím
TCP portem 587, veřejným HTTPS a **trvalým diskem**. Dostupnost SMTP portu je
potřeba ověřit u poskytovatele; některé služby jej také blokují.
Není potřeba měnit MX, SPF ani DKIM: skutečným odesílatelem zůstává iCloud.

1. V hostingu vytvoř soukromé proměnné:
   - `ICLOUD_USERNAME=pruskaadam@me.com`
   - `ICLOUD_APP_PASSWORD`: heslo pro aplikaci z účtu Apple, stejné jako pro IMAP.
   - `MAIL_RELAY_SECRET`: nový náhodný klíč, alespoň 32 znaků; například výstup
     `openssl rand -hex 32`. Nikdy jej neposílej do chatu ani do Gitu.
   - `RELAY_STORE_DIR=/data/receipts` a trvalý disk připojený na `/data`.
2. Sestav Docker image z **kořene repozitáře**:
   `docker build -f mail-relay/Dockerfile -t adampruska-mail-relay .`
   Nebo spusť `docker compose -f mail-relay/compose.yaml up -d --build`;
   proměnné předem načti v shellu nebo soukromém `.env` vedle compose souboru.
3. HTTPS reverse proxy směruj na `127.0.0.1:8080`. Kontejner sám neposkytuje
   veřejné TLS. Managed hosting musí HTTPS ukončovat na svém ingressu.
4. V Supabase Secrets ulož:
   - `MAIL_RELAY_URL=https://tvoje-adresa-relay` (bez `/send`)
   - `MAIL_RELAY_SECRET`: stejný sdílený klíč jako na hostingu.
5. Ověř `POST /verify` relay se serverovým Bearer klíčem: pouze přihlášení
   SMTP, žádný e-mail. Potom obnov administraci; odesílací tlačítko se aktivuje.
   Jediný skutečný test odešli ručně na vlastní adresu a zkontroluj Odeslané
   v administraci i v iCloudu. Automatické testy skutečné zprávy neposílají.

Bez relay je možné v administraci uložit zprávu do **iCloud Konceptů**, odeslat
ji v iCloud Mail a potom ji načíst v Odeslaných. Konfigurace relay tento postup
nevypíná.

## Ochrana před duplicitami a oprávnění

Každá zpráva má UUID. Před SMTP se na trvalém disku atomicky založí záznam
UUID → stav. Souběžné ani opakované požadavky nemohou zprávu znovu odeslat.
Při restartu zůstávají potvrzení zachovaná. Na disku se ukládá jen stav,
nikoli tělo, příjemce ani heslo. Nikdy neodstraňuj aktivní záznamy při obnově
po výpadku; jejich odstranění by umožnilo opakování stejného ID.

`POST /send` a `POST /verify` vyžadují dlouhý sdílený Bearer klíč.
`GET /health` vrací pouze `{ready:true}`. Odchozí SMTP host, port, obálka
odesílatele a Reply-To jsou pevné. Požadavek nemůže vybrat jiný server,
podstrčit přílohu ze souboru/URL nebo změnit odesílatele. Odesílá se až po
ověřeném STARTTLS; hlavní Apple heslo není potřeba.

Logy neobsahují obsah zpráv ani providerové chybové odpovědi. Při přerušení
SMTP DATA relay vrátí nejistý stav a opakování stejného ID zablokuje. Přijetí
SMTP serverem samo o sobě nezaručuje konečné doručení adresátovi.
