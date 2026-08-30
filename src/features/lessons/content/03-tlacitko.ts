import { ledEverOn, ledNeverOn, type Lesson } from "../types";

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
  minutes: 25,
  legacyTaskId: "beginner-led",

  brief: [
    "Do teď jsi Arduinu poroučel. Teď se ho naučíš ptát.",
    "Přidáš tlačítko a LED bude svítit jen tehdy, když ho držíš. Program se poprvé bude rozhodovat podle toho, co se děje venku.",
    "Tlačítko zapojíš mezi pin a GND. Když ho zmáčkneš, spojí je — a Arduino to pozná.",
  ],

  concept: {
    title: "Proč tlačítko čte LOW, když ho zmáčkneš",
    body:
      "Zní to obráceně, ale dává to smysl. INPUT_PULLUP drží pin nahoře (HIGH), " +
      "dokud ho něco nestáhne dolů. Tlačítko ho stiskem spojí se zemí — takže " +
      "zmáčknuto = LOW, puštěno = HIGH. Ušetří to jeden rezistor a pin nikdy " +
      "nečte náhodu.",
  },

  palette: ["breadboard-half", "led-red", "resistor-220", "pushbutton"],

  wiring: {
    parts: [
      { role: "arduino", type: "arduino-uno", label: "Arduino" },
      { role: "led", type: "led-red", label: "červená LED" },
      { role: "odpor", type: "resistor-220", label: "rezistor" },
      { role: "tlacitko", type: "pushbutton", label: "tlačítko" },
    ],
    connections: [
      {
        from: { role: "arduino", pin: "D8" },
        to: { role: "led", pin: "anode" },
        through: ["resistor-220"],
        hint: "Anoda LED na pin 8 přes rezistor.",
      },
      {
        from: { role: "led", pin: "cathode" },
        to: { role: "arduino", pin: "GND-1" },
        hint: "Katoda LED na GND.",
      },
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
    "Tlačítko má čtyři nožičky, ale funguje jako dvě dvojice. Stačí ti jedna z každé strany.",
    "Jedna strana tlačítka jde na pin 7, druhá na GND.",
  ],

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
  //   2) rozhodni se: if (…== LOW) { rozsviť } else { zhasni }

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

  checks: [
    {
      label: "Když tlačítko držíš, LED svítí",
      iterations: 3,
      pinInputs: { 7: 0 },
      verify: (frames) => ledEverOn(frames),
      hint:
        "Se stisknutým tlačítkem LED nesvítí. Zmáčknuté tlačítko čte LOW — " +
        "zkontroluj, jestli se ptáš na LOW, a ne na HIGH.",
    },
    {
      label: "Když tlačítko pustíš, LED zhasne",
      iterations: 3,
      pinInputs: { 7: 1 },
      verify: (frames) => ledNeverOn(frames),
      hint:
        "S puštěným tlačítkem LED pořád svítí. Chybí ti větev else, která ji zhasne — " +
        "nebo v ní není digitalWrite(led, LOW).",
    },
  ],
};
