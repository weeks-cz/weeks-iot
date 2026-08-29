"use client";

import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Alert, Card, MonoLabel } from "@/components/ui/Surface";
import {
  markLessonCompleted,
  markLessonStarted,
} from "@/features/anon-session/storage";
import { EVENT, track, trackOnce } from "@/features/analytics/track";
import { LessonWorkbench } from "@/features/lessons/components/LessonWorkbench";
import { lessonBySlug } from "@/features/lessons/content";

/**
 * Průchod lekcí.
 *
 * Kroky 2 až 4 z M2. Anonymní návštěvník lekci projde celou a stav mu
 * zůstane v prohlížeči; zeď přijde AŽ po dokončení, tedy po doručené
 * hodnotě, ne před ní.
 *
 * Tenhle soubor drží mechaniku — události, uložení stavu a zeď. Vlastní
 * lekci (zadání, skládání obvodu, editor) obstarává `LessonWorkbench`.
 *
 * ── Odkud se bere obsah ────────────────────────────────────────────────────
 * Z kódu, ne z databáze. Lekce obsahuje funkce (`verify` u každé kontroly)
 * a ty se přes hranici server → klient přenést nedají. Databáze proto drží
 * osnovu — pořadí, publikaci, cizí klíč pro postup — a obsah je vedle ní
 * v `features/lessons/content`. Že se ty dvě věci nerozejdou, hlídá test
 * nad migrací 010.
 */

interface Props {
  courseSlug: string;
  lessonSlug: string;
  lessonTitle: string;
  lessonOrder: number;
  /** Přihlášený uživatel zeď nevidí — už ji jednou prošel. */
  isAuthenticated: boolean;
  nextLessonSlug: string | null;
  /** Všechny publikované lekce kurzu, v pořadí. Pro course_complete. */
  publishedSlugs: string[];
  /** Co už má dokončené přihlášený uživatel. U anonyma prázdné. */
  completedSlugs: string[];
}

export function LessonRunner({
  courseSlug,
  lessonSlug,
  lessonTitle,
  lessonOrder,
  isAuthenticated,
  nextLessonSlug,
  publishedSlugs,
  completedSlugs,
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

    /* Start kurzu = start jeho první lekce. Samostatnou událost potřebuje
       roční metrika dokončení kurzu, která má jiný jmenovatel než metrika
       brány (ta měří jen lekci 1). */
    if (lessonOrder === 1) {
      void trackOnce(EVENT.COURSE_START, courseSlug, {
        course: courseSlug,
        anonymous: !isAuthenticated,
      });
    }
  }, [courseSlug, lessonSlug, lessonOrder, isAuthenticated]);

  /* Po dokončení se fokus přesune na zeď. Bez toho zůstane u tlačítka,
     které zmizelo, a čtečka ani klávesnice nemají kam navázat. */
  useEffect(() => {
    if (completed) wallRef.current?.focus();
  }, [completed]);

  function handleComplete() {
    const session = markLessonCompleted(courseSlug, lessonSlug);

    void track(EVENT.LESSON_COMPLETE, {
      course: courseSlug,
      lesson: lessonSlug,
      order: lessonOrder,
      anonymous: !isAuthenticated,
    });
    setCompleted(true);

    /* Dokončení kurzu = dokončená poslední publikovaná lekce, ale jen když
       jsou hotové i všechny předchozí. Odvozovat ho z „nemám kam dál" by
       bylo špatně: kdo přeskočí na poslední lekci, kurz nedokončil.

       Skládá se ze dvou zdrojů, protože každý zná jen půlku — anonymní
       relace to, co se stalo v prohlížeči, a server to, co je v účtu. */
    const doneInSession = session.lessons
      .filter((l) => l.courseSlug === courseSlug && l.completedAt)
      .map((l) => l.lessonSlug);
    const allDone = new Set([...completedSlugs, ...doneInSession, lessonSlug]);

    if (publishedSlugs.length > 0 && publishedSlugs.every((s) => allDone.has(s))) {
      void trackOnce(EVENT.COURSE_COMPLETE, courseSlug, {
        course: courseSlug,
        lessons: publishedSlugs.length,
        anonymous: !isAuthenticated,
      });
    }

    if (!isAuthenticated) {
      void track(EVENT.SIGNUP_PROMPT_VIEW, { after_lesson: lessonSlug, order: lessonOrder });
    }
  }

  if (completed) {
    return (
      <div ref={wallRef} tabIndex={-1} className="outline-none">
        <Card className="mb-6 border-trust-600 bg-trust-50 p-6">
          <MonoLabel className="mb-2">Hotovo</MonoLabel>
          <h2 className="heading-3 mb-2">Lekce &bdquo;{lessonTitle}&ldquo; je hotová</h2>
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
              <ButtonLink
                href="/registrace"
                size="lg"
                /* Kolik lidí ze zdi opravdu vyrazí k registraci. Rozdíl
                   proti signup_prompt_view je ta jediná věc, která říká,
                   jestli je špatně text zdi, nebo až samotný formulář. */
                onClick={() => {
                  void track(EVENT.SIGNUP_START, {
                    after_lesson: lessonSlug,
                    order: lessonOrder,
                  });
                }}
              >
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

  const lesson = lessonBySlug(lessonSlug);

  /* Lekce v databázi, ke které ještě není obsah. Nemělo by nastat — test
     nad migrací to hlídá — ale spadnout kvůli tomu dítěti pod rukama by
     bylo horší než tahle věta. */
  if (!lesson) {
    return (
      <Card className="p-6">
        <MonoLabel className="mb-3">Zadání</MonoLabel>
        <Alert tone="info" title="Obsah lekce se připravuje">
          Tuhle lekci ještě dopisujeme. Zkus zatím některou z předchozích.
        </Alert>
      </Card>
    );
  }

  return (
    <LessonWorkbench
      lesson={lesson}
      onSolved={handleComplete}
      onHint={(kind, index) => {
        void track(EVENT.LESSON_HINT, {
          course: courseSlug,
          lesson: lessonSlug,
          kind,
          index,
        });
      }}
    />
  );
}
