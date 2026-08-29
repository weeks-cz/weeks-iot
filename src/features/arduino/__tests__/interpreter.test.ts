import { describe, expect, it } from "vitest";
import { createBoard, emptyBoardState, type BoardState } from "../board";
import { Interpreter, RuntimeError, compile } from "../interpreter";

function run(source: string, loops = 1, inputs: Record<number, number> = {}) {
  const state: BoardState = emptyBoardState();
  for (const [pin, value] of Object.entries(inputs)) {
    state.inputs.set(Number(pin), value);
  }

  const compiled = compile(source);
  if (!compiled.ok) throw new Error(`nepřeložilo se: ${compiled.error?.message}`);

  const interp = new Interpreter(compiled.program!, createBoard(state));
  interp.runSetup();
  for (let i = 0; i < loops; i++) interp.runLoopOnce();
  return state;
}

describe("základní běh", () => {
  it("setup se spustí a nastaví piny", () => {
    const s = run("void setup() { pinMode(8, OUTPUT); }");
    expect(s.modes.get(8)).toBe("output");
  });

  it("digitalWrite zapíše na pin", () => {
    const s = run("void setup() { pinMode(8, OUTPUT); digitalWrite(8, HIGH); }");
    expect(s.outputs.get(8)).toBe(255);
  });

  it("loop běží tolikrát, kolikrát se řekne", () => {
    const s = run("int n = 0;\nvoid loop() { n++; Serial.println(n); }", 3);
    expect(s.serial.map((l) => l.text.trim())).toEqual(["1", "2", "3"]);
  });

  it("globální proměnná drží hodnotu mezi průchody", () => {
    // Bez toho by se počítadlo v každém loopu resetovalo.
    const s = run("int n = 5;\nvoid loop() { n = n + 1; }", 3);
    expect(s.serial).toEqual([]);
    expect(s.elapsedMs).toBe(0);
  });

  it("delay posouvá virtuální čas, ale neusíná", () => {
    const start = Date.now();
    const s = run("void loop() { delay(1000); }", 10);
    expect(s.elapsedMs).toBe(10_000);
    /* Deset sekund běhu se spočítá okamžitě — jinak by prohlížeč zamrzl. */
    expect(Date.now() - start).toBeLessThan(1000);
  });
});

describe("lekce 1 — LED tlačítkem", () => {
  const LESSON = `
    int tlacitko = 7;
    int led = 8;

    void setup() {
      pinMode(tlacitko, INPUT);
      pinMode(led, OUTPUT);
    }

    void loop() {
      if (digitalRead(tlacitko) == HIGH) {
        digitalWrite(led, HIGH);
      } else {
        digitalWrite(led, LOW);
      }
    }
  `;

  it("při stisknutém tlačítku LED svítí", () => {
    const s = run(LESSON, 1, { 7: 1 });
    expect(s.outputs.get(8)).toBe(255);
  });

  it("při puštěném tlačítku LED nesvítí", () => {
    const s = run(LESSON, 1, { 7: 0 });
    expect(s.outputs.get(8)).toBe(0);
  });

  it("funguje i s jiným, ale správným zápisem", () => {
    // Tohle je jádro věci: dítě, které to napsalo jinak, musí vidět,
    // že to funguje. Přehraná animace by mu ukázala prázdno.
    const jinak = `
      void setup() { pinMode(7, INPUT); pinMode(8, OUTPUT); }
      void loop() { digitalWrite(8, digitalRead(7)); }
    `;
    expect(run(jinak, 1, { 7: 1 }).outputs.get(8)).toBe(255);
    expect(run(jinak, 1, { 7: 0 }).outputs.get(8)).toBe(0);
  });
});

describe("blikání a smyčky", () => {
  it("semafor projede tři barvy", () => {
    const s = run(
      `
      void setup() { pinMode(2, OUTPUT); pinMode(3, OUTPUT); pinMode(4, OUTPUT); }
      void loop() {
        digitalWrite(2, HIGH); delay(500); digitalWrite(2, LOW);
        digitalWrite(3, HIGH); delay(500); digitalWrite(3, LOW);
        digitalWrite(4, HIGH); delay(500); digitalWrite(4, LOW);
      }
      `,
      1,
    );
    expect(s.elapsedMs).toBe(1500);
  });

  it("for zvládne projet pole pinů", () => {
    const s = run(
      "void loop() { for (int i = 2; i <= 4; i++) { digitalWrite(i, HIGH); } }",
      1,
    );
    expect([s.outputs.get(2), s.outputs.get(3), s.outputs.get(4)]).toEqual([255, 255, 255]);
  });

  it("break ze smyčky funguje", () => {
    const s = run(
      "void loop() { for (int i = 0; i < 10; i++) { if (i == 2) { break; } Serial.println(i); } }",
      1,
    );
    expect(s.serial.map((l) => l.text.trim())).toEqual(["0", "1"]);
  });

  it("proměnná z hlavičky for nepřeteče ven", () => {
    expect(() =>
      run("void loop() { for (int i = 0; i < 2; i++) {} Serial.println(i); }", 1),
    ).toThrow(RuntimeError);
  });
});

describe("analogové vstupy a výstupy", () => {
  it("analogRead přečte hodnotu z pinu", () => {
    const s = run(
      "void setup() { Serial.begin(9600); }\nvoid loop() { Serial.println(analogRead(A3)); }",
      1,
      { 17: 512 },
    );
    expect(s.serial[0]!.text.trim()).toBe("512");
  });

  it("analogWrite drží 0 až 255", () => {
    const s = run("void loop() { analogWrite(9, 300); analogWrite(10, -5); }", 1);
    expect(s.outputs.get(9)).toBe(255);
    expect(s.outputs.get(10)).toBe(0);
  });

  it("map převede rozsah", () => {
    const s = run(
      "void setup() { Serial.println(map(512, 0, 1023, 0, 255)); }",
    );
    expect(Number(s.serial[0]!.text.trim())).toBeGreaterThan(120);
  });

  it("INPUT_PULLUP drží pin nahoře, dokud ho nic nestáhne", () => {
    const s = run(
      "void setup() { pinMode(7, INPUT_PULLUP); }\nvoid loop() { Serial.println(digitalRead(7)); }",
      1,
    );
    expect(s.serial[0]!.text.trim()).toBe("1");
  });
});

describe("ochrana proti zaseknutí", () => {
  it("nekonečná smyčka skončí hláškou, ne zamrznutím", () => {
    // while(true){} je v Arduinu normální, v prohlížeči by zabil tab.
    const compiled = compile("void loop() { while (true) { } }");
    const interp = new Interpreter(compiled.program!, createBoard(emptyBoardState()));
    interp.setStepBudget(5000);
    interp.runSetup();
    expect(() => interp.runLoopOnce()).toThrow(RuntimeError);
  });

  it("hláška o zaseknutí radí delay", () => {
    const compiled = compile("void loop() { while (true) { } }");
    const interp = new Interpreter(compiled.program!, createBoard(emptyBoardState()));
    interp.setStepBudget(2000);
    interp.runSetup();
    try {
      interp.runLoopOnce();
      expect.unreachable();
    } catch (e) {
      expect((e as RuntimeError).message).toMatch(/delay/i);
    }
  });
});

describe("běhové chyby mluví k dítěti", () => {
  it("neznámá proměnná poradí, jak ji vytvořit", () => {
    try {
      run("void loop() { digitalWrite(neexistuje, HIGH); }");
      expect.unreachable();
    } catch (e) {
      expect((e as RuntimeError).message).toMatch(/int neexistuje/);
      expect((e as RuntimeError).line).toBeGreaterThan(0);
    }
  });

  it("překlep ve funkci hlásí překlep", () => {
    try {
      run("void loop() { digitlWrite(8, HIGH); }");
      expect.unreachable();
    } catch (e) {
      expect((e as RuntimeError).message).toMatch(/překlep/i);
    }
  });

  it("dělení nulou nespadne tiše", () => {
    expect(() => run("void loop() { int x = 5 / 0; }")).toThrow(/nulou/i);
  });

  it("Serial s překlepem poradí správné metody", () => {
    try {
      run("void setup() { Serial.printline(1); }");
      expect.unreachable();
    } catch (e) {
      expect((e as RuntimeError).message).toMatch(/Serial\.println/);
    }
  });
});

describe("compile", () => {
  it("chybu překladu vrací, nevyhazuje", () => {
    const r = compile("void setup() { pinMode(8, OUTPUT) }");
    expect(r.ok).toBe(false);
    expect(r.error?.message).toMatch(/středník/i);
    expect(r.error?.line).toBe(1);
  });

  it("hlášky nejsou anglicky", () => {
    for (const src of ["void x( {", "int = ;", "void loop() { if ( }"]) {
      const r = compile(src);
      if (!r.ok) expect(r.error!.message).not.toMatch(/unexpected|token/i);
    }
  });
});
