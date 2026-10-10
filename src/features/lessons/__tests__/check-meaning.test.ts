import { describe, expect, it } from "vitest";
import { lesson1, lesson2 } from "../content";
import { referenceCircuit } from "../reference-circuit";
import { runLessonChecks } from "../run-check";

/* Kontroly musí měřit to, co říká jejich název a hláška. Tady se ověřuje
   proti programům, které tu vlastnost mají mít — a proti těm, které ji
   nemají. */

describe("lekce 2: „Mezi změnami je pauza“", () => {
  const circuit = referenceCircuit(lesson2.wiring);
  const pause = () =>
    runLessonChecks(lesson2, circuit, lesson2.solution).outcomes.find(
      (o) => o.label === "Mezi změnami je pauza",
    );

  it("vzorové řešení s delay() projde", () => {
    expect(pause()?.passed).toBe(true);
  });

  it("bez pauzy mezi rozsvícením a zhasnutím neprojde", () => {
    const src = `
void setup() { pinMode(8, OUTPUT); }
void loop() {
  digitalWrite(8, HIGH);
  digitalWrite(8, LOW);
  delay(1000);
}`;
    const outcome = runLessonChecks(lesson2, circuit, src).outcomes.find(
      (o) => o.label === "Mezi změnami je pauza",
    );
    expect(outcome?.passed).toBe(false);
  });

  it("pauza kratší než 50 ms se za pauzu nepočítá", () => {
    const src = `
void setup() { pinMode(8, OUTPUT); }
void loop() {
  digitalWrite(8, HIGH);
  delay(10);
  digitalWrite(8, LOW);
  delay(10);
}`;
    const outcome = runLessonChecks(lesson2, circuit, src).outcomes.find(
      (o) => o.label === "Mezi změnami je pauza",
    );
    expect(outcome?.passed).toBe(false);
  });
});

describe("lekce 1: kontroly nejsou dvě stejné", () => {
  const circuit = referenceCircuit(lesson1.wiring);

  it("druhá kontrola měří, že LED zůstane svítit", () => {
    const labels = lesson1.checks.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain("LED zůstane svítit");
  });

  it("vzorové řešení projde obě kontroly", () => {
    const result = runLessonChecks(lesson1, circuit, lesson1.solution);
    expect(result.outcomes.every((o) => o.passed)).toBe(true);
  });

  it("program, který LED zhasne, druhou kontrolu neprojde", () => {
    const src = `
void setup() { pinMode(8, OUTPUT); }
void loop() {
  digitalWrite(8, HIGH);
  delay(500);
  digitalWrite(8, LOW);
  delay(500);
}`;
    const result = runLessonChecks(lesson1, circuit, src);
    const stays = result.outcomes.find((o) => o.label === "LED zůstane svítit");
    expect(stays?.passed).toBe(false);
  });
});
