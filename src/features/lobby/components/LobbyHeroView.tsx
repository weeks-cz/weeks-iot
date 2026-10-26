import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { Avatar } from "@/features/children/avatars";
import type { CertificateData } from "@/features/certificates/document";
import { CertificateFace } from "@/features/certificates/components/CertificateFace";
import { CERTIFICATES } from "@/features/certificates/content";
import { plural, type HeroCopy } from "../copy";
import type { HeroState, PathLesson } from "../model";

export interface LobbyHeroStats {
  lessons: number;
  builds: number;
  certificates: number;
}

export interface LobbyHeroViewProps {
  state: HeroState;
  course: { slug: string; title: string };
  /** Publikované lekce kurzu — z nich „lekce 4 / 7" i projekt na certifikátu. */
  path: PathLesson[];
  /** Texty závislé na obsahu lekce (`heroCopy`). */
  labels: HeroCopy;
  /** Dítě s profilem. Bez přezdívky (anonym) se sloupec s avatarem nevykreslí. */
  nick?: string;
  avatar?: string;
  stats?: LobbyHeroStats;
  /** Vydaný certifikát pro kartu ve stavu `done`; bez něj líc bez data. */
  certificate?: CertificateData | null;
  /** Náhled na kartě lekce místo výchozího motivu (rozdělaný obvod). */
  thumbnail?: ReactNode;
  /**
   * Jiný cíl a popisek tlačítka ve stavu `done`. Dítě s účtem jde do sbírky;
   * anonym ji otevřít nemůže, tak ho tlačítko pošle uložit postup.
   */
  doneAction?: { href: string; label: string; onClick?: () => void };
}

/** Výška náhledu na kartě. Karta má pevnou výšku, aby přepočet na klientovi nehnul stránkou. */
export const HERO_THUMB_HEIGHT = 128;

const BUTTON = {
  start: "Začít první lekcí →",
  next: "Pokračovat v lekci →",
  draft: "Pokračovat, kde jsi skončil →",
  done: "Prohlédnout certifikát →",
} as const;

/** Kurz a projekt na líci certifikátu, dokud ho dítě nemá vydaný. */
export function certificateCourse(
  course: { slug: string; title: string },
  path: PathLesson[],
): { title: string; projectTitle: string } {
  const projectSlug = CERTIFICATES[course.slug]?.projectLessonSlug;
  const project = path.find((l) => l.slug === projectSlug) ?? path.at(-1);
  return { title: course.title, projectTitle: project?.title ?? "" };
}

export function heroHref(state: HeroState, courseSlug: string): string {
  switch (state.kind) {
    case "done":
      return "/ucim-se/sbirka";
    case "draft":
      return `/kurz/${courseSlug}/${state.lesson.slug}?pokracovat=1`;
    default:
      return `/kurz/${courseSlug}/${state.lesson.slug}`;
  }
}

/**
 * Hlavní plocha lobby — čistě prezentační.
 *
 * Nic nenačítá: stav, texty i dítě dostane hotové. Serverová obálka
 * (`LobbyHero`) a klientský přepočet podle konceptu (`LobbyHeroDraft`)
 * ji vykreslují stejně, a stejně ji použije i lobby bez účtu na přehledu
 * kurzu (bez avataru a čísel).
 *
 * Tři sloupce (dítě · věta · karta) až od `xl`: při 1024 px byl prostřední
 * sloupec tak úzký, že se nadpis lámal na čtyři řádky. Do té doby dva
 * sloupce (věta · karta) a dítě pod nimi.
 *
 * Jediné amber tlačítko na obrazovce je tady. Oko ho má najít jako první:
 * na telefonu jde věta s tlačítkem nahoru, karta lekce pod ni a dítě až
 * nakonec (návrh §5.1).
 */
export function LobbyHeroView({
  state,
  course,
  path,
  labels,
  nick,
  avatar,
  stats,
  certificate,
  thumbnail,
  doneAction,
}: LobbyHeroViewProps) {
  const hasChild = nick !== undefined;

  return (
    <section className="bg-lobby relative overflow-hidden text-paper">
      {/* Velké průhledné W přes pravou půlku — dekorace. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/weeks-w.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 left-[30%] h-80 w-auto max-w-none opacity-10 select-none sm:left-[38%] xl:-top-24 xl:h-[31rem]"
      />

      <div
        className={cn(
          "section-container relative grid gap-8 py-8 sm:py-10 xl:gap-0 xl:py-0",
          hasChild
            ? "md:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[15rem_minmax(0,1fr)_20rem]"
            : "md:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]",
        )}
      >
        <Mission
          state={state}
          course={course}
          path={path}
          labels={labels}
          nick={nick}
          doneAction={doneAction}
        />
        <LessonCard
          state={state}
          path={path}
          course={course}
          nick={nick}
          certificate={certificate}
          thumbnail={thumbnail}
        />
        {hasChild && <ChildColumn nick={nick} avatar={avatar ?? "robot"} stats={stats} />}
      </div>
    </section>
  );
}

/* ── Věta a akce ──────────────────────────────────────────────────────── */

function Mission({
  state,
  course,
  path,
  labels,
  nick,
  doneAction,
}: Pick<LobbyHeroViewProps, "state" | "course" | "path" | "labels" | "nick" | "doneAction">) {
  const position =
    state.kind === "done"
      ? "hotovo"
      : `lekce ${path.findIndex((l) => l.slug === state.lesson.slug) + 1} / ${path.length}`;

  /* Tlačítko se skládá jednou: hotový kurz může mít vlastní cíl. */
  const action =
    state.kind === "done" && doneAction
      ? doneAction
      : { href: heroHref(state, course.slug), label: BUTTON[state.kind], onClick: undefined };

  return (
    <div className="order-1 min-w-0 xl:order-2 xl:px-10 xl:py-12">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-accent-300">
        Kurz {course.title} · {position}
      </p>
      {/* Nadpis a věta mají různě dlouhé texty pro „další lekci" a „rozdělanou
          práci" (měřeno pro všech 7 lekcí × zapojení/program při 320–1366 px:
          nadpis až 4 řádky, věta až 3). Blok proto drží místo na nejdelší
          kombinaci, ať přepočet na klientovi nehne tlačítkem ani kartou.
          Volné místo zůstane pod větou, ne mezi nadpisem a větou. */}
      <div className="mb-6 min-h-[14rem] sm:min-h-[15.25rem] xl:min-h-[13.5rem]">
        <h1 className="mb-4 break-words font-display text-[2.375rem] font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-5xl xl:text-[2.875rem]">
          <Heading state={state} course={course} labels={labels} nick={nick} />
        </h1>
        <p className="max-w-[28rem] text-base leading-relaxed text-paper/70 sm:text-lg">
          {labels.line}
        </p>
      </div>
      {/* Na úzkém telefonu (320 px) by se nejdelší popisek zalomil na dva
          řádky a tlačítko by po přepočtu na klientovi povyrostlo. */}
      <ButtonLink
        href={action.href}
        size="lg"
        className="max-sm:w-full max-sm:px-4"
        onClick={action.onClick}
      >
        {action.label}
      </ButtonLink>
    </div>
  );
}

function Heading({
  state,
  course,
  labels,
  nick,
}: Pick<LobbyHeroViewProps, "state" | "course" | "labels" | "nick">) {
  const em = "not-italic text-accent-300";
  switch (state.kind) {
    case "start":
      return (
        <>
          {nick ? `Ahoj ${nick}.` : "Ahoj."}
          <br />
          Postavíme první <em className={em}>obvod?</em>
        </>
      );
    case "done":
      return (
        <>
          Kurz {course.title} máš <em className={em}>hotový.</em>
        </>
      );
    default:
      return (
        <>
          Vítej zpátky.
          <br />
          {state.lesson.title} <em className={em}>{labels.waiting}</em>
        </>
      );
  }
}

/* ── Karta lekce ──────────────────────────────────────────────────────── */

const STEP_NAMES = ["zadání", "součástky", "zapojení", "program"] as const;

/** Kolik kroků je hotových a který je rozdělaný (index), podle stavu. */
function stepProgress(state: HeroState): { done: number; current: number | null } {
  if (state.kind !== "draft") return { done: 0, current: null };
  return state.step === "wiring" ? { done: 2, current: 2 } : { done: 3, current: 3 };
}

function LessonCard({
  state,
  path,
  course,
  nick,
  certificate,
  thumbnail,
}: Pick<LobbyHeroViewProps, "state" | "path" | "course" | "nick" | "certificate" | "thumbnail">) {
  return (
    <div className="order-2 flex items-center xl:order-3 xl:py-10">
      {/* Pevná výška: přepočet na klientovi mění jen obsah, ne rozměr. */}
      <div className="h-[19.5rem] w-full overflow-hidden border-2 border-accent-400 bg-[rgba(15,19,38,0.75)] p-4 shadow-[6px_6px_0_0_var(--color-accent-600)]">
        {state.kind === "done" ? (
          <>
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-accent-300">
              Tvůj certifikát
            </p>
            <CertificateFace
              data={certificate ?? null}
              placeholderName={nick}
              lessons={path.length}
              course={certificateCourse(course, path)}
              compact
            />
          </>
        ) : (
          <LessonCardBody state={state} path={path} thumbnail={thumbnail} />
        )}
      </div>
    </div>
  );
}

function LessonCardBody({
  state,
  path,
  thumbnail,
}: {
  state: Exclude<HeroState, { kind: "done" }>;
  path: PathLesson[];
  thumbnail?: ReactNode;
}) {
  const { lesson } = state;
  const number = path.findIndex((l) => l.slug === lesson.slug) + 1;
  const label =
    state.kind === "draft" ? "Rozdělaná práce" : state.kind === "start" ? "První lekce" : "Další na řadě";
  const { done, current } = stepProgress(state);

  return (
    <>
      {thumbnail ?? <ThumbMotif number={number} />}
      <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-accent-300">{label}</p>
      <p className="mt-1 truncate font-display text-2xl font-bold">{lesson.title}</p>

      {state.kind === "start" ? (
        <p className="mt-3 font-mono text-xs text-paper/60">
          {lesson.minutes
            ? `asi ${lesson.minutes} ${plural(lesson.minutes, "minutu", "minuty", "minut")}`
            : "\u00a0"}
        </p>
      ) : (
        <>
          <div className="mt-3 flex gap-1.5" aria-hidden="true">
            {STEP_NAMES.map((name, i) => (
              <i
                key={name}
                className={cn(
                  "h-1.5 flex-1",
                  i < done && i !== current && "bg-accent-400",
                  i === current &&
                    "bg-[linear-gradient(90deg,var(--color-accent-400)_50%,rgb(255_255_255/0.15)_50%)]",
                  i >= done && i !== current && "bg-paper/15",
                )}
              />
            ))}
          </div>
          <p className="mt-2 font-mono text-[0.6875rem] text-paper/60">
            {STEP_NAMES.map((name, i) =>
              i < done && i !== current ? `${name} ✓` : i === current ? `${name} …` : name,
            ).join(" · ")}
          </p>
        </>
      )}
    </>
  );
}

/** Výchozí náhled: výkresová mřížka s číslem lekce. Stejná výška jako obvod. */
function ThumbMotif({ number }: { number: number }) {
  return (
    <div
      aria-hidden="true"
      className="blueprint-grid-dark relative grid place-items-center border border-paper/10 bg-[#0f1326]"
      style={{ height: HERO_THUMB_HEIGHT }}
    >
      <span className="font-mono text-5xl font-medium text-accent-300/80">
        {String(number).padStart(2, "0")}
      </span>
      <span className="absolute left-1/2 top-1/2 size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-accent-300/25" />
    </div>
  );
}

/* ── Dítě ─────────────────────────────────────────────────────────────── */

function ChildColumn({
  nick,
  avatar,
  stats,
}: {
  nick: string;
  avatar: string;
  stats?: LobbyHeroStats;
}) {
  const items = stats
    ? [
        { key: "lessons", n: stats.lessons, label: plural(stats.lessons, "lekce", "lekce", "lekcí") },
        { key: "builds", n: stats.builds, label: plural(stats.builds, "obvod", "obvody", "obvodů") },
        {
          key: "certificates",
          n: stats.certificates,
          label: plural(stats.certificates, "certifikát", "certifikáty", "certifikátů"),
        },
      ]
    : [];

  return (
    <div className="order-3 flex min-w-0 items-center gap-5 border-t border-paper/10 pt-6 md:col-span-2 xl:order-1 xl:col-span-1 xl:flex-col xl:items-start xl:gap-0 xl:border-r xl:border-t-0 xl:py-10 xl:pr-6">
      {/* SVG avatary jsou kreslené pro světlé pozadí (návrh §10). */}
      <div className="grid size-16 shrink-0 place-items-center rounded-full border-[3px] border-accent-300 bg-paper p-2.5 text-ink shadow-[0_0_0_6px_rgb(103_232_249/0.14)] xl:size-29 xl:p-5">
        <Avatar id={avatar} className="block size-full" />
      </div>
      <div className="min-w-0 flex-1 xl:w-full">
        <p className="truncate font-display text-2xl font-extrabold xl:mt-4 xl:text-[1.75rem]">
          {nick}
        </p>
        {items.length > 0 && (
          <dl className="mt-2 flex gap-5 xl:mt-4">
            {items.map((item) => (
              <div key={item.key} className="flex flex-col-reverse">
                <dt className="text-xs text-paper/60">{item.label}</dt>
                <dd className="font-display text-2xl font-extrabold">{item.n}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
