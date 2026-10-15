# Připojení adampruska.cz přes FORPSI

Vlastník potvrdil doménu a poskytovatele 15. 10. 2026. Kód webu je připravený
pro `https://adampruska.cz/`; změny DNS ani nastavení účtu GitHub nejsou
součástí samotného nasazení kódu. Aktivace a HTTPS čekají na kroky níže.

## 1. GitHub Pages

Otevřete https://github.com/pruskaadam-hub/consulting-page/settings/pages.
V poli **Custom domain** uložte `adampruska.cz`, bez protokolu a bez cesty.
Source zůstává **GitHub Actions**. Kontrola DNS může před následujícím krokem
hlásit chybu. Tento repozitář publikuje přes Actions; soubor `CNAME` sám
o sobě nastavení domény v účtu nezapne a není pro tento způsob nasazení nutný.

## 2. DNS ve FORPSI

Přihlaste se na https://admin.forpsi.com, vyberte doménu `adampruska.cz`
a otevřete správu DNS záznamů. Cílové záznamy:

| Typ | Úplný název | Hodnota | TTL |
| --- | --- | --- | --- |
| A | adampruska.cz | 185.199.108.153 | 3600 |
| A | adampruska.cz | 185.199.109.153 | 3600 |
| A | adampruska.cz | 185.199.110.153 | 3600 |
| A | adampruska.cz | 185.199.111.153 | 3600 |
| CNAME | www.adampruska.cz | pruskaadam-hub.github.io | 3600 |

Jestli formulář sám doplňuje `.adampruska.cz`, do názvu pro kořen domény
nepište celou doménu znovu; použijte prázdný název podle formuláře. Pro
`www.adampruska.cz` pak vyplňte pouze `www`. Podstatný je výsledný úplný název.
Pokud výchozí TTL formuláře nelze měnit, ponechte jeho výchozí hodnotu.

Nahraďte předchozí záznamy A pro kořen domény a předchozí záznam pro `www`,
které míří na jiný web. Případné AAAA záznamy pro tyto stejné webové adresy
musí také mířit na GitHub Pages, nebo je při přechodu odstraňte. Záznamy MX,
TXT a jiné názvy pro poštu či ověřování při změně webu nemažte. Do cíle CNAME
nepatří `https://` ani `/consulting-page/`.

Pokud FORPSI pouze eviduje registraci a doména používá DNS jiného správce,
provedou se záznamy u něj. Neměňte naslepo nameservery kvůli připojení webu.

## 3. HTTPS a kontrola

Počkejte na rozšíření DNS a vystavení certifikátu GitHubem. DNS se může
aktualizovat až 24 hodin; certifikát může být dostupný později. V nastavení
Pages zapněte **Enforce HTTPS**, jakmile je volba dostupná.

Ověřte `https://adampruska.cz/`, přesměrování z `www`, jazykové vstupy `/sk/`
a `/en/`, přímou adresu blogového článku a načtení termínů po otevření
rezervace. Testovací kontrola dostupnosti nevyžaduje vytvoření skutečné rezervace.

## Nastavení projektu

`src/site-config.mjs` používá tuto doménu pro canonical, Open Graph,
alternativní jazyky, Article JSON-LD, sitemap a robots.txt. Produkční CORS
kontrola Cal.com používá stejný původ. Assety používají relativní cesty.

Pro ověření původní projektové adresy lze při sestavení nastavit
`VITE_SITE_URL=https://pruskaadam-hub.github.io/consulting-page/`. Při tomtéž
nastavení se spouštějí i UI testy. Veřejná build proměnná nepřepisuje DNS ani
Custom domain v účtu GitHub.

Úspěšný build nebo deploy dokládá zveřejnění souborů, nikoli dokončení DNS,
vystavení certifikátu či dostupnost domény. Tyto kroky je třeba ověřit zvlášť.
