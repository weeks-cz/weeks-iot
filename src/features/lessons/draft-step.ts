import type { Circuit } from "@/features/circuit/types";
import type { LessonStep } from "@/features/lobby/model";
import type { LessonDraft } from "./draft";
import type { Lesson } from "./types";
import { lessonSeedCircuit } from "./seed-circuit";
import { currentStep, wiringSteps } from "./wiring-steps";

/**
 * V jakém kroku dítě lekci nechalo — odhad z rozdělané práce.
 *
 * Koncept si krok nepamatuje, jen obvod, kód a bloky. Krok se proto
 * odvozuje: hotové zapojení znamená, že dítě je u programu; jakýkoli zásah
 * do obvodu znamená zapojování; jinak jen otevřelo zadání.
 *
 * Koncept pochází z `JSON.parse`, takže se porovnává podle obsahu, ne podle
 * reference.
 */
export function draftStep(lesson: Lesson, draft: LessonDraft | null): LessonStep | null {
  if (!draft) return null;

  const seed = lessonSeedCircuit(lesson);
  const circuitChanged = !sameContent(shape(draft.circuit), shape(seed));

  const wiringDone = currentStep(wiringSteps(draft.circuit, lesson.wiring)) === null;
  if (wiringDone) {
    const codeChanged = draft.code !== lesson.starterCode;
    const blocksChanged =
      draft.blocks !== undefined && !sameContent(draft.blocks, lesson.blocks.starter);
    /* Obvod, který je hotový už ve výchozím stavu, na program neukazuje —
       tam rozhoduje až zásah do kódu nebo bloků. */
    if (circuitChanged || codeChanged || blocksChanged) return "code";
  }

  return circuitChanged ? "wiring" : "brief";
}

/* Výchozí obvod dostává při každém vytvoření nová id součástek, takže se
   porovnává tvar (typ a poloha), ne identita. Drát v něm být nesmí. */
function shape(circuit: Circuit) {
  return {
    comps: circuit.comps.map(({ type, x, y, rotation }) => ({ type, x, y, rotation })),
    wires: circuit.wires.length,
  };
}

function sameContent(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
