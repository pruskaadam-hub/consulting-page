# Nový blog a zbývající podklady

## Vytvořené články

| Zdrojový soubor | Veřejná adresa |
| --- | --- |
| `src/blog/email-profesorovi-eth.md` | `/consulting-page/blog/email-profesorovi-eth/` |
| `src/blog/svycarske-cv.md` | `/consulting-page/blog/svycarske-cv/` |
| `src/blog/prace-ve-svycarsku-entry-point.md` | `/consulting-page/blog/prace-ve-svycarsku-entry-point/` |
| `src/blog/akademie-nebo-prumysl.md` | `/consulting-page/blog/akademie-nebo-prumysl/` |
| `src/blog/ceska-firma-ve-svycarsku.md` | `/consulting-page/blog/ceska-firma-ve-svycarsku/` |

Přehled: `/consulting-page/blog/`. Přehled i nové články mají také vstupy
v `/sk/blog/` a `/en/blog/`; jazykový přepínač mění rozhraní a zachová článek.
Dodané nové články jsou české a mají `lang="cs"`. Jejich překlady nebyly součástí
nových podkladů. Původní dvě přeložené stránky `/clanky/` zůstávají dostupné.

Meta popisy nejsou součástí viditelného těla článků. Používají se v metadatech
stránek a jako perex na kartách. Každý nový článek má Article JSON-LD,
autora Adama Prušku a dvě související položky z dodané sady. Datum nebylo
vymyšlené. Sitemap obsahuje všech 27 adres.

Na hlavní stránce je pět nových karet a odkaz na přehled. CTA z těla článků
vede na hlavní stránku, `#rezervace` nebo `#firmy`. V článku o CV je zmínka
o entry pointech skutečným interním odkazem. Zachované texty byly pouze
upravené v používání dlouhých pomlček dle následného souhlasu vlastníka.

## Další nově vytvořené soubory

* `src/blog/metadata.json`: titulky, meta popisy, slugs, obrázky a související články.
* `src/blog/render.mjs`: bezpečné Markdown zobrazení, interní CTA, TODO komentáře a JSON-LD.
* `src/blog-posts.mjs`: načtení článkových podkladů do webu.
* `src/pricing.mjs`: jednotný výpočet studentských cen a měnový formát s haléři.
* `tests/blog-pricing.test.mjs`: ceny, bezpečné odkazy, TODO, metadata a blogové adresy.
* `docs/blog-publication.md`: tento přehled.

HTML vstupy se generují při sestavení, nikoli ručně: `dist/blog/index.html`,
pět `dist/blog/<slug>/index.html` a jejich jazykové vstupy. Obsah nových
článků je přítomný také přímo ve statickém HTML. Nezávisí pouze na načtení
JavaScriptu. Assety, SEO a sitemap se generují z jednoho nastavení adresy webu.

## Ponechané TODO v blogu

Každá následující značka má v HTML sousední komentář
`<!-- TODO Adam: ověřit před publikací -->`.

| Značka | Umístění | Co doplnit nebo ověřit |
| --- | --- | --- |
| `[DOPLNIT: datum publikace]` | Karty a záhlaví každého z pěti nových článků | Skutečná data publikace. |
| `[ověřit u konkrétního inzerátu]` | `src/blog/svycarske-cv.md`, sekce dossier | Zda konkrétní přihláška vyžaduje celé dossier a reference. |
| `[ověřit aktuální pravidla a lhůty na webu SEM / kantonu]` | `src/blog/prace-ve-svycarsku-entry-point.md`, sekce osobní návštěvy | Aktuální podmínky pobytu při hledání práce. |

Neznámá data publikace nejsou předávaná jako neplatné řetězce do JSON-LD.

## Dřívější TODO, která zůstávají na webu

* `[DOPLNIT: cena / podmínky]`: výrazný blok praktických služeb, úprava CV a dokumentů.
* `[DOPLNIT: předem přes Cal.com / převodem na fakturu]`: platební informace a FAQ.
* `[DOPLNIT: konkrétní výsledek]`: všechny tři reference.
* `[DOPLNIT: počet]`: počet klientů a počet úspěšných přihlášek nad referencemi.
* Marie Č.: nahradit referencí s měřitelným výsledkem.
* Původní kulturní článek na Wixu: opravit slug `kopie-jak-na-doktorát…`; zdrojový odkaz zatím zůstává.

Studentská cena balíčku už není TODO. Individuální konzultace pro studenty
stojí 1 296 Kč po slevě 28 % z 1 800 Kč. Balíček pro studenty stojí
2 632,50 Kč po slevě 35 % z běžné ceny balíčku 4 050 Kč.

## Ověření

17 jednotkových testů a prohlížečové kontroly 27 stránek na 375 a 1280 px.
Kontrolují se HTML, konzole, ceny, všechny konzultační CTA, celé karty a Enter,
blogové odkazy, JSON-LD, skrytý kalendář i stavy potvrzení. Testy Cal.com používají
pouze testovací odpovědi. Živé nasazovací ověření pouze čte dostupnost a CORS.
