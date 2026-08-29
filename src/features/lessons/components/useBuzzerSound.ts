"use client";

import { useEffect, useRef } from "react";

/**
 * Bzučák, který je opravdu slyšet.
 *
 * Lekce o zvuku, ve které není nic slyšet, učí něco jiného, než chce.
 * Web Audio umí sinusový tón na dvě desítky řádků, takže tón z `tone()`
 * doopravdy zazní.
 *
 * ── Dvě věci, které to musí splnit ─────────────────────────────────────────
 * Prohlížeč nepustí zvuk, dokud uživatel něco neudělal — proto se
 * AudioContext zakládá až při prvním tónu, tedy po stisku „Spustit".
 * A hlasitost najíždí a sjíždí rampou: skokové zapnutí oscilátoru lupne
 * v reproduktoru a se sluchátky na uších to není příjemné.
 */
export function useBuzzerSound(frequency: number, enabled: boolean): void {
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (!enabled || frequency <= 0) {
      const gain = gainRef.current;
      const ctx = ctxRef.current;
      if (gain && ctx) {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
      }
      return;
    }

    let ctx = ctxRef.current;
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      ctxRef.current = ctx;
    }

    void ctx.resume();

    if (!oscRef.current || !gainRef.current) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      oscRef.current = osc;
      gainRef.current = gain;
    }

    oscRef.current.frequency.setTargetAtTime(frequency, ctx.currentTime, 0.005);
    /* Tiše. Piezo bzučák je ve skutečnosti pronikavý, ale ze sluchátek
       v plné hlasitosti by to bylo nepřátelské. */
    gainRef.current.gain.setTargetAtTime(0.06, ctx.currentTime, 0.01);
  }, [frequency, enabled]);

  /* Odchod ze stránky nesmí nechat tón hrát. */
  useEffect(() => {
    return () => {
      oscRef.current?.stop();
      oscRef.current = null;
      gainRef.current = null;
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);
}
