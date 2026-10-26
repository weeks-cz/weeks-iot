import { lessonBuildSchema, type LessonBuild } from "./schema";

/**
 * Rozbor výtvorů přijatých od prohlížeče při převzetí postupu.
 *
 * Čistá funkce: vstup je nedůvěryhodný řetězec z formuláře. Nikdy nevyhazuje,
 * neplatné nebo nadbytečné (nejstarší) položky se jen zahodí.
 */

export const MAX_ANON_BUILDS = 8;
/** Kolik znaků výtvorů klient nejvýš pošle (zbytek těla 1 MB patří relaci a ostatním polím). */
export const ANON_BUILDS_CLIENT_BUDGET = 400_000;
/** Strop na surový řetězec dřív, než se parsuje; s rezervou nad rozpočtem klienta. */
export const MAX_ANON_BUILDS_CHARS = 500_000;

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
  for (const item of list.slice(-MAX_ANON_BUILDS)) {
    const parsed = lessonBuildSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
