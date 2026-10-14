# Struktura zaměřená na rezervaci

Primární akce: **Rezervovat 30 minut zdarma**. Stejný cíl v hero, po scrollu
ve sticky liště a na konci hlavního obsahu. Zájemce nemusí nejprve vybírat
mezi třemi placenými alternativami.

Doporučené pořadí a důvod:

1. Hero: komu Adam pomáhá, s čím a jasná nabídka nezávazného úvodního setkání.
2. Lišta zkušeností: 7+ let ve Švýcarsku, ETH Zürich, akademie/startupy/korporát,
   první konzultace zdarma. Údaje dodané vlastníkem v tomto zadání.
3. S čím můžu pomoct: konkrétní situace návštěvníka, nikoli obecný výčet dovedností.
4. Co můžeš čekat: šest oblastí od kariéry a kontaktů po kulturu a vlastní projekt.
5. Krátký medailonek: člověk, kterému návštěvník svěří svou situaci, ještě před cenami.
6. Skutečné reference, pokud jsou dostupné: důvěra před rozhodnutím o rezervaci.
7. Jak to funguje: tři srozumitelné kroky, počínaje nezávazným rozhovorem.
8. Nabídka tří konzultací a **jeden** rezervační kalendář. Výběr nabídky mění
   událost v témže kalendáři. Úvodní konzultace je předvolená.
9. FAQ: zdarma/bez závazku, příprava, formát, balíček, změna termínu.
10. Krátká závěrečná výzva, která vede ke stejnému kalendáři; neopakovat celou nabídku.
11. Blog a ověřené zmínky v médiích jako sekundární cesta pro návštěvníky,
    kteří se ještě nerozhodli. Blogové odkazy otevírat mimo hlavní rezervační tok.

Medailonek a reference jsou posunuté před rezervace. Původní dvě sekce
„rezervace“ a „vyber si konzultaci“ jsou propojené; opakované seznamy nabídek
zvyšují počet rozhodnutí. Doplňuje se FAQ. Tato struktura je hypotéza pro
lepší srozumitelnost a menší tření, nikoli zaručené zvýšení počtu rezervací.

## Práce s chybějícím obsahem

Na dostupných stránkách původního Wix webu a v RSS byly nalezeny dva skutečné
články, e-mail a LinkedIn. Tři reference, vlastní portréty a rozšířené texty
později dodal vlastník přímo v chatu. Reference se nyní zobrazují před
rezervací. Mediální zmínky zůstávají připravené pro konkrétní odkazy.

Balíček: 3 × 1 800 Kč = 5 400 Kč; sleva 25 % = 1 350 Kč; výsledná cena
4 050 Kč. Délka 50 minut vychází z individuální konzultace. Jedno osobní
setkání je součástí požadavku vlastníka. Rozsah dopravy a geografické
podmínky ještě nejsou stanovené; nejsou přidávané neověřené příplatky.

## Rezervace

Vlastník zvolil Cal.com, profil https://cal.com/adam-pruska, s již připojenými
kalendáři. Rozhraní má být vlastní, nikoli iframe s cizím layoutem. Dostupnost,
kolize a potvrzení musí pocházet z Cal.com. Konec procesu nesmí oznámit
potvrzenou rezervaci pouze na základě lokálního formuláře.

Vlastník dodal dvě veřejné události: nezavazna-konzultace a soukroma-konzultace.
Balíček používá druhou událost pro první 50minutové setkání; volba balíčku a
cena nabídky jsou explicitně v poznámce a metadatech rezervace. Nedochází k
automatické úhradě ani k rezervaci všech tří termínů. Dostupnost se ověřuje
podle správné délky každého typu. Rozdílné nabídky nelze mapovat na typ s jinou délkou.
API klíč patří na server, nikdy do veřejného JavaScriptu nebo VITE_ proměnné.
Pokud vybrané veřejné API podporuje anonymní rezervace, použít jeho dokumentovaný
veřejný tok. Při chybě spojení zobrazit jasný stav a možnost kontaktovat Adama,
nikoli vymyšlené termíny. Chráněný firemní Outlook je nutné spravovat podle
možností a pravidel jeho vlastníka; samotné připojení jiných účtů není důkazem
kontroly všech kolizí.
