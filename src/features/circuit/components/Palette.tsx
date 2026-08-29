"use client";

import { getComponentSpec } from "../components";
import { PITCH } from "../constants";
import type { BuilderAction } from "./state";
import type { ComponentType } from "../types";

interface Props {
  palette: ComponentType[];
  armed: ComponentType | null;
  dispatch: React.Dispatch<BuilderAction>;
  /** Jsou už načtené Wokwi prvky? Bez nich není co kreslit. */
  ready: boolean;
  /** Součástka, kterou po dítěti chce aktuální krok. Zvýrazní se. */
  suggested?: ComponentType | null;
  disabled?: boolean;
}

/** Kolik místa má náhled v kartičce. */
const ICON_BOX = { width: 56, height: 44 };

/**
 * Náhled součástky v paletě.
 *
 * Kreslí se tou samou Wokwi součástkou, která pak přistane na desce.
 * V registru sice je `paletteIcon` s cestou k obrázku, jenže všechny ty
 * soubory jsou 68bajtové průhledné pixely — někdo je kdysi založil jako
 * zástupné a nikdo je nedoplnil. Vykreslit skutečnou součástku je lepší
 * i kdyby ty obrázky existovaly: paleta pak ukazuje přesně to, co dítě
 * dostane, a nemůže se s deskou rozejít.
 */
function ComponentPreview({ type }: { type: ComponentType }) {
  const spec = getComponentSpec(type);

  /* Prvek se na desce vykresluje ve své přirozené velikosti a teprve
     `spec.scale` ho roztáhne na mřížku. Zpětným přepočtem se dostaneme
     k té přirozené velikosti a z ní ke zmenšení, které se vejde sem. */
  const naturalWidth = (spec.spanX * PITCH) / spec.scale;
  const naturalHeight = (spec.spanY * PITCH) / spec.scale;
  const fit = Math.min(ICON_BOX.width / naturalWidth, ICON_BOX.height / naturalHeight);

  const Tag = spec.wokwiTag as unknown as React.FC<Record<string, unknown>>;

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none flex items-center justify-center overflow-hidden"
      style={ICON_BOX}
    >
      <span style={{ transform: `scale(${fit})`, transformOrigin: "center" }}>
        <Tag {...(spec.wokwiAttrs ?? {})} />
      </span>
    </span>
  );
}

/**
 * Paleta součástek.
 *
 * Jen ty, které lekce potřebuje. Nabídnout dítěti v první lekci třicet
 * součástek znamená říct mu, že dvacet devět z nich je špatně — a nechat
 * ho, ať na to přijde samo.
 *
 * ── Klepnutí, ne tažení ────────────────────────────────────────────────────
 * Stará verze uměla jen HTML5 drag-and-drop, který na dotykových displejích
 * neexistuje. Tady se součástka klepnutím „vezme do ruky" a druhým klepnutím
 * položí. Myš i prst dělají totéž a nikdo se nemusí učit dvě ovládání.
 */
export function Palette({ palette, armed, dispatch, ready, suggested, disabled }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto p-2 sm:h-full sm:w-40 sm:shrink-0 sm:flex-col sm:overflow-y-auto sm:border-r sm:border-ink/10">
      <p className="hidden px-1 pb-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-300 sm:block">
        Součástky
      </p>

      {palette.map((type) => {
        const spec = getComponentSpec(type);
        const isArmed = armed === type;
        /* Součástka, kterou právě chce návod. Bez tohohle je paleta řada
           stejných kartiček a dítě musí porovnávat názvy s instrukcí. */
        const isSuggested = !isArmed && suggested === type;

        return (
          <button
            key={type}
            type="button"
            disabled={disabled}
            aria-pressed={isArmed}
            onClick={() => dispatch({ type: "ARM", kind: isArmed ? null : type })}
            className={`relative flex w-24 shrink-0 flex-col items-center gap-1 rounded-md border p-2 text-center transition sm:w-full ${
              isArmed
                ? "border-primary-600 bg-primary-50 shadow-hard"
                : isSuggested
                  ? "border-cta-500 bg-cta-50 shadow-hard-sm"
                  : "border-ink/15 bg-paper hover:border-ink/40"
            } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            {isSuggested && (
              <span
                aria-hidden="true"
                className="absolute -right-1 -top-1 flex size-3 animate-pulse rounded-full bg-cta-500 ring-2 ring-paper"
              />
            )}
            {ready ? (
              <ComponentPreview type={type} />
            ) : (
              <span aria-hidden="true" style={ICON_BOX} />
            )}
            <span className="text-[0.7rem] leading-tight text-ink-500">{spec.label}</span>
          </button>
        );
      })}

      {armed && (
        <p className="hidden px-1 pt-2 text-[0.7rem] leading-snug text-primary-700 sm:block">
          Klepni do plochy a součástka se tam položí.
        </p>
      )}
    </div>
  );
}
