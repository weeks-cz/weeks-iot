import { ledBlinked, type Lesson } from "../types";

/**
 * Lekce 4 — pořadí.
 *
 * První lekce, kde na sobě kroky závisí. Semafor není „tři blikající
 * LED" — je to posloupnost, kde záleží, co přijde po čem. Dítě si tím
 * osahá, že program je recept, ne seznam.
 *
 * Tři LED znamenají tři piny a tři rezistory. Je to první obvod, který
 * se nevejde do dvou drátků, a proto první, kde se breadboard vyplatí.
 */
export const lesson4: Lesson = {
  slug: "semafor",
  order: 4,
  title: "Semafor",
  goal: "Postavíš posloupnost, kde na pořadí kroků záleží.",
  minutes: 30,
  legacyTaskId: "beginner-traffic-light",
  imageKey: "semafor",

  brief: [
    "Tři LED, tři barvy, jedno pořadí. Semafor, jaký znáš z křižovatky.",
    "Do teď jsi ovládal jednu LED. Teď tři — a hlavně jde o to, v jakém pořadí se střídají. Zelená, oranžová, červená, a zase dokola.",
    "Tohle je první obvod, kde se breadboard opravdu hodí: tři LED sdílejí jednu zem.",
  ],

  concept: {
    title: "Společná zem",
    body:
      "Každá LED potřebuje cestu zpátky na GND. Arduino má ale jen pár pinů GND, " +
      "a ty bys jich potřeboval tři. Řešení je napájecí lišta breadboardu: " +
      "spojíš ji jednou s GND a všechny LED se na ni napojí. Jeden drát místo tří.",
  },

  palette: ["led-red", "led-yellow", "led-green", "resistor-220"],

  wiring: {
    parts: [
      { role: "arduino", type: "arduino-uno", label: "Arduino" },
      { role: "cervena", type: "led-red", label: "červená LED" },
      { role: "oranzova", type: "led-yellow", label: "žlutá LED" },
      { role: "zelena", type: "led-green", label: "zelená LED" },
      { role: "r1", type: "resistor-220", label: "rezistor" },
      { role: "r2", type: "resistor-220", label: "druhý rezistor" },
      { role: "r3", type: "resistor-220", label: "třetí rezistor" },
    ],
    connections: [
      {
        from: { role: "arduino", pin: "D2" },
        to: { role: "cervena", pin: "anode" },
        through: ["resistor-220"],
        hint: "Červenou LED zapoj na pin 2 přes rezistor.",
      },
      {
        from: { role: "arduino", pin: "D3" },
        to: { role: "oranzova", pin: "anode" },
        through: ["resistor-220"],
        hint: "Žlutou LED zapoj na pin 3 přes rezistor.",
      },
      {
        from: { role: "arduino", pin: "D4" },
        to: { role: "zelena", pin: "anode" },
        through: ["resistor-220"],
        hint: "Zelenou LED zapoj na pin 4 přes rezistor.",
      },
      {
        from: { role: "cervena", pin: "cathode" },
        to: { role: "arduino", pin: "GND-1" },
        hint: "Katodu červené LED spoj se zemí — nejlíp přes napájecí lištu.",
      },
      {
        from: { role: "oranzova", pin: "cathode" },
        to: { role: "arduino", pin: "GND-1" },
        hint: "Katodu žluté LED spoj se zemí.",
      },
      {
        from: { role: "zelena", pin: "cathode" },
        to: { role: "arduino", pin: "GND-1" },
        hint: "Katodu zelené LED spoj se zemí.",
      },
    ],
  },

  wiringHints: [
    "Nejdřív spoj GND Arduina s napájecí lištou breadboardu (tou s modrým pruhem).",
    "Každá LED má svůj pin: červená 2, žlutá 3, zelená 4.",
    "Každá LED má svůj rezistor. Sdílet se dá zem, ne rezistor.",
    "Katody všech tří LED vedou do stejné lišty.",
  ],

  starterCode: `int cervena = 2;
int zluta = 3;
int zelena = 4;

void setup() {
  // Nastav všechny tři piny jako výstup.

}

void loop() {
  // Zelená, pak žlutá, pak červená. A zase dokola.

}
`,

  codeHints: [
    "V setup() potřebuješ tři řádky pinMode — pro každý pin jeden.",
    "V loop() vždycky jednu LED rozsviť, počkej, a zase ji zhasni, než rozsvítíš další.",
    "Když zapomeneš předchozí zhasnout, budou svítit všechny naráz.",
    "Zkus žluté dát kratší delay než zeleným a červeným — jako na skutečné křižovatce.",
  ],

  solution: `int cervena = 2;
int zluta = 3;
int zelena = 4;

void setup() {
  pinMode(cervena, OUTPUT);
  pinMode(zluta, OUTPUT);
  pinMode(zelena, OUTPUT);
}

void loop() {
  digitalWrite(zelena, HIGH);
  delay(2000);
  digitalWrite(zelena, LOW);

  digitalWrite(zluta, HIGH);
  delay(700);
  digitalWrite(zluta, LOW);

  digitalWrite(cervena, HIGH);
  delay(2000);
  digitalWrite(cervena, LOW);
}
`,

  checks: [
    {
      label: "Červená se rozsvěcí a zhasíná",
      iterations: 4,
      verify: (frames) => ledBlinked(frames, 0),
      hint: "Červená LED se nestřídá. Zkontroluj, že ji v loop() rozsvěcíš i zhasínáš.",
    },
    {
      label: "Žlutá se rozsvěcí a zhasíná",
      iterations: 4,
      verify: (frames) => ledBlinked(frames, 1),
      hint: "Žlutá LED se nestřídá. Má svůj pin 3 a vlastní dvojici rozsviť–zhasni.",
    },
    {
      label: "Zelená se rozsvěcí a zhasíná",
      iterations: 4,
      verify: (frames) => ledBlinked(frames, 2),
      hint: "Zelená LED se nestřídá. Má svůj pin 4 a vlastní dvojici rozsviť–zhasni.",
    },
    {
      label: "Mezi barvami je pauza",
      iterations: 2,
      verify: (frames) => (frames.at(-1)?.elapsedMs ?? 0) >= 1000,
      hint:
        "Bez delay() by se barvy střídaly tak rychle, že by to vypadalo jako " +
        "svítící všechno naráz. Přidej pauzu za každou barvu.",
    },
  ],
};
