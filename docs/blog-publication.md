# Nový blog a zbývající podklady

## Vytvořené články

| Zdrojový soubor | Veřejná adresa |
| --- | --- |
| `src/blog/email-profesorovi-eth.md` | `/consulting-page/blog/email-profesorovi-eth/` |
| `src/blog/svycarske-cv.md` | `/consulting-page/blog/svycarske-cv/` |
| `src/blog/prace-ve-svycarsku-entry-point.md` | `/consulting-page/blog/prace-ve-svycarsku-entry-point/` |
| `src/blog/akademie-nebo-prumysl.md` | `/consulting-page/blog/akademie-nebo-prumysl/` |
| `src/blog/ceska-firma-ve-svycarsku.md` | `/consulting-page/blog/ceska-firma-ve-svycarsku/` |
| `src/blog/kontakty-pres-komunitu.md` | `/consulting-page/blog/kontakty-pres-komunitu/` |
| `src/blog/firma-kontakty-pres-komunitu.md` | `/consulting-page/blog/firma-kontakty-pres-komunitu/` |

Přehled: `/consulting-page/blog/`. Přehled i nové články mají také vstupy
v `/sk/blog/` a `/en/blog/`; jazykový přepínač mění rozhraní a zachová článek.
Dodané nové články jsou české a mají `lang="cs"`. Jejich překlady nebyly součástí
nových podkladů. Původní dvě přeložené stránky `/clanky/` zůstávají dostupné.

Meta popisy nejsou součástí viditelného těla článků. Používají se v metadatech
stránek a jako perex na kartách. Každý nový článek má Article JSON-LD,
autora Adama Prušku a dvě související položky z dodané sady. Datum nebylo
vymyšlené. Sitemap obsahuje všech 33 adres.

Na hlavní stránce je sedm nových karet a odkaz na přehled. CTA z těla článků
vede na hlavní stránku, `#rezervace` nebo `#firmy`. V článku o CV je zmínka
o entry pointech skutečným interním odkazem. Texty vycházejí z nejnovější přílohy, mají opravené zjevné překlepy
a používají rozsahy bez dlouhých pomlček dle následného souhlasu vlastníka.

## Další nově vytvořené soubory

* `src/blog/metadata.json`: titulky, meta popisy, slugs, obrázky a související články.
* `src/blog/render.mjs`: bezpečné Markdown zobrazení, interní CTA, TODO komentáře a JSON-LD.
* `src/blog-posts.mjs`: načtení článkových podkladů do webu.
* `src/pricing.mjs`: pevné ceny, odvozené slevy a lokalizovaný měnový formát.
* `tests/blog-pricing.test.mjs`: ceny, bezpečné odkazy, TODO, metadata a blogové adresy.
* `docs/blog-publication.md`: tento přehled.

HTML vstupy se generují při sestavení, nikoli ručně: `dist/blog/index.html`,
sedm `dist/blog/<slug>/index.html` a jejich jazykové vstupy. Obsah nových
článků je přítomný také přímo ve statickém HTML. Nezávisí pouze na načtení
JavaScriptu. Assety, SEO a sitemap se generují z jednoho nastavení adresy webu.

## Ponechané TODO v blogu

Každá následující značka má v HTML sousední komentář
`<!-- TODO Adam: ověřit před publikací -->`.

| Značka | Umístění | Co doplnit nebo ověřit |
| --- | --- | --- |
| `[DOPLNIT: datum publikace]` | Karty a záhlaví každého ze sedmi nových článků | Skutečná data publikace. |

Neznámá data publikace nejsou předávaná jako neplatné řetězce do JSON-LD.

## Dřívější TODO, která zůstávají na webu

* `[DOPLNIT: cena / podmínky]`: výrazný blok praktických služeb, úprava CV a dokumentů.
* `[DOPLNIT: předem přes Cal.com / převodem na fakturu]`: platební informace a FAQ.
* `[DOPLNIT: konkrétní výsledek]`: všechny tři reference.
* `[DOPLNIT: počet]`: počet klientů a počet úspěšných přihlášek nad referencemi.
* Marie Č.: nahradit referencí s měřitelným výsledkem.
* Původní kulturní článek na Wixu: opravit slug `kopie-jak-na-doktorát…`; zdrojový odkaz zatím zůstává.

Studentská cena balíčku už není TODO. Individuální konzultace pro studenty
stojí 1 500 Kč (sleva 16,7 % z 1 800 Kč). Balíček pro studenty stojí
3 500 Kč (sleva 22,2 % z běžného balíčku 4 500 Kč). Běžný balíček šetří
900 Kč, tedy 16,7 % oproti třem jednotlivým konzultacím za 5 400 Kč.

## Ověření

18 jednotkových testů a prohlížečové kontroly 33 stránek na 375 a 1280 px.
Kontrolují se HTML, konzole, ceny, všechny konzultační CTA, celé karty a Enter,
blogové odkazy, JSON-LD, skrytý kalendář i stavy potvrzení. Testy Cal.com používají
pouze testovací odpovědi. Živé nasazovací ověření pouze čte dostupnost a CORS.

## Aktualizace podle přílohy `clanky-pro-codex.md`

Aktualizováno všech pět původních Markdown souborů, přidány dva komunitní
články uvedené v tabulce. CV má nově devět bodů. Oba komunitní články mají
vzájemný odkaz s rozlišením jednotlivců a firem. Firemní CTA vede na `#firmy`.
Vzorový e-mail má tlačítko Kopírovat; checklist má neaktivní zaškrtávací políčka.
Tabulky lze na malém displeji posouvat i ovládat klávesnicí. Opravené jsou
zjevné překlepy; rozsahy se stále píší slovem „až“ podle předchozího zadání.
Nová příloha neobsahuje dřívější dvě značky ověření v těle článků. Zbylé TODO
jsou všechna uvedená výše; data publikace nebyla vymyšlená. Zdroje nebyly
v rámci této redakční úpravy nezávisle ověřované.

HTML kontrola dovoluje titulky do 90 znaků, aby nové dodané názvy zůstaly
v plném znění i ve formátu „Titulek | Adam Pruška“ (nejdelší má 82 znaků).
