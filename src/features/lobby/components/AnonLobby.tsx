"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { MonoLabel } from "@/components/ui/Surface";
import { cn } from "@/lib/cn";
import { readAnonSession } from "@/features/anon-session/storage";
import { EVENT, track } from "@/features/analytics/track";
import type { CampOffer } from "@/features/camp/offer";
import { CampCard } from "@/features/camp/components/CampCard";
import { CircuitThumb } from "@/features/collection/components/CircuitThumb";
import { loadDraft } from "@/features/lessons/draft";
import { anonLobbyModel, type AnonLobbyModel } from "../refine";
import { CoursePath } from "./CoursePath";
import { HERO_THUMB_HEIGHT, LobbyHeroView } from "./LobbyHeroView";

type Outline = Parameters<typeof anonLobbyModel>[0];

const SAVE_ACTION = {
  href: "/registrace",
  label: "Ulož si postup a získej certifikát",
};

/**
 * Lobby bez účtu na přehledu kurzu.
 *
 * Server pošle dnešní horní část stránky jako `children`; postup anonyma
 * i jeho koncepty jsou ale jen v localStorage. Po připojení se proto čte
 * relace a má-li dítě aspoň jednu hotovou lekci, `children` se v jediném
 * commitu nahradí hero lobby (bez avataru a čísel), mapou cesty a spodní
 * řadou. Bez postupu — a na serveru — zůstává stránka beze změny.
 *
 * `enabled` je jen pro anonyma: přihlášený má lobby na `/ucim-se` a jeho
 * postup se z anonymní relace nesmí míchat.
 */
export function AnonLobby({
  enabled,
  outline,
  course,
  camp,
  children,
}: {
  enabled: boolean;
  outline: Outline;
  course: { slug: string; title: string };
  camp: CampOffer;
  children: ReactNode;
}) {
  const [model, setModel] = useState<AnonLobbyModel | null>(null);

  useEffect(() => {
    if (!enabled) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- jednorázové
       přečtení localStorage po připojení; na serveru žádný není a počáteční
       stav z něj by rozešel hydrataci. */
    setModel(
      anonLobbyModel(outline, readAnonSession(), (slug) => loadDraft(slug)),
    );
  }, [enabled, outline]);

  if (!model) return <>{children}</>;

  const { path, state, labels, circuit } = model;
  /* Věta hotového kurzu posílá do sbírky, kterou anonym nemá. */
  const heroLabels =
    state.kind === "done"
      ? {
          ...labels,
          line: "Všechny lekce máš za sebou. Ulož si postup a získej certifikát.",
        }
      : labels;

  return (
    <>
      <LobbyHeroView
        state={state}
        course={course}
        path={path}
        labels={heroLabels}
        doneAction={SAVE_ACTION}
        thumbnail={
          circuit && state.kind === "draft" ? (
            <CircuitThumb
              circuit={circuit}
              label={`Tvůj rozdělaný obvod — ${state.lesson.title}`}
              height={HERO_THUMB_HEIGHT}
            />
          ) : undefined
        }
      />
      <CoursePath course={course} path={path} />
      <section aria-label="Uložení postupu a tábor" className="bg-paper">
        <div
          className={cn(
            "section-container grid items-stretch gap-5 py-8",
            camp ? "md:grid-cols-2" : "md:grid-cols-1",
          )}
        >
          <SaveCard
            lessonSlug={state.kind === "done" ? null : state.lesson.slug}
          />
          {camp && (
            <CampCard
              offer={camp}
              placement="lobby"
              size="tile"
              className="h-full"
            />
          )}
        </div>
      </section>
    </>
  );
}

/** Postup je jen v tomhle prohlížeči — karta říká proč a kam ho uložit. */
function SaveCard({ lessonSlug }: { lessonSlug: string | null }) {
  return (
    <section className="flex h-full flex-col rounded-md border border-ink/15 bg-paper-soft p-5">
      <MonoLabel className="mb-3">Tvůj postup</MonoLabel>
      <h2 className="mb-3 font-display text-lg font-semibold text-ink">
        Zatím je jen tady
      </h2>
      <p className="mb-4 max-w-prose leading-relaxed text-ink-500">
        Postup máš uložený jen v tomhle prohlížeči. S účtem ho nepotratíš a po
        dokončení kurzu dostaneš certifikát.
      </p>
      <div className="mt-auto">
        {/* Amber má hero, tohle je vedlejší akce. */}
        <ButtonLink
          href="/registrace"
          variant="outline"
          onClick={() => {
            void track(EVENT.SIGNUP_START, {
              source: "kurz-lobby",
              after_lesson: lessonSlug,
            });
          }}
        >
          Ulož si postup
        </ButtonLink>
      </div>
    </section>
  );
}
