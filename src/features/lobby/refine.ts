import type { Circuit } from "@/features/circuit/types";
import { lessonBySlug } from "@/features/lessons/content";
import type { LessonDraft } from "@/features/lessons/draft";
import { draftStep } from "@/features/lessons/draft-step";
import { heroCopy, type HeroCopy } from "./copy";
import { heroState, type HeroState, type PathLesson } from "./model";

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
