export type ServiceId = 'intro' | 'individual' | 'package';
export type Testimonial = { quote: string; name: string; initials: string; context: string; sourceUrl?: string };
export type MediaItem = { outlet: string; title: string; url: string };
export type Service = {
  id: ServiceId; title: string; minutes: number; price: number;
  label: string; description: string; features: string[]; calSlug: string;
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
    id: 'individual', title: 'Individuální konzultace', minutes: 50, price: 1800,
    label: 'Tvůj konkrétní cíl', description: 'Osobní konzultace zaměřená na tvůj konkrétní cíl — kariéra, studium, business nebo expanze do Švýcarska.',
    features: ['50 minut online', 'Individuální přístup', 'Praktické možnosti dalšího postupu'],
    calSlug: import.meta.env.VITE_CAL_INDIVIDUAL_SLUG || '',
  },
  {
    id: 'package', title: 'Balíček 3 konzultací', minutes: 50, price: 4050,
    label: 'Sleva 25 %', description: 'Pro témata, která potřebují více prostoru a průběžnou spolupráci.',
    features: ['3 × 50 minut', 'Úspora 1 350 Kč oproti třem konzultacím', 'Jedna konzultace osobně na místě dle tvé volby'],
    calSlug: import.meta.env.VITE_CAL_PACKAGE_SLUG || '',
  },
];

export const content = {
  brand: 'Adam Pruška',
  sourceUrl: 'https://pruskaadam4.wixstudio.com/pruska',
  calUsername: import.meta.env.VITE_CAL_USERNAME || 'adam-pruska',
  phone: '+420 735 891 769',
  email: 'pruskaadam@me.com',
  linkedIn: 'https://www.linkedin.com/in/adam-pruska/',
  help: [
    { icon: 'study', title: 'Chceš studovat v zahraničí', text: 'Pomůžu ti vybrat výzkumnou skupinu, připravit se na pohovory na nejlepší univerzity a získat švýcarské granty.', tags: ['Výběr univerzity', 'Přijímací pohovor', 'Granty & stipendia'], cta: 'Chci studovat v zahraničí' },
    { icon: 'career', title: 'Hledáš práci nebo nové kontakty', text: 'Zjistíme, jestli je pro tebe lepší akademie nebo průmysl — doma nebo ve Švýcarsku. Otevřu ti dveře ke správným lidem.', tags: ['Kariérní strategie', 'Síť kontaktů', 'Příprava na pohovor'], cta: 'Chci najít správnou práci' },
    { icon: 'business', title: 'Máš firmu nebo projekt', text: 'Ukážu ti, jak najít správné kontakty, uděláme analýzu trhu a rozjedeme tvůj business ve Švýcarsku.', tags: ['Analýza trhu', 'Swiss kontakty', 'Business strategie'], cta: 'Chci expandovat do CH' },
  ],
  expectations: [
    { title: 'Kariéra v zahraničí', text: 'Zjisti, jestli je pro tebe lepší akademie nebo průmysl — doma nebo ve Švýcarsku. Pomůžu ti s kariérní strategií i hledáním konkrétních pozic.' },
    { title: 'Správné kontakty', text: 'Česká a slovenská komunita ve Švýcarsku je ten nejlepší způsob, jak do země proniknout. Propojím tě s těmi správnými lidmi.' },
    { title: 'Studium na ETH & dalších', text: 'Jak si vybrat výzkumnou skupinu, připravit se na pohovory a získat švýcarské granty — bakalář, magistr i doktorát.' },
    { title: 'Swiss business', text: 'Pomohu ti najít a kontaktovat partnery nebo klienty ze soukromé i státní sféry. Analýza trhu, strategy & execution.' },
    { title: 'Švýcarská mentalita & kultura', text: 'Pomůžu ti připravit se na místní zvyky a firemní kulturu. Vědět, co se očekává, je základ úspěchu v každém prostředí.' },
    { title: 'Projekt & originalita', text: 'Máš super nápad, ale nevíš, kde začít? Pomůžu ti zhodnotit rizika, najít financování a vdechnout projektu nový život.' },
  ],
  process: [
    { title: 'Nezávazná schůzka zdarma', text: 'Zavolej nebo napiš. Zdarma zjistíme, s čím přesně ti mohu pomoci a jestli si vzájemně sedíme. Žádné skryté podmínky, žádný tlak.' },
    { title: 'Nastavíme plán', text: 'Definujeme tvůj cíl a připravíme konkrétní kroky. Ať jde o kariéru, studium nebo business — každý plán je na míru.' },
    { title: 'Jedeme', text: 'Pracujeme společně online, v Praze nebo Brně. Průběžně ladíme postup podle toho, jak se věci vyvíjí. Jsem dostupný i mezi konzultacemi.' },
  ],
  testimonials: [
    { initials: 'MP', name: 'Michaela P.', context: 'Hledala práci v Zurichu', quote: 'Adam nám přiblížil, jak to ve Švýcarsku chodí a otevřel oči, že hledat práci z Česka nebude úplně možné. Už první CV upravené podle jeho rad mi pomohlo dostat se přes první kolo pohovorů.' },
    { initials: 'MČ', name: 'Marie Č.', context: 'Kariéra v korporátním sektoru CH', quote: 'Nikdy jsem nevěděla, že i takové drobnosti jako je doba příchodu hrají takovou roli. Díky Adame — chodit pozdě se nemá a chodit příliš brzy je tlak na toho druhého.' },
    { initials: 'KM', name: 'Karel M.', context: 'Expanze firmy do Švýcarska', quote: 'Naše firma hledala způsob, jak se spojit s lidmi ve Švýcarsku. Adamovy kontakty nám ušetřily měsíce práce a spoustu peněz. Na první emaily jsme dostali odpověď.' },
  ] as Testimonial[],
  media: [] as MediaItem[],
  posts: [
    {
      title: 'Čech ve Švýcarsku: kulturní rozdíly v každodenní komunikaci',
      description: 'Osobní pohled na komunikaci, studium a práci v novém prostředí.',
      date: '9. července 2025', image: 'culture.jpg',
      url: 'https://pruskaadam4.wixstudio.com/pruska/post/kopie-jak-na-doktor%C3%A1t-ve-%C5%A1v%C3%BDcarsku',
    },
    {
      title: 'Jak na doktorát ve Švýcarsku?',
      description: 'Co vědět o přihlášce, výzkumné skupině a začátcích na švýcarské univerzitě.',
      date: '25. března 2025', image: 'zurich.jpg',
      url: 'https://pruskaadam4.wixstudio.com/pruska/post/jak-na-doktor%C3%A1t-ve-%C5%A1v%C3%BDcarsku',
    },
  ],
  faq: [
    { question: 'Je první konzultace opravdu zdarma?', answer: 'Ano. Úvodní online setkání trvá 30 minut a je nezávazné. Probereme tvou situaci a zjistíme, zda spolupráce dává smysl.' },
    { question: 'Musím mít konkrétní plán nebo otázku?', answer: 'Nemusíš mít hotový plán. Pomůže, když si předem promyslíš, kde se právě nacházíš a co bys chtěl nebo chtěla posunout.' },
    { question: 'Jak probíhá individuální konzultace?', answer: 'Individuální online konzultace trvá 50 minut a stojí 1 800 Kč. Je věnovaná konkrétnímu tématu, které potřebuješ probrat.' },
    { question: 'Máš slevu pro studenty? A můžeme se potkat osobně?', answer: 'Bc. a Mgr. studenti mají slevu 50 %. Lze se setkat i osobně v Praze nebo Brně — konkrétní podmínky domluvíme předem.' },
    { question: 'Co obsahuje balíček tří konzultací?', answer: 'Balíček obsahuje tři konzultace po 50 minutách za 4 050 Kč, tedy o 25 % méně než tři jednotlivé konzultace. Jedna se uskuteční osobně na místě dle tvé volby. Místo a praktické podmínky osobního setkání domluvíme předem. V kalendáři vybíráš termín prvního setkání; další dva domluvíme společně.' },
    { question: 'Co když potřebuji změnit termín?', answer: 'Možnosti změny nebo zrušení termínu najdeš v potvrzení rezervace. Pokud si nejsi jistý nebo jistá, napiš mi na pruskaadam@me.com.' },
  ],
};

export const priceLabel = (price: number) => price === 0 ? 'Zdarma' : new Intl.NumberFormat('cs-CZ').format(price) + ' Kč';
