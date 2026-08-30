import type { ComponentType } from "./types";

export interface PinSpec {
  name: string;                              // logical pin name
  dx: number;                                // PITCH offset from component origin
  dy: number;
}

export interface ComponentSpec {
  type: ComponentType;
  label: string;                             // Czech UI label
  wokwiTag: string;
  wokwiAttrs?: Record<string, string>;
  pins: PinSpec[];
  spanX: number;                             // PITCH units
  spanY: number;                             // PITCH units
  paletteIcon: string;                       // path under public/
  scale: number;                             // CSS transform scale to fit on PITCH grid
  /**
   * Posun KRESBY vůči pinům, v přirozených jednotkách prvku (před scale).
   *
   * Wokwi prvky mají nožičky tam, kde je má skutečná součástka — a to
   * skoro nikdy není na našich mřížkových bodech. Piny (kam se chytají
   * drátky a kudy se zapichuje do desky) proto stojí na mřížce a kresba
   * se posune tak, aby JEJÍ nožičky ležely přesně na nich. Hodnoty jsou
   * změřené z `element.pinInfo`; kdo mění scale, musí je přepočítat.
   */
  visualOffset?: { x: number; y: number };
  /**
   * Co to je, řečeno dítěti.
   *
   * Bez tohohle je paleta seznam neznámých slov. „Rezistor 220 Ω" nikomu
   * v deseti letech nic neříká; „brzda na proud, aby se LED nespálila" ano.
   */
  intro?: { what: string; why: string };
}

/**
 * Lidský název pinu.
 *
 * V obvodu se pin jmenuje „anode", protože tak se jmenuje v datech. Dítěti
 * se ale musí říct „delší nožička" — to je jediné, co na součástce v ruce
 * i na obrazovce opravdu pozná.
 */
export function pinLabel(type: ComponentType, pinName: string): string {
  const custom = PIN_LABELS[type]?.[pinName];
  if (custom) return custom;

  if (type === "arduino-uno") {
    if (/^D\d+$/.test(pinName)) return `pin ${pinName.slice(1)}`;
    if (/^A\d$/.test(pinName)) return `pin ${pinName} (měřicí)`;
    if (pinName.startsWith("GND")) return "GND (zem)";
    if (pinName === "5V" || pinName === "3.3V") return `${pinName} (napájení)`;
    return pinName;
  }

  if (type === "breadboard-half") {
    const rail = /^(top|bot)-(.)-\d+$/.exec(pinName);
    if (rail) return rail[2] === "+" ? "kladná lišta" : "záporná lišta";
    const row = /^row-([A-J])-(\d+)$/.exec(pinName);
    if (row) return `řada ${row[1]}, sloupec ${row[2]}`;
  }

  return pinName;
}

/**
 * Jméno pinu do krátké instrukce.
 *
 * „delší nožička (+)" je dobrý popis, ale v instrukci z toho vznikne
 * souvětí, které se láme na dva řádky. Uprostřed práce se čte jen krátká
 * fráze, takže tahle varianta jde na dřeň: „+", „pin 8", „GND".
 */
export function pinShort(type: ComponentType, pinName: string): string {
  const short = PIN_SHORT[type]?.[pinName];
  if (short) return short;

  if (type === "arduino-uno") {
    if (/^D\d+$/.test(pinName)) return `pin ${pinName.slice(1)}`;
    if (/^A\d$/.test(pinName)) return pinName;
    if (pinName.startsWith("GND")) return "GND";
    return pinName;
  }

  if (type === "breadboard-half") {
    const row = /^row-([A-J])-(\d+)$/.exec(pinName);
    if (row) return `${row[1]}${row[2]}`;
  }

  return pinName;
}

const PIN_SHORT: Partial<Record<ComponentType, Record<string, string>>> = {
  "led-red": { anode: "+", cathode: "−" },
  "led-yellow": { anode: "+", cathode: "−" },
  "led-green": { anode: "+", cathode: "−" },
  "led-blue": { anode: "+", cathode: "−" },
  "led-rgb": { r: "R", g: "G", b: "B", cathode: "−" },
  "resistor-220": { a: "nožička", b: "nožička" },
  "pushbutton": { "1a": "levá strana", "1b": "levá strana", "2a": "pravá strana", "2b": "pravá strana" },
  "piezo-buzzer": { "+": "+", "-": "−" },
  "potentiometer": { "terminal-a": "kraj", signal: "střed", "terminal-b": "druhý kraj" },
  "photoresistor": { vcc: "VCC", gnd: "GND", dout: "DO", aout: "AO" },
};

const PIN_LABELS: Partial<Record<ComponentType, Record<string, string>>> = {
  "led-red": { anode: "delší nožička (+)", cathode: "kratší nožička (−)" },
  "led-yellow": { anode: "delší nožička (+)", cathode: "kratší nožička (−)" },
  "led-green": { anode: "delší nožička (+)", cathode: "kratší nožička (−)" },
  "led-blue": { anode: "delší nožička (+)", cathode: "kratší nožička (−)" },
  "led-rgb": {
    r: "červená", g: "zelená", b: "modrá", cathode: "společná nožička (−)",
  },
  "resistor-220": { a: "levá nožička", b: "pravá nožička" },
  "pushbutton": {
    "1a": "levý horní kontakt", "1b": "levý dolní kontakt",
    "2a": "pravý horní kontakt", "2b": "pravý dolní kontakt",
  },
  "piezo-buzzer": { "+": "nožička +", "-": "nožička −" },
  "potentiometer": {
    "terminal-a": "krajní nožička", signal: "prostřední nožička (výstup)",
    "terminal-b": "druhá krajní nožička",
  },
  "photoresistor": {
    vcc: "VCC (napájení)", gnd: "GND (zem)",
    dout: "DO — jen ano/ne", aout: "AO — naměřená hodnota",
  },
};

function generateBreadboardHalfPins(): PinSpec[] {
  const pins: PinSpec[] = [];
  // Power rails (top + bottom)
  for (let x = 0; x < 30; x++) {
    pins.push({ name: `top-+-${x}`, dx: x, dy: 0 });
    pins.push({ name: `top-−-${x}`, dx: x, dy: 1 });
    pins.push({ name: `bot-+-${x}`, dx: x, dy: 13 });
    pins.push({ name: `bot-−-${x}`, dx: x, dy: 14 });
  }
  // Bus rows above trench: rows A..E, columns 1..30
  for (const row of ["A", "B", "C", "D", "E"]) {
    const dy = 2 + ["A", "B", "C", "D", "E"].indexOf(row);
    for (let col = 1; col <= 30; col++) {
      pins.push({ name: `row-${row}-${col}`, dx: col - 1, dy });
    }
  }
  // Below trench F..J: rows F..J, columns 1..30
  for (const row of ["F", "G", "H", "I", "J"]) {
    const dy = 8 + ["F", "G", "H", "I", "J"].indexOf(row);
    for (let col = 1; col <= 30; col++) {
      pins.push({ name: `row-${row}-${col}`, dx: col - 1, dy });
    }
  }
  return pins;
}

const led = (color: string): Omit<ComponentSpec, "type" | "label" | "paletteIcon" | "intro"> => ({
  wokwiTag: "wokwi-led",
  wokwiAttrs: { color },
  /* pinInfo: A=(25,42), C=(15,42) — ANODA JE V KRESBĚ VPRAVO. Původní spec
     ji měla vlevo, takže model věřil opačné nožičce, než jakou dítě na
     obrazovce vidělo. Scale 1.6 dělá z rozteče nožiček (10) přesně jednu
     rozteč mřížky (16). */
  pins: [
    { name: "cathode", dx: 2, dy: 5 },
    { name: "anode",   dx: 3, dy: 5 },
  ],
  spanX: 4, spanY: 6, scale: 1.6,
  visualOffset: { x: 5, y: 8 },
});

export const COMPONENT_REGISTRY: Record<ComponentType, ComponentSpec> = {
  "arduino-uno": {
    type: "arduino-uno",
    intro: {
      what: "Malý počítač o velikosti dlaně. Nemá obrazovku ani klávesnici — místo toho má po krajích řadu pinů, kterými ovládá všechno, co k nim připojíš.",
      why: "Je to mozek obvodu. Program, který napíšeš, běží právě v něm.",
    },
    label: "Arduino Uno",
    wokwiTag: "wokwi-arduino-uno",
    /* Piny přesně podle element.pinInfo (× scale 1,68 / PITCH). Zlomkové
       souřadnice jsou záměr: Arduino se do breadboardu nezapichuje, takže
       mřížku nepotřebuje — a značky díky tomu sedí přesně na kresbě,
       včetně fyzické mezery mezi D8 a D7. */
    pins: [
      { name: "AREF",  dx: 11.13,  dy: 0.945 },
      { name: "GND-1", dx: 12.127, dy: 0.945 },
      { name: "D13", dx: 13.125, dy: 0.945 }, { name: "D12", dx: 14.122, dy: 0.945 },
      { name: "D11", dx: 15.12,  dy: 0.945 }, { name: "D10", dx: 16.117, dy: 0.945 },
      { name: "D9",  dx: 17.115, dy: 0.945 }, { name: "D8",  dx: 18.165, dy: 0.945 },
      { name: "D7",  dx: 19.845, dy: 0.945 }, { name: "D6",  dx: 20.842, dy: 0.945 },
      { name: "D5",  dx: 21.84,  dy: 0.945 }, { name: "D4",  dx: 22.837, dy: 0.945 },
      { name: "D3",  dx: 23.835, dy: 0.945 }, { name: "D2",  dx: 24.832, dy: 0.945 },
      { name: "D1",  dx: 25.83,  dy: 0.945 }, { name: "D0",  dx: 26.828, dy: 0.945 },
      { name: "IOREF", dx: 13.755, dy: 20.107 },
      { name: "RESET", dx: 14.752, dy: 20.107 },
      { name: "3V3",   dx: 15.75,  dy: 20.107 },
      { name: "5V",    dx: 16.8,   dy: 20.107 },
      { name: "GND-2", dx: 17.797, dy: 20.107 },
      { name: "GND-3", dx: 18.795, dy: 20.107 },
      { name: "VIN",   dx: 19.793, dy: 20.107 },
      { name: "A0", dx: 21.84,  dy: 20.107 }, { name: "A1", dx: 22.837, dy: 20.107 },
      { name: "A2", dx: 23.835, dy: 20.107 }, { name: "A3", dx: 24.832, dy: 20.107 },
      { name: "A4", dx: 25.83,  dy: 20.107 }, { name: "A5", dx: 26.828, dy: 20.107 },
    ],
    spanX: 29, spanY: 22, scale: 1.68,
    paletteIcon: "/cad/palette/arduino-uno.png",
  },
  "breadboard-half": {
    type: "breadboard-half",
    intro: {
      what: "Deska plná dírek, do kterých se zapichují součástky. Nic se nepájí — všechno jde zase vytáhnout.",
      why: "Dírky ve stejném sloupci jsou uvnitř propojené. Dvě nožičky spojíš tím, že je zapíchneš do stejného sloupce.",
    },
    label: "Breadboard",
    wokwiTag: "wokwi-breadboard-half",
    pins: generateBreadboardHalfPins(),
    spanX: 30, spanY: 15, scale: 1.0,
    visualOffset: { x: -22, y: -8 },
    paletteIcon: "/cad/palette/breadboard-half.png",
  },
  "led-red":    { ...led("red"),    type: "led-red",
    intro: { what: "Světélko. Svítí, jen když jí proud teče správným směrem — je to dioda.", why: "Delší nožička je plus a patří k pinu, kratší je mínus a patří na zem. Obráceně nesvítí." },    label: "LED červená", paletteIcon: "/cad/palette/led-red.png" },
  "led-yellow": { ...led("yellow"), type: "led-yellow",
    intro: { what: "Světélko. Svítí, jen když jí proud teče správným směrem — je to dioda.", why: "Delší nožička je plus a patří k pinu, kratší je mínus a patří na zem. Obráceně nesvítí." }, label: "LED žlutá",   paletteIcon: "/cad/palette/led-yellow.png" },
  "led-green":  { ...led("green"),  type: "led-green",
    intro: { what: "Světélko. Svítí, jen když jí proud teče správným směrem — je to dioda.", why: "Delší nožička je plus a patří k pinu, kratší je mínus a patří na zem. Obráceně nesvítí." },  label: "LED zelená",  paletteIcon: "/cad/palette/led-green.png" },
  "led-blue":   { ...led("blue"),   type: "led-blue",
    intro: { what: "Světélko. Svítí, jen když jí proud teče správným směrem — je to dioda.", why: "Delší nožička je plus a patří k pinu, kratší je mínus a patří na zem. Obráceně nesvítí." },   label: "LED modrá",   paletteIcon: "/cad/palette/led-blue.png" },
  "led-rgb": {
    type: "led-rgb",
    intro: {
      what: "LED, která umí tři barvy naráz. Uvnitř jsou vlastně tři světélka.",
      why: "Každá barva má vlastní nožičku a vlastní pin; společná nožička jde na zem.",
    }, label: "LED RGB",
    wokwiTag: "wokwi-rgb-led",
    // scale=1.78: 42×73px → 75×130px; pins at R(8.5,44)→(1,5), COM(18,54)→(2,6), G(26.4,44)→(3,5), B(35.7,44)→(4,5)
    pins: [
      { name: "r",       dx: 1, dy: 5 },
      { name: "cathode", dx: 2, dy: 6 },
      { name: "g",       dx: 3, dy: 5 },
      { name: "b",       dx: 4, dy: 5 },
    ],
    spanX: 5, spanY: 8, scale: 1.78,
    paletteIcon: "/cad/palette/led-rgb.png",
  },
  "resistor-220": {
    type: "resistor-220",
    intro: {
      what: "Brzda na proud. Sama nic nedělá, ale propustí jen tolik, kolik LED unese.",
      why: "Bez ní by si LED vzala všechno, co jí Arduino nabídne, a spálila by se. Na jejím místě v obvodu nezáleží — hlavně ať je v cestě.",
    }, label: "Rezistor 220 Ω",
    wokwiTag: "wokwi-resistor",
    wokwiAttrs: { value: "220" },
    // scale=1.09: 59×11px → 64×12px; pin1(0,5.65)→(0,0), pin2(58.8,5.65)→(4,0); spacing 58.8×1.09≈64=4 PITCH
    pins: [{ name: "a", dx: 0, dy: 0 }, { name: "b", dx: 4, dy: 0 }],
    spanX: 4, spanY: 1, scale: 1.0884,
    visualOffset: { x: 0, y: -5.7 },
    paletteIcon: "/cad/palette/resistor-220.png",
  },
  "pushbutton": {
    type: "pushbutton",
    intro: {
      what: "Obyčejné tlačítko. Dokud ho držíš, propojí své dvě strany; jakmile pustíš, přeruší je.",
      why: "Arduino díky němu pozná, že se něco stalo. Je to jeho jediný způsob, jak se tě zeptat.",
    }, label: "Tlačítko",
    wokwiTag: "wokwi-pushbutton",
    wokwiAttrs: { color: "red" },
    // scale=1.0: 67×45px; left pins at x=0→dx=0, right at x=67→dx=4; top y=13→dy=1, bottom y=32→dy=2
    pins: [
      { name: "1a", dx: 0, dy: 1 }, { name: "2a", dx: 4, dy: 1 },
      { name: "1b", dx: 0, dy: 2 }, { name: "2b", dx: 4, dy: 2 },
    ],
    spanX: 5, spanY: 3, scale: 0.955,
    visualOffset: { x: 0, y: 2.63 },
    paletteIcon: "/cad/palette/pushbutton.png",
  },
  "piezo-buzzer": {
    type: "piezo-buzzer",
    intro: {
      what: "Bzučák. Dělá to co LED, ale slyšitelně — čím vyšší číslo mu pošleš, tím vyšší tón.",
      why: "Nožička + patří k pinu, nožička − na zem. Rezistor nepotřebuje.",
    }, label: "Piezo buzzer",
    wokwiTag: "wokwi-buzzer",
    // scale=1.6: 64×76px; + at natural(27,84)→(43,134)≈(3,8)×PITCH; - at (37,84)→(59,134)≈(4,8)×PITCH
    pins: [{ name: "+", dx: 3, dy: 8 }, { name: "-", dx: 4, dy: 8 }],
    spanX: 7, spanY: 9, scale: 1.6,
    visualOffset: { x: 3, y: -4 },
    paletteIcon: "/cad/palette/piezo-buzzer.png",
  },
  "potentiometer": {
    type: "potentiometer",
    intro: {
      what: "Otočný knoflík. Podle toho, jak ho natočíš, posílá do Arduina číslo od 0 do 1023.",
      why: "Krajní nožičky patří na napájení a na zem, prostřední posílá hodnotu.",
    }, label: "Potenciometr",
    wokwiTag: "wokwi-potentiometer",
    // scale=1.6: 76×76px; pins at y=68.5→dy=7; GND(29)→dx=3, SIG(39)→dx=4, VCC(49)→dx=5; spacing 10px×1.6=16=1 PITCH
    pins: [
      { name: "terminal-a", dx: 3, dy: 7 },
      { name: "signal",     dx: 4, dy: 7 },
      { name: "terminal-b", dx: 5, dy: 7 },
    ],
    spanX: 8, spanY: 8, scale: 1.6,
    visualOffset: { x: 1, y: 1.5 },
    paletteIcon: "/cad/palette/potentiometer.png",
  },
  "photoresistor": {
    type: "photoresistor",
    intro: {
      what: "Čidlo světla. Měří, kolik je kolem něj světla, a posílá číslo — velké ve světle, malé ve tmě.",
      why: "Potřebuje tři drátky: napájení (VCC), zem (GND) a výstup (AO), kterým hodnotu posílá.",
    }, label: "Fotorezistor",
    wokwiTag: "wokwi-photoresistor-sensor",
    // scale=1.78: 174×62px → 310×110px; all 4 pins at x=172→dx=19; VCC(y=16)→dy=2, GND(26)→dy=3, DO(35.8)→dy=4, AO(45.5)→dy=5
    pins: [
      { name: "vcc",  dx: 19, dy: 2 },
      { name: "gnd",  dx: 19, dy: 3 },
      { name: "dout", dx: 19, dy: 4 },
      { name: "aout", dx: 19, dy: 5 },
    ],
    spanX: 20, spanY: 7, scale: 1.6327,
    visualOffset: { x: 14.2, y: 3.6 },
    paletteIcon: "/cad/palette/photoresistor.png",
  },
};

export function getComponentSpec(type: ComponentType): ComponentSpec {
  const spec = COMPONENT_REGISTRY[type];
  if (!spec) throw new Error(`Unknown ComponentType: ${type}`);
  return spec;
}
