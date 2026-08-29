import type { Circuit } from "@/features/circuit/types";

/**
 * Rozpracovaná lekce v prohlížeči.
 *
 * Dítě si obvod skládá deset minut. Když se stránka obnoví — a ona se
 * obnoví, protože tablet uspí kartu — nesmí být všechno pryč. Ukládá se
 * lokálně a bez účtu: je to koncept, ne postup.
 *
 * Postup (co je hotové) drží `anon-session`. Tohle je něco jiného a
 * schválně to nesdílí úložiště: koncept se smí zahodit, postup ne.
 */

const KEY_PREFIX = "weeks.lesson-draft.v1.";

export interface LessonDraft {
  code: string;
  circuit: Circuit;
}

export function loadDraft(slug: string): LessonDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + slug);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isDraft(parsed)) return null;
    return parsed;
  } catch {
    /* Poškozený nebo zaplněný localStorage nesmí shodit lekci. */
    return null;
  }
}

export function saveDraft(slug: string, draft: LessonDraft): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(KEY_PREFIX + slug, JSON.stringify(draft));
  } catch {
    /* Plné úložiště nebo soukromé okno. Neuložit je horší než spadnout? Ne. */
  }
}

export function clearDraft(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY_PREFIX + slug);
  } catch {
    /* nic */
  }
}

function isDraft(value: unknown): value is LessonDraft {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.code !== "string") return false;

  const circuit = v.circuit as Record<string, unknown> | undefined;
  return Boolean(circuit && Array.isArray(circuit.comps) && Array.isArray(circuit.wires));
}
