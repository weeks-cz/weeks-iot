import { ledEverOn, ledNeverOn, type Lesson } from "../types";

/**
 * Lekce 1 — první kontakt.
 *
 * Nese celou aktivaci: je to jediná lekce, která běží bez účtu, a brána
 * 19. 10. měří právě její dokončení. Proto je nejvypilovanější a proto
 * má nejmenší možný rozsah — jedna LED, jeden pin, jedna podmínka.
 *
 * Tlačítko, které v původním zadání ovládalo druhou LED bez programu,
 * je vypuštěné. Bylo to hezké, ale míchalo dvě myšlenky naráz: „elektřina
 * teče" a „program rozhoduje". První lekce má mít jednu.
 */
export const lesson1: Lesson = {
  slug: "rozsvit-ledku",
  order: 1,
  title: "Rozsviť LEDku",
  goal: "Pochopíš, že Arduino je vypínač, který se ovládá slovem v programu.",
  minutes: 20,
  legacyTaskId: "beginner-led",
  imageKey: "led",

  brief: [
    "Rozsvítíš svoji první LED. Ne vypínačem — programem.",
    "Arduino má na kraji řadu pinů. Každý z nich umí být zapnutý (HIGH) nebo vypnutý (LOW), a ty mu řekneš který a kdy.",
    "Nejdřív obvod poskládáš, pak napíšeš tři řádky kódu. Až to bude sedět, LED se rozsvítí přímo tady na obrazovce.",
  ],

  concept: {
    title: "Proč tam musí být rezistor",
    body:
      "LED je nenasytná — kdyby mohla, vzala by si všechen proud, co jí Arduino nabídne, " +
      "a za vteřinu by se spálila. Rezistor je brzda: propustí jen tolik, kolik LED unese. " +
      "Bez něj to jednou blikne a je po ní. Proto ho tam kontrola vyžaduje.",
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
        hint:
          "Delší nožička LED (anoda) musí vést na pin 8 — ale přes rezistor. " +
          "Bez něj se LED spálí.",
      },
      {
        from: { role: "led", pin: "cathode" },
        to: { role: "arduino", pin: "GND-1" },
        hint:
          "Kratší nožička LED (katoda) musí vést na GND. Proud potřebuje cestu tam " +
          "i zpátky — bez zpáteční nepoteče vůbec.",
      },
    ],
  },

  wiringHints: [
    "Začni od Arduina: vytáhni drátek z pinu 8.",
    "Do cesty mezi pin 8 a LED vlož rezistor.",
    "Druhou nožičku LED spoj s GND, aby se obvod uzavřel.",
    "Nožičky LED nejsou stejné. Delší je anoda (kladná), kratší katoda.",
  ],

  starterCode: `// Číslo pinu, na kterém máš LED.
int led = 8;

void setup() {
  // ÚKOL 1: Řekni Arduinu, že pin s LED bude OVLÁDAT.
  //         Tvar příkazu najdeš v taháku u „pinMode".

}

void loop() {
  // ÚKOL 2: Rozsviť LED — pošli na pin HIGH.
  //         Tvar najdeš v taháku u „digitalWrite".

}
`,

  codeHints: [
    "Do setup() patří pinMode(led, OUTPUT). Říká: „pin 8 bude něco ovládat, ne poslouchat.“",
    "Do loop() patří digitalWrite(led, HIGH). To je ten příkaz, co LED rozsvítí.",
    "HIGH znamená zapnuto, LOW vypnuto. Zkus si prohodit a uvidíš rozdíl.",
  ],

  solution: `int led = 8;

void setup() {
  pinMode(led, OUTPUT);
}

void loop() {
  digitalWrite(led, HIGH);
}
`,

  checks: [
    {
      label: "LED svítí",
      iterations: 3,
      verify: (frames) => ledEverOn(frames),
      hint:
        "LED zatím nesvítí. Do loop() patří digitalWrite(led, HIGH) — a v setup() " +
        "musí být pinMode(led, OUTPUT), jinak Arduino neví, že má pin ovládat.",
    },
    {
      label: "Program řídí pin 8",
      iterations: 3,
      pinInputs: {},
      verify: (frames) => ledEverOn(frames),
      hint: "Zkontroluj, že píšeš na stejný pin, na kterém máš LED zapojenou.",
    },
  ],
};

/**
 * Kontrola „zhasne, když má", schovaná do vlastní lekce až od dvojky.
 * V první lekci by přidala druhou myšlenku a rozmělnila ji.
 */
export const lesson1NegativeCheck = ledNeverOn;
