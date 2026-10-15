# Firemní pošta přes iCloud+ a Supabase

Cílová adresa je `adam@adampruska.cz`. FORPSI spravuje DNS domény,
GitHub Pages hostuje web, iCloud Mail přijímá poštu a HTTPS API Resend
odesílá zprávy z chráněné administrace. Vlastník potvrdil předplatné iCloud+.
Doména u Applu, ověření Resend a skutečné doručení zatím nejsou ověřené.

## 1. Přidejte doménu do iCloudu

Na https://www.icloud.com/icloudplus/ otevřete **Vlastní e-mailová doména**,
přidejte `adampruska.cz` a vytvořte adresu `adam@adampruska.cz`.
Pokud na doméně dosud žádná schránka neexistovala, při průvodci nepřidávejte
neexistující schránku jako již používanou adresu k ověření.

Do DNS ve FORPSI přeneste přesné názvy a hodnoty MX, TXT a DKIM/CNAME,
které zobrazí Apple. Ověřovací hodnoty jsou konkrétní pro účet; tento návod
je nevymýšlí. Nahraďte případné staré MX záznamy pro stejnou doménu.
Zachovejte A záznamy pro GitHub Pages, CNAME `www` i ověření vlastnictví
domény pro GitHub. Není potřeba měnit nameservery.

Dokončete ověření u Applu. V iCloud Mail ověřte příjem a ruční odeslání
z nové adresy na svou druhou schránku.

## 2. Připojte příjem do administrace

Na https://account.apple.com/ v části přihlášení a zabezpečení vytvořte
**heslo pro konkrétní aplikaci** pro administraci webu. Vyžaduje se
dvoufaktorové zabezpečení Apple účtu. Použijte toto samostatné heslo;
hlavní heslo Apple účtu do aplikace neukládejte.

V [Supabase Edge Functions → Secrets](https://supabase.com/dashboard/project/lsofzsartjesgwetcpzw/functions/secrets)
uložte:

| Name | Value |
| --- | --- |
| `MAIL_PROVIDER` | `icloud` |
| `MAIL_FROM_EMAIL` | `adam@adampruska.cz` |
| `ICLOUD_USERNAME` | Přihlašovací adresa iCloud Mail, například `pruskaadam@me.com` |
| `ICLOUD_APP_PASSWORD` | Nově vytvořené heslo pro konkrétní aplikaci |

Backend se připojí výhradně k `imap.mail.me.com:993` s ověřeným TLS.
iCloud má společnou doručenou poštu, takže administrace může zobrazit
i osobní zprávy pro jiné adresy tohoto účtu. Přístup vyžaduje vlastníka
a dokončené MFA. Přílohy a HTML verze zůstávají v poštovní aplikaci.

## 3. Připojte odesílání přes Resend

Apple uvádí pro SMTP port 587. Hostované Supabase Edge Functions blokují
odchozí porty 25 a 587, proto přímé odesílání přes iCloud SMTP nepoužíváme.
Resend voláme přes HTTPS na `https://api.resend.com/emails`.

1. Založte účet na https://resend.com/ a zkontrolujte aktuální tarif a limity.
2. V Domains přidejte `adampruska.cz` pro odesílání. Vložte do DNS ve FORPSI
   přesně zobrazené záznamy DKIM a SPF/Return-Path. Kořenové MX pro příjem
   ponechte Applu. Příjem přes Resend nezapínejte.
3. Pro jeden název v DNS nesmí být více TXT záznamů začínajících `v=spf1`.
   Záznam Resend pro samostatný název typu `send` je jiný než kořenový SPF
   pro iCloud. Při shodě názvu slučte povolené zdroje do jednoho SPF.
4. Po úspěšném ověření domény vytvořte API klíč s oprávněním **Sending access**,
   omezený na tuto doménu, a uložte ho v Supabase Secrets jako `RESEND_API_KEY`.

Klient uvidí `Adam Pruška <adam@adampruska.cz>`. Reply-To míří na stejnou
adresu a odpovědi díky MX dorazí do iCloudu. Zprávy odeslané přes Resend
se automaticky nekopírují do složky Odeslané v iCloudu. Přehled administrace
eviduje příjemce, předmět, stav a ID; obsah rozepsané zprávy do databáze neukládá.
Poštu přes Resend zpracovává také tento poskytovatel; zohledněte to při
nastavení svého účtu a informování klientů.

## 4. Nasazení a ověření

Publikování webu z `main` nejprve volá workflow **Deploy Supabase backend**.
Stejné workflow lze spustit ručně v Actions. Používá existující GitHub Secret
`SUPABASE_ACCESS_TOKEN`. Nastavení schránky a Resend patří do Supabase Secrets,
ne do GitHub proměnných pro veřejné sestavení a ne do chatu.

V administraci zkontrolujte samostatné stavy **Příjem pošty** a **Odesílání
pošty**. „Nastaveno“ znamená přítomnost konfigurace, nikoli ověřené přihlášení
nebo doručení. Načtěte zprávy, odešlete jeden test na svou jinou adresu,
zkontrolujte doručení a odpovězte zpět do iCloudu. Automatické testy žádnou
skutečnou zprávu neposílají. Při nejistém výsledku se odeslání neopakuje
automaticky; ověřte ho v Resend a v přehledu odesílání.

## Alternativa FORPSI

Starší připojení zůstává dostupné pouze při `MAIL_PROVIDER=forpsi`
a vyplněných `FORPSI_USERNAME` a `FORPSI_PASSWORD`. Vlastník aktuálně
schránku FORPSI nemá; toto nastavení proto nepoužívejte pro iCloud.

## Zdroje

- [Apple: nastavení serverů iCloud Mail](https://support.apple.com/102525)
- [Apple: hesla pro konkrétní aplikace](https://support.apple.com/102654)
- [Supabase: odesílání přes Resend](https://supabase.com/docs/guides/functions/examples/send-emails)
- [Supabase: omezení Edge Functions](https://supabase.com/docs/guides/functions/limits)
- [Resend: ověření domény](https://resend.com/docs/dashboard/domains/introduction)
