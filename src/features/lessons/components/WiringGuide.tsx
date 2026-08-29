"use client";

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
export function CurrentStep({ steps, current }: Props) {
  const index = current ? steps.indexOf(current) : steps.length;

  if (!current) {
    return (
      <div className="rounded-md border border-trust-600 bg-trust-50 px-4 py-3">
        <p className="font-semibold text-trust-800">
          Obvod je hotový. Teď mu řekneš, co má dělat.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-ink/15 bg-paper px-4 py-3">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <MonoLabel>
          Krok {index + 1} z {steps.length}
        </MonoLabel>
        <span className="font-mono text-xs text-ink-300">
          {current.kind === "place"
            ? "vyber v paletě a klepni do plochy"
            : "klepni na jednu blikající tečku a pak na druhou"}
        </span>
      </div>

      <p className="text-lg font-semibold leading-snug text-ink">{current.instruction}</p>

      {current.warning ? (
        <p
          role="status"
          className="mt-2 max-w-prose rounded-sm border-l-4 border-cta-600 bg-cta-50 px-3 py-2 text-sm leading-relaxed text-ink-700"
        >
          {current.warning}
        </p>
      ) : (
        current.detail && (
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-500">{current.detail}</p>
        )
      )}
    </div>
  );
}

/** Odškrtávací seznam všech kroků. Patří pod plochu. */
export function StepList({ steps, current }: Props) {
  const done = steps.filter((s) => s.done).length;

  return (
    <div className="rounded-md border border-ink/15 bg-paper">
      <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 px-4 py-2">
        <MonoLabel>Postup zapojení</MonoLabel>
        <span className="font-mono text-xs text-ink-300">
          {done} z {steps.length}
        </span>
      </div>

      <ol className="flex flex-col gap-1 p-3">
        {steps.map((step, i) => {
          const isCurrent = step === current;

          return (
            <li
              key={`${step.kind}-${i}-${step.instruction}`}
              aria-current={isCurrent ? "step" : undefined}
              className={`flex items-start gap-2 rounded-sm px-2 py-1.5 text-sm ${
                isCurrent ? "bg-primary-50 text-ink" : step.done ? "text-ink-300" : "text-ink-500"
              }`}
            >
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                {step.done ? (
                  <Check className="h-4 w-4 text-trust-600" aria-hidden="true" />
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
