/**
 * Kdo se dívá a kam pro něj vede „domů“.
 *
 * Logo bylo nejčastější slepá ulička: přihlášené dítě v lekci kliklo na
 * logo a skončilo na marketingové stránce s „Přihlásit“. Cíl loga se proto
 * odvozuje z toho, kdo se dívá, a pravidlo je na jednom místě — hlavička,
 * drobečková navigace v lekci i všechno další ho berou odsud.
 */

export type Viewer =
  /** `hasProgress` zná jen prohlížeč (anonymní relace); server ho nechává prázdné. */
  | { kind: "anon"; hasProgress?: boolean }
  /** Přihlášený rodič bez vybraného profilu. */
  | { kind: "parent" }
  | { kind: "child"; nick: string; avatar: string };

/** Kam vede anonyma s postupem: přehled kurzu, dokud je kurz jeden. */
const ANON_WITH_PROGRESS_HOME = "/kurz/iot";

export function homeHref(viewer: Viewer): string {
  switch (viewer.kind) {
    case "child":
    case "parent":
      /* Bez aktivního profilu lobby samo nabídne výběr profilu. */
      return "/ucim-se";
    case "anon":
      return viewer.hasProgress ? ANON_WITH_PROGRESS_HOME : "/";
  }
}

/**
 * Viewer ze session a aktivního profilu.
 *
 * Čisté, aby ho mohla použít i stránka, která si profil načítá sama
 * (lekce), a nemusela kvůli tomu číst profily podruhé.
 */
export function toViewer(
  user: { id: string } | null | undefined,
  active: { nick: string; avatar: string } | null | undefined,
): Viewer {
  if (!user) return { kind: "anon" };
  if (!active) return { kind: "parent" };
  return { kind: "child", nick: active.nick, avatar: active.avatar };
}
