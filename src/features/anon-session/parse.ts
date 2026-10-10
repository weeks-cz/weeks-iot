import { anonSessionSchema, type AnonSession } from "./schema";

/**
 * Rozbor anonymní relace přijaté od prohlížeče.
 *
 * Čistá funkce bez databáze, proto ji jde testovat a sdílí ji onboarding
 * i přenos postupu do už existujícího účtu. Vstup je nedůvěryhodný: přichází
 * jako řetězec z formuláře, který si může poslat kdokoli.
 */

/** Strop na velikost dřív, než se to vůbec zkusí parsovat. */
export const MAX_ANON_SESSION_CHARS = 50_000;

export function parseAnonSession(raw: FormDataEntryValue | null | undefined): AnonSession | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (raw.length > MAX_ANON_SESSION_CHARS) return null;

  try {
    const parsed = anonSessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Kolik různých lekcí relace nese. Stejná lekce víckrát se počítá jednou. */
export function countAnonLessons(session: Pick<AnonSession, "lessons">): number {
  return new Set(session.lessons.map((l) => `${l.courseSlug}/${l.lessonSlug}`)).size;
}
