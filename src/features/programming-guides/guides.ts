export type ProgrammingGuide = {
  slug: string;
  title: string;
  summary: string;
  goal: string;
  intro: string;
  specialUrlNote: string;
  requirements: string[];
  steps: Array<{
    title: string;
    description: string;
    checklist: string[];
  }>;
  codeSample: string;
  successChecks: string[];
  extensionIdeas: string[];
};

export const programmingGuides: ProgrammingGuide[] = [
  {
    slug: "vlastni-zadani",
    title: "Návod pro vlastní programovací zadání",
    summary:
      "Samostatná stránka pro jedno konkrétní zadání, které otevřeš přes speciální URL bez míchání s interní dokumentací repa.",
    goal:
      "Cílem je připravit jedno jasné zadání, podle kterého student nebo lektor naprogramuje přesně definovanou věc od začátku do funkčního výsledku.",
    intro:
      "Tahle stránka je záměrně oddělená od interních markdown dokumentů. Slouží jako veřejně otevřitelný návod uvnitř aplikace, zatímco zdrojový kód zůstává normálně verzovaný v Gitu jako zbytek projektu.",
    specialUrlNote:
      "Každé další zadání může mít vlastní adresu ve tvaru /navody/nejaky-slug, takže můžeš posílat přesný odkaz bez toho, aby uživatelé hledali správný dokument ručně.",
    requirements: [
      "Připrav si přesný popis toho, co má výsledný program dělat.",
      "Sepiš si vstupy a výstupy, například tlačítko, LED, servo nebo senzor.",
      "Rozhodni, podle čeho poznáš, že je úkol hotový.",
    ],
    steps: [
      {
        title: "1. Popiš chování programu",
        description:
          "Nejdřív jednou větou napiš, co se má po spuštění dít. Bez toho se zadání rychle rozpadne do nejasností.",
        checklist: [
          "Co přesně program ovládá",
          "Kdy se má něco zapnout nebo změnit",
          "Jak má vypadat správný výsledek",
        ],
      },
      {
        title: "2. Rozděl úkol na malé kroky",
        description:
          "Každý návod je čitelnější, když není psaný jako jeden dlouhý blok. Rozděl logiku na jednoduché kroky, které jdou průběžně ověřovat.",
        checklist: [
          "Inicializace pinů nebo proměnných",
          "Podmínky a reakce na vstup",
          "Opakování v hlavní smyčce",
        ],
      },
      {
        title: "3. Přidej minimální ukázku kódu",
        description:
          "Ukázka nemá vyřešit celé zadání za uživatele, ale má ho správně nasměrovat. Hodí se hlavně kostra programu.",
        checklist: [
          "Srozumitelný název proměnných",
          "Krátké komentáře jen tam, kde opravdu pomohou",
          "Žádné zbytečně hotové kompletní řešení, pokud chceš nechat prostor pro práci",
        ],
      },
      {
        title: "4. Definuj kontrolu hotového řešení",
        description:
          "Na konci musí být jasné, jak si uživatel ověří, že jeho program funguje správně a ne jen náhodou.",
        checklist: [
          "Co se stane při správném spuštění",
          "Jaké chyby bývají nejčastější",
          "Jak otestovat hraniční situace",
        ],
      },
    ],
    codeSample: `// Sem vloz kratkou kostru konkretniho zadani
void setup() {
  // inicializace
}

void loop() {
  // hlavni logika programu
}`,
    successChecks: [
      "Uživatel přesně ví, co má vytvořit.",
      "URL lze poslat samostatně bez dalšího vysvětlování.",
      "Návod je oddělený od interních repozitářových dokumentů.",
    ],
    extensionIdeas: [
      "Přidej obrázek zapojení nebo blokové schéma.",
      "Doplň variantu pro začátečníky a variantu navíc pro pokročilé.",
      "Napoj další guide přes nový slug bez zásahu do stávajících stránek.",
    ],
  },
];

export function getProgrammingGuide(slug: string) {
  return programmingGuides.find((guide) => guide.slug === slug);
}
