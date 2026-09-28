"use client";

import { useRef } from "react";
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
 * ── Klepnutí i tažení ──────────────────────────────────────────────────────
 * Stará verze uměla jen HTML5 drag-and-drop, který na dotykových displejích
 * neexistuje. Pak se tu dalo jen klepnout („vezmi do ruky") a klepnout znovu
 * do plochy („polož") — jenže každý, kdo kdy něco skládal na obrazovce,
 * součástku chytne a táhne, a nestalo se nic. Teď jde obojí. Tažení je
 * na pointer events, takže funguje i prstem; pustí ho plocha (`Plane`).
 */
export function Palette({ palette, armed, dispatch, ready, suggested, disabled }: Props) {
  /** Tah, který právě běží — ať po něm `click` kartičku znovu nepřepne. */
  const dragged = useRef(false);

  const onPointerDown = (type: ComponentType) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0) return;
    dragged.current = false;
    const start = { x: e.clientX, y: e.clientY };

    /* Dotyk si prvek, na kterém začal, „přivlastní" a pohyb by pak plocha
       vůbec neviděla. Uvolnit, ať ukazatel nad plochou hlásí, kde je. */
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const move = (ev: PointerEvent) => {
      if (dragged.current) return;
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
      dragged.current = true;
      dispatch({ type: "ARM", kind: type, drag: true });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <div className="flex gap-2 overflow-x-auto p-2 sm:h-full sm:w-40 sm:shrink-0 sm:flex-col sm:overflow-y-auto sm:border-r sm:border-ink/10">
      <p className="hidden px-1 pb-1 font-mono text-xs uppercase tracking-[0.18em] text-ink-500 sm:block">
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
            onPointerDown={onPointerDown(type)}
            onClick={() => {
              if (dragged.current) {
                dragged.current = false;
                return;
              }
              dispatch({ type: "ARM", kind: isArmed ? null : type });
            }}
            /* Na mobilu je paleta vodorovný pás: do strany se roluje, dolů
               se táhne do plochy. Na širší obrazovce naopak. */
            className={`relative flex w-24 shrink-0 cursor-grab touch-pan-x flex-col items-center gap-1 rounded-md border p-2 text-center transition active:cursor-grabbing sm:w-full sm:touch-pan-y ${
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
            <span className="text-sm font-medium leading-tight text-ink">{spec.label}</span>
          </button>
        );
      })}

      {armed && (
        <p className="hidden px-1 pt-2 text-sm font-medium leading-snug text-primary-700 sm:block">
          Klepni do plochy a součástka se tam položí.
        </p>
      )}
    </div>
  );
}
