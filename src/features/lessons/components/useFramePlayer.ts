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
 * Řídí se virtuálním časem snímků, ne jejich počtem: mezi dvěma snímky
 * vzdálenými půl vteřiny se čeká půl vteřiny. Přechod jasu s delay(5) se
 * tím přehraje plynule a blikání s delay(500) pomalu, aniž by se to
 * muselo kdekoli nastavovat.
 */

/** Nejdelší přehrání jednoho cyklu. Delší běh se zrychlí. */
const MAX_PLAYBACK_MS = 8000;
/** Program bez jediného delay nemá čas — jede se pevným krokem. */
const FALLBACK_STEP_MS = 300;

export interface FramePlayer {
  /** Snímek, který se má právě zobrazit. */
  frame: SimulationFrame | null;
  playing: boolean;
  play: () => void;
  stop: () => void;
}

export function useFramePlayer(frames: SimulationFrame[]): FramePlayer {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [shownFrames, setShownFrames] = useState(frames);
  const raf = useRef<number | null>(null);

  /* Nový běh začíná od začátku. Srovnává se to při renderu, ne v efektu:
     kdyby se index vynuloval až po vykreslení, dítě by na jeden snímek
     zahlédlo doprostřed předchozího pokusu. */
  if (shownFrames !== frames) {
    setShownFrames(frames);
    setIndex(0);
  }

  const stop = useCallback(() => setPlaying(false), []);
  const play = useCallback(() => {
    setIndex(0);
    setPlaying(true);
  }, []);

  useEffect(() => {
    if (!playing || frames.length <= 1) return;

    const total = frames.at(-1)?.elapsedMs ?? 0;
    /* Dlouhý běh se zrychlí, aby dítě nečekalo minutu. Krátký běží
       v reálném čase — půl vteřiny má vypadat jako půl vteřiny. */
    const rate = total > MAX_PLAYBACK_MS ? total / MAX_PLAYBACK_MS : 1;

    let cycleStart = performance.now();

    const tick = (now: number) => {
      const elapsed = now - cycleStart;

      let next: number;
      if (total > 0) {
        const virtual = elapsed * rate;
        next = 0;
        while (next + 1 < frames.length && (frames[next + 1]?.elapsedMs ?? 0) <= virtual) {
          next += 1;
        }
      } else {
        next = Math.floor(elapsed / FALLBACK_STEP_MS);
      }

      if (next >= frames.length - 1) {
        /* Blikání má blikat pořád. Doběhnutý program se přehraje znovu —
           jinak by dítě vidělo jeden cyklus a pak ustrnulý obrázek. */
        setIndex(frames.length - 1);
        cycleStart = now;
      } else {
        setIndex(next);
      }

      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);

    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [playing, frames]);

  return {
    frame: frames[Math.min(index, frames.length - 1)] ?? null,
    playing,
    play,
    stop,
  };
}
