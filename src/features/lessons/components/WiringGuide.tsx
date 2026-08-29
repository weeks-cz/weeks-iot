"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { MonoLabel } from "@/components/ui/Surface";
import type { WiringStep } from "../wiring-steps";

interface Props {
  steps: WiringStep[];
  /** Krok, na kterém dítě právě je. Null = hotovo. */
  current: WiringStep | null;
}

/**
 * Návod k zapojení, krok za krokem.
 *
 * ── Proč je to rozdělené na dvě komponenty ─────────────────────────────────
 * Nejdřív to byl jeden blok nad plochou. Jenže instrukce plus pět kroků
 * vytlačí plochu z obrazovky a dítě pak musí rolovat mezi tím, CO má
 * udělat, a tím, KDE to má udělat. Aktuální krok proto sedí těsně nad
 * plochou a celý seznam je až pod ní.
 *
 * Seznam se odškrtává sám podle obvodu, ne podle toho, jestli dítě kleplo
 * na „další". Kdo si zapojí obvod po svém a v jiném pořadí, uvidí odškrtnuto
 * stejně — návod má pomáhat, ne poroučet.
 */

/** Kolik kroků je hotových — pro poznání, že se něco povedlo. */
function doneCount(steps: WiringStep[]): number {
  return steps.filter((s) => s.done).length;
}

export function CurrentStep({ steps, current }: Props) {
  const index = current ? steps.indexOf(current) : steps.length;
  const done = doneCount(steps);

  /* Když přibude odškrtnutý krok, instrukce se přehraje znovu. Bez toho
     se text jen tiše vymění a dítě nepozná, že se něco povedlo — a to je
     ta jediná odměna, kterou během zapojování dostane. */
  const [beat, setBeat] = useState(0);
  const lastDone = useRef(done);

  useEffect(() => {
    if (done > lastDone.current) setBeat((b) => b + 1);
    lastDone.current = done;
  }, [done]);

  if (!current) {
    return (
      <div
        role="status"
        className="animate-pop rounded-md border-2 border-trust-600 bg-trust-50 px-4 py-3"
      >
        <p className="step-instruction text-trust-800">
          Hotovo! Obvod sedí. Teď mu řekneš, co má dělat.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-ink/15 bg-paper px-4 py-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <MonoLabel>
          Krok {index + 1} z {steps.length}
        </MonoLabel>
        <span className="font-mono text-xs text-ink-300">
          {current.kind === "place"
            ? "vyber v paletě a klepni do plochy"
            : "klepni na jednu blikající tečku a pak na druhou"}
        </span>
      </div>

      {/* Klíč vynutí nové vykreslení, takže animace naskočí i tehdy, když
          se změnil jen text uvnitř téhož prvku. */}
      <p key={beat} className="step-instruction animate-slide-in text-ink">
        {current.instruction}
      </p>

      {current.warning ? (
        <p
          role="status"
          className="animate-nudge mt-2 max-w-prose rounded-sm border-l-4 border-cta-600 bg-cta-50 px-3 py-2 leading-relaxed text-ink-700"
        >
          {current.warning}
        </p>
      ) : (
        current.detail && (
          <p className="mt-1.5 max-w-prose leading-relaxed text-ink-500">{current.detail}</p>
        )
      )}
    </div>
  );
}

/** Odškrtávací seznam všech kroků. Patří pod plochu. */
export function StepList({ steps, current }: Props) {
  const done = doneCount(steps);
  const pct = steps.length > 0 ? (done / steps.length) * 100 : 0;

  return (
    <div className="overflow-hidden rounded-md border border-ink/15 bg-paper">
      <div className="border-b border-ink/10 px-4 py-2.5">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <MonoLabel>Postup zapojení</MonoLabel>
          <span className="font-mono text-xs text-ink-300">
            {done} z {steps.length}
          </span>
        </div>

        {/* Jeden plynulý pruh, ne řada čtverečků. Roste to viditelně a
            spojitě — z toho se pozná pohyb vpřed líp než z počtu. */}
        <div
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-label={`Zapojeno ${done} z ${steps.length} kroků`}
          className="h-2 overflow-hidden rounded-full bg-ink/10"
        >
          <div
            className="h-full rounded-full bg-trust-500 transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ol className="flex flex-col gap-1 p-3">
        {steps.map((step, i) => {
          const isCurrent = step === current;

          return (
            <li
              key={`${step.kind}-${i}-${step.instruction}`}
              aria-current={isCurrent ? "step" : undefined}
              className={`flex items-start gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors ${
                isCurrent ? "bg-primary-50 text-ink" : step.done ? "text-ink-300" : "text-ink-500"
              }`}
            >
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                {step.done ? (
                  <Check className="animate-check h-4 w-4 text-trust-600" aria-hidden="true" />
                ) : (
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full ${isCurrent ? "bg-primary-600" : "bg-ink/20"}`}
                  />
                )}
              </span>

              <span className={step.done ? "line-through decoration-ink/20" : undefined}>
                {step.instruction}
                <span className="sr-only">{step.done ? " — hotovo" : " — zbývá"}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
