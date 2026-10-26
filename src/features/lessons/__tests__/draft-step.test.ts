import { describe, expect, it } from "vitest";
import { lesson1 } from "../content";
import { applyStep } from "../apply-step";
import type { LessonDraft } from "../draft";
import { draftStep } from "../draft-step";
import { referenceCircuit } from "../reference-circuit";
import { lessonSeedCircuit } from "../seed-circuit";
import { currentStep, wiringSteps } from "../wiring-steps";

/* Koncept přichází z JSON.parse, ne jako stejná reference — test to napodobuje. */
const roundTrip = (d: LessonDraft): LessonDraft => JSON.parse(JSON.stringify(d));

describe("odhad kroku z konceptu", () => {
  it("bez konceptu je null", () => {
    expect(draftStep(lesson1, null)).toBeNull();
  });

  it("výchozí obvod a startovní kód = zadání", () => {
    const d = roundTrip({
      code: lesson1.starterCode,
      circuit: lessonSeedCircuit(lesson1),
      blocks: lesson1.blocks.starter,
    });
    expect(draftStep(lesson1, d)).toBe("brief");
  });

  it("jeden krok zapojení = zapojování", () => {
    const seed = lessonSeedCircuit(lesson1);
    const step = currentStep(wiringSteps(seed, lesson1.wiring));
    expect(step).not.toBeNull();
    const d = roundTrip({ code: lesson1.starterCode, circuit: applyStep(seed, step!) });
    expect(draftStep(lesson1, d)).toBe("wiring");
  });

  it("hotové zapojení a startovní kód = program", () => {
    const d = roundTrip({ code: lesson1.starterCode, circuit: referenceCircuit(lesson1.wiring) });
    expect(draftStep(lesson1, d)).toBe("code");
  });

  it("hotové zapojení a řešení = program", () => {
    const d = roundTrip({ code: lesson1.solution, circuit: referenceCircuit(lesson1.wiring) });
    expect(draftStep(lesson1, d)).toBe("code");
  });
});
