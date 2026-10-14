import { PRICES, STUDENT_PRICES, currencyLabel } from './pricing.mjs';
import { CONTACT_EMAIL } from './site-config.mjs';
export type ServiceId = 'intro' | 'individual' | 'package';
export type Testimonial = { quote: string; name: string; initials: string; context: string; result?: string; photo?: string; linkedIn?: string; sourceUrl?: string };
export type Service = {
  id: ServiceId; title: string; minutes: number; price: number;
  studentPrice?: number; studentDiscount?: number; label: string; description: string; features: string[]; calSlug: string;
};

// Facts: original Wix website + the owner's instructions. See docs/content-sources.md.
export const services: Service[] = [
  {
    id: 'intro', title: 'Nezávazná konzultace', minutes: 30, price: 0,
    label: 'Zdarma a bez závazku', description: 'Zjistíme, s čím přesně ti mohu pomoci a jestli si vzájemně sedíme. Žádný závazek, žádné podmínky.',
    features: ['30 minut online', 'Prostor pro tvoje otázky', 'Společně zhodnotíme další krok'],
    calSlug: import.meta.env.VITE_CAL_INTRO_SLUG || '',
  },
  {
    id: 'individual', title: 'Individuální konzultace', minutes: 50, price: PRICES.individual, studentPrice: STUDENT_PRICES.individual, studentDiscount: PRICES.studentIndividualDiscount,
    label: 'Tvůj konkrétní cíl', description: 'Osobní konzultace zaměřená na tvůj konkrétní cíl v kariéře, studiu, podnikání nebo expanzi do Švýcarska.',
    features: ['50 minut online', 'Individuální přístup', 'Odejdeš s konkrétním plánem dalších kroků'],
    calSlug: import.meta.env.VITE_CAL_INDIVIDUAL_SLUG || '',
  },
  {
    id: 'package', title: 'Balíček 3 konzultací', minutes: 50, price: PRICES.package, studentPrice: STUDENT_PRICES.package, studentDiscount: PRICES.studentPackageDiscount,
    label: 'Sleva 25 %', description: 'Pro témata, která potřebují více prostoru a průběžnou spolupráci.',
    features: ['3 × 50 minut', 'Úspora 1 350 Kč oproti třem konzultacím', 'Jedna konzultace osobně na místě dle tvé volby', 'Odejdeš s konkrétním plánem dalších kroků'],
    calSlug: import.meta.env.VITE_CAL_PACKAGE_SLUG || '',
  },
];

export const content = {
  brand: 'Adam Pruška',
  sourceUrl: 'https://pruskaadam4.wixstudio.com/pruska',
  calUsername: import.meta.env.VITE_CAL_USERNAME || 'adam-pruska',
  phone: '+420 735 891 769',
  email: CONTACT_EMAIL,
  linkedIn: 'https://www.linkedin.com/in/adam-pruska/',
  help: [
    { icon: 'study', title: 'Chceš studovat v zahraničí', text: 'Vybereme univerzitu a výzkumnou skupinu pro Bc., Mgr. nebo PhD. Připravím tě na přijímací pohovor a pomůžu ti zorientovat se ve švýcarských grantech a stipendiích.', tags: ['Výběr univerzity', 'Přijímací pohovor', 'Granty & stipendia'], cta: 'Chci studovat v zahraničí' },
    { icon: 'career', title: 'Hledáš práci nebo nové kontakty', text: 'Akademie, nebo průmysl? Společně nastavíme kariérní strategii a připravíme pohovor. Probereme švýcarskou mentalitu i firemní kulturu a propojím tě s česko-slovenskou komunitou v CH.', tags: ['Kariérní strategie', 'Síť kontaktů', 'Příprava na pohovor'], cta: 'Chci najít správnou práci' },
    { icon: 'business', title: 'Máte firmu nebo projekt', text: 'Pomohu vám s analýzou trhu a kontakty v soukromé i státní sféře. Projdeme business strategii, rizika i možnosti financování vašeho projektu.', tags: ['Analýza trhu', 'Swiss kontakty', 'Business strategie'], cta: 'Chceme expandovat do CH' },
  ],
  process: [
    { title: 'Nezávazná schůzka zdarma', text: 'Zavolej nebo napiš. Zdarma zjistíme, s čím přesně ti mohu pomoci a jestli si vzájemně sedíme. Žádné skryté podmínky, žádný tlak.' },
    { title: 'Nastavíme plán', text: 'Definujeme tvůj cíl a připravíme konkrétní kroky. Každý plán přizpůsobíme tvé kariéře, studiu nebo podnikání.' },
    { title: 'Jedeme', text: 'Pracujeme společně online, v Praze nebo Brně. Průběžně ladíme postup podle toho, jak se věci vyvíjí. Jsem dostupný i mezi konzultacemi.' },
  ],
  testimonials: [
    { initials: 'MP', name: 'Michaela P.', context: 'Hledala práci v Zurichu', quote: 'Adam nám přiblížil, jak to ve Švýcarsku chodí a otevřel oči, že hledat práci z Česka nebude úplně možné. Už první CV upravené podle jeho rad mi pomohlo dostat se přes první kolo pohovorů.' },
    { initials: 'MČ', name: 'Marie Č.', context: 'Kariéra v korporátním sektoru CH', quote: 'Nikdy jsem nevěděla, že i takové drobnosti jako je doba příchodu hrají takovou roli. Díky Adame. Chodit pozdě se nemá a chodit příliš brzy je tlak na toho druhého.' },
    { initials: 'KM', name: 'Karel M.', context: 'Expanze firmy do Švýcarska', quote: 'Naše firma hledala způsob, jak se spojit s lidmi ve Švýcarsku. Adamovy kontakty nám ušetřily měsíce práce a spoustu peněz. Na první emaily jsme dostali odpověď.' },
  ] as Testimonial[],
  faq: [
    { question: 'Jak se platí?', answer: '' },
    { question: 'Je první konzultace opravdu zdarma?', answer: 'Ano. Úvodní online setkání trvá 30 minut a je nezávazné. Probereme tvou situaci a zjistíme, zda spolupráce dává smysl.' },
    { question: 'Musím mít konkrétní plán nebo otázku?', answer: 'Nemusíš mít hotový plán. Pomůže, když si předem promyslíš, kde se právě nacházíš a co bys chtěl nebo chtěla posunout.' },
    { question: 'Jak probíhá individuální konzultace?', answer: 'Individuální online konzultace trvá 50 minut a stojí 1 800 Kč. Je věnovaná konkrétnímu tématu, které potřebuješ probrat.' },
    { question: 'Máš slevu pro studenty? A můžeme se potkat osobně?', answer: `Bc. a Mgr. studenti mají individuální konzultaci o 28 % levnější, tedy za ${currencyLabel(STUDENT_PRICES.individual)}. Balíček je pro studenty o 35 % levnější, za ${currencyLabel(STUDENT_PRICES.package)}. Osobní setkání v Praze nebo Brně je možné po předchozí domluvě.` },
    { question: 'Co obsahuje balíček tří konzultací?', answer: 'Balíček obsahuje tři konzultace po 50 minutách za 4 050 Kč, tedy o 25 % méně než tři jednotlivé konzultace. Jedna se uskuteční osobně na místě dle tvé volby. Místo a praktické podmínky osobního setkání domluvíme předem. V kalendáři vybíráš termín prvního setkání; další dva domluvíme společně.' },
    { question: 'Co když potřebuji změnit termín?', answer: `Možnosti změny nebo zrušení termínu najdeš v potvrzení rezervace. Pokud si nejsi jistý nebo jistá, napiš mi přes kontaktní sekci.` },
  ],
};
