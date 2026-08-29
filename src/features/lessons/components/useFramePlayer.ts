"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SimulationFrame } from "@/features/circuit/simulate";

/**
 * Přehrávač snímků simulace.
 *
 * Simulace spočítá celý běh dopředu — včetně delayů, které se nikde
 * nečekaly. Aby ale dítě vidělo blikání jako blikání, musí se ty snímky
 * přehrát ve skutečném čase.
 *
 * ── Co se přehrává a co ne ─────────────────────────────────────────────────
 * Rozhoduje virtuální čas. Program s delayem se v čase mění, takže se
 * přehraje a pak zas od začátku. Program bez delaye se nemění vůbec —
 * jen se ustálí — a tam se rovnou ukáže výsledný stav.
 *
 * Bez toho rozlišení dopadla první lekce takhle: snímky byly dva
 * (zhasnuto ze setupu, rozsvíceno z loopu), přehrávač je střídal a LED,
 * která má svítit natrvalo, blikala. Dítě by dostalo „splněno" u obvodu,
 * na kterém nic nevidí.
 */

/** Nejdelší přehrání jednoho cyklu. Delší běh se zrychlí. */
const MAX_PLAYBACK_MS = 8000;

/**
 * Který snímek patří k danému okamžiku běhu.
 *
 * Vytažené ven, protože tohle je celá logika přehrávání a v prohlížeči se
 * testuje mizerně: requestAnimationFrame na skryté kartě vůbec neběží.
 * Jako funkce se to dá ověřit přesně.
 */
export function frameIndexAt(frames: SimulationFrame[], virtualMs: number): number {
  let index = 0;
  while (index + 1 < frames.length && (frames[index + 1]?.elapsedMs ?? 0) <= virtualMs) {
    index += 1;
  }
  return index;
}

export interface FramePlayer {
  /** Snímek, který se má právě zobrazit. */
  frame: SimulationFrame | null;
  /** Běží animace? U ustáleného programu je false — není co animovat. */
  playing: boolean;
  stop: () => void;
}

/** Stabilní „žádné snímky". Přehrávač porovnává reference, viz níž. */
export const NO_FRAMES: SimulationFrame[] = [];

/**
 * @param frames Snímky běhu. Reference musí být stabilní — nový běh se
 *   pozná právě podle toho, že se změnila, a nový běh se rovnou přehraje.
 *   Kdo sem pošle `x ?? []`, vyrobí nové pole při každém renderu a
 *   přehrávač se zacyklí; na to je `NO_FRAMES`.
 */
export function useFramePlayer(frames: SimulationFrame[]): FramePlayer {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [shown, setShown] = useState(frames);
  const raf = useRef<number | null>(null);

  const total = frames.at(-1)?.elapsedMs ?? 0;
  const animated = total > 0 && frames.length > 1;

  /* Nové snímky = nový běh. Srovnává se to při renderu, ne v efektu: kdyby
     se index přenastavil až po vykreslení, dítě by na jeden snímek
     zahlédlo doprostřed předchozího pokusu. */
  if (shown !== frames) {
    setShown(frames);
    setIndex(animated ? 0 : Math.max(0, frames.length - 1));
    setPlaying(animated);
  }

  const stop = useCallback(() => setPlaying(false), []);

  useEffect(() => {
    if (!playing || !animated) return;

    /* Dlouhý běh se zrychlí, aby dítě nečekalo minutu. Krátký běží
       v reálném čase — půl vteřiny má vypadat jako půl vteřiny. */
    const rate = total > MAX_PLAYBACK_MS ? total / MAX_PLAYBACK_MS : 1;
    let cycleStart = performance.now();

    const tick = (now: number) => {
      let virtual = (now - cycleStart) * rate;

      /* Doběhlo? Znovu od začátku — blikání má blikat pořád. Cyklus se
         uzavírá až po uplynutí času POSLEDNÍHO snímku, takže i ten je
         chvíli vidět. */
      if (virtual >= total) {
        cycleStart = now;
        virtual = 0;
      }

      setIndex(frameIndexAt(frames, virtual));

      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);

    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [playing, animated, total, frames]);

  return {
    frame: frames[Math.min(index, frames.length - 1)] ?? null,
    playing,
    stop,
  };
}
