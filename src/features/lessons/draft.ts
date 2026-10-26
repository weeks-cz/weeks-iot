import type { Circuit } from "@/features/circuit/types";
import type { WorkspaceState } from "@/features/blocks/program";

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
const PROFILE_KEY_PREFIX = "weeks.lesson-draft.v2.";

/**
 * Klíč konceptu. Anonym drží starý klíč v1; dítě s profilem má vlastní v2,
 * aby si sourozenci na jednom tabletu nepřepisovali rozdělanou práci.
 */
export function draftKey(slug: string, profileId?: string | null): string {
  return profileId ? `${PROFILE_KEY_PREFIX}${profileId}.${slug}` : KEY_PREFIX + slug;
}

export interface LessonDraft {
  code: string;
  circuit: Circuit;
  /** Rozdělané bloky. Chybí u konceptů uložených před zavedením bloků. */
  blocks?: WorkspaceState;
}

export function loadDraft(slug: string, profileId?: string | null): LessonDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const key = draftKey(slug, profileId);
    let raw = window.localStorage.getItem(key);

    /* Koncept z doby před profily patří prvnímu profilu, který lekci otevře:
       přesune se pod něj a v1 zmizí, takže druhé dítě ho už nenajde. */
    if (!raw && profileId) {
      const legacyKey = draftKey(slug);
      const legacy = window.localStorage.getItem(legacyKey);
      if (legacy) {
        window.localStorage.setItem(key, legacy);
        window.localStorage.removeItem(legacyKey);
        raw = legacy;
      }
    }
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isDraft(parsed)) return null;
    return parsed;
  } catch {
    /* Poškozený nebo zaplněný localStorage nesmí shodit lekci. */
    return null;
  }
}

export function saveDraft(slug: string, draft: LessonDraft, profileId?: string | null): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(draftKey(slug, profileId), JSON.stringify(draft));
  } catch {
    /* Plné úložiště nebo soukromé okno. Neuložit je horší než spadnout? Ne. */
  }
}

export function clearDraft(slug: string, profileId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(slug, profileId));
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
