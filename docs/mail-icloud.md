# Poštovní klient adam@adampruska.cz

Administrace `/admin/` → **Pošta** používá iCloud jako hlavní úložiště pošty.
Příjem a složky čte přes nativní IMAP/TLS 993. Živá kontrola potvrdila
přihlášení a existenci Doručených i Odeslaných. Resend není potřeba.

Přímé odesílání přes iCloud vyžaduje [SMTP relay](../mail-relay/README.md)
mimo Supabase: port 465 je ze současného Edge runtime nedostupný a port
587 Supabase blokuje. Do připojení relay zůstává přímé odesílací tlačítko
vypnuté. Zprávu lze napsat v administraci, uložit do iCloud Konceptů a odeslat
v iCloud Mail. Po odeslání se synchronizuje do Odeslaných v administraci.

## Přihlašovací údaje

V Supabase → Edge Functions → Secrets:

| Název | Hodnota |
| --- | --- |
| `MAIL_PROVIDER` | `icloud` (výchozí) |
| `ICLOUD_USERNAME` | Adresa iCloud Mail, v tomto účtu `pruskaadam@me.com` |
| `ICLOUD_APP_PASSWORD` | Heslo pro aplikaci z account.apple.com |

Přihlašovací jméno Apple účtu na Yahoo není adresa schránky pro IMAP.
Odesílatel klienta je pevně `Adam Pruška <adam@adampruska.cz>` a Reply-To
je stejná adresa. Běžné Apple heslo do aplikace nepatří. Hesla se neukládají
v prohlížeči ani v GitHub repozitáři; používá je pouze serverová funkce.

## Složky a synchronizace

- **Doručené:** jen zprávy s přesnou adresou `adam@adampruska.cz` v Komu
  nebo Kopii. Zprávy pouze se skrytou kopií se nezobrazují.
- **Odeslané:** složka s IMAP příznakem `\\Sent`, případně standardní
  `Sent Messages` / `Sent`. Zobrazuje jen zprávy s danou adresou odesílatele,
  včetně zpráv poslaných z iCloudu na webu, telefonu nebo počítači.
- Seznam se obnoví při otevření Pošty, návratu do okna, tlačítkem **Obnovit
  poštu** a jednou za minutu, pokud je okno viditelné.
- Stránka obsahuje maximálně 25 odpovídajících zpráv. Prochází nejvýše 500
  hlaviček na požadavek a nabídne **Načíst další zprávy**, pokud zbývají další.
- Příznak přečtení lze změnit a ukládá se přímo do iCloudu. Samotné otevření
  používá `BODY.PEEK`, takže zprávu automaticky neoznačí jako přečtenou.
- Obsah se zobrazuje jako prostý text; HTML, vzdálené obrázky ani přílohy se
  automaticky nespouštějí. Zprávy nad 5 MB je potřeba otevřít v iCloud Mail.

Nejde o nepřetržitou synchronizaci na pozadí zavřeného prohlížeče. Běžná pošta
zůstává v iCloudu, administrace ji při otevření načítá z aktuálního stavu.

## Psaní, odpovědi a kontakty

**Napsat zprávu** otevře formulář s našeptávačem z kontaktů. V sekci **Klienti**
jsou tlačítka **Napsat e-mail** a **Korespondence**. Filtr kontaktu funguje pro
obě složky. Z detailu zprávy lze uložit nový kontakt nebo otevřít kontakty.
Odpovědi používají Reply-To původní zprávy a hlavičky Message-ID,
In-Reply-To a References pro seskupení vláken v iCloudu.
Rozepsaný text je do uložení jen v paměti otevřené administrace. Tlačítko
**Uložit koncept do iCloudu** uloží novou zprávu do serverové složky Koncepty
s příznakem Draft. Potom ji lze otevřít a odeslat v iCloud Mail. Další úpravy
uloženého konceptu prováděj v iCloudu; webový formulář se po uložení vyprázdní.

## Bezpečné odeslání a kopie

Před SMTP se založí jedinečný záznam v `mail_outbox`. Stejné ID nemůže spustit
druhé odeslání. Po potvrzení SMTP 250 je zpráva odeslaná; chyba při ukládání
kopie už nikdy nezpůsobí druhé odeslání.

Kopie se přidá do iCloud Odeslaných přes IMAP APPEND. Když se uložení kopie
nezdaří, MIME zdroj zůstane dočasně v chráněném outboxu a lze použít
**Synchronizovat odeslané kopie**. Tato operace kontroluje Message-ID a pouze
doplňuje kopie, neposílá žádný nový e-mail. Po úspěchu se dočasný zdroj smaže.
Přehled administrace načítá jen metadata, nikoli MIME zdroje.

Při přerušení spojení po SMTP DATA zůstane stav **Ověřit odeslání**; před
jakýmkoliv opakováním je potřeba ověřit Odeslané a doručení. Při jednoznačném
odmítnutí je stav **Neodesláno**. Přijetí poštovním serverem nepotvrzuje doručení
adresátovi. Automatické testy skutečné zprávy neposílají.

## Oprávnění a provoz

Veškerá uživatelská API vyžadují účet správce a MFA. Kontrola adresy se provádí
na serveru pro seznam, detail i změnu přečtení. Cesty složek, SMTP host ani
port se nepřebírají z uživatelského požadavku.

Nasazení vytváří oddělené `MAIL_DEPLOY_CHECK_SECRET` jen pro kontrolu pevných
poštovních transportů. Tento endpoint vrací pouze booleany TLS, přihlášení a
nalezení složek; nevrací poštu ani hesla. Diagnostický klíč nedává přístup
k uživatelskému mail API a při dalším nasazení se obmění.

Starší explicitní varianta `MAIL_DELIVERY_PROVIDER=resend` a `MAIL_PROVIDER=forpsi`
zůstává zachována pro existující konfigurace. Pro aktuální iCloud klient tyto
přepínače nenastavuj.

Pro relay patří do Supabase pouze `MAIL_RELAY_URL` a `MAIL_RELAY_SECRET`.
`ICLOUD_SMTP_DIRECT=true` je experimentální explicitní volba pro prostředí,
kde funguje 465; v aktuálním projektu ji nepoužívej.
