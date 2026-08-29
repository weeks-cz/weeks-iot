"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Minus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Palette } from "./Palette";
import { Plane } from "./Plane";
import { useBuilderReducer } from "./state";
import { ensureVisible, fitCircuit } from "./fit";
import { useWokwiElements } from "./useWokwiElements";
import { SAVE_DEBOUNCE_MS, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "../constants";
import type { Circuit, ComponentType, PinRef } from "../types";
import type { SimulationFrame } from "../simulate";

interface Props {
  palette: ComponentType[];
  initialCircuit: Circuit;
  onChange: (circuit: Circuit) => void;
  /** Poslední snímek běhu — z něj se rozsvítí LED a rozezní bzučák. */
  frame?: SimulationFrame | null;
  /** Součástky, ke kterým se váže nesplněný bod zapojení. */
  flagged?: string[];
  /** Piny, na které se má dítě právě trefit — plocha je rozbliká. */
  highlightPins?: PinRef[];
  /** Ukázat tečky pinů i bez najetí myší. Zapíná se v kroku zapojování. */
  showPins?: boolean;
  /** Součástka, kterou po dítěti chce aktuální krok návodu. */
  suggested?: ComponentType | null;
  /**
   * Obvod, na který se dítě vrátí tlačítkem „Začít znovu".
   *
   * Musí to být VÝCHOZÍ stav lekce, ne ten aktuální. Dřív se sem posílal
   * aktuální obvod, takže tlačítko resetovalo na to, co už tam bylo —
   * kliklo se a nestalo se nic.
   */
  resetTo?: Circuit;
  /** Zavolá se po resetu, aby o něm věděla i lekce. */
  onReset?: () => void;
  readOnly?: boolean;
  height?: number;
  /**
   * Návod ke kroku, který se veze i do režimu přes celou obrazovku.
   *
   * Bez toho by se dítě po roztažení plochy octlo bez instrukce — a to je
   * přesně ta chvíle, kdy ji potřebuje nejvíc.
   */
  toolbar?: React.ReactNode;
}

/**
 * Skládání obvodu.
 *
 * Součástky se berou z palety, drátky se kreslí ze dvou klepnutí na piny.
 * Nic víc — žádné vrstvy, žádné vlastnosti součástek, žádné menu.
 *
 * ── Co je odkoukané z Tinkercadu a co ne ───────────────────────────────────
 * Odkoukané: náhled součástky, která se chystá položit, zvýraznění pinu pod
 * ukazatelem a plocha přes celou obrazovku. Tohle všechno dělá skládání
 * pohodlným a nic z toho nic nezjednodušuje.
 *
 * Neodkoukané: stovky součástek. Paleta je omezená na to, co lekce
 * potřebuje — dítě v první lekci nemá hledat LED mezi bramborami.
 */
export function CircuitBuilder({
  palette,
  initialCircuit,
  onChange,
  frame,
  flagged,
  highlightPins,
  showPins,
  suggested,
  resetTo,
  onReset,
  readOnly,
  height = 460,
  toolbar,
}: Props) {
  const [state, dispatch] = useBuilderReducer(initialCircuit);
  const ready = useWokwiElements();
  const [expanded, setExpanded] = useState(false);
  const lastSent = useRef<Circuit>(initialCircuit);
  const viewportRef = useRef<HTMLDivElement>(null);

  /** Doostří výřez tak, aby byl vidět celý obvod. */
  const fit = useCallback(
    (circuit: Circuit) => {
      const el = viewportRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const next = fitCircuit(circuit, { width: rect.width, height: rect.height });
      if (!next) return;

      dispatch({ type: "SET_ZOOM", zoom: next.zoom });
      dispatch({ type: "SET_PAN", pan: next.pan });
    },
    [dispatch],
  );

  /* Výřez se jednou nastaví tak, aby byla vidět celá deska.
     V editovatelném builderu JEN jednou na začátku: dítě si pak výřez
     posouvá samo a přeskakovat mu ho pod rukama by bylo horší než kus
     obvodu za okrajem. V náhledu se přepočítá pokaždé, protože tam se
     nedá hýbat ničím. */
  const fitted = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (!readOnly && fitted.current) return;

    fitted.current = true;
    fit(initialCircuit);
  }, [ready, readOnly, initialCircuit, fit]);

  /* Zvýrazněné piny musí být vidět. Jinak plocha bliká někam za okraj a
     dítě hledá tečku, která na obrazovce není. Posouvá se jen tehdy, když
     opravdu nejsou vidět — skákání pod rukama je horší než nic. */
  const highlightKey = (highlightPins ?? []).map((p) => `${p.compId}#${p.pinName}`).join(",");

  useEffect(() => {
    if (!ready || readOnly || !highlightPins?.length) return;

    const el = viewportRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const pan = ensureVisible(
      state.circuit,
      highlightPins,
      { width: rect.width, height: rect.height },
      { zoom: state.zoom, pan: state.pan },
    );
    if (pan) dispatch({ type: "SET_PAN", pan });
    /* Závisí jen na TOM, KTERÉ piny se zvýrazňují — ne na výřezu samotném,
       jinak by se efekt spouštěl po vlastním posunu donekonečna. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, readOnly, highlightKey]);

  /* Po zvětšení i zmenšení se výřez srovná — jinak obvod zůstane někde
     v rohu úplně jinak velké plochy. */
  useEffect(() => {
    if (!ready) return;
    const id = requestAnimationFrame(() => fit(state.circuit));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

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

  const body = (
    <div
      className={
        expanded
          ? "flex h-full min-h-0 flex-col bg-paper"
          : "overflow-hidden rounded-lg border border-ink/15 bg-paper"
      }
    >
      {expanded && toolbar && (
        <div className="shrink-0 border-b border-ink/10 px-3 py-2">{toolbar}</div>
      )}

      <div
        className={`flex flex-col sm:flex-row ${expanded ? "min-h-0 flex-1" : ""}`}
        style={expanded ? undefined : { height }}
      >
        {/* Jen ke koukání paletu nepotřebuje — a v úzkém sloupci by z ní
            ubrala místo tomu jedinému, na co se dítě dívá. */}
        {!readOnly && (
          <Palette
            palette={palette}
            armed={state.armed}
            dispatch={dispatch}
            ready={ready}
            suggested={suggested}
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
              highlightPins={highlightPins}
              showPins={showPins}
              onEscape={expanded ? () => setExpanded(false) : undefined}
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
            <div className="pointer-events-auto flex flex-wrap gap-1">
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

              {resetTo && !readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: "RESET", circuit: resetTo });
                    /* Výřez taky, jinak zůstane odjetý někam, kde po
                       resetu nic není. */
                    requestAnimationFrame(() => fit(resetTo));
                    onReset?.();
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

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="rounded p-1.5 text-ink-500 hover:bg-ink/5 hover:text-ink"
                  aria-label={expanded ? "Zmenšit plochu" : "Roztáhnout na celou obrazovku"}
                >
                  {expanded ? (
                    <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {!readOnly && !expanded && (
        <p className="border-t border-ink/10 bg-paper-soft px-3 py-2 text-[0.7rem] leading-snug text-ink-300">
          Součástku vyber vlevo a klepni do plochy. Drátek natáhneš klepnutím na
          jednu tečku a pak na druhou — nemusíš se trefit přesně, chytne se
          nejbližší. Tahem po prázdné ploše se rozhlédneš.
        </p>
      )}
    </div>
  );

  /* Přes celou obrazovku. Skládání je hlavní práce lekce a ve výřezu
     vysokém 460 px se dělá mizerně — Tinkercad má na totéž celé okno a je
     to jeden z důvodů, proč se v něm staví pohodlně. */
  if (expanded) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Skládání obvodu na celé obrazovce"
        className="fixed inset-0 z-50 flex flex-col bg-paper"
      >
        {body}
      </div>
    );
  }

  return body;
}
