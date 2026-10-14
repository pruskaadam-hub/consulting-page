# Adam Pruška — Mentoring & Consulting

Responzivní česká landing page s informacemi a fotografiemi z původního Wix webu,
vloženým Calendly a nasazením přes GitHub Pages. React, TypeScript a Vite.

## Vývoj

Node.js >=22.12 (ověřeno s Node.js 24).

```sh
cd /workspace/consulting-page
npm ci --cache /workspace/.cache/npm
npm run dev -- --port 5173
```

`npm run build` provede kontrolu typů a produkční sestavení do `dist/`.
Relativní cesty fungují v podadresáři GitHub Pages i při lokálním spuštění.
`npm test` ověří veřejné odkazy Calendly a parametry vloženého kalendáře.

## Rezervační kalendář

Do `.env.local` nebo prostředí nastavte:

```dotenv
VITE_CALENDLY_URL=https://calendly.com/pruskaadam/consulting-hour
```

Veřejný odkaz dodal vlastník v chatu. Stejný odkaz je nastaven v GitHub Actions.
Po změně proměnné restartujte vývojový server; na produkci musí být nastavena
při sestavení. `.env.local` je ignorován Gitem. Nepřidávejte API klíče do veřejných
proměnných `VITE_`.

Kalendář se načítá až po kliknutí návštěvníka; existuje i přímý odkaz pro případ
problémů s vložením. Dostupnost, délku, podmínky schůzky a potvrzení spravuje
Calendly. Stránka neodesílá vlastní rezervační formulář a neslibuje vymyšlené
termíny. Nevytvářejte rezervace v účtu při běžném testování.

## Obsah

Zdroje a původ fotografií jsou zdokumentovány v [docs/content-sources.md](docs/content-sources.md).
Logo a fotografie jsou uložené lokálně v `public/images/`.
Žádná ilustrační fotografie není prezentována jako portrét Adama.

## GitHub Pages

Workflow `.github/workflows/pages.yml` ověří testy, sestaví stránku a publikuje
`dist/` při každém pushi do `main`. GitHub Actions jsou připnuté na konkrétní SHA.

V nastavení repozitáře **Settings → Pages → Source** má být **GitHub Actions**.
Workflow lze spustit znovu přes **Actions → Deploy landing page to GitHub Pages →
Run workflow**. Nezapínejte vlastní doménu bez požadavku vlastníka.

Očekávaná adresa: https://pruskaadam-hub.github.io/consulting-page/.
Samotný push ani úspěšný build nejsou důkazem publikace; ověřte dokončený
deploy a funkční veřejnou adresu.

## Cloudové prostředí

Používejte existující checkout. Každá cloudová úloha je izolovaná, není třeba
vytvářet další Git worktree. Instalace používá lockfile (`npm ci`), proces Vite
je třeba po obnovení prostředí spustit znovu. Lokální náhled v onboarding UI
nenahrazuje veřejné nasazení webu.
