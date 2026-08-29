import { ledFaded, type Lesson } from "../types";

/**
 * Lekce 5 — mezi zapnuto a vypnuto.
 *
 * Do teď byl svět binární: HIGH nebo LOW. Tahle lekce ho otevírá.
 * A zároveň zavádí `for` — protože ručně vypsat 256 hodnot nikdo nechce,
 * a to je ten nejlepší důvod, proč se smyčku naučit.
 */
export const lesson5: Lesson = {
  slug: "plynuly-jas",
  order: 5,
  title: "Plynulý jas",
  goal: "Zjistíš, že mezi zapnuto a vypnuto je 256 mezistupňů — a jak je projet smyčkou.",
  minutes: 25,
  legacyTaskId: "beginner-pwm-led",

  brief: [
    "LED nemusí jen svítit nebo nesvítit. Může svítit napůl.",
    "Arduino to umí trikem: bliká tak rychle, že to oko nestihne, a ty vidíš slabší svit. Jmenuje se to PWM a použiješ na to analogWrite místo digitalWrite.",
    "Hodnota jde od 0 (tma) do 255 (naplno). Aby LED plynule zesilovala, musíš je projet všechny — a od toho je smyčka for.",
  ],

  concept: {
    title: "Ne každý pin umí PWM",
    body:
      "Na Arduinu Uno to zvládnou jen piny označené vlnovkou: 3, 5, 6, 9, 10 a 11. " +
      "Na ostatních se analogWrite chová jako vypínač — všechno nad 127 je HIGH. " +
      "Proto tuhle lekci stavíš na pinu 9, ne na osmičce jako minule.",
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
        from: { role: "arduino", pin: "D9" },
        to: { role: "led", pin: "anode" },
        through: ["resistor-220"],
        hint:
          "Tentokrát pin 9, ne 8 — jen piny s vlnovkou umí plynulý jas. " +
          "Rezistor v cestě zůstává.",
      },
      {
        from: { role: "led", pin: "cathode" },
        to: { role: "arduino", pin: "GND-1" },
        hint: "Katoda LED na GND.",
      },
    ],
  },

  wiringHints: [
    "Zapojení je jako v první lekci, jen místo pinu 8 použij pin 9.",
    "Pin 9 má na desce vedle čísla vlnovku (~). To znamená, že umí PWM.",
  ],

  starterCode: `int led = 9;

void setup() {
  pinMode(led, OUTPUT);
}

void loop() {
  // Projeď jas od 0 do 255 a zase zpátky.

}
`,

  codeHints: [
    "Smyčka vypadá takhle: for (int jas = 0; jas <= 255; jas++) { ... }",
    "Uvnitř dej analogWrite(led, jas); a krátký delay(5);",
    "Pro zhasínání použij druhou smyčku, která jde od 255 dolů: jas--",
    "Zkus si delay změnit. Menší číslo znamená rychlejší přechod.",
  ],

  solution: `int led = 9;

void setup() {
  pinMode(led, OUTPUT);
}

void loop() {
  for (int jas = 0; jas <= 255; jas++) {
    analogWrite(led, jas);
    delay(5);
  }

  for (int jas = 255; jas >= 0; jas--) {
    analogWrite(led, jas);
    delay(5);
  }
}
`,

  checks: [
    {
      label: "LED mění jas plynule, ne skokem",
      iterations: 2,
      /* Tři a víc různých úrovní jasu znamená, že to není jen zapnuto
         a vypnuto. Konkrétní hodnoty ani rychlost nekontrolujeme —
         dítě si smí zvolit vlastní. */
      verify: (frames) => ledFaded(frames),
      hint:
        "Jas se zatím mění jen skokem. Potřebuješ analogWrite (ne digitalWrite) " +
        "a smyčku for, která projede hodnoty mezi 0 a 255.",
    },
    {
      label: "Přechod trvá, není okamžitý",
      iterations: 1,
      verify: (frames) => (frames.at(-1)?.elapsedMs ?? 0) > 0,
      hint:
        "Bez delay() uvnitř smyčky proběhne přechod tak rychle, že ho nikdo neuvidí. " +
        "Přidej delay(5).",
    },
  ],
};
