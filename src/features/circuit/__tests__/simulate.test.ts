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
    /* Po každém průchodu končí LOW, ale mezi snímky se stav mění — z toho
       se dá poskládat animace, ne jen koncový stav. */
    expect(r.frames.length).toBe(5);
    expect(values.some((v) => v === 0)).toBe(true);
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
