import { ledEverOn, ledNeverOn, type Lesson } from "../types";
import {
  compare,
  digitalRead,
  digitalWrite,
  ifElse,
  level,
  pinMode,
  program,
} from "@/features/blocks/program";

/**
 * Lekce 3 — vstup.
 *
 * Do teď Arduino jen poroučelo. Teď se poprvé ptá: co se děje venku?
 * To je zlom, po kterém přestává být program scénářem a stává se
 * rozhodováním.
 *
 * Tlačítko je zapojené s INPUT_PULLUP schválně: ušetří rezistor navíc
 * a hlavně se vyhne „plovoucímu vstupu", kde tlačítko čte náhodu a dítě
 * si myslí, že udělalo chybu.
 */
export const lesson3: Lesson = {
  slug: "tlacitko",
  order: 3,
  title: "Tlačítko",
  goal: "Naučíš se, jak se Arduino ptá na okolní svět a rozhoduje se podle odpovědi.",
  celebrate: {
    title: "poslouchá.",
    line: "Arduino se ptá na tlačítko a rozhoduje se podle toho, co odpoví.",
  },
  minutes: 25,
  legacyTaskId: "beginner-led",

  brief: [
    "Doteď Arduinu říkáš, co má dělat. Teď se ho naučíš ptát.",
    "Přidáš tlačítko a LED bude svítit jen tehdy, když ho držíš. Program se poprvé bude rozhodovat podle toho, co se děje venku.",
    "Tlačítko zapojíš mezi pin a GND. Když ho zmáčkneš, spojí je — a Arduino to pozná.",
  ],

  concept: {
    title: "Proč tlačítko čte LOW, když ho zmáčkneš",
    body:
      "Pin je normálně HIGH. Stisk tlačítka ho stáhne na zem (GND), takže čteš LOW. " +
      "Proto ti stačí dva drátky: jeden na pin, druhý na zem. Rezistor navíc " +
      "nepotřebuješ, protože režim vstup (pull-up) drží pin nahoře sám.",
  },

  palette: ["breadboard-half", "led-red", "resistor-220", "pushbutton"],

  wiring: {
    parts: [
      { role: "arduino", type: "arduino-uno", label: "Arduino" },
      { role: "led", type: "led-red", label: "červená LED" },
      { role: "odpor", type: "resistor-220", label: "rezistor" },
      { role: "tlacitko", type: "pushbutton", label: "tlačítko" },
    ],
    series: [
      {
        from: { role: "arduino", pin: "D8" },
        to: { role: "arduino", pin: "GND-1" },
        led: { role: "led", anode: "anode", cathode: "cathode" },
        resistor: "resistor-220",
        hint:
          "LED zapoj mezi pin 8 a GND přes rezistor — delší nožičkou (anodou) směrem k pinu. " +
          "Rezistor může stát na kterékoli straně LED.",
      },
    ],
    connections: [
      {
        from: { role: "arduino", pin: "D7" },
        to: { role: "tlacitko", pin: "1a" },
        hint: "Jednu stranu tlačítka spoj s pinem 7 — tam se Arduino ptá.",
      },
      {
        from: { role: "tlacitko", pin: "2a" },
        to: { role: "arduino", pin: "GND-1" },
        hint: "Druhou stranu tlačítka spoj s GND. Stiskem se pin stáhne k zemi.",
      },
    ],
  },

  wiringHints: [
    "LED zapoj stejně jako minule na pin 8.",
    "Tlačítko dej přes prostřední drážku desky: jedna strana do jednoho sloupce, druhá do druhého. Každá strana má dvě nožičky spojené uvnitř, stačí ti jedna z nich.",
    "Jedna strana tlačítka jde na pin 7, druhá na GND.",
  ],

  programGoal: "Když držíš tlačítko, LED svítí. Když ho pustíš, zhasne.",

  starterCode: `int led = 8;
int tlacitko = 7;

void setup() {
  pinMode(led, OUTPUT);
  // Tlačítko je vstup: Arduino ho poslouchá.
  pinMode(tlacitko, INPUT_PULLUP);
}

void loop() {
  // ÚKOL: Když je tlačítko zmáčknuté, rozsviť. Jinak zhasni.
  //   1) přečti tlačítko: digitalRead(tlacitko)
  //   2) rozhodni se: if (… == LOW) { rozsviť } else { zhasni }

}
`,

  codeHints: [
    "Do setup() přidej pinMode(tlacitko, INPUT_PULLUP).",
    "V loop() si přečti hodnotu: int stav = digitalRead(tlacitko);",
    "Pak se rozhodni: if (stav == LOW) { LED svítí } else { LED zhasne }",
    "Pozor: zmáčknuté tlačítko je LOW, ne HIGH. Vysvětlení je v modrém rámečku nahoře.",
  ],

  solution: `int led = 8;
int tlacitko = 7;

void setup() {
  pinMode(led, OUTPUT);
  pinMode(tlacitko, INPUT_PULLUP);
}

void loop() {
  int stav = digitalRead(tlacitko);

  if (stav == LOW) {
    digitalWrite(led, HIGH);
  } else {
    digitalWrite(led, LOW);
  }
}
`,

  /* Kontroly MAČKAJÍ skutečné tlačítko v obvodu (pressed), nevnucují
     pinu hodnotu. Vnucená hodnota by pustila i špatně zapojené tlačítko —
     třeba obvod, kde je pin uzemněný natrvalo a stisk nic nemění. */
  blocks: {
    starter: program({ setup: [pinMode(8, "OUTPUT"), pinMode(7, "INPUT_PULLUP")] }),
    solution: program({
      setup: [pinMode(8, "OUTPUT"), pinMode(7, "INPUT_PULLUP")],
      loop: [
        ifElse(
          compare(digitalRead(7), "==", level("LOW")),
          [digitalWrite(8, "HIGH")],
          [digitalWrite(8, "LOW")],
        ),
      ],
    }),
    steps: [
      "Piny už jsou nastavené: LED je na pinu 8, tlačítko na pinu 7.",
      "Pořád dokola se ptej, jestli je tlačítko zmáčknuté. Zmáčknuté tlačítko čte LOW.",
      "Když je, rozsviť LED. Jinak ji zhasni.",
    ],
    hints: [
      "Tlačítko už je nastavené jako vstup — v části „na začátku jednou“ to máš hotové.",
      "Do „pak pořád dokola“ dej blok „když … udělej … jinak“.",
      "Do okénka za „když“ vlož porovnání a do něj „přečti pin 7“ = LOW.",
      "Pozor: zmáčknuté tlačítko je LOW, ne HIGH. Proto se ptáš na LOW.",
    ],
  },

  checks: [
    {
      label: "Když tlačítko držíš, LED svítí",
      iterations: 3,
      pressed: ["tlacitko"],
      verify: (frames) => ledEverOn(frames),
      hint:
        "Se stisknutým tlačítkem LED nesvítí. Zmáčknuté tlačítko čte LOW — " +
        "zkontroluj, jestli se ptáš na LOW, a ne na HIGH.",
      blockHint:
        "Se stisknutým tlačítkem LED nesvítí. Zmáčknuté tlačítko čte LOW — zkontroluj, jestli se v porovnání ptáš na LOW, a ne na HIGH.",
    },
    {
      label: "Když tlačítko pustíš, LED zhasne",
      iterations: 3,
      pressed: [],
      verify: (frames) => ledNeverOn(frames),
      hint:
        "S puštěným tlačítkem LED pořád svítí. Chybí ti větev else, která ji zhasne — " +
        "nebo v ní není digitalWrite(led, LOW).",
      blockHint:
        "S puštěným tlačítkem LED pořád svítí. Do části „jinak“ patří „na pin 8 pošli LOW“.",
    },
  ],
};
