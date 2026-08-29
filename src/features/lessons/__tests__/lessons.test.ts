import { describe, expect, it } from "vitest";
import { getComponentSpec } from "@/features/circuit/components";
import { checkWiring } from "@/features/circuit/wiring-check";
import { compile } from "@/features/arduino/interpreter";
import { findTask } from "@/legacy/lib/tasks";
import { COURSE_LESSONS } from "../content";
import { referenceCircuit } from "../reference-circuit";
import { runLessonChecks } from "../run-check";
import type { Lesson } from "../types";

/**
 * Lekce je datová struktura, takže se v ní dá napsat nesmysl, který
 * TypeScript nechytí: pin, co na součástce není, kontrola, kterou vzorové
 * řešení neprojde, startovní kód, který se nepřeloží.
 *
 * Tyhle testy jsou přejímka obsahu. Když spadnou, je vadné zadání lekce,
 * ne kód emulátoru.
 */

function pinNames(type: Parameters<typeof getComponentSpec>[0]): string[] {
  return getComponentSpec(type).pins.map((p) => p.name);
}

describe("osnova kurzu", () => {
  it("pořadí je souvislé od jedničky", () => {
    const orders = COURSE_LESSONS.map((l) => l.order);
    expect(orders).toEqual(orders.map((_, i) => i + 1));
  });

  it("slugy jsou jedinečné", () => {
    const slugs = COURSE_LESSONS.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("finále je noční světlo — projekt, který jde ukázat", () => {
    expect(COURSE_LESSONS.at(-1)?.slug).toBe("nocni-svetlo");
  });

  it("každá lekce odkazuje na úlohu, která ve staré aplikaci opravdu je", () => {
    /* Brána 0, bod 4: staré úlohy jsou pro nové lekce DATA, ne kód.
       Odkaz na neexistující id by tu vazbu tiše přeťal. Že tři lekce míří
       na „beginner-led", je v pořádku — ta úloha dělala tři věci najednou
       a právě proto se rozpadla. */
    for (const lesson of COURSE_LESSONS) {
      expect(findTask(lesson.legacyTaskId), lesson.legacyTaskId).toBeDefined();
    }
  });
});

describe.each(COURSE_LESSONS.map((l) => [l.slug, l] as const))(
  "lekce %s",
  (_slug, lesson: Lesson) => {
    const circuit = referenceCircuit(lesson.wiring);

    it("má vyplněné všechno, co dítě uvidí", () => {
      expect(lesson.title.length).toBeGreaterThan(0);
      expect(lesson.goal.length).toBeGreaterThan(0);
      expect(lesson.brief.length).toBeGreaterThan(0);
      expect(lesson.palette.length).toBeGreaterThan(0);
      expect(lesson.wiringHints.length).toBeGreaterThan(0);
      expect(lesson.codeHints.length).toBeGreaterThan(0);
      expect(lesson.checks.length).toBeGreaterThan(0);
      /* Prázdné pole je paralyzující — lekce vždycky začíná s kostrou. */
      expect(lesson.starterCode.trim().length).toBeGreaterThan(0);
    });

    it("každý spoj míří na pin, který na součástce opravdu je", () => {
      const typeOf = new Map(lesson.wiring.parts.map((p) => [p.role, p.type]));

      for (const conn of lesson.wiring.connections) {
        for (const side of [conn.from, conn.to]) {
          const type = typeOf.get(side.role);
          expect(type, `role „${side.role}" není mezi parts`).toBeDefined();
          expect(
            pinNames(type!),
            `pin „${side.pin}" na součástce ${type}`,
          ).toContain(side.pin);
        }
      }
    });

    it("součástky ze zadání se nabízejí v paletě", () => {
      /* Arduino je na desce vždycky, to se z palety netahá. */
      const needed = lesson.wiring.parts
        .map((p) => p.type)
        .filter((t) => t !== "arduino-uno");

      for (const type of new Set(needed)) {
        expect(lesson.palette, `paleta neobsahuje ${type}`).toContain(type);
      }
    });

    it("vzorový obvod projde vlastní kontrolou zapojení", () => {
      const result = checkWiring(circuit, lesson.wiring);
      expect(result.issues.map((i) => i.hint)).toEqual([]);
      expect(result.ok).toBe(true);
    });

    it("startovní kód se přeloží", () => {
      const compiled = compile(lesson.starterCode);
      expect(compiled.error?.message).toBeUndefined();
      expect(compiled.ok).toBe(true);
    });

    it("vzorové řešení projde všemi kontrolami lekce", () => {
      const result = runLessonChecks(lesson, circuit, lesson.solution);

      expect(result.error?.message).toBeUndefined();
      expect(
        result.outcomes.filter((o) => !o.passed).map((o) => o.label),
        "neprošlé body",
      ).toEqual([]);
      expect(result.passed).toBe(true);
    });

    it("prázdný obvod kontrolami neprojde", () => {
      /* Pojistka proti kontrole, která se dá splnit i bez zapojení —
         taková by lekci degradovala na „klikni na hotovo". */
      const result = runLessonChecks(lesson, { comps: [], wires: [] }, lesson.solution);
      expect(result.passed).toBe(false);
    });
  },
);
