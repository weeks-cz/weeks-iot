"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert, Card, MonoLabel } from "@/components/ui/Surface";
import {
  markLessonCompleted,
  markLessonStarted,
} from "@/features/anon-session/storage";
import { EVENT, track, trackOnce } from "@/features/analytics/track";

/**
 * Průchod lekcí.
 *
 * Kroky 2 až 4 z M2. Anonymní návštěvník lekci projde celou a stav mu
 * zůstane v prohlížeči; zeď přijde AŽ po dokončení, tedy po doručené
 * hodnotě, ne před ní.
 *
 * Obsah lekce je zatím zástupný. Tenhle soubor drží mechaniku — události,
 * uložení stavu a zeď — a je připravený na to, že do něj v bloku 1.3
 * přibude zadání, video a circuit builder.
 */

interface Props {
  courseSlug: string;
  lessonSlug: string;
  lessonTitle: string;
  lessonOrder: number;
  /** Přihlášený uživatel zeď nevidí — už ji jednou prošel. */
  isAuthenticated: boolean;
  nextLessonSlug: string | null;
}

export function LessonRunner({
  courseSlug,
  lessonSlug,
  lessonTitle,
  lessonOrder,
  isAuthenticated,
  nextLessonSlug,
}: Props) {
  const [completed, setCompleted] = useState(false);
  const wallRef = useRef<HTMLDivElement>(null);

  /* Zaznamenání začátku. Tohle je nález N4 — bez lesson_start neexistuje
     jmenovatel metriky brány 1 a dokončení se nedá spočítat vůbec. */
  useEffect(() => {
    markLessonStarted(courseSlug, lessonSlug);
    void trackOnce(EVENT.LESSON_START, `${courseSlug}/${lessonSlug}`, {
      course: courseSlug,
      lesson: lessonSlug,
      order: lessonOrder,
      anonymous: !isAuthenticated,
    });
  }, [courseSlug, lessonSlug, lessonOrder, isAuthenticated]);

  /* Po dokončení se fokus přesune na zeď. Bez toho zůstane u tlačítka,
     které zmizelo, a čtečka ani klávesnice nemají kam navázat. */
  useEffect(() => {
    if (completed) wallRef.current?.focus();
  }, [completed]);

  function handleComplete() {
    markLessonCompleted(courseSlug, lessonSlug);
    void track(EVENT.LESSON_COMPLETE, {
      course: courseSlug,
      lesson: lessonSlug,
      order: lessonOrder,
      anonymous: !isAuthenticated,
    });
    setCompleted(true);

    if (!isAuthenticated) {
      void track(EVENT.SIGNUP_PROMPT_VIEW, { after_lesson: lessonSlug, order: lessonOrder });
    }
  }

  if (completed) {
    return (
      <div ref={wallRef} tabIndex={-1} className="outline-none">
        <Card className="mb-6 border-trust-600 bg-trust-50 p-6">
          <MonoLabel className="mb-2">Hotovo</MonoLabel>
          <h2 className="heading-3 mb-2">Lekce „{lessonTitle}" je hotová</h2>
          <p className="text-ink-500">Zvládl jsi to. Pojď na další.</p>
        </Card>

        {isAuthenticated ? (
          <div className="flex flex-wrap gap-3">
            {nextLessonSlug ? (
              <ButtonLink href={`/kurz/${courseSlug}/${nextLessonSlug}`} size="lg">
                Další lekce →
              </ButtonLink>
            ) : (
              <ButtonLink href="/ucim-se" size="lg">
                Zpět na přehled
              </ButtonLink>
            )}
          </div>
        ) : (
          /* Zeď. Přichází po doručené hodnotě — dítě má hotový výsledek
             před sebou a teprve teď se ptáme na e-mail rodiče. */
          <Card className="border-ink p-6 shadow-hard">
            <MonoLabel className="mb-3">Ulož si to</MonoLabel>

            <h2 className="heading-3 mb-3">Ať ti to nezmizí</h2>

            <p className="mb-5 max-w-prose leading-relaxed text-ink-500">
              Postup máš zatím jen v tomhle prohlížeči. Když rodič založí účet, přeneseme
              ho do tvého profilu a budeš moct pokračovat i na jiném zařízení.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <ButtonLink href="/registrace" size="lg">
                Uložit můj postup
              </ButtonLink>
              <button
                type="button"
                onClick={() => setCompleted(false)}
                className="rounded-sm text-sm text-ink-500 underline underline-offset-4 hover:text-ink"
              >
                Zatím ne, chci pokračovat
              </button>
            </div>

            <p className="mt-5 font-mono text-xs text-ink-300">
              účet zakládá rodič · e-mail dítěte nepotřebujeme
            </p>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <MonoLabel className="mb-3">Zadání</MonoLabel>

        {/* Zástupný obsah. Blok 1.3 sem doplní zadání, video z HWLabu
            a circuit builder; mechanika kolem už stojí. */}
        <Alert tone="info" title="Obsah lekce se připravuje">
          Zadání, video a skládání obvodu doplňujeme. Mechanika postupu už funguje —
          tlačítkem níž si můžeš vyzkoušet, jak vypadá dokončení lekce.
        </Alert>
      </Card>

      <div>
        <Button onClick={handleComplete} size="lg">
          Označit lekci za hotovou
        </Button>
      </div>
    </div>
  );
}
