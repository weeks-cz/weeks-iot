"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Palette } from "./Palette";
import { Plane } from "./Plane";
import { useBuilderReducer } from "./state";
import { fitCircuit } from "./fit";
import { registerBreadboardHalf } from "../register-breadboard";
import { SAVE_DEBOUNCE_MS, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "../constants";
import type { Circuit, ComponentType } from "../types";
import type { SimulationFrame } from "../simulate";

interface Props {
  palette: ComponentType[];
  initialCircuit: Circuit;
  onChange: (circuit: Circuit) => void;
  /** Poslední snímek běhu — z něj se rozsvítí LED a rozezní bzučák. */
  frame?: SimulationFrame | null;
  /** Součástky, ke kterým se váže nesplněný bod zapojení. */
  flagged?: string[];
  /** Vrátit obvod do výchozího stavu lekce. */
  onReset?: () => void;
  readOnly?: boolean;
  height?: number;
}

/**
 * Skládání obvodu.
 *
 * Součástky se berou z palety, drátky se kreslí ze dvou klepnutí na piny.
 * Nic víc — žádné vrstvy, žádné vlastnosti součástek, žádné menu.
 *
 * ── Proč to není Tinkercad ─────────────────────────────────────────────────
 * Tinkercad má stovky součástek a dítě v první lekci hledá LED mezi
 * bramborami. Paleta je proto omezená na to, co lekce potřebuje. Co se
 * nedá zapojit špatně, není potřeba kontrolovat.
 */
export function CircuitBuilder({
  palette,
  initialCircuit,
  onChange,
  frame,
  flagged,
  onReset,
  readOnly,
  height = 460,
}: Props) {
  const [state, dispatch] = useBuilderReducer(initialCircuit);
  const [ready, setReady] = useState(false);
  const lastSent = useRef<Circuit>(initialCircuit);
  const viewportRef = useRef<HTMLDivElement>(null);

  /** Doostří výřez tak, aby byl vidět celý obvod. */
  const fit = useCallback((circuit: Circuit) => {
    const el = viewportRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const next = fitCircuit(circuit, { width: rect.width, height: rect.height });
    if (!next) return;

    dispatch({ type: "SET_ZOOM", zoom: next.zoom });
    dispatch({ type: "SET_PAN", pan: next.pan });
  }, [dispatch]);

  /* Wokwi prvky se načítají až v prohlížeči. Jsou to custom elements —
     na serveru není `customElements` a import by build shodil. */
  useEffect(() => {
    let alive = true;
    registerBreadboardHalf();
    void import("@wokwi/elements").then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* Náhled se sám nastaví tak, aby bylo vidět všechno. V editovatelném
     builderu se to nedělá: dítě si výřez posunulo samo a přeskočit mu ho
     pod rukama je horší než kus obvodu za okrajem. */
  useEffect(() => {
    if (!ready || !readOnly) return;
    fit(initialCircuit);
  }, [ready, readOnly, initialCircuit, fit]);

  /* Změny se posílají ven se zpožděním. Během tahu součástkou se stav mění
     desetkrát za vteřinu a nadřazená lekce po každé změně přepočítává
     kontrolu zapojení — bez zdržení by se to dělalo úplně zbytečně. */
  useEffect(() => {
    if (state.circuit === lastSent.current) return;

    const handle = setTimeout(() => {
      lastSent.current = state.circuit;
      onChange(state.circuit);
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [state.circuit, onChange]);

  const live = new Map<string, { brightness?: number; sounding?: boolean; pressed?: boolean }>();
  for (const led of frame?.leds ?? []) live.set(led.compId, { brightness: led.brightness });
  for (const buzzer of frame?.buzzers ?? []) {
    live.set(buzzer.compId, { sounding: buzzer.frequency > 0 });
  }

  const setZoom = (value: number) =>
    dispatch({
      type: "SET_ZOOM",
      zoom: Number(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)).toFixed(2)),
    });

  const selectedLabel =
    state.selection?.kind === "component"
      ? "součástku"
      : state.selection?.kind === "wire"
        ? "drátek"
        : null;

  return (
    <div className="overflow-hidden rounded-lg border border-ink/15 bg-paper">
      <div className="flex flex-col sm:flex-row" style={{ height }}>
        {/* Jen ke koukání paletu nepotřebuje — a v úzkém sloupci by z ní
            ubrala místo tomu jedinému, na co se dítě dívá. */}
        {!readOnly && (
          <Palette
            palette={palette}
            armed={state.armed}
            dispatch={dispatch}
            ready={ready}
            disabled={!ready}
          />
        )}

        <div
          ref={viewportRef}
          className="relative flex-1 overflow-hidden border-t border-ink/10 sm:border-t-0"
        >
          {ready ? (
            <Plane
              state={state}
              dispatch={dispatch}
              live={live}
              flagged={new Set(flagged ?? [])}
              readOnly={readOnly}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-paper-soft">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-300">
                Načítám součástky…
              </p>
            </div>
          )}

          {/* Ovládání. Mazací tlačítko je tu proto, že na tabletu žádná
              klávesa Delete není — bez něj by se špatně natažený drátek
              nedal odstranit vůbec. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2">
            <div className="pointer-events-auto flex gap-1">
              {selectedLabel && !readOnly && (
                <button
                  type="button"
                  onClick={() =>
                    dispatch(
                      state.selection?.kind === "component"
                        ? { type: "DELETE_COMPONENT", id: state.selection.id }
                        : { type: "DELETE_WIRE", id: state.selection!.id },
                    )
                  }
                  className="flex items-center gap-1.5 rounded-md border border-ink/20 bg-paper px-2.5 py-1.5 text-xs text-ink shadow-sm hover:border-ink/40"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Smazat {selectedLabel}
                </button>
              )}

              {onReset && !readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    onReset();
                    dispatch({ type: "RESET", circuit: initialCircuit });
                  }}
                  className="flex items-center gap-1.5 rounded-md border border-ink/20 bg-paper px-2.5 py-1.5 text-xs text-ink-500 shadow-sm hover:border-ink/40 hover:text-ink"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Začít znovu
                </button>
              )}
            </div>

            <div className="pointer-events-auto flex items-center gap-1 rounded-md border border-ink/20 bg-paper p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setZoom(state.zoom - ZOOM_STEP)}
                className="rounded p-1.5 text-ink-500 hover:bg-ink/5 hover:text-ink"
                aria-label="Oddálit"
              >
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              {/* Ne „zpět na sto procent", ale „ukaž mi všechno". Kdo se
                  ztratil posouváním plochy, potřebuje tohle. */}
              <button
                type="button"
                onClick={() => fit(state.circuit)}
                className="px-1.5 py-1 font-mono text-[0.7rem] tabular-nums text-ink-500 hover:text-ink"
                aria-label="Ukázat celý obvod"
              >
                {Math.round(state.zoom * 100)} %
              </button>
              <button
                type="button"
                onClick={() => setZoom(state.zoom + ZOOM_STEP)}
                className="rounded p-1.5 text-ink-500 hover:bg-ink/5 hover:text-ink"
                aria-label="Přiblížit"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {!readOnly && (
        <p className="border-t border-ink/10 bg-paper-soft px-3 py-2 text-[0.7rem] leading-snug text-ink-300">
          Součástku vyber vlevo a klepni do plochy. Drátek natáhneš klepnutím na
          jednu nožičku a pak na druhou. Tahem po prázdné ploše se rozhlédneš.
        </p>
      )}
    </div>
  );
}
