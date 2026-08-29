"use client";

import { useCallback, useEffect, useRef } from "react";
import { getComponentSpec, pinLabel } from "../components";
import { PIN_HIT_AREA, PITCH } from "../constants";
import { snapToGrid, type BuilderAction } from "./state";
import type { CircuitComponent, PinRef } from "../types";

/**
 * Součástka položená na ploše.
 *
 * Kreslí ji custom element z @wokwi/elements — ta samá knihovna, co používá
 * Wokwi. Nekreslíme si vlastní SVG: LED, tlačítko i Arduino tam vypadají
 * přesně jako ve skutečnosti, a to je půlka práce, aby dítě poznalo, na co
 * se dívá.
 *
 * ── Proč pointer, a ne mouse ───────────────────────────────────────────────
 * Stará verze poslouchala mousedown/mousemove. Na tabletu se tím nedá udělat
 * vůbec nic. Pointer events pokrývají myš, dotyk i pero jedním kódem.
 *
 * ── Proč tlačítka pinů nechytají myš ───────────────────────────────────────
 * Chytala, a klikalo se to mizerně: u LED jsou nožičky 16 px od sebe, ale
 * dotykový cíl musí být aspoň dvacetipixelový, takže se cíle překrývaly a
 * vyhrával ten pozdější v DOM, ne ten bližší. Kliknutí teď řeší plocha přes
 * vzdálenost (`hit-test.ts`) a tlačítka tu zůstávají jako vrstva pro
 * klávesnici a čtečku — ta pořadí v DOM nevadí.
 */

interface Props {
  comp: CircuitComponent;
  selected: boolean;
  dispatch: React.Dispatch<BuilderAction>;
  wireFrom: PinRef | null;
  onPinAction: (pin: PinRef) => void;
  /* Živý stav ze simulace, po jedné hodnotě. Objektem by to bylo hezčí,
     jenže ten má při každém renderu novou referenci a efekt níž by se
     spouštěl pořád dokola. */
  /** Jas LED, 0–255. */
  brightness?: number;
  /** Zní na bzučáku tón? */
  sounding?: boolean;
  /** Drží se tlačítko? */
  pressed?: boolean;
  /** Zvýraznit, protože se jí týká nesplněný bod zapojení. */
  flagged?: boolean;
  /** Piny, na které se dítě má právě teď trefit. Průvodce je pulzuje. */
  highlightPins?: string[];
  /** Ukázat tečky pinů i bez najetí myší. */
  showPins?: boolean;
  readOnly?: boolean;
  zoom: number;
}

export function PlacedComponent({
  comp,
  selected,
  dispatch,
  wireFrom,
  onPinAction,
  brightness,
  sounding,
  pressed,
  flagged,
  highlightPins,
  showPins,
  readOnly,
  zoom,
}: Props) {
  const spec = getComponentSpec(comp.type);
  const elementRef = useRef<HTMLElement>(null);
  const drag = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  /* Živý stav se nastavuje jako vlastnost, ne jako atribut. Lit prvky mají
     `brightness` jako number a `pressed` jako boolean — přes atribut by tam
     dorazil řetězec „false", což je pravdivá hodnota. */
  useEffect(() => {
    const el = elementRef.current as (HTMLElement & Record<string, unknown>) | null;
    if (!el) return;

    if (brightness !== undefined) {
      el.value = brightness > 0;
      el.brightness = Math.min(1, brightness / 255);
    }
    if (sounding !== undefined) el.hasSignal = sounding;
    if (pressed !== undefined) el.pressed = pressed;
  }, [brightness, sounding, pressed]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (readOnly || e.button !== 0) return;
      /* Tah se nesmí dostat na plochu — ta by ho brala jako posouvání
         výřezu. Kliknutí ale propustíme, protože ho vyhodnocuje plocha
         (nejbližší pin). */
      e.stopPropagation();

      dispatch({ type: "SELECT", target: { kind: "component", id: comp.id } });
      drag.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        originX: comp.x,
        originY: comp.y,
      };

      const move = (ev: PointerEvent) => {
        if (!drag.current.active) return;
        dispatch({
          type: "MOVE",
          id: comp.id,
          x: drag.current.originX + (ev.clientX - drag.current.startX) / zoom,
          y: drag.current.originY + (ev.clientY - drag.current.startY) / zoom,
        });
      };

      const up = (ev: PointerEvent) => {
        /* Zarovnání na mřížku až při puštění. Během tahu by součástka
           poskakovala po šestnácti pixelech a hůř by se mířilo. */
        dispatch({
          type: "MOVE",
          id: comp.id,
          x: snapToGrid(drag.current.originX + (ev.clientX - drag.current.startX) / zoom),
          y: snapToGrid(drag.current.originY + (ev.clientY - drag.current.startY) / zoom),
        });
        drag.current.active = false;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [comp.id, comp.x, comp.y, dispatch, readOnly, zoom],
  );

  /* Custom element se v TSX chová jako komponenta. React 19 předá `ref`
     jako běžnou vlastnost, takže se přes něj dá sáhnout na Lit prvek. */
  const Tag = spec.wokwiTag as unknown as React.FC<
    Record<string, unknown> & { ref?: React.Ref<HTMLElement> }
  >;

  /* Tečky pinů jsou vidět, když se zapojuje. Dřív naskakovaly až při
     najetí myší, takže dítě nevidělo, kam se dá kliknout — na tabletu,
     kde žádné najetí neexistuje, vůbec.

     Breadboard je výjimka: má devět set pinů a tečky přes ně jsou oranžová
     záplava, ve které nejde nic najít. Dírky má nakreslené ve své vlastní
     grafice, takže je stejně vidět, kam se dá píchnout — ukazují se u něj
     jen ty, na které průvodce zrovna ukazuje. */
  const crowded = comp.type === "breadboard-half";
  const pinsVisible = !crowded && (showPins || Boolean(wireFrom) || selected);
  const highlighted = new Set(highlightPins ?? []);

  return (
    <div
      data-comp-id={comp.id}
      className="group absolute touch-none select-none"
      style={{
        left: comp.x,
        top: comp.y,
        transform: `scale(${spec.scale})`,
        transformOrigin: "0 0",
        cursor: readOnly ? "default" : "grab",
        outline: selected
          ? "2px solid var(--color-cta-500)"
          : flagged
            ? "2px dashed var(--color-cta-400)"
            : undefined,
        outlineOffset: 4,
      }}
      onPointerDown={onPointerDown}
    >
      <Tag ref={elementRef} {...(spec.wokwiAttrs ?? {})} />

      <div className="pointer-events-none absolute inset-0">
        {spec.pins.map((pin) => {
          const isStart = wireFrom?.compId === comp.id && wireFrom.pinName === pin.name;
          const isTarget = highlighted.has(pin.name);

          /* Velikost se přepočítává zpátky přes scale, aby tečka měla na
             obrazovce pořád stejný průměr bez ohledu na to, jak moc je
             součástka roztažená. Zvýrazněná je znatelně větší — je to
             jediné, co dítěti říká „klepni sem". */
          const dot = isStart || isTarget ? 16 : 8;
          const size = dot / spec.scale;

          return (
            <button
              key={pin.name}
              type="button"
              disabled={readOnly}
              /* Myš a prst řeší plocha přes vzdálenost; tady zůstává jen
                 cesta klávesnicí, které pointer-events nevadí. */
              tabIndex={readOnly ? -1 : 0}
              onClick={(e) => {
                e.stopPropagation();
                if (!readOnly) onPinAction({ compId: comp.id, pinName: pin.name });
              }}
              className="absolute rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
              style={{
                left: (pin.dx * PITCH) / spec.scale - PIN_HIT_AREA / spec.scale / 2,
                top: (pin.dy * PITCH) / spec.scale - PIN_HIT_AREA / spec.scale / 2,
                width: PIN_HIT_AREA / spec.scale,
                height: PIN_HIT_AREA / spec.scale,
                pointerEvents: "none",
              }}
              aria-label={
                isStart
                  ? `Zrušit drátek z: ${spec.label} — ${pinLabel(comp.type, pin.name)}`
                  : wireFrom
                    ? `Dotáhnout drátek na: ${spec.label} — ${pinLabel(comp.type, pin.name)}`
                    : `Začít drátek z: ${spec.label} — ${pinLabel(comp.type, pin.name)}`
              }
            >
              <span
                aria-hidden="true"
                className={`absolute rounded-full transition-all ${
                  isStart
                    ? "bg-primary-500 ring-2 ring-white"
                    : isTarget
                      ? "animate-pulse bg-cta-500 ring-2 ring-cta-200"
                      : pinsVisible
                      ? "bg-cta-400 ring-1 ring-cta-200"
                      : crowded
                        ? "bg-cta-400 opacity-0"
                        : "bg-cta-400 opacity-0 ring-1 ring-cta-200 group-hover:opacity-100"
                }`}
                style={{
                  width: size,
                  height: size,
                  left: `calc(50% - ${size / 2}px)`,
                  top: `calc(50% - ${size / 2}px)`,
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
