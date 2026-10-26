"use client";

import { useEffect, useState } from "react";
import type { Circuit } from "@/features/circuit/types";
import { CircuitThumb } from "@/features/collection/components/CircuitThumb";
import { lessonBySlug } from "@/features/lessons/content";
import { loadDraft } from "@/features/lessons/draft";
import { draftStep } from "@/features/lessons/draft-step";
import { heroCopy, type HeroCopy } from "../copy";
import { heroState, type HeroState, type PathLesson } from "../model";
import { HERO_THUMB_HEIGHT, LobbyHeroView, type LobbyHeroViewProps } from "./LobbyHeroView";

/**
 * Hero lobby, upřesněný podle konceptu v prohlížeči.
 *
 * Server ví, které lekce jsou hotové, ale ne, že dítě má v lekci
 * rozdělané zapojení — koncept leží v localStorage. Server proto vykreslí
 * „další lekci" a tady se po připojení stav přepočítá: má-li cílová lekce
 * koncept za úvodním krokem, karta ukáže rozdělaný obvod a tlačítko
 * „Pokračovat, kde jsi skončil". Karta má pevnou výšku, mění se jen obsah.
 *
 * `profileId` je id dítěte (koncepty jsou podle profilu); anonym ho nemá
 * a čte starý klíč.
 */
type Refined = {
  state: Extract<HeroState, { kind: "draft" }>;
  labels: HeroCopy;
  circuit: Circuit;
} | null;

/** Stav hero podle konceptu cílové lekce; null = koncept nic nemění. */
function refine(path: PathLesson[], profileId: string | null): Refined {
  /* Cíl je tentýž jako v `heroState`: první nedokončená lekce. */
  const target = path.find((l) => !l.done);
  const lesson = target ? lessonBySlug(target.slug) : null;
  const draft = target && lesson ? loadDraft(target.slug, profileId) : null;
  if (!lesson || !draft) return null;

  const state = heroState(path, () => draftStep(lesson, draft));
  if (state.kind !== "draft") return null;
  return { state, labels: heroCopy(state, lesson), circuit: draft.circuit };
}

export function LobbyHeroDraft({
  profileId,
  ...initial
}: Omit<LobbyHeroViewProps, "thumbnail"> & { profileId: string | null }) {
  const [refined, setRefined] = useState<Refined>(null);
  const { path } = initial;

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- jednorázové
       přečtení localStorage po připojení; na serveru žádný není a počáteční
       stav z něj by rozešel hydrataci. Přepočítá se i po `router.refresh()`
       (nová `path`) — proto se nastavuje vždy, i na null. */
    setRefined(refine(path, profileId));
  }, [path, profileId]);

  if (!refined) return <LobbyHeroView {...initial} />;

  return (
    <LobbyHeroView
      {...initial}
      state={refined.state}
      labels={refined.labels}
      thumbnail={
        <CircuitThumb
          circuit={refined.circuit}
          label={`Tvůj rozdělaný obvod — ${refined.state.lesson.title}`}
          height={HERO_THUMB_HEIGHT}
        />
      }
    />
  );
}
