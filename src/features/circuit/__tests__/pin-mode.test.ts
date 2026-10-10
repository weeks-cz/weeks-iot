import { describe, expect, it } from "vitest";
import { lesson1, lesson3 } from "@/features/lessons/content";
import { referenceCircuit } from "@/features/lessons/reference-circuit";
import { runProgram } from "../simulate";
import type { Circuit } from "../types";

/* Skutečná deska řídí pin jen tehdy, když je jako výstup — přes pinMode
   nebo implicitně analogWrite/tone. Kdo jen zapíše HIGH, nic nerozsvítí. */

const LED_PROGRAM = (setup: string) => `
void setup() {
  ${setup}
}
void loop() {
  digitalWrite(8, HIGH);
  delay(100);
}
`;

const circuit: Circuit = referenceCircuit(lesson1.wiring);

describe("pin řídí obvod jen jako výstup", () => {
  it("digitalWrite bez pinMode OUTPUT LED nerozsvítí", () => {
    const run = runProgram(LED_PROGRAM(""), circuit, { iterations: 3 });
    expect(run.ok).toBe(true);
    expect(run.frames.some((f) => f.leds[0]!.brightness > 0)).toBe(false);
  });

  it("stejný program s pinMode OUTPUT LED rozsvítí", () => {
    const run = runProgram(LED_PROGRAM("pinMode(8, OUTPUT);"), circuit, { iterations: 3 });
    expect(run.frames.some((f) => f.leds[0]!.brightness > 0)).toBe(true);
  });

  it("pinMode INPUT_PULLUP výstup nepředstírá", () => {
    const run = runProgram(LED_PROGRAM("pinMode(8, INPUT_PULLUP);"), circuit, { iterations: 3 });
    expect(run.frames.some((f) => f.leds[0]!.brightness > 0)).toBe(false);
  });

  it("analogWrite nastaví pin jako výstup implicitně", () => {
    const src = `
void setup() {}
void loop() {
  analogWrite(8, 255);
  delay(100);
}`;
    const run = runProgram(src, circuit, { iterations: 2 });
    expect(run.frames.some((f) => f.leds[0]!.brightness > 0)).toBe(true);
  });

  it("nevyžádaný zápis na pin bez režimu se zapíše do diagnostiky", () => {
    const run = runProgram(LED_PROGRAM(""), circuit, { iterations: 2 });
    expect(run.diagnostics).toEqual([{ kind: "not-output", pin: 8 }]);
  });

  it("správný program nemá žádnou diagnostiku", () => {
    const run = runProgram(LED_PROGRAM("pinMode(8, OUTPUT);"), circuit, { iterations: 2 });
    expect(run.diagnostics).toEqual([]);
  });

  it("vstupní pin s tlačítkem se nezmění — INPUT_PULLUP nic nepřepíná", () => {
    const btn = referenceCircuit(lesson3.wiring);
    const run = runProgram(lesson3.solution, btn, { iterations: 2 });
    expect(run.ok).toBe(true);
    expect(run.shortCircuit).toBeUndefined();
  });
});
