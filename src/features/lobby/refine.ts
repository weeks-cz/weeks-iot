import type { Circuit } from "@/features/circuit/types";
import { lessonBySlug } from "@/features/lessons/content";
import type { LessonDraft } from "@/features/lessons/draft";
import { draftStep } from "@/features/lessons/draft-step";
import { heroCopy, type HeroCopy } from "./copy";
import {
  coursePath,
  heroState,
  type HeroState,
  type PathLesson,
} from "./model";
import type { AnonSession } from "@/features/anon-session/schema";

export type RefinedHero = {
  state: Extract<HeroState, { kind: "draft" }>;
  labels: HeroCopy;
  /** Rozdělaný obvod dítěte — náhled na kartě místo výchozího motivu. */
  circuit: Circuit;
} | null;

/**
 * Hero upřesněný podle konceptu v prohlížeči; null = koncept nic nemění.
 *
 * Cíl je tentýž jako v `heroState`: první nedokončená lekce. Koncept se
 * čte jen pro ni. `load` je `loadDraft` s profilem dítěte (anonym bez
 * profilu) — předává se, aby to šlo otestovat bez localStorage.
 */
export function refineHero(
  path: PathLesson[],
  load: (slug: string) => LessonDraft | null,
): RefinedHero {
  const target = path.find((l) => !l.done);
  const lesson = target ? lessonBySlug(target.slug) : null;
  const draft = target && lesson ? load(target.slug) : null;
  if (!lesson || !draft) return null;

  const state = heroState(path, () => draftStep(lesson, draft));
  if (state.kind !== "draft") return null;
  return { state, labels: heroCopy(state, lesson), circuit: draft.circuit };
}

export interface AnonLobbyModel {
  path: PathLesson[];
  state: HeroState;
  labels: HeroCopy;
  /** Rozdělaný obvod z konceptu; null = výchozí motiv karty. */
  circuit: Circuit | null;
}

/**
 * Lobby bez účtu na přehledu kurzu. `null` = anonym nemá hotovou lekci
 * (nebo relaci nemá vůbec, nebo je přihlášený) a stránka zůstane, jaká je.
 *
 * Relaci dostane jen anonym — přihlášenému ji volající nepředá, takže se
 * jeho postup nesplete s tím, co zbylo v prohlížeči po sourozenci.
 * Koncept se čte pod starým klíčem bez profilu (anonym).
 */
export function anonLobbyModel(
  outline: {
    slug: string;
    lessons: {
      slug: string;
      title: string;
      orderIndex: number;
      estimatedMinutes: number | null;
      isPublished: boolean;
    }[];
  },
  session: AnonSession | null,
  load: (slug: string) => LessonDraft | null,
): AnonLobbyModel | null {
  const completed = new Set(
    (session?.lessons ?? [])
      .filter((l) => l.courseSlug === outline.slug && l.completedAt)
      .map((l) => l.lessonSlug),
  );
  const path = coursePath(
    outline.lessons.filter((l) => l.isPublished),
    completed,
  );
  if (!path.some((l) => l.done)) return null;

  const refined = refineHero(path, load);
  if (refined) {
    return {
      path,
      state: refined.state,
      labels: refined.labels,
      circuit: refined.circuit,
    };
  }
  const state = heroState(path, () => null);
  const lesson = state.kind === "done" ? null : lessonBySlug(state.lesson.slug);
  return { path, state, labels: heroCopy(state, lesson), circuit: null };
}
