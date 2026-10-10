import { describe, expect, it } from "vitest";
import { lesson1, lesson3 } from "@/features/lessons/content";
import { referenceCircuit } from "@/features/lessons/reference-circuit";
import { runProgram, shortCircuitInCircuit } from "../simulate";
import type { Circuit, Wire } from "../types";

/* Zkrat je stav, do kterého se deska nesmí dostat. Statický se pozná bez
   běhu: 5 V přímo na zemi. Běhový: výstup v HIGH přímo na zemi, nebo LOW
   přímo na 5 V. Vstup s tlačítkem k zemi zkrat není — jen čte. */

let seq = 0;
function wire(a: [string, string], b: [string, string]): Wire {
  return {
    id: `z${++seq}`,
    from: { compId: a[0], pinName: a[1] },
    to: { compId: b[0], pinName: b[1] },
  };
}

const base = referenceCircuit(lesson1.wiring);
const uno = base.comps.find((c) => c.type === "arduino-uno")!;

const SHORT_5V = "Zkrat! 5V je spojené přímo se zemí — ve skutečnosti by se deska mohla poškodit.";

describe("statický zkrat 5 V → zem", () => {
  it("5 V přímo na GND se pozná bez běhu programu", () => {
    const c: Circuit = {
      comps: base.comps,
      wires: [...base.wires, wire([uno.id, "5V"], [uno.id, "GND-1"])],
    };
    expect(shortCircuitInCircuit(c)).toBe(SHORT_5V);
  });

  it("program na takovém obvodu neběží", () => {
    const c: Circuit = {
      comps: base.comps,
      wires: [...base.wires, wire([uno.id, "5V"], [uno.id, "GND-1"])],
    };
    const run = runProgram("void loop() { delay(10); }", c, { iterations: 2 });
    expect(run.ok).toBe(false);
    expect(run.shortCircuit).toBe(SHORT_5V);
    expect(run.frames).toEqual([]);
  });

  it("obyčejný obvod zkrat nemá", () => {
    expect(shortCircuitInCircuit(base)).toBeNull();
  });
});

describe("běhový zkrat na výstupním pinu", () => {
  const short8ToGnd: Circuit = {
    comps: base.comps,
    wires: [...base.wires, wire([uno.id, "D8"], [uno.id, "GND-1"])],
  };

  it("výstup HIGH přímo na zemi zastaví běh a pojmenuje pin", () => {
    const src = `
void setup() { pinMode(8, OUTPUT); }
void loop() { digitalWrite(8, HIGH); delay(100); }`;
    const run = runProgram(src, short8ToGnd, { iterations: 3 });
    expect(run.ok).toBe(false);
    expect(run.shortCircuit).toContain("Pin 8");
    expect(run.shortCircuit).toContain("Zkrat");
  });

  it("výstup LOW přímo na 5 V je zkrat taky", () => {
    const c: Circuit = {
      comps: base.comps,
      wires: [...base.wires, wire([uno.id, "D8"], [uno.id, "5V"])],
    };
    const src = `
void setup() { pinMode(8, OUTPUT); }
void loop() { digitalWrite(8, LOW); delay(100); }`;
    const run = runProgram(src, c, { iterations: 3 });
    expect(run.shortCircuit).toContain("Pin 8");
  });

  it("vstup INPUT_PULLUP stažený tlačítkem k zemi zkrat není", () => {
    const btn = referenceCircuit(lesson3.wiring);
    const run = runProgram(lesson3.solution, btn, { iterations: 3 });
    expect(run.shortCircuit).toBeUndefined();
    expect(run.ok).toBe(true);
  });

  it("výstup přes LED s rezistorem na zem zkrat není", () => {
    const run = runProgram(
      "void setup() { pinMode(8, OUTPUT); } void loop() { digitalWrite(8, HIGH); delay(100); }",
      base,
      { iterations: 3 },
    );
    expect(run.shortCircuit).toBeUndefined();
  });
});
