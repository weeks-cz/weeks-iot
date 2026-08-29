import { z } from "zod";

/**
 * Tvar anonymní relace.
 *
 * Relace žije výhradně v localStorage prohlížeče. Do okamžiku, kdy rodič
 * odešle registraci, neodchází na server žádný osobní údaj — to je celý
 * smysl kroků 1 až 4 z M2 a zároveň důvod, proč je právní stav čistý.
 *
 * `anonId` není osobní údaj: je to náhodné číslo, které slouží jen ke
 * spárování událostí jedné návštěvy. Nenese e-mail, jméno ani rok narození.
 *
 * Schéma je zároveň validací na serveru. Všechno, co sem přijde, napsal
 * prohlížeč — tedy nedůvěryhodný zdroj, který si může vymyslet cokoli.
 */

/* Krátké limity schválně: UTM je marketingový štítek, ne úložiště. Bez
   stropu by šlo relaci nafouknout na megabajty a poslat je na server. */
const shortText = z.string().trim().max(200);
const slug = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "Slug smí obsahovat jen malá písmena, číslice a pomlčky");

const isoDate = z
  .string()
  .max(40)
  .refine((v) => Number.isFinite(Date.parse(v)), "Neplatné datum");

export const attributionSchema = z.object({
  utmSource: shortText.optional(),
  utmMedium: shortText.optional(),
  utmCampaign: shortText.optional(),
  utmContent: shortText.optional(),
  utmTerm: shortText.optional(),
  referrer: z.string().trim().max(500).optional(),
  landingPath: z.string().trim().max(500).optional(),
});

export type Attribution = z.infer<typeof attributionSchema>;

export const anonLessonSchema = z.object({
  courseSlug: slug,
  lessonSlug: slug,
  startedAt: isoDate,
  completedAt: isoDate.optional(),
  durationS: z.number().int().min(0).max(86_400).optional(),
  hintsUsed: z.number().int().min(0).max(1000).optional(),
});

export type AnonLesson = z.infer<typeof anonLessonSchema>;

export const anonSessionSchema = z.object({
  v: z.literal(1),
  anonId: z
    .string()
    .regex(/^[a-f0-9]{32}$/, "anonId musí být 32 hexadecimálních znaků"),
  createdAt: isoDate,
  attribution: attributionSchema.default({}),
  /* Strop na počet lekcí: kurz má sedm. Padesát je velkorysá rezerva
     a zároveň zábrana proti relaci nafouknuté na tisíce položek. */
  lessons: z.array(anonLessonSchema).max(50).default([]),
});

export type AnonSession = z.infer<typeof anonSessionSchema>;

export const ANON_STORAGE_KEY = "ucebna.anon.v1";
export const ANON_SESSION_VERSION = 1;
