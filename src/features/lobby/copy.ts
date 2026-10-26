import type { Lesson } from "@/features/lessons/types";

/** Výchozí dovětky za názvem lekce v lobby: „Semafor čeká na dráty." */
export const WAITING_DEFAULTS = {
  next: "je na řadě.",
  wiring: "čeká na dráty.",
  code: "čeká na program.",
} as const;

export function waitingLine(lesson: Lesson, kind: "next" | "wiring" | "code"): string {
  return lesson.waiting?.[kind] ?? WAITING_DEFAULTS[kind];
}
