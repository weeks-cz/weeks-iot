import { buzzerSounded, type Lesson } from "../types";

/**
 * Lekce 6 — výstup, který není vidět.
 *
 * Přidává druhý smysl a připravuje finále: dítě už umí číst vstup
 * (tlačítko), řídit výstup (LED) a teď i vyrobit zvuk. Noční světlo
 * z toho pak poskládá celek.
 */
export const lesson6: Lesson = {
  slug: "zvuk",
  order: 6,
  title: "Zvuk na stisk",
  goal: "Vyrobíš tón a spojíš vstup s výstupem — zmáčkni a ozve se.",
  minutes: 25,
  legacyTaskId: "beginner-buzzer-button",

  brief: [
    "Až doteď šlo všechno vidět. Teď to bude slyšet.",
    "Bzučák je LED naopak: místo světla dělá zvuk. Řekneš mu frekvenci a on ji vydá — čím vyšší číslo, tím vyšší tón.",
    "Spojíš to s tlačítkem z lekce 3: zmáčkni a ozve se.",
  ],

  concept: {
    title: "tone místo digitalWrite",
    body:
      "Na bzučák se nepíše HIGH a LOW, ale tone(pin, frekvence). Frekvence je v hertzech: " +
      "440 Hz je komorní A, 262 Hz je střední C. noTone(pin) zvuk zase vypne. " +
      "Kdybys použil digitalWrite, ozvalo by se jen cvaknutí.",
  },

  palette: ["breadboard-half", "piezo-buzzer", "pushbutton"],

  wiring: {
    parts: [
      { role: "arduino", type: "arduino-uno", label: "Arduino" },
      { role: "bzucak", type: "piezo-buzzer", label: "bzučák" },
      { role: "tlacitko", type: "pushbutton", label: "tlačítko" },
    ],
    connections: [
      {
        from: { role: "arduino", pin: "D8" },
        to: { role: "bzucak", pin: "+" },
        hint: "Nožičku bzučáku označenou + spoj s pinem 8.",
      },
      {
        from: { role: "bzucak", pin: "-" },
        to: { role: "arduino", pin: "GND-1" },
        hint: "Nožičku označenou − spoj s GND.",
      },
      {
        from: { role: "arduino", pin: "D7" },
        to: { role: "tlacitko", pin: "1a" },
        hint: "Jednu stranu tlačítka na pin 7.",
      },
      {
        from: { role: "tlacitko", pin: "2a" },
        to: { role: "arduino", pin: "GND-1" },
        hint: "Druhou stranu tlačítka na GND.",
      },
    ],
  },

  wiringHints: [
    "Bzučák má nožičky označené + a −. Plus jde na pin, mínus na zem.",
    "Bzučák nepotřebuje rezistor, na rozdíl od LED.",
    "Tlačítko zapoj stejně jako v lekci 3: pin 7 a GND.",
  ],

  starterCode: `int bzucak = 8;
int tlacitko = 7;

void setup() {
  pinMode(bzucak, OUTPUT);
  pinMode(tlacitko, INPUT_PULLUP);
}

void loop() {
  // ÚKOL: Když je tlačítko zmáčknuté, hraj. Jinak mlč.
  //   1) if (digitalRead(tlacitko) == LOW) → tone(bzucak, 440)
  //   2) else → noTone(bzucak)

}
`,

  codeHints: [
    "Přečti tlačítko: if (digitalRead(tlacitko) == LOW) { ... }",
    "Uvnitř použij tone(bzucak, 440);",
    "Do větve else patří noTone(bzucak); jinak bude pípat pořád.",
    "Zkus jiné frekvence. 262 je C, 330 je E, 392 je G — dá se z toho složit akord.",
  ],

  solution: `int bzucak = 8;
int tlacitko = 7;

void setup() {
  pinMode(bzucak, OUTPUT);
  pinMode(tlacitko, INPUT_PULLUP);
}

void loop() {
  if (digitalRead(tlacitko) == LOW) {
    tone(bzucak, 440);
  } else {
    noTone(bzucak);
  }
}
`,

  checks: [
    {
      label: "Se zmáčknutým tlačítkem se ozve tón",
      iterations: 3,
      pinInputs: { 7: 0 },
      verify: (frames) => buzzerSounded(frames),
      hint:
        "Bzučák mlčí. Použil jsi tone(bzucak, 440)? A ptáš se na LOW — " +
        "zmáčknuté tlačítko je LOW, ne HIGH.",
    },
    {
      label: "S puštěným tlačítkem je ticho",
      iterations: 3,
      pinInputs: { 7: 1 },
      verify: (frames) => !buzzerSounded(frames),
      hint:
        "Bzučák pípá i bez stisku. Chybí ti noTone(bzucak) ve větvi else — " +
        "tone jednou spuštěný hraje dál, dokud ho nevypneš.",
    },
  ],
};
