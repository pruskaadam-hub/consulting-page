# Struktura zaměřená na rezervaci

Primární akce: **Rezervovat 30 minut zdarma**. Stejný cíl v hero, po scrollu
ve sticky liště a na konci hlavního obsahu. Zájemce nemusí nejprve vybírat
mezi třemi placenými alternativami.

Aktuální pořadí a důvod:

1. Hero: konkrétní situace (ETH, práce v Curychu, business v CH) a bezplatný úvod.
2. Lišta zkušeností: Švýcarsko, ETH, tři pracovní prostředí a první setkání zdarma.
3. Jedna sloučená sekce pomoci: studium, kariéra, firmy/projekty; témata původních
   šesti bodů jsou rozpuštěná do těchto tří karet.
4. Medailonek se zkušenostmi s konzultacemi pro absolventy i profesionály.
5. Reference s podporou výsledku, role, celé identity a fotografie. Neznámé údaje
   jsou viditelně označené k doplnění; počty nejsou vymyšlené.
6. Tři kroky spolupráce začínající bezplatným rozhovorem.
7. Firemní vstup s vykáním a individuální poptávkou; nevede do osobního kalendáře.
8. Nabídky a rozbalovací kalendář, který je skrytý do interakce. Úvod je předvolený.
9. Články jako důkaz odbornosti před FAQ, s vlastními podstránkami.
10. FAQ včetně plateb; neznámé podmínky označené k doplnění.
11. Závěrečná výzva ke stejnému úvodnímu setkání.
12. Kontakty a LinkedIn jako přirozená alternativa k okamžité rezervaci.
13. Adam v médiích: všech deset přesných odkazů dodaných vlastníkem.

Medailonek a reference jsou posunuté před rezervace. Původní dvě sekce
„rezervace“ a „vyber si konzultaci“ jsou propojené; opakované seznamy nabídek
zvyšují počet rozhodnutí. Doplňuje se FAQ. Tato struktura je hypotéza pro
lepší srozumitelnost a menší tření, nikoli zaručené zvýšení počtu rezervací.

## Práce s chybějícím obsahem

Na dostupných stránkách původního Wix webu a v RSS byly nalezeny dva skutečné
články, e-mail a LinkedIn. Tři reference, vlastní portréty a rozšířené texty
později dodal vlastník přímo v chatu. Reference se nyní zobrazují před
rezervací. Vlastník později dodal deset mediálních odkazů; jsou v závěrečné sekci.

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

## Předání záměru a kvalifikace

Studijní a kariérní karty předvyplní téma v kalendáři. Úvod vyžaduje situaci
klienta a časový horizont; financování je volitelné pouze při studiu.
Odpovědi se předávají v poznámce, identifikátor tématu také v metadatech.
Cal.com se načítá teprve po otevření rezervace. Přesný seznam otázek,
značek k doplnění, jazykových adres a postup pro doménu viz
[owner-handoff.md](owner-handoff.md).
