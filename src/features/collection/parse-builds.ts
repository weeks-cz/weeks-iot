import { lessonBuildSchema, type LessonBuild } from "./schema";

/**
 * Rozbor výtvorů přijatých od prohlížeče při převzetí postupu.
 *
 * Čistá funkce: vstup je nedůvěryhodný řetězec z formuláře. Nikdy nevyhazuje,
 * neplatné nebo nadbytečné položky se jen zahodí.
 */

export const MAX_ANON_BUILDS = 8;
/** Strop na surový řetězec dřív, než se parsuje (8 × strop jednoho výtvoru). */
export const MAX_ANON_BUILDS_CHARS = MAX_ANON_BUILDS * 100_000;

export function parseAnonBuilds(raw: FormDataEntryValue | null | undefined): LessonBuild[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  if (raw.length > MAX_ANON_BUILDS_CHARS) return [];

  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];

  const out: LessonBuild[] = [];
  for (const item of list.slice(0, MAX_ANON_BUILDS)) {
    const parsed = lessonBuildSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
