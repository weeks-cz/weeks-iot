import { describe, expect, it } from "vitest";
import { runProgram } from "@/features/circuit/simulate";
import { frameIndexAt } from "../components/useFramePlayer";
import { referenceCircuit } from "../reference-circuit";
import { lesson1, lesson2 } from "../content";

/**
 * Přehrávání se v prohlížeči testuje mizerně: requestAnimationFrame na
 * skryté kartě neběží vůbec, takže „LED nesvítí" tam nic neznamená.
 * Tady se ptáme na to jediné, na čem záleží — který snímek patří ke
 * kterému okamžiku.
 */

describe("výběr snímku podle času", () => {
  const frames = [
    { leds: [], buzzers: [], serial: [], elapsedMs: 0 },
    { leds: [], buzzers: [], serial: [], elapsedMs: 500 },
    { leds: [], buzzers: [], serial: [], elapsedMs: 1000 },
  ];

  it("před prvním předělem drží úvodní snímek", () => {
    expect(frameIndexAt(frames, 0)).toBe(0);
    expect(frameIndexAt(frames, 499)).toBe(0);
  });

  it("v okamžiku předělu přepne", () => {
    expect(frameIndexAt(frames, 500)).toBe(1);
    expect(frameIndexAt(frames, 999)).toBe(1);
    expect(frameIndexAt(frames, 1000)).toBe(2);
  });

  it("za koncem drží poslední snímek", () => {
    expect(frameIndexAt(frames, 99_999)).toBe(2);
  });

  it("prázdný běh nespadne", () => {
    expect(frameIndexAt([], 100)).toBe(0);
  });
});

describe("blikání je v přehrávání opravdu vidět", () => {
  it("během jednoho cyklu se LED rozsvítí i zhasne", () => {
    /* Regrese: přehrávač napřed skákal na poslední snímek hned, jak na
       něj došel, takže rozsvícená LED byla vidět jednu šestnáctinu
       vteřiny a lekce vypadala, že nefunguje. */
    const circuit = referenceCircuit(lesson2.wiring);
    const run = runProgram(lesson2.solution, circuit, { iterations: 6 });

    const total = run.frames.at(-1)?.elapsedMs ?? 0;
    expect(total).toBeGreaterThan(0);

    const svit = new Set<boolean>();
    for (let t = 0; t < total; t += 50) {
      const frame = run.frames[frameIndexAt(run.frames, t)];
      svit.add((frame?.leds[0]?.brightness ?? 0) > 0);
    }

    expect(svit).toEqual(new Set([true, false]));
  });

  it("program bez delay se nepřehrává — jen se ustálí", () => {
    /* Lekce 1 nemá delay. Kdyby se snímky přehrávaly dokola, střídal by
       se setup (zhasnuto) s výsledkem (svítí) a LED, která má svítit
       natrvalo, by blikala. */
    const circuit = referenceCircuit(lesson1.wiring);
    const run = runProgram(lesson1.solution, circuit, { iterations: 3 });

    expect(run.frames.at(-1)?.elapsedMs).toBe(0);
    expect(run.frames.at(-1)?.leds[0]?.brightness).toBeGreaterThan(0);
  });
});
