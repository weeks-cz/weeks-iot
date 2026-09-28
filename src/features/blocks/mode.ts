/**
 * Jestli dítě skládá bloky, nebo píše kód.
 *
 * Pamatuje se v prohlížeči, ne u lekce: kdo jednou přešel na kód, nechce
 * se v každé další lekci přepínat znovu. Výchozí jsou bloky — dítě, které
 * neví, co jsou, se na ně nemá ptát, a přepínač „Psát kód" je vidět.
 */

export type EditorMode = "blocks" | "code";

const KEY = "weeks.editor-mode.v1";

export function loadEditorMode(): EditorMode {
  if (typeof window === "undefined") return "blocks";
  try {
    return window.localStorage.getItem(KEY) === "code" ? "code" : "blocks";
  } catch {
    return "blocks";
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
