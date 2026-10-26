"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert, MonoLabel } from "@/components/ui/Surface";
import { EVENT, track } from "@/features/analytics/track";
import { CampCard } from "@/features/camp/components/CampCard";
import type { CampOffer } from "@/features/camp/offer";
import { CertificateFace } from "@/features/certificates/components/CertificateFace";
import { CertificateStage } from "@/features/certificates/components/CertificateStage";
import type { CertificateData } from "@/features/certificates/document";
import { CircuitThumb } from "@/features/collection/components/CircuitThumb";
import { Celebration } from "@/features/lessons/components/Celebration";
import { plural } from "@/features/lobby/copy";
import type { BuildTile } from "@/features/lobby/model";

export interface CourseFinaleProps {
  /** `child` = přihlášený (i rodič bez vybraného profilu), `anon` = bez účtu. */
  mode: "child" | "anon";
  /** Přezdívka profilu; `null` u anonyma a u rodiče bez profilu. */
  nick: string | null;
  /** Profil, pod kterým se postup zapsal — bez něj není co stáhnout. */
  childId: string | null;
  courseSlug: string;
  courseTitle: string;
  projectTitle: string;
  /** Počet publikovaných lekcí kurzu — čísla v hero i pečeť certifikátu. */
  lessons: number;
  camp: CampOffer;
  /**
   * Jestli je postup poslední lekce zapsaný v účtu. Certifikát se počítá
   * z postupu, takže do té doby by odkaz na PDF vrátil 404.
   */
  progressSaved: Promise<boolean> | boolean;
  /** Právě dokončená lekce — měření `signup_start` jako dřív na konci kurzu. */
  afterLesson: { slug: string; order: number };
  /** Náhledy postavených obvodů do karty „Co dál" (jen dítě s profilem). */
  builds?: BuildTile[];
  /** Výběr profilu se zápisem téhle lekce — jen rodič bez profilu. */
  zapsatHref?: string;
}

const THUMB_HEIGHT = 80;

/* Odkaz na PDF je obyčejné <a>, ne next/link: route vrací soubor a Link by
   ho v produkci přednačítal (generoval PDF jen proto, že je tlačítko vidět).
   Třídy odpovídají `Button` variantě primary velikosti lg. */
const AMBER_LINK =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-ink " +
  "bg-cta-500 px-8 py-4 text-lg font-semibold text-ink shadow-hard-sm select-none " +
  "transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-cta-400 " +
  "hover:shadow-hard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper";

/* Obrysové tlačítko na tmavém pozadí. `ButtonLink variant="outline"` je
   inkoustové na papír a `cn` třídy nepřepisuje, proto vlastní. */
const DARK_OUTLINE =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-paper/50 " +
  "px-7 py-4 text-lg font-semibold text-paper transition-colors duration-200 " +
  "hover:border-paper hover:bg-paper hover:text-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper";

/**
 * Výsledek ukládání postupu jako stav: `null` = ještě běží.
 * Odmítnutý slib je totéž co neuložený postup.
 */
function useSettled(value: Promise<boolean> | boolean): boolean | null {
  /* Výsledek si pamatuje, ke kterému slibu patří — nový slib (opakované
     vyřešení lekce) je zase „ještě běží", bez nastavování stavu v efektu. */
  const [result, setResult] = useState<{ of: Promise<boolean>; ok: boolean } | null>(null);
  useEffect(() => {
    if (typeof value === "boolean") return;
    let live = true;
    value.then(
      (ok) => live && setResult({ of: value, ok }),
      () => live && setResult({ of: value, ok: false }),
    );
    return () => {
      live = false;
    };
  }, [value]);
  if (typeof value === "boolean") return value;
  return result?.of === value ? result.ok : null;
}

/**
 * Finále kurzu (návrh §6.2 a §6.4) — po lekci, která dokončila celý kurz.
 *
 * Nahoře tmavá scéna: vlevo co dítě dokázalo a jediná amber akce, vpravo
 * certifikát, který přiletí a dá se naklánět. Pod ní „Co dál" a tábor.
 *
 * Nadpis bez oslovení v 5. pádě: přezdívky jsou cokoli a „Kubo/Kubíku"
 * z nich spolehlivě udělat nejde — „{nick} je konstruktér." funguje
 * pro libovolnou.
 *
 * Konfety dvakrát: při zobrazení a když certifikát dopadne. Druhá vlna
 * visí na stavu `landed`, takže dvojí `onLanded` (StrictMode v dev) ji
 * nespustí znovu. Omezený pohyb vypne obojí (`Celebration` i stage).
 */
export function CourseFinale({
  mode,
  nick,
  childId,
  courseSlug,
  courseTitle,
  projectTitle,
  lessons,
  camp,
  progressSaved,
  afterLesson,
  builds = [],
  zapsatHref,
}: CourseFinaleProps) {
  const titleId = useId();
  const [landed, setLanded] = useState(false);
  /* Datum na líci je „dnes" — PDF z účtu nese čas zápisu postupu, který
     je ve stejný den. Drží se ve stavu, ať se při překreslení nemění. */
  const [completedAt] = useState(() => new Date().toISOString());
  const saved = useSettled(progressSaved);

  const named = mode === "child" && nick ? nick : null;
  const certificate: CertificateData | null = named
    ? {
        name: named,
        courseTitle,
        projectTitle,
        /* Líc dovednosti netiskne; ty jsou jen v PDF. */
        skills: [],
        completedAt,
      }
    : null;

  return (
    <>
      <Celebration active palette="weeks" />
      <Celebration active={landed} palette="weeks" />

      <section
        aria-labelledby={titleId}
        className="overflow-hidden border-2 border-ink bg-paper shadow-hard"
      >
        <div className="bg-lobby relative overflow-hidden px-5 py-9 text-paper sm:px-10 sm:py-12 xl:px-12 xl:py-14">
          {/* Azurová záře za certifikátem a velké W vlevo dole — dekorace. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_72%_42%,rgb(34_211_238/0.18),transparent_55%)]"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/weeks-w.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -left-20 h-[26rem] w-auto max-w-none opacity-[0.08] select-none sm:h-[32rem]"
          />

          {/* Na telefonu jde certifikát hned pod nadpis — odměna má být vidět
              bez scrollování, tlačítka počkají pod ním. Na šířku dvě půlky:
              text vlevo (dva řádky mřížky), certifikát vpravo přes oba. */}
          <div className="relative grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-y-0">
            <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:self-end">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-cta-300">
                ★ Kurz dokončen
              </p>
              <h2
                id={titleId}
                className="mt-4 break-words font-display text-[2.5rem] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[3.25rem] xl:text-[3.75rem]"
              >
                {named ? (
                  <>
                    {named}{" "}
                    <span className="whitespace-nowrap">
                      je <em className="not-italic text-accent-300">konstruktér.</em>
                    </span>
                  </>
                ) : (
                  <>
                    Kurz máš{" "}
                    <em className="whitespace-nowrap not-italic text-accent-300">za sebou.</em>
                  </>
                )}
              </h2>
            </div>

            <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
              <CertificateStage
                onLanded={() => setLanded(true)}
                face={
                  <CertificateFace
                    data={certificate}
                    lessons={lessons}
                    course={{ title: courseTitle, projectTitle }}
                  />
                }
              />
            </div>

            <div className="min-w-0 lg:col-start-1 lg:row-start-2 lg:self-start">
              <p className="max-w-[28rem] text-base leading-relaxed text-paper/75 sm:text-lg lg:mt-4">
                Celý kurz <span className="font-semibold text-paper">{courseTitle}</span> je
                hotový — od první lekce až po závěrečný projekt{" "}
                <span className="font-semibold text-paper">{projectTitle}</span>.
              </p>

              <ul className="my-7 flex flex-wrap gap-x-8 gap-y-3">
                <Stat n={lessons} label={plural(lessons, "lekce", "lekce", "lekcí")} />
                <Stat
                  n={lessons}
                  label={plural(
                    lessons,
                    "postavený obvod",
                    "postavené obvody",
                    "postavených obvodů",
                  )}
                />
              </ul>

              {mode === "anon" ? (
                <AnonActions courseSlug={courseSlug} afterLesson={afterLesson} />
              ) : (
                <ChildActions
                  pdfHref={childId ? `/ucet/certifikat/${childId}/${courseSlug}/` : null}
                  saved={saved}
                />
              )}
            </div>
          </div>
        </div>

        <div
          className={
            camp
              ? "grid items-stretch gap-5 p-5 sm:p-7 md:grid-cols-2"
              : "grid gap-5 p-5 sm:p-7"
          }
        >
          {mode === "child" && zapsatHref && (
            <Alert tone="warning" title="Postup se zatím neukládá" className="md:col-span-2">
              Nevybrali jste, kdo se učí. Vyberte profil dítěte, ať se kurz zapíše k němu
              a certifikát se vystaví.{" "}
              <Link href={zapsatHref} className="font-semibold underline underline-offset-4">
                Vybrat profil
              </Link>
            </Alert>
          )}

          {mode === "anon" ? <AnonNext /> : <ChildNext builds={builds} withCollection={Boolean(childId)} />}

          {camp && (
            <CampCard
              offer={camp}
              placement={mode === "anon" ? "finale-anonym" : "finale"}
              className="h-full"
            />
          )}
        </div>
      </section>
    </>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <li className="flex flex-col">
      <span className="font-display text-[2.125rem] font-extrabold leading-none">{n}</span>
      <span className="mt-1 text-sm text-paper/60">{label}</span>
    </li>
  );
}

/* ── Akce ─────────────────────────────────────────────────────────────── */

function ChildActions({ pdfHref, saved }: { pdfHref: string | null; saved: boolean | null }) {
  /* Bez profilu, nebo když se postup nezapsal, by odkaz skončil 404 —
     místo něj věta, kde certifikát najde, a amber dostane lobby. */
  if (!pdfHref || saved === false) {
    return (
      <div className="flex flex-col gap-4">
        <p className="max-w-[28rem] leading-relaxed text-paper/75">
          Certifikát najdeš v účtu rodiče, jakmile se postup uloží.
        </p>
        <div>
          <ButtonLink href="/ucim-se" size="lg" className="max-sm:w-full">
            Zpět do lobby
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {saved === null ? (
        <Button size="lg" loading className="max-sm:w-full">
          Chystám certifikát…
        </Button>
      ) : (
        <a href={pdfHref} target="_blank" rel="noopener" className={`${AMBER_LINK} max-sm:w-full`}>
          Stáhnout certifikát <span aria-hidden="true">↓</span>
          <span className="sr-only">(PDF, otevře se v novém okně)</span>
        </a>
      )}
      <Link href="/ucim-se" className={DARK_OUTLINE}>
        Zpět do lobby
      </Link>
    </div>
  );
}

function AnonActions({
  courseSlug,
  afterLesson,
}: {
  courseSlug: string;
  afterLesson: { slug: string; order: number };
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <ButtonLink
        href="/registrace"
        size="lg"
        className="max-sm:w-full max-sm:px-4"
        /* Stejné měření jako dřívější zeď na konci kurzu: kolik dětí po
           celém kurzu opravdu vyrazí k registraci. */
        onClick={() => {
          void track(EVENT.SIGNUP_START, {
            after_lesson: afterLesson.slug,
            order: afterLesson.order,
            course: courseSlug,
          });
        }}
      >
        Ulož si postup a získej certifikát
      </ButtonLink>
      <Link href={`/kurz/${courseSlug}`} className={DARK_OUTLINE}>
        Zpět na přehled kurzu
      </Link>
    </div>
  );
}

/* ── Co dál ───────────────────────────────────────────────────────────── */

function ChildNext({ builds, withCollection }: { builds: BuildTile[]; withCollection: boolean }) {
  return (
    <section className="flex h-full flex-col rounded-md border border-ink bg-white p-6 sm:p-8">
      <MonoLabel className="mb-3">Co dál</MonoLabel>
      <h3 className="heading-3 mb-3">Další kurz chystáme</h3>
      <p className="max-w-prose leading-relaxed text-ink-500">
        Až bude hotový, ukáže se tady i v lobby. Mezitím si můžeš kteroukoli lekci zopakovat
        a vylepšit.
      </p>

      {withCollection && builds.length > 0 && (
        <ul className="mt-5 grid grid-cols-4 gap-2 sm:gap-3">
          {builds.map((tile) => (
            <li key={tile.slug} className="relative min-w-0">
              <CircuitThumb
                circuit={tile.circuit}
                label={`Obvod z lekce ${tile.title}`}
                height={THUMB_HEIGHT}
              />
              {tile.reference && (
                <span
                  className="absolute left-1 top-1 rounded-sm bg-paper/90 px-1 font-mono text-[0.5625rem] uppercase tracking-wider text-ink-500"
                  title="Vzorové zapojení — tvůj výtvor se uloží, až lekci zopakuješ."
                >
                  vzor
                </span>
              )}
              <p className="mt-1 truncate text-xs font-semibold">{tile.title}</p>
            </li>
          ))}
        </ul>
      )}

      {withCollection && (
        <div className="mt-auto pt-5">
          <Link
            href="/ucim-se/sbirka"
            className="inline-flex min-h-11 items-center gap-2 rounded-sm font-semibold text-primary-700 underline-offset-4 hover:underline"
          >
            Prohlédnout svou sbírku <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}
    </section>
  );
}

/** Text dřívější zdi na konci kurzu — postup je zatím jen v prohlížeči. */
function AnonNext() {
  return (
    <section className="flex h-full flex-col rounded-md border border-ink bg-white p-6 sm:p-8">
      <MonoLabel className="mb-3">Co dál</MonoLabel>
      <h3 className="heading-3 mb-3">Certifikát na tebe čeká</h3>
      <p className="max-w-prose leading-relaxed text-ink-500">
        Certifikát s tvou přezdívkou už na tebe čeká. Rodič ho získá, až založí účet: tvůj
        postup z tohoto prohlížeče se do něj přenese a certifikát se vystaví s datem
        dokončení kurzu.
      </p>
      <p className="mt-auto pt-5 font-mono text-xs text-ink-300">
        účet zakládá rodič · e-mail dítěte nepotřebujeme · lekce zůstávají otevřené
      </p>
    </section>
  );
}
