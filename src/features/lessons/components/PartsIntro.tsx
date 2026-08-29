"use client";

import { getComponentSpec } from "@/features/circuit/components";
import { PITCH } from "@/features/circuit/constants";
import { Card, MonoLabel } from "@/components/ui/Surface";
import type { ComponentType } from "@/features/circuit/types";

interface Props {
  /** Součástky lekce, včetně desky. V pořadí, v jakém se o nich mluví. */
  parts: ComponentType[];
  /** Jsou načtené Wokwi prvky? Bez nich není co kreslit. */
  ready: boolean;
}

const PREVIEW = { width: 96, height: 72 };

/**
 * Náhled skutečné součástky, ne obrázku.
 *
 * Kreslí se tím samým prvkem, který pak přistane na desce — dítě si tak
 * spojí větu „tohle je rezistor" s tím, co za chvíli uvidí v paletě.
 */
function Preview({ type }: { type: ComponentType }) {
  const spec = getComponentSpec(type);

  const naturalWidth = (spec.spanX * PITCH) / spec.scale;
  const naturalHeight = (spec.spanY * PITCH) / spec.scale;
  const fit = Math.min(PREVIEW.width / naturalWidth, PREVIEW.height / naturalHeight);

  const Tag = spec.wokwiTag as unknown as React.FC<Record<string, unknown>>;

  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-paper-soft"
      style={PREVIEW}
    >
      <span style={{ transform: `scale(${fit})`, transformOrigin: "center" }}>
        <Tag {...(spec.wokwiAttrs ?? {})} />
      </span>
    </span>
  );
}

/**
 * Seznámení se součástkami.
 *
 * ── Proč to tu je ──────────────────────────────────────────────────────────
 * Lekce začínala rovnou paletou plnou názvů jako „Rezistor 220 Ω". Dítě,
 * které elektroniku nikdy nevidělo, netuší, co drží v ruce ani proč — a
 * krok „zapoj obvod" je pak hádanka, ne úkol. Jedna obrazovka, na které se
 * každá součástka jednou ukáže a řekne se, co dělá, to spraví.
 */
export function PartsIntro({ parts, ready }: Props) {
  /* Duplicity pryč — tři rezistory v semaforu jsou pořád jeden rezistor. */
  const unique = [...new Set(parts)];

  return (
    <div className="flex flex-col gap-3">
      <MonoLabel>S čím budeš pracovat</MonoLabel>

      {unique.map((type) => {
        const spec = getComponentSpec(type);

        return (
          <Card key={type} className="flex flex-wrap items-start gap-4 p-4">
            {ready ? (
              <Preview type={type} />
            ) : (
              <span aria-hidden="true" className="shrink-0 rounded-sm bg-paper-soft" style={PREVIEW} />
            )}

            <div className="min-w-0 flex-1">
              <h3 className="mb-1 font-display font-semibold text-ink">{spec.label}</h3>

              {spec.intro ? (
                <>
                  <p className="max-w-prose text-sm leading-relaxed text-ink-700">
                    {spec.intro.what}
                  </p>
                  <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-500">
                    {spec.intro.why}
                  </p>
                </>
              ) : (
                <p className="text-sm text-ink-500">Součástka, kterou v téhle lekci použiješ.</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
