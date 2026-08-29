import { describe, expect, it } from "vitest";
import { runProgram } from "../simulate";
import type { Circuit, CircuitComponent, Wire } from "../types";

function comp(id: string, type: CircuitComponent["type"]): CircuitComponent {
  return { id, type, x: 0, y: 0, rotation: 0 };
}

let seq = 0;
function w(a: [string, string], b: [string, string]): Wire {
  return {
    id: `w${++seq}`,
    from: { compId: a[0], pinName: a[1] },
    to: { compId: b[0], pinName: b[1] },
  };
}

const UNO = comp("uno", "arduino-uno");
const LED = comp("led", "led-red");
const RES = comp("r", "resistor-220");

/** LED na D8 přes rezistor, katoda na zem. Správně zapojeno. */
function correctCircuit(): Circuit {
  return {
    comps: [UNO, LED, RES],
    wires: [
      w(["uno", "D8"], ["r", "a"]),
      w(["r", "b"], ["led", "anode"]),
      w(["led", "cathode"], ["uno", "GND-1"]),
    ],
  };
}

/** Totéž zapojení, ale na pin 9 — jen ten umí plynulý jas. */
function pwmWires(): Wire[] {
  return [
    w(["uno", "D9"], ["r", "a"]),
    w(["r", "b"], ["led", "anode"]),
    w(["led", "cathode"], ["uno", "GND-1"]),
  ];
}

const BLINK = `
  void setup() { pinMode(8, OUTPUT); }
  void loop() {
    digitalWrite(8, HIGH);
    delay(500);
    digitalWrite(8, LOW);
    delay(500);
  }
`;

describe("LED svítí, protože jí teče proud", () => {
  it("správné zapojení a HIGH → svítí", () => {
    const r = runProgram(
      "void setup() { pinMode(8, OUTPUT); digitalWrite(8, HIGH); }",
      correctCircuit(),
      { iterations: 0 },
    );
    expect(r.ok).toBe(true);
    expect(r.frames[0]!.leds[0]!.brightness).toBeGreaterThan(0);
  });

  it("správné zapojení a LOW → nesvítí", () => {
    const r = runProgram(
      "void setup() { pinMode(8, OUTPUT); digitalWrite(8, LOW); }",
      correctCircuit(),
      { iterations: 0 },
    );
    expect(r.frames[0]!.leds[0]!.brightness).toBe(0);
  });

  it("SPRÁVNÝ kód a ŠPATNÉ zapojení → nesvítí", () => {
    // Tohle je jádro celého emulátoru. Kdyby se přehrával očekávaný
    // výsledek, LED by svítila i u obvodu, který nikdy fungovat nemůže —
    // a dítě by se nenaučilo nic.
    const bezZeme: Circuit = {
      comps: [UNO, LED, RES],
      wires: [w(["uno", "D8"], ["r", "a"]), w(["r", "b"], ["led", "anode"])],
    };
    const r = runProgram(
      "void setup() { pinMode(8, OUTPUT); digitalWrite(8, HIGH); }",
      bezZeme,
      { iterations: 0 },
    );
    expect(r.frames[0]!.leds[0]!.brightness).toBe(0);
  });

  it("LED bez rezistoru → nesvítí", () => {
    /* Přímo na pin je nejčastější začátečnická chyba a jediná, po které
       LED opravdu odejde. Dřív tady simulace svítila: ptala se přes
       findPath s `through`, jenže to je seznam POVOLENÝCH typů, ne
       vyžadovaných, takže prošla i cesta vedoucí rovnou přes LED. */
    const bezOdporu: Circuit = {
      comps: [UNO, LED],
      wires: [w(["uno", "D8"], ["led", "anode"]), w(["led", "cathode"], ["uno", "GND-1"])],
    };
    const r = runProgram(
      "void setup() { pinMode(8, OUTPUT); digitalWrite(8, HIGH); }",
      bezOdporu,
      { iterations: 0 },
    );
    expect(r.frames[0]!.leds[0]!.brightness).toBe(0);
  });

  it("rezistor jen položený na desce se nepočítá", () => {
    /* „Mám ho" není totéž co „použil jsem ho". */
    const nezapojeny: Circuit = {
      comps: [UNO, LED, RES],
      wires: [w(["uno", "D8"], ["led", "anode"]), w(["led", "cathode"], ["uno", "GND-1"])],
    };
    const r = runProgram(
      "void setup() { pinMode(8, OUTPUT); digitalWrite(8, HIGH); }",
      nezapojeny,
      { iterations: 0 },
    );
    expect(r.frames[0]!.leds[0]!.brightness).toBe(0);
  });

  it("rezistor na straně katody chrání stejně dobře", () => {
    /* Elektricky je jedno, na které noze je — smyčka je jedna. */
    const naKatode: Circuit = {
      comps: [UNO, LED, RES],
      wires: [
        w(["uno", "D8"], ["led", "anode"]),
        w(["led", "cathode"], ["r", "a"]),
        w(["r", "b"], ["uno", "GND-1"]),
      ],
    };
    const r = runProgram(
      "void setup() { pinMode(8, OUTPUT); digitalWrite(8, HIGH); }",
      naKatode,
      { iterations: 0 },
    );
    expect(r.frames[0]!.leds[0]!.brightness).toBeGreaterThan(0);
  });

  it("LED zapojená na jiný pin, než program řídí → nesvítí", () => {
    const jinyPin: Circuit = {
      comps: [UNO, LED, RES],
      wires: [
        w(["uno", "D9"], ["r", "a"]),
        w(["r", "b"], ["led", "anode"]),
        w(["led", "cathode"], ["uno", "GND-1"]),
      ],
    };
    const r = runProgram(
      "void setup() { pinMode(8, OUTPUT); digitalWrite(8, HIGH); }",
      jinyPin,
      { iterations: 0 },
    );
    expect(r.frames[0]!.leds[0]!.brightness).toBe(0);
  });

  it("prohozená anoda a katoda → nesvítí", () => {
    // LED je dioda. Obráceně nesvítí, a to je lekce sama o sobě.
    const obracene: Circuit = {
      comps: [UNO, LED, RES],
      wires: [
        w(["uno", "D8"], ["r", "a"]),
        w(["r", "b"], ["led", "cathode"]),
        w(["led", "anode"], ["uno", "GND-1"]),
      ],
    };
    const r = runProgram(
      "void setup() { pinMode(8, OUTPUT); digitalWrite(8, HIGH); }",
      obracene,
      { iterations: 0 },
    );
    expect(r.frames[0]!.leds[0]!.brightness).toBe(0);
  });
});

describe("blikání se pozná ze snímků", () => {
  it("LED se ve snímcích střídavě rozsvěcí a zhasíná", () => {
    const r = runProgram(BLINK, correctCircuit(), { iterations: 4 });
    const values = r.frames.map((f) => (f.leds[0]!.brightness > 0 ? 1 : 0));
    /* Rozsvícení je uvnitř jednoho průchodu smyčky. Kdyby se snímalo až
       na jejím konci, viděly by se samé nuly a blikání by z běhu nešlo
       poznat — proto se snímá vždycky, když uplyne čas. */
    expect(values).toContain(1);
    expect(values).toContain(0);
  });

  it("bez delay není co vidět — stav se nestihne projevit", () => {
    /* Fyzikálně pravdivé a je to obsah lekce 2: co netrvá, to není vidět.
       Rozsvícení a zhasnutí bez pauzy proběhne v mikrosekundách. */
    const r = runProgram(
      `void setup() { pinMode(8, OUTPUT); }
       void loop() { digitalWrite(8, HIGH); digitalWrite(8, LOW); }`,
      correctCircuit(),
      { iterations: 4 },
    );
    expect(r.frames.every((f) => f.leds[0]!.brightness === 0)).toBe(true);
  });

  it("přechod jasu projde víc než dvěma úrovněmi", () => {
    const r = runProgram(
      `void setup() { pinMode(9, OUTPUT); }
       void loop() {
         for (int jas = 0; jas <= 255; jas++) { analogWrite(9, jas); delay(5); }
       }`,
      { ...correctCircuit(), wires: pwmWires() },
      { iterations: 1 },
    );
    const levels = new Set(r.frames.map((f) => f.leds[0]!.brightness));
    levels.delete(0);
    expect(levels.size).toBeGreaterThan(2);
  });

  it("virtuální čas roste podle delay", () => {
    const r = runProgram(BLINK, correctCircuit(), { iterations: 3 });
    expect(r.frames.at(-1)!.elapsedMs).toBe(3000);
  });
});

describe("tlačítko a vstupy", () => {
  it("stisknuté tlačítko program přečte", () => {
    const btn = comp("btn", "pushbutton");
    const circuit: Circuit = {
      comps: [UNO, LED, RES, btn],
      wires: [
        w(["uno", "D8"], ["r", "a"]),
        w(["r", "b"], ["led", "anode"]),
        w(["led", "cathode"], ["uno", "GND-1"]),
      ],
    };
    const src = `
      void setup() { pinMode(7, INPUT); pinMode(8, OUTPUT); }
      void loop() { digitalWrite(8, digitalRead(7)); }
    `;
    const stisk = runProgram(src, circuit, {
      iterations: 1,
      pinInputs: new Map([[7, 1]]),
    });
    expect(stisk.frames.at(-1)!.leds[0]!.brightness).toBeGreaterThan(0);

    const bezStisku = runProgram(src, circuit, {
      iterations: 1,
      pinInputs: new Map([[7, 0]]),
    });
    expect(bezStisku.frames.at(-1)!.leds[0]!.brightness).toBe(0);
  });

  it("analogová hodnota dojde do programu", () => {
    const r = runProgram(
      `void setup() { Serial.begin(9600); }
       void loop() { Serial.println(analogRead(A3)); }`,
      correctCircuit(),
      { iterations: 1, pinInputs: new Map([[17, 700]]) },
    );
    expect(r.frames.at(-1)!.serial.join("")).toContain("700");
  });
});

describe("chyby v kódu", () => {
  it("chyba překladu vrátí hlášku a řádek, nespadne", () => {
    const r = runProgram("void setup() { pinMode(8, OUTPUT) }", correctCircuit());
    expect(r.ok).toBe(false);
    expect(r.error?.message).toMatch(/středník/i);
  });

  it("běhová chyba vrátí snímky až do místa pádu", () => {
    const r = runProgram(
      `void setup() { pinMode(8, OUTPUT); }
       void loop() { digitalWrite(8, HIGH); digitalWrite(neznama, LOW); }`,
      correctCircuit(),
      { iterations: 2 },
    );
    expect(r.ok).toBe(false);
    /* Snímek ze setupu tam je — dítě vidí, kam se program dostal. */
    expect(r.frames.length).toBeGreaterThan(0);
  });

  it("nekonečná smyčka nezamrzne", () => {
    const start = Date.now();
    const r = runProgram(
      "void setup() { } void loop() { while (true) { } }",
      correctCircuit(),
      { iterations: 1 },
    );
    expect(r.ok).toBe(false);
    expect(Date.now() - start).toBeLessThan(10_000);
  });
});

describe("tlačítko v obvodu opravdu něco dělá", () => {
  /* Do téhle chvíle se vstupy braly jen z konfigurace: kontrola lekce si
     nastavila „na pinu 7 je nula" a tlačítko v obvodu bylo dekorace. Dítě
     si ho v lekci o tlačítku nemohlo zmáčknout a nic zjistit. */
  const btn = comp("btn", "pushbutton");

  function tlacitkoNaPinu7(): Circuit {
    return {
      comps: [UNO, LED, RES, btn],
      wires: [
        w(["uno", "D8"], ["r", "a"]),
        w(["r", "b"], ["led", "anode"]),
        w(["led", "cathode"], ["uno", "GND-1"]),
        w(["uno", "D7"], ["btn", "1a"]),
        w(["btn", "2a"], ["uno", "GND-1"]),
      ],
    };
  }

  const SRC = `
    void setup() { pinMode(7, INPUT_PULLUP); pinMode(8, OUTPUT); }
    void loop() {
      if (digitalRead(7) == LOW) { digitalWrite(8, HIGH); } else { digitalWrite(8, LOW); }
    }
  `;

  it("puštěné tlačítko čte pin nahoře — LED nesvítí", () => {
    const r = runProgram(SRC, tlacitkoNaPinu7(), { iterations: 2 });
    expect(r.frames.at(-1)!.leds[0]!.brightness).toBe(0);
  });

  it("zmáčknuté tlačítko stáhne pin k zemi — LED se rozsvítí", () => {
    const r = runProgram(SRC, tlacitkoNaPinu7(), {
      iterations: 2,
      inputs: { pressed: new Set(["btn"]) },
    });
    expect(r.frames.at(-1)!.leds[0]!.brightness).toBeGreaterThan(0);
  });

  it("nezapojené tlačítko obvod neovlivní", () => {
    /* Zmáčknout tlačítko, které nikam nevede, nesmí nic udělat — jinak by
       lekce prošla i s obvodem, který dítě nezapojilo. */
    const bezDratku: Circuit = {
      comps: [UNO, LED, RES, btn],
      wires: [
        w(["uno", "D8"], ["r", "a"]),
        w(["r", "b"], ["led", "anode"]),
        w(["led", "cathode"], ["uno", "GND-1"]),
      ],
    };

    const r = runProgram(SRC, bezDratku, {
      iterations: 2,
      inputs: { pressed: new Set(["btn"]) },
    });
    expect(r.frames.at(-1)!.leds[0]!.brightness).toBe(0);
  });

  it("hodnota zadaná kontrolou přebíjí obvod", () => {
    /* Kontrola lekce musí umět říct „senzor hlásí tmu" bez ohledu na to,
       co v obvodu je — jinak by se noční světlo nedalo otestovat. */
    const r = runProgram(
      `void setup() { pinMode(7, INPUT_PULLUP); pinMode(8, OUTPUT); }
       void loop() {
         if (digitalRead(7) == LOW) { digitalWrite(8, HIGH); } else { digitalWrite(8, LOW); }
       }`,
      tlacitkoNaPinu7(),
      { iterations: 2, pinInputs: new Map([[7, 0]]) },
    );
    expect(r.frames.at(-1)!.leds[0]!.brightness).toBeGreaterThan(0);
  });
});
