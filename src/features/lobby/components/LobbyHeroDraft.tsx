"use client";

import { useEffect, useState } from "react";
import { CircuitThumb } from "@/features/collection/components/CircuitThumb";
import { loadDraft } from "@/features/lessons/draft";
import { refineHero, type RefinedHero } from "../refine";
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
export function LobbyHeroDraft({
  profileId,
  ...initial
}: Omit<LobbyHeroViewProps, "thumbnail"> & { profileId: string | null }) {
  const [refined, setRefined] = useState<RefinedHero>(null);
  const { path } = initial;

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- jednorázové
       přečtení localStorage po připojení; na serveru žádný není a počáteční
       stav z něj by rozešel hydrataci. Přepočítá se i po `router.refresh()`
       (nová `path`) — proto se nastavuje vždy, i na null. */
    setRefined(refineHero(path, (slug) => loadDraft(slug, profileId)));
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
