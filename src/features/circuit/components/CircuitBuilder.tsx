"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Minus, Plus, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { Palette } from "./Palette";
import { Plane } from "./Plane";
import { canRotate, useBuilderReducer } from "./state";
import { ensureVisible, fitCircuit } from "./fit";
import { clampPan, contentBounds, zoomAt } from "./view";
import { useWokwiElements } from "./useWokwiElements";
import { SAVE_DEBOUNCE_MS, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "../constants";
import { getComponentSpec } from "../components";
import { isRotatable } from "../pins";
import type { Circuit, ComponentType, PinRef } from "../types";
import type { SimulationFrame } from "../simulate";

interface Props {
  palette: ComponentType[];
  initialCircuit: Circuit;
  onChange: (circuit: Circuit) => void;
  /** Poslední snímek běhu — z něj se rozsvítí LED a rozezní bzučák. */
  frame?: SimulationFrame | null;
  /** Piny, na které se má dítě právě trefit — plocha je rozbliká. */
  highlightPins?: PinRef[];
  /** Ukázat tečky pinů i bez najetí myší. Zapíná se v kroku zapojování. */
  showPins?: boolean;
  /** Součástka, kterou po dítěti chce aktuální krok návodu. */
  suggested?: ComponentType | null;
  /** Která tlačítka jsou právě držená. */
  pressed?: Set<string>;
  /** Zmáčknutí tlačítka v obvodu — jen když má smysl, tedy při běhu. */
  onPress?: (compId: string, down: boolean) => void;
  /**
   * Obvod, na který se dítě vrátí tlačítkem „Začít znovu".
   *
   * Musí to být VÝCHOZÍ stav lekce, ne ten aktuální.
   */
  resetTo?: Circuit;
  /** Zavolá se po resetu, aby o něm věděla i lekce. */
  onReset?: () => void;
  /**
   * Obvod vnucený zvenku — použije se, jakmile dorazí JINÝ objekt.
   *
   * Porovnává se REFERENCE, ne obsah: každé vnucení musí být nový objekt,
   * jinak druhé kliknutí na tutéž věc nic neudělá.
   */
  pushCircuit?: Circuit | null;
  readOnly?: boolean;
  /**
   * Jen obrázek: bez rámečku a bez ovládání. Pro ukázku na úvodní stránce,
   * kde obvod stojí místo fotky a nikdo s ním nemá nic dělat.
   */
  bare?: boolean;
  height?: number;
  /**
   * Návod ke kroku, který se veze i do režimu přes celou obrazovku.
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
  highlightPins,
  showPins,
  suggested,
  pressed,
  onPress,
  resetTo,
  onReset,
  pushCircuit,
  readOnly,
  bare,
  height = 460,
  toolbar,
}: Props) {
  const [state, dispatch] = useBuilderReducer(initialCircuit);
  const ready = useWokwiElements();
  const [expanded, setExpanded] = useState(false);
  /** „Začít znovu" se nesmí spustit jedním klepnutím: obvod, na který dítě
      přišlo, je pryč, a `window.confirm` na tabletu nevypadá dobře. */
  const [confirmReset, setConfirmReset] = useState(false);
  const lastSent = useRef<Circuit>(initialCircuit);
  const viewportRef = useRef<HTMLDivElement>(null);
  /* Výřez pro efekty, které běží mimo vykreslení (requestAnimationFrame). */
  const viewRef = useRef({ zoom: state.zoom, pan: state.pan });
  useEffect(() => {
    viewRef.current = { zoom: state.zoom, pan: state.pan };
  }, [state.zoom, state.pan]);

  /* Obvod, jaký je právě na ploše — čte se z efektů, které nemají vlastní
     závislost na stavu. */
  const circuitRef = useRef(state.circuit);
  useEffect(() => {
    circuitRef.current = state.circuit;
  }, [state.circuit]);

  /** Doostří výřez tak, aby byl vidět celý obvod. Vrací, jestli to šlo —
      při nulové velikosti výřezu (skrytý rodič) se nedá nic spočítat. */
  const fit = useCallback(
    (circuit: Circuit): boolean => {
      const el = viewportRef.current;
      if (!el) return false;

      const rect = el.getBoundingClientRect();
      const next = fitCircuit(
        circuit,
        { width: rect.width, height: rect.height },
        { minZoom: readOnly ? 0.4 : undefined },
      );
      if (!next) return false;

      dispatch({ type: "SET_ZOOM", zoom: next.zoom });
      dispatch({ type: "SET_PAN", pan: next.pan });
      return true;
    },
    [dispatch, readOnly],
  );

  /* Výřez se jednou nastaví tak, aby byla vidět celá deska. V editovatelném
     builderu JEN jednou, dokud se nepovede: dřív se příznak nastavil dřív,
     než se vědělo, že výřez má velikost — a plocha zůstala odjetá. V náhledu
     se přepočítá pokaždé, protože tam se nedá hýbat ničím. */
  const fitted = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (!readOnly && fitted.current) return;
    if (fit(initialCircuit)) fitted.current = true;
  }, [ready, readOnly, initialCircuit, fit]);

  /* Obvod poslaný zvenku (krok „Zapoj za mě"). Výřez se NEPŘEPOČÍTÁVÁ — dítě
     by po každém kroku vidělo, jak mu plocha uskakuje. Posune se jen tehdy,
     když nová součástka leží mimo výřez. */
  const lastPushed = useRef(pushCircuit);

  useEffect(() => {
    if (!pushCircuit || pushCircuit === lastPushed.current) return;

    lastPushed.current = pushCircuit;
    const before = circuitRef.current;
    dispatch({ type: "RESET", circuit: pushCircuit });
    /* Zpátky ven se to neposílá — lekce ten obvod poslala, takže ho má. */
    lastSent.current = pushCircuit;

    const added = pushCircuit.comps.filter((c) => !before.comps.some((b) => b.id === c.id));
    if (added.length === 0) return;
    const pins: PinRef[] = added.flatMap((c) =>
      getComponentSpec(c.type).pins.map((p) => ({ compId: c.id, pinName: p.name })),
    );

    requestAnimationFrame(() => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pan = ensureVisible(
        pushCircuit,
        pins,
        { width: rect.width, height: rect.height },
        viewRef.current,
      );
      if (pan) dispatch({ type: "SET_PAN", pan });
    });
  }, [pushCircuit, dispatch]);

  /* Zvýrazněné piny musí být vidět. Jinak plocha bliká někam za okraj a
     dítě hledá tečku, která na obrazovce není. Posouvá se jen tehdy, když
     opravdu nejsou vidět. */
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
     kontrolu zapojení. */
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
  for (const id of pressed ?? []) {
    live.set(id, { ...(live.get(id) ?? {}), pressed: true });
  }

  /** Zvětší nebo zmenší kolem středu výřezu — tlačítka nemají kurzor. */
  const zoomFromCentre = (value: number) => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
    const next = zoomAt(
      { zoom: state.zoom, pan: state.pan },
      { x: rect.width / 2, y: rect.height / 2 },
      zoom,
    );
    dispatch({ type: "SET_ZOOM", zoom: next.zoom });
    dispatch({
      type: "SET_PAN",
      pan: clampPan(next.pan, next.zoom, contentBounds(state.circuit), {
        width: rect.width,
        height: rect.height,
      }),
    });
  };

  const selectedComp =
    state.selection?.kind === "component"
      ? state.circuit.comps.find((c) => c.id === state.selection?.id) ?? null
      : null;
  const selectedLabel =
    state.selection?.kind === "component"
      ? "součástku"
      : state.selection?.kind === "wire"
        ? "drátek"
        : null;
  const rotatable = selectedComp !== null && isRotatable(selectedComp.type);
  const rotationBlocked = rotatable && selectedComp !== null && !canRotate(state.circuit, selectedComp.id);

  const body = (
    <div
      className={
        expanded
          ? "flex h-full min-h-0 flex-col bg-paper"
          : bare
            ? "overflow-hidden bg-paper"
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
              highlightPins={highlightPins}
              showPins={showPins}
              onPress={onPress}
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
              klávesa Delete není. */}
          {!bare && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2">
              <div className="pointer-events-auto flex flex-wrap items-end gap-1">
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
                    className="flex min-h-11 items-center gap-2 rounded-md border border-ink bg-paper px-3.5 text-sm font-semibold text-ink shadow-hard-sm hover:bg-danger-50"
                  >
                    <Trash2 className="h-4 w-4 text-danger-600" aria-hidden="true" />
                    Smazat {selectedLabel}
                  </button>
                )}

                {rotatable && !readOnly && selectedComp && (
                  <>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "ROTATE", id: selectedComp.id })}
                      disabled={rotationBlocked}
                      title={rotationBlocked ? "Tady se otočit nedá — nožička by padla do obsazené dírky." : "Otočit o čtvrt kola (R)"}
                      className="flex min-h-11 items-center gap-2 rounded-md border border-ink bg-paper px-3.5 text-sm font-semibold text-ink shadow-hard-sm hover:bg-primary-50 disabled:opacity-40"
                    >
                      <RotateCw className="h-4 w-4 text-primary-700" aria-hidden="true" />
                      Otočit
                    </button>
                    {rotationBlocked && (
                      <span className="max-w-[16rem] rounded-md bg-paper/90 px-2 py-1 text-xs leading-snug text-danger-700">
                        Otočit nejde: nožička by padla do obsazené dírky.
                      </span>
                    )}
                  </>
                )}

                {resetTo && !readOnly && !confirmReset && (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="flex min-h-11 items-center gap-2 rounded-md border border-ink/30 bg-paper px-3.5 text-sm font-medium text-ink-500 hover:border-ink hover:text-ink"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Začít znovu
                  </button>
                )}

                {resetTo && !readOnly && confirmReset && (
                  <div
                    role="group"
                    aria-label="Potvrzení smazání"
                    className="flex flex-wrap items-center gap-1 rounded-md border border-danger-600 bg-paper p-1 shadow-hard-sm"
                  >
                    <span className="px-2 text-sm font-semibold text-ink">Opravdu smazat vše?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmReset(false);
                        dispatch({ type: "RESET", circuit: resetTo });
                        /* Výřez taky, jinak zůstane odjetý někam, kde po
                           resetu nic není. */
                        requestAnimationFrame(() => fit(resetTo));
                        onReset?.();
                      }}
                      className="min-h-11 rounded px-3 text-sm font-semibold text-danger-700 hover:bg-danger-50"
                    >
                      Ano, smazat
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="min-h-11 rounded px-3 text-sm font-medium text-ink-500 hover:bg-ink/5 hover:text-ink"
                    >
                      Ne
                    </button>
                  </div>
                )}
              </div>

              <div className="pointer-events-auto flex items-center gap-0.5 rounded-md border border-ink bg-paper p-0.5 shadow-hard-sm">
                <button
                  type="button"
                  onClick={() => zoomFromCentre(state.zoom - ZOOM_STEP)}
                  className="grid size-11 place-items-center rounded text-ink-500 hover:bg-ink/5 hover:text-ink"
                  aria-label="Oddálit"
                >
                  <Minus className="h-5 w-5" aria-hidden="true" />
                </button>

                {/* Ne „zpět na sto procent", ale „ukaž mi všechno". Kdo se
                    ztratil posouváním plochy, potřebuje tohle. */}
                <button
                  type="button"
                  onClick={() => fit(state.circuit)}
                  className="min-h-11 px-2 font-mono text-sm tabular-nums text-ink-500 hover:text-ink"
                  aria-label="Ukázat celý obvod"
                >
                  {Math.round(state.zoom * 100)} %
                </button>

                <button
                  type="button"
                  onClick={() => zoomFromCentre(state.zoom + ZOOM_STEP)}
                  className="grid size-11 place-items-center rounded text-ink-500 hover:bg-ink/5 hover:text-ink"
                  aria-label="Přiblížit"
                >
                  <Plus className="h-5 w-5" aria-hidden="true" />
                </button>

                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="grid size-11 place-items-center rounded text-ink-500 hover:bg-ink/5 hover:text-ink"
                    aria-label={expanded ? "Zmenšit plochu" : "Roztáhnout na celou obrazovku"}
                  >
                    {expanded ? (
                      <Minimize2 className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Maximize2 className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {!readOnly && !expanded && (
        <p className="border-t border-ink/10 bg-paper-soft px-4 py-2.5 text-sm leading-snug text-ink-500">
          <strong className="font-semibold text-ink">Součástku</strong> přetáhni z nabídky do
          plochy. <strong className="font-semibold text-ink">Drátek</strong> natáhneš klepnutím
          na jednu tečku a pak na druhou — chytne se ta nejbližší. Tahem po prázdné ploše se
          rozhlédneš.
        </p>
      )}
    </div>
  );

  /* Přes celou obrazovku. Skládání je hlavní práce lekce a ve výřezu
     vysokém 460 px se dělá mizerně. */
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
