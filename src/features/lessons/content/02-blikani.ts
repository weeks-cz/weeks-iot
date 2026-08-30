import { ledBlinked, type Lesson } from "../types";

/**
 * Lekce 2 — čas.
 *
 * Zavádí jedinou novou myšlenku: `loop()` se opakuje pořád dokola.
 * Dokud LED jen svítí, není to vidět. Jakmile bliká, je to zjevné —
 * a od téhle chvíle dítě chápe, proč se program jmenuje loop.
 *
 * Zapojení zůstává stejné jako v lekci 1 schválně. Nová věc má být
 * jedna, ne dvě.
 */
export const lesson2: Lesson = {
  slug: "blikani",
  order: 2,
  title: "Blikání",
  goal: "Pochopíš, že loop() běží pořád dokola a že delay() je pauza mezi kroky.",
  minutes: 20,
  legacyTaskId: "beginner-led",

  brief: [
    "Zapojení necháš stejné jako minule. Měnit budeš jen program.",
    "Všimni si názvu: loop znamená smyčka. Všechno, co do něj napíšeš, Arduino udělá, vrátí se na začátek a udělá to znovu. A znovu. Tisíckrát za vteřinu.",
    "Když LED rozsvítíš a hned zhasneš, blikne to tak rychle, že to oko nezachytí. Proto delay — pauza.",
  ],

  concept: {
    title: "delay je čekání, ne zpomalení",
    body:
      "delay(1000) znamená „stůj a nedělej nic po dobu jedné vteřiny“. " +
      "Arduino během té doby opravdu nic jiného nestihne — nepřečte tlačítko, nezmění nic. " +
      "Proto se u větších programů delay používá opatrně. Tady je ale přesně to, co chceme.",
  },

  palette: ["breadboard-half", "led-red", "resistor-220"],

  wiring: {
    parts: [
      { role: "arduino", type: "arduino-uno", label: "Arduino" },
      { role: "led", type: "led-red", label: "červená LED" },
      { role: "odpor", type: "resistor-220", label: "rezistor" },
    ],
    connections: [
      {
        from: { role: "arduino", pin: "D8" },
        to: { role: "led", pin: "anode" },
        through: ["resistor-220"],
        hint: "Anoda LED na pin 8 přes rezistor — stejně jako minule.",
      },
      {
        from: { role: "led", pin: "cathode" },
        to: { role: "arduino", pin: "GND-1" },
        hint: "Katoda LED na GND, aby se obvod uzavřel.",
      },
    ],
  },

  wiringHints: [
    "Zapojení je stejné jako v první lekci: pin 8 → rezistor → anoda, katoda → GND.",
  ],

  starterCode: `int led = 8;

void setup() {
  pinMode(led, OUTPUT);
}

void loop() {
  // ÚKOL: Rozsviť, počkej, zhasni, počkej. Čtyři řádky:
  //   1) digitalWrite — zapnout
  //   2) delay — počkat
  //   3) digitalWrite — vypnout
  //   4) delay — počkat

}
`,

  codeHints: [
    "Čtyři řádky: digitalWrite(led, HIGH); delay(500); digitalWrite(led, LOW); delay(500);",
    "Číslo v delay jsou milisekundy. 1000 je jedna vteřina, 500 půl.",
    "Zkus si čísla změnit. Co udělá delay(50)? A co delay(2000)?",
  ],

  solution: `int led = 8;

void setup() {
  pinMode(led, OUTPUT);
}

void loop() {
  digitalWrite(led, HIGH);
  delay(500);
  digitalWrite(led, LOW);
  delay(500);
}
`,

  checks: [
    {
      label: "LED bliká — střídá svícení a tmu",
      iterations: 6,
      /* Nekontroluje se, JAK dlouho bliká ani jak rychle. Stačí, že se
         stav mění — dítě si smí zvolit vlastní rytmus. */
      verify: (frames) => ledBlinked(frames),
      hint:
        "LED se zatím nestřídá. Potřebuješ v loop() obojí: digitalWrite(led, HIGH) " +
        "i digitalWrite(led, LOW), a mezi nimi delay().",
    },
    {
      label: "Mezi změnami je pauza",
      iterations: 4,
      verify: (frames) => (frames.at(-1)?.elapsedMs ?? 0) > 0,
      hint:
        "Bez delay() by LED blikala tisíckrát za vteřinu a vypadala by, že jen svítí. " +
        "Přidej delay() mezi rozsvícení a zhasnutí.",
    },
  ],
};
