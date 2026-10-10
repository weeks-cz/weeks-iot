import { describe, expect, it } from "vitest";
import { lesson1 } from "../content";
import { referenceCircuit } from "../reference-circuit";
import { runLessonChecks } from "../run-check";

/* Kid, který zapomene pinMode, musí dostat větu, která mu řekne, co chybí —
   v kódu i v blocích. A zkrat musí zastavit kontroly, ne jen je neuspokojit. */

const NO_PINMODE = `
void setup() {}
void loop() {
  digitalWrite(8, HIGH);
  delay(500);
  digitalWrite(8, LOW);
  delay(500);
}`;

describe("diagnostika pinů v běhu lekce", () => {
  it("chybějící pinMode se pojmenuje v kódu i v blocích", () => {
    const result = runLessonChecks(lesson1, referenceCircuit(lesson1.wiring), NO_PINMODE);
    expect(result.diagnostics).toHaveLength(1);
    const [d] = result.diagnostics;
    expect(d?.pin).toBe(8);
    expect(d?.message).toContain("pinMode(8, OUTPUT)");
    expect(d?.blockMessage).toContain("nastav pin 8 jako výstup");
    expect(d?.blockMessage).not.toContain("pinMode");
  });

  it("LED bez pinMode nesvítí a kontrola to nepustí", () => {
    const result = runLessonChecks(lesson1, referenceCircuit(lesson1.wiring), NO_PINMODE);
    expect(result.outcomes.some((o) => o.passed)).toBe(false);
  });

  it("správný program nemá diagnostiku", () => {
    const result = runLessonChecks(
      lesson1,
      referenceCircuit(lesson1.wiring),
      lesson1.solution,
    );
    expect(result.diagnostics).toEqual([]);
  });
});

describe("zkrat v lekci", () => {
  it("zkrat 5 V na zem zastaví kontroly a žádný bod nezobrazí", () => {
    const base = referenceCircuit(lesson1.wiring);
    const uno = base.comps.find((c) => c.type === "arduino-uno")!;
    const short = {
      comps: base.comps,
      wires: [
        ...base.wires,
        { id: "zk", from: { compId: uno.id, pinName: "5V" }, to: { compId: uno.id, pinName: "GND-1" } },
      ],
    };

    const result = runLessonChecks(lesson1, short, lesson1.solution);
    expect(result.shortCircuit).toContain("Zkrat!");
    expect(result.outcomes).toEqual([]);
    expect(result.passed).toBe(false);
  });

  it("obyčejný obvod zkrat nehlásí", () => {
    const result = runLessonChecks(lesson1, referenceCircuit(lesson1.wiring), lesson1.solution);
    expect(result.shortCircuit).toBeNull();
  });
});
