import type { Lesson } from "@/features/lessons/types";
import type { HeroState } from "./model";

/** Výchozí dovětky za názvem lekce v lobby: „Semafor čeká na dráty." */
export const WAITING_DEFAULTS = {
  next: "je na řadě.",
  wiring: "čeká na dráty.",
  code: "čeká na program.",
} as const;

export function waitingLine(lesson: Lesson, kind: "next" | "wiring" | "code"): string {
  return lesson.waiting?.[kind] ?? WAITING_DEFAULTS[kind];
}

/**
 * České tvary podle počtu: 1 lekce, 2–4 lekce, 0 a 5+ lekcí.
 * Čísla se v lobby odvozují z dat, takže tvar se musí odvodit taky.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

/** Texty hero, které závisí na obsahu lekce — komponenta je dostane hotové. */
export interface HeroCopy {
  /** Azurový dovětek nadpisu („čeká na dráty."). Jen u `next` a `draft`. */
  waiting: string | null;
  /** Jedna věta pod nadpisem: co lekce naučí, nebo kde dítě skončilo. */
  line: string;
}

const STEP_LINE = {
  wiring: "Minule jsi skončil u zapojování. Obvod tě čeká tak, jak jsi ho nechal.",
  code: "Obvod máš zapojený, zbývá program.",
} as const;

const FALLBACK_LINE = "Lekce na tebe čeká.";

/**
 * Texty hero pro daný stav. `lesson` je obsah cílové lekce z kódu; když
 * chybí (lekce je v databázi, ale ne v obsahu), nastoupí výchozí věty —
 * lobby kvůli tomu nesmí spadnout.
 */
export function heroCopy(state: HeroState, lesson: Lesson | null): HeroCopy {
  switch (state.kind) {
    case "done":
      return {
        waiting: null,
        line: "Všechny lekce máš za sebou. Certifikát i všechno, co jsi postavil, najdeš ve sbírce.",
      };
    case "start":
      return { waiting: null, line: lesson?.goal ?? FALLBACK_LINE };
    case "next":
      return {
        waiting: lesson ? waitingLine(lesson, "next") : WAITING_DEFAULTS.next,
        line: lesson?.goal ?? FALLBACK_LINE,
      };
    case "draft":
      return {
        waiting: lesson ? waitingLine(lesson, state.step) : WAITING_DEFAULTS[state.step],
        line: STEP_LINE[state.step],
      };
  }
}
