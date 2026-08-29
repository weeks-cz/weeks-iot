"use client";

import { useCallback, useEffect, useRef } from "react";
import { getComponentSpec } from "../components";
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

  /* Piny jsou vidět při najetí, při vedení drátku a u vybrané součástky.
     Pořád viditelné by z Arduina byl ježek. */
  const pinsVisible = Boolean(wireFrom) || selected;

  return (
    <div
      data-comp-id={comp.id}
      className="group absolute select-none touch-none"
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

          return (
            <button
              key={pin.name}
              type="button"
              disabled={readOnly}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (!readOnly) onPinAction({ compId: comp.id, pinName: pin.name });
              }}
              className="pointer-events-auto absolute flex items-center justify-center rounded-full opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 group-hover:opacity-100"
              style={{
                left: (pin.dx * PITCH) / spec.scale - PIN_HIT_AREA / 2,
                top: (pin.dy * PITCH) / spec.scale - PIN_HIT_AREA / 2,
                width: PIN_HIT_AREA,
                height: PIN_HIT_AREA,
                opacity: pinsVisible ? 1 : undefined,
                cursor: wireFrom ? "crosshair" : "pointer",
              }}
              /* Název součástky patří do popisku vždycky. „Dotáhnout
                 drátek na pin a" je pro čtečku k ničemu — pinů se stejným
                 jménem je na desce několik a slyšet se musí, na které
                 součástce ten pin je. */
              aria-label={
                isStart
                  ? `Zrušit drátek z pinu ${pin.name} na ${spec.label}`
                  : wireFrom
                    ? `Dotáhnout drátek na pin ${pin.name} na ${spec.label}`
                    : `Začít drátek z pinu ${pin.name} na ${spec.label}`
              }
            >
              <span
                className={
                  isStart
                    ? "block h-3 w-3 rounded-full bg-primary-500 ring-2 ring-white"
                    : "block h-2 w-2 rounded-full bg-cta-400 ring-1 ring-cta-200 hover:h-3 hover:w-3 hover:bg-cta-300"
                }
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
