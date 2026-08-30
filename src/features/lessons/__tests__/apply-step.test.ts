import { describe, expect, it } from "vitest";
import { checkWiring } from "@/features/circuit/wiring-check";
import type { Circuit } from "@/features/circuit/types";
import { applyStep } from "../apply-step";
import { COURSE_LESSONS } from "../content";
import { runLessonChecks } from "../run-check";
import { lessonSeedCircuit } from "../seed-circuit";
import { currentStep, wiringSteps } from "../wiring-steps";

/**
 * Úniková cesta ze zapojování.
 *
 * Nejpřísnější zkouška, jaká jde: obvod se postaví VÝHRADNĚ tímhle
 * tlačítkem, krok po kroku, a pak se na něm pustí vzorové řešení lekce.
 * Když projde, ví se, že dítě, které to za sebe nechá udělat celé,
 * neskončí v obvodu, který nefunguje.
 */

/** Zapojí celou lekci po krocích. Vrátí obvod a počet kroků. */
function buildByHatch(lesson: (typeof COURSE_LESSONS)[number]): {
  circuit: Circuit;
  taken: number;
} {
  let circuit = lessonSeedCircuit(lesson);
  let taken = 0;

  /* Strop je pojistka proti kroku, který se sám neodškrtne: bez něj by
     se test místo spadnutí zacyklil a nikdo by nevěděl proč. */
  while (taken < 40) {
    const step = currentStep(wiringSteps(circuit, lesson.wiring));
    if (!step) break;
    circuit = applyStep(circuit, step);
    taken += 1;
  }

  return { circuit, taken };
}

describe.each(COURSE_LESSONS.map((l) => [l.slug, l] as const))("applyStep — %s", (slug, lesson) => {
  const { circuit, taken } = buildByHatch(lesson);

  it("dojde na konec, každý krok posune obvod dál", () => {
    expect(taken, `${slug}: kroky se přestaly odškrtávat`).toBeLessThan(40);
    expect(currentStep(wiringSteps(circuit, lesson.wiring))).toBeNull();
  });

  it("výsledek projde kontrolou zapojení", () => {
    const wiring = checkWiring(circuit, lesson.wiring);
    expect(wiring.issues[0]?.hint ?? null, slug).toBeNull();
    expect(wiring.ok).toBe(true);
  });

  it("na výsledku projde vzorové řešení", () => {
    const run = runLessonChecks(lesson, circuit, lesson.solution);
    expect(run.error, slug).toBeNull();
    expect(run.passed, slug).toBe(true);
  });
});

describe("applyStep", () => {
  const lesson = COURSE_LESSONS[0]!;

  it("položí právě jednu součástku", () => {
    const seed = lessonSeedCircuit(lesson);
    const step = currentStep(wiringSteps(seed, lesson.wiring))!;
    expect(step.kind).toBe("place");

    const next = applyStep(seed, step);
    expect(next.comps.length).toBe(seed.comps.length + 1);
    expect(next.comps.at(-1)?.type).toBe(step.place);
  });

  it("nepokládá součástku na jinou", () => {
    /* Dvě součástky na stejném místě vypadají jako jedna a piny na téže
       souřadnici se navíc přes desku spojí. */
    const { circuit } = buildByHatch(lesson);
    const places = circuit.comps.map((c) => `${c.x}:${c.y}`);
    expect(new Set(places).size).toBe(places.length);
  });

  it("nesahá na původní obvod", () => {
    const seed = lessonSeedCircuit(lesson);
    const step = currentStep(wiringSteps(seed, lesson.wiring))!;
    const before = JSON.stringify(seed);

    applyStep(seed, step);
    expect(JSON.stringify(seed)).toBe(before);
  });

  it("krok bez konců spoje obvod nezmění", () => {
    const seed = lessonSeedCircuit(lesson);
    const next = applyStep(seed, {
      kind: "connect",
      instruction: "nikam",
      pins: [],
      from: [],
      to: [],
      done: false,
    });
    expect(next).toBe(seed);
  });
});
