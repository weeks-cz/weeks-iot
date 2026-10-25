"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/**
 * Jeden animační snímek prohlížeče (60 Hz). Kratší stav než tohle se
 * v rAF klidně ztratí, proto má aspoň jeden snímek svůj čas.
 */
export const TICK_MS = 1000 / 60;

/**
 * Který snímek patří k danému okamžiku běhu, když se počítá z času snímků
 * (`elapsedMs`), bez zkrácení a bez délek. Pro testy a rychlé dotazy.
 */
export function frameIndexAt(frames: SimulationFrame[], virtualMs: number): number {
  let index = 0;
  while (index + 1 < frames.length && (frames[index + 1]?.elapsedMs ?? 0) <= virtualMs) {
    index += 1;
  }
  return index;
}

/**
 * Rozvrh přehrávání: kdy který snímek začne a jak dlouho je vidět.
 *
 * Přehrává se v reálném čase, 1 : 1. Stav, který trvá aspoň tick, se ukáže
 * přesně tak dlouho, jak trvá. Krátký stav uprostřed dlouhých (třeba 10 ms
 * zhasnutí mezi dvěma půlsekundami) se natáhne na jeden snímek — jinak by
 * do obrazovky vůbec nedosáhl. Řada krátkých stavů za sebou (přechod jasu
 * s delay(5)) zůstává v reálném čase: je to plynulý náběh, ne jednotlivé
 * záblesky.
 */
export interface PlaybackSchedule {
  /** Začátek každého snímku na časové ose přehrávání. */
  starts: number[];
  /** Jak dlouho je každý snímek vidět. 0 = nikdy (zero-length stav). */
  shown: number[];
  /** Délka celého cyklu. */
  total: number;
}

export function playbackSchedule(frames: SimulationFrame[]): PlaybackSchedule {
  const raw = frames.map((frame, i) => {
    if (frame.durationMs !== undefined) return frame.durationMs;
    const next = frames[i + 1]?.elapsedMs ?? frame.elapsedMs;
    return Math.max(0, next - frame.elapsedMs);
  });

  /* Nejdelší čas, který se ukáže sám od sebe. Sousedé na hranici se počítají
     jako dlouzí — první nebo poslední krátký stav tak dostane svůj tick. */
  const long = (d: number | undefined) => d === undefined || d >= TICK_MS;

  const shown = raw.map((d, i) => {
    if (d <= 0) return 0;
    if (d >= TICK_MS) return d;
    const isolated = long(raw[i - 1]) || long(raw[i + 1]);
    return isolated ? TICK_MS : d;
  });

  const starts: number[] = [];
  let at = 0;
  for (const d of shown) {
    starts.push(at);
    at += d;
  }

  return { starts, shown, total: at };
}

/** Index snímku, který je v daném okamžiku cyklu vidět. */
export function playbackIndexAt(schedule: PlaybackSchedule, virtualMs: number): number {
  let index = 0;
  for (let i = 0; i < schedule.starts.length; i++) {
    if ((schedule.shown[i] ?? 0) > 0 && (schedule.starts[i] ?? 0) <= virtualMs) index = i;
  }
  return index;
}

/** Snímek, který se ukáže v čase `virtualMs` cyklu přehrávání. */
export function stateAtPlayback(
  frames: SimulationFrame[],
  virtualMs: number,
): SimulationFrame | null {
  if (frames.length === 0) return null;
  return frames[playbackIndexAt(playbackSchedule(frames), virtualMs)] ?? null;
}

export interface FramePlayer {
  /** Snímek, který se má právě zobrazit. */
  frame: SimulationFrame | null;
  /** Běží animace? U ustáleného programu je false — není co animovat. */
  playing: boolean;
  /**
   * Běží program? Na rozdíl od `playing` i u ustáleného programu — ten se
   * neanimuje, ale pořád „běží". Podle toho hraje bzučák: program bez
   * delaye (tlačítko → tón) se nikdy neanimoval, a tak nebyl ani slyšet.
   */
  active: boolean;
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
  const [active, setActive] = useState(false);
  const [shown, setShown] = useState(frames);
  const raf = useRef<number | null>(null);

  const schedule = useMemo(() => playbackSchedule(frames), [frames]);
  const total = schedule.total;
  const animated = total > 0 && frames.length > 1;
  const playing = active && animated;

  /* Nové snímky = nový běh. Srovnává se to při renderu, ne v efektu: kdyby
     se index přenastavil až po vykreslení, dítě by na jeden snímek
     zahlédlo doprostřed předchozího pokusu. */
  if (shown !== frames) {
    setShown(frames);
    setIndex(animated ? 0 : Math.max(0, frames.length - 1));
    setActive(frames.length > 0);
  }

  const stop = useCallback(() => setActive(false), []);

  useEffect(() => {
    if (!playing || !animated) return;

    /* Reálný čas, 1 : 1. Cyklus se posouvá o celé délky, ne resetuje na nulu,
       aby se čas nerozjížděl o zlomky tiku při každém obratu. */
    let cycleStart = performance.now();

    const tick = (now: number) => {
      let virtual = now - cycleStart;
      if (virtual >= total) {
        const cycles = Math.floor(virtual / total);
        cycleStart += cycles * total;
        virtual -= cycles * total;
      }

      setIndex(playbackIndexAt(schedule, virtual));

      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);

    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [playing, animated, total, schedule]);

  return {
    frame: frames[Math.min(index, frames.length - 1)] ?? null,
    playing,
    active,
    stop,
  };
}
