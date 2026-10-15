# Ruční fakturace a náhled

Podklad: [Fakturoid: náležitosti faktury](https://www.fakturoid.cz/almanach/zacatky-podnikani/nalezitosti-faktury),
aktualizace článku 4. 8. 2026. Celý text dodal vlastník v příloze 15. 10. 2026;
přímý přístup k webu Fakturoid je z prostředí blokovaný. Použity jsou informace
o fakturačních údajích, nikoli marketingové pokyny k registraci v této službě.

## Údaje a kontrola

| Oblast | Co se zadává nebo vytváří |
| --- | --- |
| Dodavatel | Právní jméno či název, sídlo včetně země, české IČO, skutečný údaj o zápisu v rejstříku nebo evidenci |
| Soukromý odběratel | Jméno, příjmení, úplná fakturační adresa, země |
| Firma nebo podnikatel | Právní název, adresa, země a identifikátor; u českého podnikatele osmimístné IČO. Jméno a příjmení kontaktní osoby jsou volitelné. |
| Kontakt | E-mail pro evidenci klientů, volitelný web. Web ani logo nejsou povinnou fakturační náležitostí. |
| Plátcovství | DIČ dodavatele, pokud je plátce; DIČ odběratele, pokud označíme jeho plátcovství |
| Doklad | Označení Faktura, pořadové číslo přidělené až při vystavení, datum vystavení, název a popis služby, množství 1, cena v Kč |
| Termíny | Zvolená splatnost; datum poskytnutí služby, u plátce datum plnění nebo přijetí platby podle toho, které nastalo dříve |
| Daňový doklad | Označení pro plátce, základ daně, sazba a výše daně v Kč na dvě desetinná místa |
| Nulová sazba u plátce | Vyžaduje vysvětlení a právní ustanovení pro konkrétní režim, uložené na daném dokladu |
| Platba | Bankovní účet nebo IBAN a variabilní symbol shodný s číslem faktury |

Splatnost a bankovní údaje jsou užitečné pro platbu, nejsou univerzálními
zákonnými náležitostmi každého dokladu. Podpis ani razítko nevytváříme.
Náhled není vystavený účetní doklad a nemá předem přidělené skutečné číslo.

Výpočty jsou v celých haléřích. Cena je konečná a pro plátce se základ a daň
rozloží ze zadané celkové ceny. Částka převodem se nezaokrouhluje na celé Kč.
Podporujeme jednu službu na doklad, měnu CZK a ručně zvolenou sazbu 0, 12 nebo
21 procent. Systém neurčuje místo plnění, zvláštní zahraniční režimy ani
povinnost registrace podle země klienta. Zvolená země sama sazbu nezmění.

## Editor a uložení

Ve Fakturách lze zvolit uloženého klienta nebo ručně zadat nového. Údaje
vybraného klienta jsou upravitelné; při vystavení se aktualizuje také kontakt.
Nový e-mail musí být jedinečný. Při shodě formulář vyzve k výběru existujícího
kontaktu místo jeho tichého přepsání. Volný popis, web a kontaktní údaje se
vykreslují jako text, bez spouštění HTML či vzdáleného obsahu.

Náhled průběžně používá hodnoty z formuláře včetně údajů dodavatele, loga,
barvy, plátcovství a ceny. Logo může být značka ap. používaná na současném
webu, původní dodané logo z `public/images/logo.jpg`, nebo jen název značky.
Firemní údaje a vzhled lze vyplnit také v Nastavení. Skutečnou registraci,
IČO a sídlo dodavatele nikdy nevymýšlíme.

RPC `issue_invoice_draft` vyžaduje vlastníka a MFA. V jedné transakci uloží
klienta, firemní nastavení, objednávku a fakturu. Chyba vrátí všechny změny.
Request UUID a soukromá tabulka `invoice_requests` zamezují duplikaci při
opakování stejného požadavku. Existující objednávka musí patřit uvedenému
klientovi a nesmí už mít fakturu. Její cenu přebíráme z databáze.

Vystavený doklad obsahuje neměnnou kopii tehdejších údajů klienta, dodavatele,
vzhledu a služby. Pozdější editace kontaktu nebo nastavení nepřepíše starou
fakturu. Nové povinné registrační údaje se doplní pro nové doklady; do starých
záznamů zpětně nevkládáme vymyšlené údaje. Tisk/PDF používá stejný
komponent jako náhled, ale tiskne jen vystavenou fakturu.
