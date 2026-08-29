"use client";

import Image from "next/image";
import { getComponentSpec } from "../components";
import type { BuilderAction } from "./state";
import type { ComponentType } from "../types";

interface Props {
  palette: ComponentType[];
  armed: ComponentType | null;
  dispatch: React.Dispatch<BuilderAction>;
  disabled?: boolean;
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
export function Palette({ palette, armed, dispatch, disabled }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto p-2 sm:h-full sm:w-40 sm:shrink-0 sm:flex-col sm:overflow-y-auto sm:border-r sm:border-ink/10">
      <p className="hidden px-1 pb-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-300 sm:block">
        Součástky
      </p>

      {palette.map((type) => {
        const spec = getComponentSpec(type);
        const isArmed = armed === type;

        return (
          <button
            key={type}
            type="button"
            disabled={disabled}
            aria-pressed={isArmed}
            onClick={() => dispatch({ type: "ARM", kind: isArmed ? null : type })}
            className={`flex w-24 shrink-0 flex-col items-center gap-1 rounded-md border p-2 text-center transition sm:w-full ${
              isArmed
                ? "border-primary-600 bg-primary-50 shadow-hard"
                : "border-ink/15 bg-paper hover:border-ink/40"
            } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <Image
              src={spec.paletteIcon}
              alt=""
              width={48}
              height={48}
              className="h-10 w-auto object-contain"
            />
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
