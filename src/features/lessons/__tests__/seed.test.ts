import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COURSE_LESSONS } from "../content";

/**
 * Databáze drží osnovu (pořadí, publikaci, id pro cizí klíč postupu),
 * kód drží obsah. Rozejít se nesmí: lekce v databázi bez obsahu v kódu je
 * mrtvý odkaz a obsah bez řádku v databázi si nikdo neuloží.
 *
 * Tenhle test čte migraci jako text. Není to elegantní, ale je to jediný
 * způsob, jak z testu ověřit SQL, které se pouští jinde než v CI — a chytí
 * přesně to, co se stane: dopíšu lekci a zapomenu na migraci.
 */

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/010_ucebna_kurz_osnova.sql"),
  "utf8",
);

describe("migrace 010 sedí s obsahem kurzu", () => {
  it.each(COURSE_LESSONS.map((l) => [l.slug, l] as const))(
    "lekce %s je v seedu se stejným pořadím i délkou",
    (slug, lesson) => {
      const row = migration
        .split("\n")
        .find((line) => line.trimStart().startsWith(`('${slug}',`));

      expect(row, `v migraci chybí řádek pro „${slug}"`).toBeDefined();
      expect(row).toContain(`'${lesson.title}'`);
      expect(row).toContain(`'${lesson.goal}'`);
      expect(row).toContain(`, ${lesson.order}, '${lesson.legacyTaskId}', ${lesson.minutes})`);
    },
  );

  it("seed nedrží lekci, ke které není obsah", () => {
    const seeded = [...migration.matchAll(/^ {2}\('([a-z-]+)',/gm)].map((m) => m[1]);
    expect(seeded.sort()).toEqual(COURSE_LESSONS.map((l) => l.slug).sort());
  });

  it("mazací seznam vyjmenovává právě lekce, které v kurzu zůstávají", () => {
    const keep = migration.slice(migration.indexOf("l.slug not in ("));
    for (const lesson of COURSE_LESSONS) {
      expect(keep).toContain(`'${lesson.slug}'`);
    }
  });
});
