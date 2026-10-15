import { content, services, type Service } from './content';
import type { Language } from './locales';
import { PRICES, STUDENT_PRICES, currencyLabel, discountLabel, PACKAGE_DISCOUNT, PACKAGE_SAVINGS } from './pricing.mjs';

const translated = {
  sk: {
    help:[
      {icon:'study',title:'Chceš študovať v zahraničí',text:'Vyberieme univerzitu a výskumnú skupinu pre Bc., Mgr. alebo PhD. Pripravím ťa na prijímací pohovor a pomôžem ti zorientovať sa vo švajčiarskych grantoch a štipendiách.',tags:['Výber univerzity','Prijímací pohovor','Granty & štipendiá'],cta:'Chcem študovať v zahraničí'},
      {icon:'career',title:'Hľadáš prácu alebo nové kontakty',text:'Akadémia, alebo priemysel? Spoločne nastavíme kariérnu stratégiu a pripravíme pohovor. Preberieme švajčiarsku mentalitu aj firemnú kultúru a prepojím ťa s česko-slovenskou komunitou vo Švajčiarsku.',tags:['Kariérna stratégia','Sieť kontaktov','Príprava na pohovor'],cta:'Chcem nájsť správnu prácu'},
      {icon:'business',title:'Máte firmu alebo projekt',text:'Pomôžem vám s analýzou trhu a kontaktmi v súkromnej aj štátnej sfére. Prejdeme biznisovú stratégiu, riziká aj možnosti financovania vášho projektu.',tags:['Analýza trhu','Swiss kontakty','Biznisová stratégia'],cta:'Chceme expandovať do Švajčiarska'},
    ],
    service:[
      {title:'Nezáväzná konzultácia',label:'Zadarmo a bez záväzku',description:'Zistíme, s čím presne ti môžem pomôcť a či si vzájomne sadneme. Žiadny záväzok, žiadne podmienky.',features:['30 minút online','Priestor na tvoje otázky','Spoločne zhodnotíme ďalší krok']},
      {title:'Individuálna konzultácia',label:'Tvoj konkrétny cieľ',description:'Osobná konzultácia zameraná na tvoj konkrétny cieľ v kariére, štúdiu, podnikaní alebo expanzii do Švajčiarska.',features:['50 minút online','Individuálny prístup','Odídeš s konkrétnym plánom ďalších krokov']},
      {title:'Balíček 3 konzultácií',label:`Zľava ${discountLabel(PACKAGE_DISCOUNT,'sk')} %`,description:'Pre témy, ktoré potrebujú viac priestoru a priebežnú spoluprácu.',features:['3 × 50 minút',`Úspora ${currencyLabel(PACKAGE_SAVINGS,'sk')} oproti trom konzultáciám`,'Jedna konzultácia osobne na mieste podľa tvojej voľby','Odídeš s konkrétnym plánom ďalších krokov']},
    ],
    process:[
      {title:'Nezáväzné stretnutie zadarmo',text:'Zavolaj alebo napíš. Zadarmo zistíme, s čím presne ti môžem pomôcť a či si vzájomne sadneme. Žiadne skryté podmienky, žiadny tlak.'},
      {title:'Nastavíme plán',text:'Definujeme tvoj cieľ a pripravíme konkrétne kroky. Každý plán prispôsobíme tvojej kariére, štúdiu alebo podnikaniu.'},
      {title:'Ideme na to',text:'Pracujeme spoločne online, v Prahe alebo Brne. Priebežne ladíme postup podľa toho, ako sa veci vyvíjajú. Som dostupný aj medzi konzultáciami.'},
    ],
    testimonials:[
      {context:'Práca v biotechnológiách pri Bazileji',result:'Našla laboratórnu prácu v biotechnologickej firme pri Bazileji',quote:'Adam nám priblížil, ako to vo Švajčiarsku chodí, a otvoril oči, že hľadať prácu z Česka nebude úplne možné. Už prvé CV upravené podľa jeho rád mi pomohlo dostať sa cez prvé kolo pohovorov.'},
      {context:'Kariéra v korporátnom sektore Švajčiarska',result:'Zlepšila svoj prvý dojem a naladila sa na švajčiarsku mentalitu',quote:'Nikdy som nevedela, že aj také drobnosti ako čas príchodu hrajú takú rolu. Vďaka, Adam. Chodiť neskoro sa nemá a chodiť príliš skoro je tlak na toho druhého.'},
      {context:'Expanzia firmy do Švajčiarska',result:'Získal prvé zákazky na svoju službu vo švajčiarskych firmách',quote:'Naša firma hľadala spôsob, ako sa spojiť s ľuďmi vo Švajčiarsku. Adamove kontakty nám ušetrili mesiace práce a veľa peňazí. Na prvé e-maily sme dostali odpoveď.'},
    ],
    faq:[
      {question:'Ako sa platí?',answer:'Po ukončení našej spolupráce vystavím faktúru. Platbu vykonáš prevodom na účet uvedený na faktúre.'},
      {question:'Je prvá konzultácia naozaj zadarmo?',answer:'Áno. Úvodné online stretnutie trvá 30 minút a je nezáväzné. Preberieme tvoju situáciu a zistíme, či spolupráca dáva zmysel.'},
      {question:'Musím mať konkrétny plán alebo otázku?',answer:'Nemusíš mať hotový plán. Pomôže, keď si vopred premyslíš, kde sa práve nachádzaš a čo chceš posunúť.'},
      {question:'Ako prebieha individuálna konzultácia?',answer:'Individuálna online konzultácia trvá 50 minút a stojí 1 800 Kč vrátane DPH. Venujeme ju konkrétnej téme, ktorú potrebuješ prebrať.'},
      {question:'Máš zľavu pre študentov? A môžeme sa stretnúť osobne?',answer:`Bc. a Mgr. študenti majú individuálnu konzultáciu o ${discountLabel(PRICES.studentIndividualDiscount,'sk')} % lacnejšiu, za ${currencyLabel(STUDENT_PRICES.individual,'sk')}. Balíček je pre študentov o ${discountLabel(PRICES.studentPackageDiscount,'sk')} % lacnejší než bežný balíček, za ${currencyLabel(STUDENT_PRICES.package,'sk')}. Všetky ceny sú vrátane DPH. Osobné stretnutia v Prahe alebo Brne sú možné po dohode.`},
      {question:'Čo obsahuje balíček troch konzultácií?',answer:`Tri konzultácie po 50 minútach za ${currencyLabel(PRICES.package,'sk')}, o ${discountLabel(PACKAGE_DISCOUNT,'sk')} % menej než tri samostatné konzultácie. Jedna je osobne na mieste podľa tvojej voľby; miesto a praktické podmienky dohodneme vopred. Cena je vrátane DPH. V kalendári rezervuješ prvé stretnutie, ďalšie dve dohodneme spoločne.`},
      {question:'Čo ak potrebujem zmeniť termín?',answer:'Možnosti zmeny alebo zrušenia nájdeš v potvrdení rezervácie. Ak si nie si istý alebo istá, napíš mi.'},
    ],
  },
  en: {
    help:[
      {icon:'study',title:'You want to study abroad',text:'We will choose a university and research group for bachelor’s, master’s or PhD studies. I will help you prepare for admission interviews and navigate Swiss grants and scholarships.',tags:['University selection','Admission interviews','Grants & scholarships'],cta:'I want to study abroad'},
      {icon:'career',title:'You are looking for work or connections',text:'Academia or industry? We will develop your career strategy and prepare for interviews. We will discuss Swiss working culture and I can connect you with the Czech-Slovak community in Switzerland.',tags:['Career strategy','Professional network','Interview preparation'],cta:'I want to find the right job'},
      {icon:'business',title:'You have a business or project',text:'I can help with market analysis and contacts in both the private and public sectors. We will explore business strategy, risks and funding options for your project.',tags:['Market analysis','Swiss connections','Business strategy'],cta:'We want to expand into Switzerland'},
    ],
    service:[
      {title:'Introductory consultation',label:'Free, no commitment',description:'We will find out how I can help and whether we are a good fit. No commitment and no conditions.',features:['30 minutes online','Space for your questions','Discuss the next step together']},
      {title:'Individual consultation',label:'Your specific goal',description:'A personal consultation focused on your goal in your career, studies, business or expansion into Switzerland.',features:['50 minutes online','An individual approach','Leave with a concrete plan for your next steps']},
      {title:'3-consultation package',label:`Save ${discountLabel(PACKAGE_DISCOUNT,'en')}%`,description:'For topics that benefit from more time and ongoing collaboration.',features:['3 × 50 minutes',`Save ${currencyLabel(PACKAGE_SAVINGS,'en')} compared with three individual sessions`,'One in-person consultation at a location of your choice','Leave with a concrete plan for your next steps']},
    ],
    process:[
      {title:'A free introductory meeting',text:'Call or write. We will find out how I can help and whether we are a good fit, at no cost. No hidden conditions and no pressure.'},
      {title:'We make a plan',text:'We define your goal and practical steps. Each plan is tailored to your career, studies or business.'},
      {title:'We get moving',text:'We work together online, in Prague or in Brno, and adjust as your situation develops. I am also available between consultations.'},
    ],
    testimonials:[
      {context:'A biotech job near Basel',result:'Found a laboratory job at a biotech company near Basel',quote:'Adam explained how things work in Switzerland and opened our eyes to the difficulty of looking for a job from Czechia. The very first CV I revised following his advice helped me get through the first round of interviews.'},
      {context:'A career in the Swiss corporate sector',result:'Improved her first impression and adapted to the Swiss mindset',quote:'I never knew that even small things like your arrival time could matter so much. Thank you, Adam. You should not arrive late, and arriving too early puts pressure on the other person.'},
      {context:'Business expansion into Switzerland',result:'Secured his first contracts with Swiss companies',quote:'Our company was looking for a way to connect with people in Switzerland. Adam’s contacts saved us months of work and a lot of money. We received replies to our first emails.'},
    ],
    faq:[
      {question:'How do I pay?',answer:'I will issue an invoice after we finish working together. You pay by bank transfer to the account listed on the invoice.'},
      {question:'Is the first consultation really free?',answer:'Yes. The introductory online meeting is 30 minutes and carries no commitment. We discuss your situation and whether working together makes sense.'},
      {question:'Do I need a specific plan or question?',answer:'You do not need a finished plan. It helps to think about where you are now and what you want to move forward.'},
      {question:'How does an individual consultation work?',answer:'An individual online consultation is 50 minutes and costs CZK 1,800 including VAT. We focus on the specific topic you want to discuss.'},
      {question:'Is there a student discount? Can we meet in person?',answer:`Bachelor’s and master’s students receive a ${discountLabel(PRICES.studentIndividualDiscount,'en')}% discount on individual consultations, bringing the price to ${currencyLabel(STUDENT_PRICES.individual,'en')}. The package is ${discountLabel(PRICES.studentPackageDiscount,'en')}% cheaper than the regular package for students at ${currencyLabel(STUDENT_PRICES.package,'en')}. All prices include VAT. In-person meetings in Prague or Brno are possible by arrangement.`},
      {question:'What does the three-consultation package include?',answer:`Three 50-minute consultations for ${currencyLabel(PRICES.package,'en')}, ${discountLabel(PACKAGE_DISCOUNT,'en')}% less than three individual sessions. One is in person at a location of your choice; the location and practical details are agreed in advance. The price includes VAT. You book the first meeting in the calendar and we arrange the other two together.`},
      {question:'What if I need to change the time?',answer:'You can find rescheduling and cancellation options in your booking confirmation. If you are unsure, email me.'},
    ],
  },
};
export function localizedContent(language:Language) {
  const translation=language==='cs' ? null : translated[language];
  return {
    ...content,
    help:translation?.help || content.help,
    process:translation?.process || content.process,
    faq:translation?.faq || content.faq,
    testimonials:content.testimonials.map((item,index)=>({...item,...translation?.testimonials[index]})),
  };
}
export function localizedServices(language:Language):Service[] {
  return services.map((item,index)=>({...item,...(language==='cs' ? {} : translated[language].service[index])}));
}
export { currencyLabel as formatPrice } from './pricing.mjs';
