"use client";

import { useEffect } from "react";
import { EVENT, trackOnce } from "@/features/analytics/track";
import { currentEnvironment } from "@/features/analytics/environment";
import { hasCompletedAnyLesson, readAnonSession } from "@/features/anon-session/storage";

/**
 * Měří zobrazení `/registrace`.
 *
 * Nese prostředí zvlášť, ne jen přes `visit_first`: ta se zapisuje
 * v layoutu `(public)` a kdo přijde odkazem rovnou sem, žádnou nemá.
 * `had_lesson` říká, jestli rodič přichází po vyzkoušené lekci, nebo
 * naslepo — to jsou dva různé trychtýře.
 */
export function SignUpView() {
  useEffect(() => {
    void trackOnce(EVENT.SIGNUP_VIEW, "registrace", {
      env: currentEnvironment(),
      had_lesson: hasCompletedAnyLesson(readAnonSession()),
    });
  }, []);

  return null;
}
