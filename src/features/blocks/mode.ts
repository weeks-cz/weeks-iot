/**
 * Jestli dítě skládá bloky, nebo píše kód.
 *
 * Nepamatuje se u lekce: kdo jednou přešel na kód, nechce se v každé
 * další lekci přepínat znovu. Výchozí jsou bloky — dítě, které neví, co
 * jsou, se na ně nemá ptát, a přepínač „Psát kód" je vidět.
 *
 * ── Kde se pamatuje ────────────────────────────────────────────────────────
 * Přihlášenému dítěti u profilu (`children.editor_mode`), jinak by se volba
 * ztratila na jiném počítači a sourozenci na jednom notebooku by si ji
 * navzájem přepínali. Anonymovi v prohlížeči. Profil, který volbu ještě
 * nemá (null), převezme tu z prohlížeče — dítě, které si kód zvolilo před
 * registrací, se po ní nemá ocitnout zpátky v blocích.
 */

export type EditorMode = "blocks" | "code";

const KEY = "weeks.editor-mode.v1";

export function isEditorMode(value: unknown): value is EditorMode {
  return value === "blocks" || value === "code";
}

/** Co si pamatuje prohlížeč; null, když nic (nebo se k úložišti nedostaneme). */
export function readLocalEditorMode(): EditorMode | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(KEY);
    return isEditorMode(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveEditorMode(mode: EditorMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    /* Soukromé okno nebo plné úložiště — přepínač pak jen nepřežije reload. */
  }
}

/**
 * Který režim ukázat a jestli ho profilu uložit.
 *
 * @param stored režim profilu: `undefined` = anonym (nebo se nedá zjistit,
 *   kdo se učí), `null` = profil volbu ještě nemá.
 * @param local  co si pamatuje prohlížeč.
 * @returns `adopt` je režim, který se má profilu zapsat, jinak null.
 */
export function resolveEditorMode(
  stored: EditorMode | null | undefined,
  local: EditorMode | null,
): { mode: EditorMode; adopt: EditorMode | null } {
  if (stored) return { mode: stored, adopt: null };
  if (stored === null && local) return { mode: local, adopt: local };
  return { mode: local ?? "blocks", adopt: null };
}
