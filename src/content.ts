export type ServiceId = 'intro' | 'individual' | 'package';
export type Testimonial = { quote: string; name: string; context: string; sourceUrl?: string };
export type MediaItem = { outlet: string; title: string; url: string };
export type Service = {
  id: ServiceId; title: string; minutes: number; price: number;
  label: string; description: string; features: string[]; calSlug: string;
};

// Facts: original Wix website + the owner's instructions. See docs/content-sources.md.
export const services: Service[] = [
  {
    id: 'intro', title: 'Nezávazná konzultace', minutes: 30, price: 0,
    label: 'Začni tady', description: 'Probereme tvoji situaci a zjistíme, zda ti můžu pomoct. Bez závazku pokračovat.',
    features: ['30 minut online', 'Prostor pro tvoje otázky', 'Společně zhodnotíme další krok'],
    calSlug: import.meta.env.VITE_CAL_INTRO_SLUG || '',
  },
  {
    id: 'individual', title: 'Individuální konzultace', minutes: 50, price: 1800,
    label: 'Konkrétní téma', description: 'Čas věnovaný tvé otázce, rozhodnutí nebo konkrétní výzvě.',
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
    { title: 'Studium a doktorát', text: 'Výběr výzkumné skupiny, oslovení profesora, přihláška nebo příprava na pohovor ve Švýcarsku.', tag: 'Akademie' },
    { title: 'Práce a kariérní směr', text: 'Orientace v zahraničním prostředí a rozhodování mezi akademií, startupem a korporátem.', tag: 'Kariéra' },
    { title: 'První kroky v zahraničí', text: 'Praktické otázky spojené s přesunem, novým prostředím a hledáním relevantních kontaktů.', tag: 'Švýcarsko' },
    { title: 'Komunikace a nové prostředí', text: 'Kulturní rozdíly, začlenění do týmu a každodenní komunikace ve Švýcarsku.', tag: 'Život v zahraničí' },
  ],
  expectations: [
    { title: 'Pohled z vlastní zkušenosti', text: 'Opírám se o studium a práci na ETH Zürich i zkušenosti z různých pracovních prostředí.' },
    { title: 'Prostor pro tvoji situaci', text: 'Začneme tím, kde se právě nacházíš a co chceš vyřešit. Každá konzultace vychází z tvých otázek.' },
    { title: 'Konkrétnější další krok', text: 'Projdeme možnosti, priority a praktické kroky, které dávají smysl pro tvoji situaci.' },
  ],
  testimonials: [] as Testimonial[],
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
    { question: 'Co obsahuje balíček tří konzultací?', answer: 'Balíček obsahuje tři konzultace po 50 minutách za 4 050 Kč, tedy o 25 % méně než tři jednotlivé konzultace. Jedna se uskuteční osobně na místě dle tvé volby. Místo a praktické podmínky osobního setkání domluvíme předem. V kalendáři vybíráš termín prvního setkání; další dva domluvíme společně.' },
    { question: 'Co když potřebuji změnit termín?', answer: 'Možnosti změny nebo zrušení termínu najdeš v potvrzení rezervace. Pokud si nejsi jistý nebo jistá, napiš mi na pruskaadam@me.com.' },
  ],
};

export const priceLabel = (price: number) => price === 0 ? 'Zdarma' : new Intl.NumberFormat('cs-CZ').format(price) + ' Kč';
