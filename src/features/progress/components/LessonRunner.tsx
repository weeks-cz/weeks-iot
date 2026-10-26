"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Card, MonoLabel } from "@/components/ui/Surface";
import {
  markLessonCompleted,
  markLessonStarted,
} from "@/features/anon-session/storage";
import { EVENT, track, trackOnce } from "@/features/analytics/track";
import { LessonWorkbench } from "@/features/lessons/components/LessonWorkbench";
import { lessonBySlug } from "@/features/lessons/content";
import { saveLessonProgressAction } from "@/features/progress/actions";
import { celebrationAfter, lessonsDoneAfter } from "@/features/progress/course-done";
import { saveLessonBuildAction } from "@/features/collection/actions";
import { saveAnonBuild } from "@/features/collection/anon-builds";
import type { LessonBuildDraft } from "@/features/collection/schema";
import type { EditorMode } from "@/features/blocks/mode";
import type { CampOffer } from "@/features/camp/offer";
import type { Circuit } from "@/features/circuit/types";
import { referenceCircuit } from "@/features/lessons/reference-circuit";
import {
  coursePath,
  lobbyBuilds,
  type PathLesson,
} from "@/features/lobby/model";
import { LessonDone, nextLesson } from "@/features/celebrate/components/LessonDone";
import { CourseFinale } from "@/features/celebrate/components/CourseFinale";

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
  /** Název kurzu z databáze — finále a certifikát. */
  courseTitle: string;
  /** Závěrečný projekt kurzu (podle `CERTIFICATES`) — finále a certifikát. */
  projectTitle: string;
  lessonSlug: string;
  lessonOrder: number;
  /** Přihlášený uživatel zeď nevidí — už ji jednou prošel. */
  isAuthenticated: boolean;
  /** Přihlášený bez vybraného profilu dítěte: postup se zatím nikam nezapíše. */
  needsChildProfile?: boolean;
  /** Všechny publikované lekce kurzu, v pořadí. Pro course_complete. */
  publishedSlugs: string[];
  /** Co už má dokončené přihlášený uživatel. U anonyma prázdné. */
  completedSlugs: string[];
  /** Režim editoru uložený u profilu; u anonyma `undefined`. */
  childEditorMode?: EditorMode | null;
  /** Profil dítěte, pod kterým se ukládá koncept lekce; anonym `null`. */
  profileId?: string | null;
  /** Přezdívka aktivního profilu — nadpis a certifikát ve finále. */
  nick?: string | null;
  /** Nabídka tábora pro finále; `null` = karta tábora se neukáže. */
  campOffer?: CampOffer;
  /**
   * Obvody, které má dítě uložené ve sbírce (slug lekce → obvod). Server je
   * posílá, jen když tahle lekce může dokončit kurz; jinak prázdné a finále
   * nakreslí vzorová zapojení.
   */
  savedCircuits?: Record<string, Circuit>;
}

export function LessonRunner({
  courseSlug,
  courseTitle,
  projectTitle,
  lessonSlug,
  lessonOrder,
  isAuthenticated,
  needsChildProfile = false,
  publishedSlugs,
  completedSlugs,
  childEditorMode,
  profileId,
  nick = null,
  campOffer = null,
  savedCircuits = {},
}: Props) {
  const [completed, setCompleted] = useState(false);
  /* Jestli se výtvor uložil do sbírky — oslava po lekci podle toho řekne
     „Přidáno do tvé sbírky". `null` = ukládání ještě nedoběhlo. */
  const [savedToCollection, setSavedToCollection] = useState<boolean | null>(null);
  /* Hotové lekce kurzu po vyřešení téhle (`lessonsDoneAfter`).
     Z nich se rozhoduje finále vs. malá oslava i mapa v oslavě. */
  const [doneSlugs, setDoneSlugs] = useState<ReadonlySet<string>>(() => new Set(completedSlugs));
  /* Zápis postupu do účtu. Finále podle něj odemkne stažení certifikátu —
     certifikát se počítá z postupu, takže dřív by odkaz vrátil 404. */
  const [progressSaved, setProgressSaved] = useState<Promise<boolean> | boolean>(false);
  /* Obvod, který dítě právě postavilo — první náhled v „Co dál" finále. */
  const [builtCircuit, setBuiltCircuit] = useState<Circuit | null>(null);
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
    const wall = wallRef.current;
    if (!completed || !wall) return;
    /* Samotné focus() neposune stránku, když je obal vidět aspoň kouskem —
       „Mám hotovo" bývá dole a dítě by místo nadpisu a certifikátu vidělo
       jen spodní karty. Proto vždy na začátek oslavy (pod hlavičku drží
       scroll-padding-top). */
    wall.focus({ preventScroll: true });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    wall.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  }, [completed]);

  /**
   * Lekce je vyřešená.
   *
   * Zapíše se postup a událost, ale obrazovka se NEPŘEPÍNÁ. Dítě má
   * nejdřív vidět svou LED svítit — to je celá odměna za těch dvacet
   * minut. Zeď s registrací přijde teprve tehdy, když samo řekne, že
   * chce dál. Zeď má stát za doručenou hodnotou, ne místo ní.
   */
  function handleSolved(hintsUsed: number, build: LessonBuildDraft) {
    const session = markLessonCompleted(courseSlug, lessonSlug, hintsUsed);

    /* Přihlášenému dítěti se postup zapisuje i do účtu. Bez toho zůstal
       jen v prohlížeči: přehled v účtu se zastavil na čísle z registrace
       a dokončení kurzu (certifikát) se nedalo zjistit. */
    if (isAuthenticated) {
      const record = session.lessons.find(
        (l) => l.courseSlug === courseSlug && l.lessonSlug === lessonSlug,
      );
      if (record) {
        const saving = saveLessonProgressAction(record)
          .then((res) => {
            if (!res.ok) console.warn("[lekce] Postup se do účtu nezapsal");
            return res.ok;
          })
          .catch(() => false);
        /* Slib jde do finále jen dokud zápis opravdu běží. Doběhne-li dřív,
           než dítě klikne „Mám hotovo", dostane finále rovnou boolean
           a „Chystám certifikát…" neproblikne. */
        setProgressSaved(saving);
        void saving.then((ok) => setProgressSaved((cur) => (cur === saving ? ok : cur)));
      }
    }
    setBuiltCircuit(build.circuit);

    /* Výtvor do sbírky jen u dítěte s aktivním profilem; server si profil
       odvodí sám. Slugy doplňuje až tady, protože editor lekce kurz nezná. */
    if (isAuthenticated && !needsChildProfile) {
      void saveLessonBuildAction({ ...build, courseSlug, lessonSlug })
        .then((res) => {
          setSavedToCollection(res.ok);
          if (!res.ok) console.warn("[lekce] Výtvor se do sbírky neuložil");
        })
        .catch(() => setSavedToCollection(false));
    } else {
      /* Bez účtu (nebo bez profilu dítěte) výtvor zůstane v prohlížeči
         a převezme se spolu s postupem. */
      setSavedToCollection(saveAnonBuild({ ...build, courseSlug, lessonSlug }));
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

       Dítě s profilem má postup na serveru; anonymní relace prohlížeče se
       mu nepřimíchává (může v ní být sourozenec) — viz `lessonsDoneAfter`.
       Stejná množina rozhoduje oslavu i course_complete. */
    const allDone = lessonsDoneAfter({
      completedSlugs,
      sessionDoneSlugs: session.lessons
        .filter((l) => l.courseSlug === courseSlug && l.completedAt)
        .map((l) => l.lessonSlug),
      lessonSlug,
      profileBacked: isAuthenticated && !needsChildProfile,
    });
    setDoneSlugs(allDone);

    if (celebrationAfter(publishedSlugs, allDone) === "finale") {
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

  const lesson = lessonBySlug(lessonSlug);

  if (completed) {
    /* Finále jen po celém kurzu, jinak malá oslava (`celebrationAfter`). */
    if (celebrationAfter(publishedSlugs, doneSlugs) === "lesson" && lesson) {
      const path = contentPath(publishedSlugs, doneSlugs);
      return (
        <div ref={wallRef} tabIndex={-1} className="outline-none">
          <LessonDone
            courseSlug={courseSlug}
            lesson={lesson}
            path={path}
            next={nextLesson(path, lessonSlug)}
            viewer={!isAuthenticated ? "anon" : needsChildProfile ? "parent-no-profile" : "child"}
            savedToCollection={savedToCollection === true}
            zapsatHref={zapsatHref(courseSlug, lessonSlug)}
          />
        </div>
      );
    }

    /* ── Konec kurzu ── Finále s certifikátem (přihlášený i anonym). */
    const saved = new Map(
      Object.entries(savedCircuits).map(([slug, circuit]) => [slug, { data: { circuit } }]),
    );
    if (builtCircuit) saved.set(lessonSlug, { data: { circuit: builtCircuit } });

    return (
      <div ref={wallRef} tabIndex={-1} className="outline-none">
        <CourseFinale
          mode={isAuthenticated ? "child" : "anon"}
          nick={isAuthenticated && !needsChildProfile ? nick : null}
          childId={isAuthenticated && !needsChildProfile ? (profileId ?? null) : null}
          courseSlug={courseSlug}
          courseTitle={courseTitle}
          projectTitle={projectTitle}
          lessons={publishedSlugs.length}
          camp={campOffer}
          progressSaved={progressSaved}
          afterLesson={{ slug: lessonSlug, order: lessonOrder }}
          builds={lobbyBuilds(contentPath(publishedSlugs, doneSlugs), saved, referenceFor)}
          zapsatHref={
            isAuthenticated && needsChildProfile ? zapsatHref(courseSlug, lessonSlug) : undefined
          }
        />
      </div>
    );
  }

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
      profileId={profileId}
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

/** Výběr profilu, který po výběru zapíše tuhle lekci k vybranému dítěti. */
function zapsatHref(courseSlug: string, lessonSlug: string): string {
  return `/ucim-se?zapsat=${encodeURIComponent(`${courseSlug}/${lessonSlug}`)}`;
}

/** Vzorové zapojení lekce pro hotovou lekci bez uloženého výtvoru. */
function referenceFor(slug: string): Circuit | null {
  const lesson = lessonBySlug(slug);
  return lesson ? referenceCircuit(lesson.wiring) : null;
}

/**
 * Cesta kurzem pro oslavu. Pořadí a publikaci určuje databáze
 * (`publishedSlugs`), název a délku obsah lekce v kódu — stejný zdroj, ze
 * kterého lekce běží. Lekce bez obsahu (nemělo by nastat, hlídá to test nad
 * migrací) dostane místo názvu slug, ať mapa nespadne a počty sedí.
 */
function contentPath(publishedSlugs: string[], done: ReadonlySet<string>): PathLesson[] {
  return coursePath(
    publishedSlugs.map((slug, i) => {
      const content = lessonBySlug(slug);
      return {
        slug,
        title: content?.title ?? slug,
        orderIndex: i + 1,
        estimatedMinutes: content?.minutes ?? null,
      };
    }),
    done,
  );
}
