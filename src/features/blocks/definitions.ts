/**
 * Jak bloky vypadají — JSON pro `Blockly.common.defineBlocksWithJsonArray`.
 *
 * Co bloky DĚLAJÍ, je v `program.ts` (překlad do Arduino C). Tady je jen
 * podoba: český text, barva a okénka. Text je věta, kterou si dítě přečte
 * nahlas („na pin 8 pošli HIGH"), ne název funkce — název funkce uvidí
 * v panelu s kódem pod bloky a přepínačem „Chci psát kód".
 *
 * Barvy podle druhu, ne podle nálady: piny tyrkysové (technika, stejně
 * jako na webu), čas a zvuk fialové, rozhodování zelené, čísla oranžová.
 */

const C = {
  program: "#232741",
  pins: "#0891B2",
  time: "#7C3AED",
  logic: "#059669",
  values: "#D97706",
  serial: "#4F46E5",
} as const;

const PIN = { type: "field_number", name: "PIN", value: 8, min: 0, max: 13, precision: 1 };

export const BLOCK_DEFINITIONS = [
  {
    type: "arduino_program",
    message0: "Program pro Arduino",
    message1: "na začátku jednou %1",
    args1: [{ type: "input_statement", name: "SETUP" }],
    message2: "pak pořád dokola %1",
    args2: [{ type: "input_statement", name: "LOOP" }],
    colour: C.program,
    tooltip: "Co je v „na začátku jednou“, proběhne po zapnutí. Co je v „pak pořád dokola“, opakuje se, dokud Arduino běží.",
  },
  {
    type: "pin_mode",
    message0: "nastav pin %1 jako %2",
    args0: [
      PIN,
      {
        type: "field_dropdown",
        name: "MODE",
        options: [
          ["výstup", "OUTPUT"],
          ["vstup s tlačítkem", "INPUT_PULLUP"],
        ],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: C.pins,
    tooltip: "Výstup = pin něco ovládá (LED, bzučák). Vstup = pin poslouchá (tlačítko).",
  },
  {
    type: "digital_write",
    message0: "na pin %1 pošli %2",
    args0: [
      PIN,
      {
        type: "field_dropdown",
        name: "LEVEL",
        options: [
          ["HIGH (zapnuto)", "HIGH"],
          ["LOW (vypnuto)", "LOW"],
        ],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: C.pins,
    tooltip: "HIGH pin zapne, LOW vypne.",
  },
  {
    type: "analog_write",
    message0: "jas pinu %1 na %2",
    args0: [{ ...PIN, value: 9 }, { type: "input_value", name: "VALUE" }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: C.pins,
    tooltip: "Jas od 0 (zhasnuto) do 255 (naplno). Funguje na pinech s vlnovkou: 3, 5, 6, 9, 10, 11.",
  },
  {
    type: "delay_ms",
    message0: "počkej %1 ms",
    args0: [{ type: "field_number", name: "MS", value: 500, min: 0, precision: 1 }],
    previousStatement: null,
    nextStatement: null,
    colour: C.time,
    tooltip: "1000 ms je jedna vteřina.",
  },
  {
    type: "tone_play",
    message0: "tón na pinu %1 %2 Hz",
    args0: [PIN, { type: "field_number", name: "HZ", value: 440, min: 31, max: 5000, precision: 1 }],
    previousStatement: null,
    nextStatement: null,
    colour: C.time,
    tooltip: "Čím větší číslo, tím vyšší tón. 440 Hz je komorní A.",
  },
  {
    type: "tone_stop",
    message0: "ztiš pin %1",
    args0: [PIN],
    previousStatement: null,
    nextStatement: null,
    colour: C.time,
    tooltip: "Spuštěný tón hraje, dokud ho tímhle nevypneš.",
  },
  {
    type: "serial_begin",
    message0: "zapni výpis do počítače",
    previousStatement: null,
    nextStatement: null,
    colour: C.serial,
    tooltip: "Bez tohohle „vypiš“ nic neukáže.",
  },
  {
    type: "serial_println",
    message0: "vypiš %1",
    args0: [{ type: "input_value", name: "VALUE" }],
    previousStatement: null,
    nextStatement: null,
    colour: C.serial,
    tooltip: "Pošle číslo do výpisu pod obvodem.",
  },
  {
    type: "if_else",
    message0: "když %1",
    args0: [{ type: "input_value", name: "COND", check: "Boolean" }],
    message1: "udělej %1",
    args1: [{ type: "input_statement", name: "DO" }],
    message2: "jinak %1",
    args2: [{ type: "input_statement", name: "ELSE" }],
    previousStatement: null,
    nextStatement: null,
    colour: C.logic,
    tooltip: "Když platí podmínka, udělá první část. Jinak druhou.",
  },
  {
    type: "if_only",
    message0: "když %1",
    args0: [{ type: "input_value", name: "COND", check: "Boolean" }],
    message1: "udělej %1",
    args1: [{ type: "input_statement", name: "DO" }],
    previousStatement: null,
    nextStatement: null,
    colour: C.logic,
  },
  {
    type: "repeat_range",
    message0: "opakuj od %1 do %2 %3",
    args0: [
      { type: "field_number", name: "FROM", value: 0, precision: 1 },
      { type: "field_number", name: "TO", value: 255, precision: 1 },
      {
        type: "field_dropdown",
        name: "DIR",
        options: [
          ["nahoru", "UP"],
          ["dolů", "DOWN"],
        ],
      },
    ],
    message1: "%1",
    args1: [{ type: "input_statement", name: "DO" }],
    previousStatement: null,
    nextStatement: null,
    colour: C.logic,
    tooltip: "Projede čísla od–do po jedné. Aktuální číslo je v bloku „hodnota z opakování“.",
  },
  {
    type: "number",
    message0: "%1",
    args0: [{ type: "field_number", name: "NUM", value: 0 }],
    output: "Number",
    colour: C.values,
  },
  {
    type: "level",
    message0: "%1",
    args0: [
      {
        type: "field_dropdown",
        name: "LEVEL",
        options: [
          ["LOW", "LOW"],
          ["HIGH", "HIGH"],
        ],
      },
    ],
    output: null,
    colour: C.values,
  },
  {
    type: "digital_read",
    message0: "přečti pin %1",
    args0: [{ ...PIN, value: 7 }],
    output: null,
    colour: C.pins,
    tooltip: "Tlačítko s „vstupem s tlačítkem“: zmáčknuté je LOW, puštěné HIGH.",
  },
  {
    type: "analog_read",
    message0: "přečti analogový pin %1",
    args0: [
      {
        type: "field_dropdown",
        name: "PIN",
        options: ["A0", "A1", "A2", "A3", "A4", "A5"].map((p) => [p, p]),
      },
    ],
    output: "Number",
    colour: C.pins,
    tooltip: "Číslo od 0 do 1023. U světelného senzoru: čím víc světla, tím větší.",
  },
  {
    type: "compare",
    message0: "%1 %2 %3",
    args0: [
      { type: "input_value", name: "A" },
      {
        type: "field_dropdown",
        name: "OP",
        options: [
          ["=", "EQ"],
          ["<", "LT"],
          [">", "GT"],
          ["≤", "LTE"],
          ["≥", "GTE"],
          ["≠", "NEQ"],
        ],
      },
      { type: "input_value", name: "B" },
    ],
    inputsInline: true,
    output: "Boolean",
    colour: C.logic,
  },
  {
    type: "loop_value",
    message0: "hodnota z opakování",
    output: "Number",
    colour: C.values,
    tooltip: "Číslo, na kterém je právě opakování, ve kterém tenhle blok je.",
  },
] as const;
