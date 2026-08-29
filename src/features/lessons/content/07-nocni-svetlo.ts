import { ledEverOn, ledNeverOn, type Lesson } from "../types";

/**
 * Lekce 7 — závěrečný projekt.
 *
 * Tohle je ta věc, kterou dítě přinese ukázat. Proto je poslední, ne
 * „A / NEBO" z původní osnovy: logické operátory jsou sice těžší, ale
 * nedají se předvést. Noční světlo ano — zakryješ senzor rukou a ono
 * se rozsvítí.
 *
 * Skládá dohromady všechno předchozí: výstup (lekce 1), rozhodování
 * (lekce 3), plynulý jas (lekce 5). Nová je jediná věc — analogové
 * čtení, tedy že svět není jen zapnuto a vypnuto.
 *
 * Je to zároveň obsah certifikátu a materiál na video a článek.
 */
export const lesson7: Lesson = {
  slug: "nocni-svetlo",
  order: 7,
  title: "Noční světlo",
  goal: "Postavíš zařízení, které se samo rozsvítí, když se setmí.",
  minutes: 30,
  legacyTaskId: "beginner-light-sensor",

  brief: [
    "Závěrečný projekt. Postavíš noční světlo, které se rozsvítí samo, jakmile je kolem tma.",
    "Fotorezistor je součástka, která mění odpor podle světla. Sedí na destičce, která ho napájí a posílá do Arduina číslo — velké ve světle, malé ve tmě. Ne jen zapnuto a vypnuto, ale celou škálu.",
    "Až to bude hotové, zakryj senzor rukou. LED se rozsvítí. To je celé — a přesně tohle si postavíš na táboře i naživo.",
  ],

  concept: {
    title: "analogRead vrací 0 až 1023",
    body:
      "digitalRead umí jen dvě odpovědi. analogRead jich umí 1024 — od 0 (nic) " +
      "po 1023 (naplno). Musíš si sám určit hranici, od které to bereš jako tmu. " +
      "Žádné správné číslo neexistuje: záleží na senzoru i na místnosti. " +
      "Vypiš si hodnotu do sériového monitoru a podívej se, co ti chodí.",
  },

  palette: ["breadboard-half", "photoresistor", "led-red", "resistor-220"],

  wiring: {
    parts: [
      { role: "arduino", type: "arduino-uno", label: "Arduino" },
      { role: "senzor", type: "photoresistor", label: "fotorezistor" },
      { role: "led", type: "led-red", label: "červená LED" },
      { role: "odpor", type: "resistor-220", label: "rezistor" },
    ],
    connections: [
      {
        from: { role: "arduino", pin: "5V" },
        to: { role: "senzor", pin: "vcc" },
        hint: "Pin senzoru označený VCC spoj s 5V — odtud bere napětí.",
      },
      {
        from: { role: "senzor", pin: "gnd" },
        to: { role: "arduino", pin: "GND-1" },
        hint: "GND senzoru spoj se zemí Arduina.",
      },
      {
        from: { role: "senzor", pin: "aout" },
        to: { role: "arduino", pin: "A0" },
        hint:
          "Výstup AO (analog out) veď na pin A0. Tudy chodí naměřená hodnota — " +
          "pin DO vedle něj umí jen ano/ne, a to nám nestačí.",
      },
      {
        from: { role: "arduino", pin: "D9" },
        to: { role: "led", pin: "anode" },
        through: ["resistor-220"],
        hint: "LED zapoj na pin 9 přes rezistor — jako v lekci o plynulém jasu.",
      },
      {
        from: { role: "led", pin: "cathode" },
        to: { role: "arduino", pin: "GND-1" },
        hint: "Katoda LED na GND.",
      },
    ],
  },

  wiringHints: [
    "Senzor potřebuje tři drátky: napájení (VCC), zem (GND) a výstup (AO).",
    "VCC na 5V, GND na GND, AO na A0. Pin DO nech volný.",
    "LED zapoj jako v lekci 5 — pin 9, přes rezistor, katoda na zem.",
    "Až budeš mít hotovo, spusť program a podívej se do sériového monitoru, jaká čísla chodí.",
  ],

  starterCode: `int senzor = A0;
int led = 9;

// Od jaké hodnoty budeš brát okolí jako tmu?
int hranice = 400;

void setup() {
  pinMode(led, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  // Přečti senzor, vypiš hodnotu a rozhodni o LED.

}
`,

  codeHints: [
    "Přečti senzor: int svetlo = analogRead(senzor);",
    "Vypiš si ho, ať víš, s čím pracuješ: Serial.println(svetlo);",
    "Rozhodni se: if (svetlo < hranice) { LED svítí } else { LED zhasne }",
    "Hranici si uprav podle toho, jaká čísla ti chodí. Neexistuje jedno správné.",
    "Zkus místo digitalWrite použít analogWrite — čím větší tma, tím jasnější světlo.",
  ],

  solution: `int senzor = A0;
int led = 9;
int hranice = 400;

void setup() {
  pinMode(led, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int svetlo = analogRead(senzor);
  Serial.println(svetlo);

  if (svetlo < hranice) {
    digitalWrite(led, HIGH);
  } else {
    digitalWrite(led, LOW);
  }

  delay(200);
}
`,

  checks: [
    {
      label: "Ve tmě se LED rozsvítí",
      iterations: 3,
      /* A0 je na Uno pin číslo 14. Nízká hodnota = málo světla. */
      pinInputs: { 14: 100 },
      verify: (frames) => ledEverOn(frames),
      hint:
        "Ve tmě LED nesvítí. Čteš hodnotu přes analogRead a porovnáváš ji s hranicí? " +
        "Ve tmě je hodnota MALÁ, takže podmínka má být „menší než“.",
    },
    {
      label: "Ve světle LED zhasne",
      iterations: 3,
      pinInputs: { 14: 900 },
      verify: (frames) => ledNeverOn(frames),
      hint:
        "Ve světle LED pořád svítí. Chybí ti větev else, která ji zhasne — " +
        "nebo máš podmínku otočenou.",
    },
    {
      label: "Hranice je někde mezi tmou a světlem",
      iterations: 3,
      pinInputs: { 14: 500 },
      /* Při střední hodnotě je správně obojí — jde jen o to, že program
         nespadl a rozhodl se. Dítě si smí zvolit vlastní hranici. */
      verify: (frames) => frames.length > 0,
      hint: "Program se při střední hodnotě zasekl. Zkontroluj podmínku.",
    },
  ],
};
