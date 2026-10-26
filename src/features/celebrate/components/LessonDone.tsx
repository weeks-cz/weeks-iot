"use client";

import { useId } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Alert, MonoLabel } from "@/components/ui/Surface";
import { EVENT, track } from "@/features/analytics/track";
import { Celebration } from "@/features/lessons/components/Celebration";
import { lessonBySlug } from "@/features/lessons/content";
import type { Lesson } from "@/features/lessons/types";
import { plural } from "@/features/lobby/copy";
import type { PathLesson } from "@/features/lobby/model";
import { MiniPath } from "./MiniPath";

export interface LessonDoneProps {
  courseSlug: string;
  /** Právě dokončená lekce (obsah z kódu — nadpis oslavy je v ní). */
  lesson: Lesson;
  /** Cesta kurzem včetně téhle lekce jako hotové. */
  path: PathLesson[];
  /** Kam dál (`nextLesson`). `null` jen u hotového kurzu — ten má finále. */
  next: PathLesson | null;
  viewer: "child" | "parent-no-profile" | "anon";
  /** Výtvor se opravdu uložil (do účtu, nebo u anonyma do prohlížeče). */
  savedToCollection: boolean;
  /** Výběr profilu se zápisem téhle lekce — jen pro `parent-no-profile`. */
  zapsatHref?: string;
}

/**
 * Kam po lekci: první nedokončená lekce ZA touhle, a když za ní žádná není,
 * první nedokončená od začátku. Hotové se přeskakují — kdo má lekci 5 už
 * z dřívějška, nemá ji dostat znovu jako „další". `null` = kurz je hotový.
 */
export function nextLesson(path: PathLesson[], currentSlug: string): PathLesson | null {
  const index = path.findIndex((l) => l.slug === currentSlug);
  return path.slice(index + 1).find((l) => !l.done) ?? path.find((l) => !l.done) ?? null;
}

/**
 * Malá oslava po lekci, která kurz nedokončila (návrh §6.1).
 *
 * Levá půlka slaví: lekce vlastními slovy („Semafor *jede.*"), co dítě
 * postavilo a kde na cestě kurzem je. Pravá vede dál — karta další lekce
 * a jediné amber tlačítko „Další lekce". Konfety nesmí zdržet: tlačítko je
 * klikatelné hned, plátno klik nepřebírá.
 *
 * Anonym místo karty dostane dnešní zeď „Ulož si to" (amber registrace),
 * ale „Další lekce" zůstává jako druhé tlačítko — zeď nesmí stát mezi
 * dítětem a obsahem.
 */
export function LessonDone({
  courseSlug,
  lesson,
  path,
  next,
  viewer,
  savedToCollection,
  zapsatHref,
}: LessonDoneProps) {
  const titleId = useId();
  const position = path.findIndex((l) => l.slug === lesson.slug);
  const number = position >= 0 ? position + 1 : lesson.order;
  const nextNumber = next ? path.findIndex((l) => l.slug === next.slug) + 1 : null;
  const nextHref = next ? `/kurz/${courseSlug}/${next.slug}` : null;

  /* Další lekce leží PŘED touhle: dítě došlo na konec (nebo skočilo dopředu)
     a něco mu chybí. Pak se řekne, kolik — certifikát je za celý kurz. */
  const missing = path.filter((l) => !l.done).length;
  const remaining =
    nextNumber !== null && nextNumber < number
      ? `Zbývá ti ${missing} ${plural(missing, "lekce", "lekce", "lekcí")} do certifikátu.`
      : null;

  return (
    <>
      <Celebration active palette="weeks" />

      <section
        aria-labelledby={titleId}
        className="grid overflow-hidden border-2 border-ink bg-paper shadow-hard md:grid-cols-[1.1fr_0.9fr]"
      >
        <div className="bg-lobby relative overflow-hidden px-6 py-8 text-paper sm:px-10 sm:py-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/weeks-w.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-auto max-w-none opacity-10 select-none"
          />
          <p className="relative font-mono text-xs uppercase tracking-[0.16em] text-trust-300">
            ✓ Lekce {number} hotová
          </p>
          <h2
            id={titleId}
            className="relative mb-3 mt-3 break-words font-display text-[2.375rem] font-extrabold leading-none tracking-[-0.03em] sm:text-[2.625rem]"
          >
            {lesson.title} <em className="not-italic text-accent-300">{lesson.celebrate.title}</em>
          </h2>
          <p className="relative max-w-[24rem] leading-relaxed text-paper/70">
            {lesson.celebrate.line}
            {savedToCollection && " Přidáno do tvé sbírky."}
          </p>
          <div className="relative mt-6">
            <MiniPath path={path} nextSlug={next?.slug ?? null} />
          </div>
        </div>

        <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
          {viewer === "anon" ? (
            <SaveWall lesson={lesson} nextHref={nextHref} remaining={remaining} />
          ) : (
            <>
              {viewer === "parent-no-profile" && zapsatHref && (
                <Alert tone="warning" title="Postup se zatím neukládá">
                  Nevybrali jste, kdo se učí. Vyberte profil dítěte, ať se lekce zapíše k němu.{" "}
                  <Link href={zapsatHref} className="font-semibold underline underline-offset-4">
                    Vybrat profil
                  </Link>
                </Alert>
              )}
              {remaining && <p className="font-semibold text-ink">{remaining}</p>}
              {next && nextNumber !== null && <NextCard next={next} number={nextNumber} />}
              <div className="flex flex-wrap gap-3">
                {nextHref && (
                  <ButtonLink href={nextHref} size="lg">
                    Další lekce →
                  </ButtonLink>
                )}
                <ButtonLink href="/ucim-se" variant={nextHref ? "outline" : "primary"} size="lg">
                  Do lobby
                </ButtonLink>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}

function NextCard({ next, number }: { next: PathLesson; number: number }) {
  const goal = lessonBySlug(next.slug)?.goal;
  return (
    <div className="border-2 border-ink bg-white p-4">
      <p className="mono-label">Další na řadě · lekce {number}</p>
      <p className="mb-0.5 mt-1 font-display text-xl font-extrabold">{next.title}</p>
      <p className="text-sm text-ink-500">
        {goal}
        {next.minutes ? `${goal ? " " : ""}~${next.minutes}\u00a0min` : ""}
      </p>
    </div>
  );
}

/**
 * Zeď pro dítě bez účtu — text beze změny proti dřívější obrazovce
 * `completed`. Přichází po doručené hodnotě: výsledek už dítě vidělo.
 */
function SaveWall({
  lesson,
  nextHref,
  remaining,
}: {
  lesson: Lesson;
  nextHref: string | null;
  remaining: string | null;
}) {
  return (
    <div>
      <MonoLabel className="mb-3">Ulož si to</MonoLabel>

      <h3 className="heading-3 mb-3">Ať ti to nezmizí</h3>

      <p className="mb-5 max-w-prose leading-relaxed text-ink-500">
        Postup máš zatím jen v tomhle prohlížeči. Když rodič založí účet, přeneseme
        ho do tvého profilu a budeš moct pokračovat i na jiném zařízení.
      </p>

      {remaining && <p className="mb-5 font-semibold text-ink">{remaining}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <ButtonLink
          href="/registrace"
          size="lg"
          /* Kolik lidí ze zdi opravdu vyrazí k registraci. Rozdíl proti
             signup_prompt_view říká, jestli je špatně text zdi, nebo až
             samotný formulář. */
          onClick={() => {
            void track(EVENT.SIGNUP_START, {
              after_lesson: lesson.slug,
              order: lesson.order,
            });
          }}
        >
          Uložit můj postup
        </ButtonLink>
        {/* Zeď nesmí stát mezi dítětem a obsahem — dítě, které si nechce
            zakládat účet, musí mít jak jít dál. */}
        {nextHref && (
          <ButtonLink href={nextHref} variant="outline" size="lg">
            Další lekce →
          </ButtonLink>
        )}
      </div>

      <p className="mt-5 font-mono text-xs text-ink-300">
        účet zakládá rodič · e-mail dítěte nepotřebujeme · dál se dostaneš i bez něj
      </p>
    </div>
  );
}
