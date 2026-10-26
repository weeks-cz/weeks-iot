import { z } from "zod";
import type { Circuit } from "@/features/circuit/types";
import type { WorkspaceState } from "@/features/blocks/program";

/**
 * Výtvor dítěte: hotový obvod a program k jedné lekci.
 *
 * Posílá ho prohlížeč, tedy nedůvěryhodný zdroj, a ukládá se do JSONB.
 * Schéma proto ověřuje tvar volně, ale s tvrdými stropy: kolik součástek
 * a drátů, jak dlouhý kód a kolik JSON celkem. Úplnou validitu obvodu
 * (že piny existují) neřeší — výtvor se jen zobrazuje a znovu simuluje,
 * takže špatný tvar nanejvýš nevykreslí nic.
 */

/** Strop celého výtvoru po serializaci do JSON, ve znacích. */
export const MAX_BUILD_BYTES = 100_000;

/** Stejná pravidla jako u slugů v `anonLessonSchema`. */
const slug = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "Slug smí obsahovat jen malá písmena, číslice a pomlčky");

const id = z.string().min(1).max(80);
const pinName = z.string().min(1).max(40);

const COMPONENT_TYPES = [
  "arduino-uno",
  "breadboard-half",
  "led-red",
  "led-yellow",
  "led-green",
  "led-blue",
  "led-rgb",
  "resistor-220",
  "pushbutton",
  "piezo-buzzer",
  "potentiometer",
  "photoresistor",
] as const;

const pinRef = z.object({ compId: id, pinName });

const circuitSchema = z.object({
  comps: z
    .array(
      z.object({
        id,
        type: z.enum(COMPONENT_TYPES),
        x: z.number().finite().min(-100_000).max(100_000),
        y: z.number().finite().min(-100_000).max(100_000),
        rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
      }),
    )
    .max(80),
  wires: z
    .array(
      z.object({
        id,
        from: pinRef,
        to: pinRef,
        color: z.literal("gray").optional(),
      }),
    )
    .max(300),
});

/* Stav Blockly je volný formát; hlídá se jen, že jde o pole objektů
   omezené délky. Celkovou velikost drží strop na JSON níž. */
const blocksSchema = z.object({
  blocks: z
    .object({
      languageVersion: z.literal(0),
      blocks: z.array(z.record(z.string(), z.unknown())).max(200),
    })
    .optional(),
});

export interface LessonBuild {
  courseSlug: string;
  lessonSlug: string;
  circuit: Circuit;
  code: string;
  blocks?: WorkspaceState;
  mode: "blocks" | "code";
}

/** Výtvor, jak ho zná editor lekce — bez slugů, ty doplní `LessonRunner`. */
export type LessonBuildDraft = Omit<LessonBuild, "courseSlug" | "lessonSlug">;

const lessonBuildBase = z.object({
  courseSlug: slug,
  lessonSlug: slug,
  circuit: circuitSchema,
  code: z.string().max(20_000),
  blocks: blocksSchema.optional(),
  mode: z.enum(["blocks", "code"]),
});

/* Přetypování jen na hranici: tvar bloků je záměrně volnější než
   `BlockState`, ale v úložišti je to stejný JSON. */
export const lessonBuildSchema = lessonBuildBase.refine(
  (b) => JSON.stringify(b).length <= MAX_BUILD_BYTES,
  { message: "Výtvor je příliš velký" },
) as unknown as z.ZodType<LessonBuild>;

/** Tvar `projects.data`. Verze je kvůli budoucí změně formátu. */
export type StoredBuildData = {
  v: 1;
  circuit: Circuit;
  code: string;
  blocks?: WorkspaceState;
  mode: "blocks" | "code";
};

export function toStoredData(build: LessonBuild): StoredBuildData {
  const { circuit, code, blocks, mode } = build;
  return { v: 1, circuit, code, ...(blocks ? { blocks } : {}), mode };
}
