/**
 * Co ukazuje domovská obrazovka dítěte (lobby).
 *
 * Čistá logika bez Reactu a bez čtení z databáze: dostane publikované
 * lekce kurzu, množinu hotových slugů a funkci, která o lekci řekne, v jakém
 * kroku dítě rozdělanou práci nechalo. Nic z toho nezná napevno — počet lekcí
 * ani jejich pořadí se odvozují z toho, co je právě publikované, takže přidaná
 * osmá lekce se v lobby objeví sama.
 */

import type { Circuit } from "@/features/circuit/types";

export type LessonStep = "brief" | "wiring" | "code";

export interface PathLesson {
  slug: string;
  title: string;
  order: number;
  minutes: number | null;
  done: boolean;
}

export type HeroState =
  | { kind: "start"; lesson: PathLesson }
  | { kind: "next"; lesson: PathLesson }
  | { kind: "draft"; lesson: PathLesson; step: Exclude<LessonStep, "brief"> }
  | { kind: "done" };

/** Cesta kurzem: publikované lekce seřazené podle pořadí, s příznakem „hotovo“. */
export function coursePath(
  published: {
    slug: string;
    title: string;
    orderIndex: number;
    estimatedMinutes: number | null;
  }[],
  completed: ReadonlySet<string>,
): PathLesson[] {
  return [...published]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((l) => ({
      slug: l.slug,
      title: l.title,
      order: l.orderIndex,
      minutes: l.estimatedMinutes,
      done: completed.has(l.slug),
    }));
}

/**
 * Hlavní karta lobby. Cílem je první nedokončená lekce v pořadí (ne ta, kam
 * dítě skočilo). Má-li u ní rozdělaný koncept za úvodním krokem, nabídne se
 * pokračování; jinak „začni“ (nic hotového) nebo „další“.
 */
export function heroState(
  path: PathLesson[],
  draftStep: (slug: string) => LessonStep | null,
): HeroState {
  const target = path.find((l) => !l.done);
  if (!target) return { kind: "done" };

  const step = draftStep(target.slug);
  if (step && step !== "brief") return { kind: "draft", lesson: target, step };

  return path.some((l) => l.done)
    ? { kind: "next", lesson: target }
    : { kind: "start", lesson: target };
}

/**
 * Kurz je hotový, když je hotová KAŽDÁ publikovaná lekce (stejné pravidlo
 * jako u certifikátu). Prázdný kurz hotový není.
 */
export function isCourseDone(
  publishedSlugs: readonly string[],
  completed: ReadonlySet<string>,
): boolean {
  return (
    publishedSlugs.length > 0 && publishedSlugs.every((s) => completed.has(s))
  );
}

/** Jeden náhled v dlaždici „Co jsi postavil". */
export interface BuildTile {
  slug: string;
  title: string;
  circuit: Circuit;
  /** Lekce je hotová, ale výtvor uložený nemá — kreslí se vzorové zapojení. */
  reference: boolean;
}

/**
 * Náhledy do lobby: posledních `limit` hotových lekcí v pořadí kurzu.
 *
 * Počítá se z hotových lekcí, ne z uložených výtvorů (návrh §9.3) — lekce
 * dokončené před zavedením sbírky výtvor nemají a dostanou vzorové
 * zapojení. Lekce bez uloženého výtvoru i bez vzoru se vynechá.
 */
export function lobbyBuilds(
  path: PathLesson[],
  saved: ReadonlyMap<string, { data: { circuit: Circuit } }>,
  reference: (slug: string) => Circuit | null,
  limit = 4,
): BuildTile[] {
  const tiles: BuildTile[] = [];
  for (const lesson of path) {
    if (!lesson.done) continue;
    const own = saved.get(lesson.slug)?.data.circuit;
    const circuit = own ?? reference(lesson.slug);
    if (!circuit) continue;
    tiles.push({ slug: lesson.slug, title: lesson.title, circuit, reference: !own });
  }
  return tiles.slice(-limit);
}
