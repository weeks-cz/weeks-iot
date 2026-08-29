"use client";

import { useEffect, useState } from "react";
import { registerBreadboardHalf } from "../register-breadboard";

/**
 * Načtení součástkových prvků.
 *
 * Jsou to custom elements — na serveru žádné `customElements` neexistuje,
 * takže import musí až do prohlížeče. Breadboard v knihovně @wokwi/elements
 * není a registruje se zvlášť; kdo si to načte sám a na tenhle druhý krok
 * zapomene, dostane prázdné místo místo desky (a přesně to se stalo kroku
 * „Součástky").
 *
 * Proto jedno místo pro obojí.
 */

let loading: Promise<void> | null = null;

function loadOnce(): Promise<void> {
  loading ??= import("@wokwi/elements").then(() => {
    registerBreadboardHalf();
  });
  return loading;
}

/** Jsou prvky připravené k vykreslení? */
export function useWokwiElements(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadOnce().then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  return ready;
}
