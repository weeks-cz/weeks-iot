"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Alert, Card, MonoLabel } from "@/components/ui/Surface";
import {
  markLessonCompleted,
  markLessonStarted,
} from "@/features/anon-session/storage";
import { EVENT, track, trackOnce } from "@/features/analytics/track";
import { LessonWorkbench } from "@/features/lessons/components/LessonWorkbench";
import { lessonBySlug } from "@/features/lessons/content";
import { saveLessonProgressAction } from "@/features/progress/actions";
import type { EditorMode } from "@/features/blocks/mode";

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
  /** Přihlášený bez vybraného profilu dítěte: postup se zatím nikam nezapíše. */
  needsChildProfile?: boolean;
  nextLessonSlug: string | null;
  /** Všechny publikované lekce kurzu, v pořadí. Pro course_complete. */
  publishedSlugs: string[];
  /** Co už má dokončené přihlášený uživatel. U anonyma prázdné. */
  completedSlugs: string[];
  /** Režim editoru uložený u profilu; u anonyma `undefined`. */
  childEditorMode?: EditorMode | null;
}

export function LessonRunner({
  courseSlug,
  lessonSlug,
  lessonTitle,
  lessonOrder,
  isAuthenticated,
  needsChildProfile = false,
  nextLessonSlug,
  publishedSlugs,
  completedSlugs,
  childEditorMode,
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

  /**
   * Lekce je vyřešená.
   *
   * Zapíše se postup a událost, ale obrazovka se NEPŘEPÍNÁ. Dítě má
   * nejdřív vidět svou LED svítit — to je celá odměna za těch dvacet
   * minut. Zeď s registrací přijde teprve tehdy, když samo řekne, že
   * chce dál. Zeď má stát za doručenou hodnotou, ne místo ní.
   */
  function handleSolved(hintsUsed: number) {
    const session = markLessonCompleted(courseSlug, lessonSlug, hintsUsed);

    /* Přihlášenému dítěti se postup zapisuje i do účtu. Bez toho zůstal
       jen v prohlížeči: přehled v účtu se zastavil na čísle z registrace
       a dokončení kurzu (certifikát) se nedalo zjistit. */
    if (isAuthenticated) {
      const record = session.lessons.find(
        (l) => l.courseSlug === courseSlug && l.lessonSlug === lessonSlug,
      );
      if (record) {
        void saveLessonProgressAction(record).then((res) => {
          if (!res.ok) console.warn("[lekce] Postup se do účtu nezapsal");
        });
      }
    }

    void track(EVENT.LESSON_COMPLETE, {
      course: courseSlug,
      lesson: lessonSlug,
      order: lessonOrder,
      hints: hintsUsed,
      anonymous: !isAuthenticated,
    });

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

  }

  /** Dítě dokoukalo výsledek a chce dál. Teprve tady se ukáže zeď. */
  function handleContinue() {
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
          <h2 className="heading-3 mb-2">Lekce &bdquo;{lessonTitle}&ldquo; je hotová</h2>
          <p className="lesson-body text-ink-700">
            {nextLessonSlug ? "Máš to! Pojď na další." : "Celý kurz máš za sebou!"}
          </p>
        </Card>

        {isAuthenticated && needsChildProfile && (
          <Alert tone="warning" title="Postup se zatím neukládá" className="mb-6">
            Nevybrali jste, kdo se učí. Vyberte profil dítěte, ať se lekce zapíše k němu.{" "}
            <Link href="/ucim-se" className="font-semibold underline underline-offset-4">
              Vybrat profil
            </Link>
          </Alert>
        )}

        {isAuthenticated ? (
          <div className="flex flex-col gap-4">
            {!nextLessonSlug && !needsChildProfile && (
              <p className="max-w-prose leading-relaxed text-ink-500">
                Certifikát za celý kurz je připravený v účtu rodiče, v přehledu dítěte.
              </p>
            )}
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
          </div>
        ) : !nextLessonSlug ? (
          <CourseEndWall
            courseSlug={courseSlug}
            lessonSlug={lessonSlug}
            lessonOrder={lessonOrder}
          />
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
              {/* Zeď nesmí stát mezi dítětem a obsahem — to je pravidlo
                  projektu, ne kosmetika. Dřív tu byl jen odkaz zpátky do
                  téže lekce, takže dítě, které si nechtělo zakládat účet,
                  nemělo jak jít dál a kurz pro něj skončil. */}
              {nextLessonSlug ? (
                <ButtonLink
                  href={`/kurz/${courseSlug}/${nextLessonSlug}`}
                  variant="outline"
                  size="lg"
                >
                  Další lekce →
                </ButtonLink>
              ) : (
                <button
                  type="button"
                  onClick={() => setCompleted(false)}
                  className="rounded-sm text-sm text-ink-500 underline underline-offset-4 hover:text-ink"
                >
                  Zpátky k lekci
                </button>
              )}
            </div>

            <p className="mt-5 font-mono text-xs text-ink-300">
              účet zakládá rodič · e-mail dítěte nepotřebujeme · dál se dostaneš i bez něj
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
      childEditorMode={childEditorMode}
      onSolved={handleSolved}
      onContinue={handleContinue}
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

/**
 * Konec kurzu pro dítě bez účtu. Certifikát už na něj čeká, ale vydá se až
 * přes rodiče — proto je tu zeď s registrací a jemný další krok, ne další lekce.
 * Amber zůstává jen u registrace; odkaz na tábor je záměrně sekundární.
 */
function CourseEndWall({
  courseSlug,
  lessonSlug,
  lessonOrder,
}: {
  courseSlug: string;
  lessonSlug: string;
  lessonOrder: number;
}) {
  const campHref =
    "https://weeks.cz/tabory?utm_source=ucebna&utm_medium=app&utm_campaign=leto2027&utm_content=konec-kurzu";
  return (
    <Card className="border-ink p-6 shadow-hard">
      <MonoLabel className="mb-3">Certifikát</MonoLabel>
      <h2 className="heading-3 mb-3">Kurz máš hotový</h2>
      <p className="mb-5 max-w-prose leading-relaxed text-ink-500">
        Certifikát s tvou přezdívkou už na tebe čeká. Rodič ho získá, až založí účet:
        tvůj postup z tohoto prohlížeče se do něj přenese a certifikát se vystaví s datem
        dokončení kurzu.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <ButtonLink
          href="/registrace"
          size="lg"
          onClick={() => {
            void track(EVENT.SIGNUP_START, {
              after_lesson: lessonSlug,
              order: lessonOrder,
              course: courseSlug,
            });
          }}
        >
          Založit účet a získat certifikát
        </ButtonLink>
        <ButtonLink
          href={campHref}
          variant="outline"
          size="lg"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            void track(EVENT.CAMP_CTA_CLICK, { placement: "konec-kurzu", destination: "weeks.cz/tabory" });
          }}
        >
          Co dál: letní tábory Weeks
        </ButtonLink>
      </div>

      <p className="mt-5 font-mono text-xs text-ink-300">
        účet zakládá rodič · e-mail dítěte nepotřebujeme · lekce zůstávají otevřené
      </p>
    </Card>
  );
}
