"use client";

import { useCallback, useEffect, useRef } from "react";
import { getComponentSpec, pinLabel } from "../components";
import { PIN_HIT_AREA, PITCH } from "../constants";
import { drawBoxLocal, normalizeRotation, rotationTransform } from "../pins";
import { snapToGrid, type BuilderAction } from "./state";
import type { CircuitComponent, PinRef } from "../types";

/**
 * Součástka položená na ploše.
 *
 * Kreslí ji custom element z @wokwi/elements — ta samá knihovna, co používá
 * Wokwi. Tlačítko a deska mají vlastní prvky (`register-*.ts`), protože
 * Wokwi tlačítko má nožičky daleko od sebe.
 *
 * ── Tělo a nožičky ─────────────────────────────────────────────────────────
 * Celá součástka je jeden element v neotočeném obdélníku (počátek = (x,y)
 * na ploše). Piny a kresba jsou jeho děti v TÉ SAMÉ souřadné soustavě a
 * otočení se na element pověsí jednou transformací (`rotationTransform`).
 * Díky tomu se nožičky a kresba otáčejí spolu a nemůže se rozjet jedno od
 * druhého.
 *
 * ── Tah a klik ─────────────────────────────────────────────────────────────
 * Tah součástkou začíná až po pěti pixelech pohybu. Tap na nožičku je tak
 * klik a začne drátek — nehýbe součástkou, i když prst trochu ujede.
 */

interface Props {
  comp: CircuitComponent;
  selected: boolean;
  dispatch: React.Dispatch<BuilderAction>;
  wireFrom: PinRef | null;
  onPinAction: (pin: PinRef) => void;
  /** Jas LED, 0–255. */
  brightness?: number;
  /** Zní na bzučáku tón? */
  sounding?: boolean;
  /** Drží se tlačítko? */
  pressed?: boolean;
  /** Piny, na které se dítě má právě teď trefit. Průvodce je pulzuje. */
  highlightPins?: string[];
  /** Pin, který se chytne, kdyby dítě teď kleplo. Ukazuje se dopředu. */
  nearestPin?: string | null;
  /** Ukázat tečky pinů i bez najetí myší. */
  showPins?: boolean;
  /** Držení tlačítka. Dokud drží, obvod je sepnutý — jako doopravdy. */
  onPress?: (compId: string, down: boolean) => void;
  readOnly?: boolean;
  zoom: number;
  /** Kam součástka během tahu opravdu padne — magnet nad deskou. */
  resolveMove?: (compId: string, raw: { x: number; y: number }) => { x: number; y: number };
  /** Součástky, které pojedou s deskou, když se tahne za ni. */
  carriedBy?: (compId: string) => string[];
  /** Vrstva na ploše: desky a Arduino leží pod drátky, součástky nad nimi. */
  zIndex: number;
}

/** Kolik pixelů musí tah urazit, aby se z klepnutí stal tah. */
const DRAG_THRESHOLD = 5;

export function PlacedComponent({
  comp,
  selected,
  dispatch,
  wireFrom,
  onPinAction,
  brightness,
  sounding,
  pressed,
  highlightPins,
  nearestPin,
  showPins,
  onPress,
  readOnly,
  zoom,
  resolveMove,
  carriedBy,
  zIndex,
}: Props) {
  const spec = getComponentSpec(comp.type);
  const elementRef = useRef<HTMLElement>(null);
  const drag = useRef({ active: false, started: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  const rotation = normalizeRotation(comp.rotation);
  const box = { w: spec.spanX * PITCH, h: spec.spanY * PITCH };
  const drawn = drawBoxLocal(comp.type);

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

  /* Tlačítko se drží, ne přepíná. Na skutečné desce taky drží jen tak
     dlouho, jak dlouho na něm máš prst — a lekce 3 na tom stojí. */
  const holdable = comp.type === "pushbutton" && Boolean(onPress);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (holdable) {
        e.stopPropagation();
        onPress?.(comp.id, true);

        const release = () => {
          onPress?.(comp.id, false);
          window.removeEventListener("pointerup", release);
          window.removeEventListener("pointercancel", release);
        };
        window.addEventListener("pointerup", release);
        window.addEventListener("pointercancel", release);
        return;
      }

      if (readOnly || e.button !== 0) return;
      /* Tah se nesmí dostat na plochu — ta by ho brala jako posouvání
         výřezu. Kliknutí ale propustíme, protože ho vyhodnocuje plocha. */
      e.stopPropagation();

      dispatch({ type: "SELECT", target: { kind: "component", id: comp.id } });

      /* Zapíchnuté díly se berou v okamžiku tahu, ne při každém pohybu:
         deska, kterou dítě přesune přes jiné součástky, nesmí jet s těmi
         přejetými. */
      const carry = carriedBy?.(comp.id) ?? [];

      drag.current = {
        active: true,
        started: false,
        startX: e.clientX,
        startY: e.clientY,
        originX: comp.x,
        originY: comp.y,
      };

      const rawAt = (ev: PointerEvent) => ({
        x: drag.current.originX + (ev.clientX - drag.current.startX) / zoom,
        y: drag.current.originY + (ev.clientY - drag.current.startY) / zoom,
      });

      /* Nad deskou přicvakne do dírek už během tahu (`resolveMove`), mimo
         ni jede plynule. */
      const move = (ev: PointerEvent) => {
        if (!drag.current.active) return;
        const moved = Math.hypot(ev.clientX - drag.current.startX, ev.clientY - drag.current.startY);
        if (!drag.current.started && moved < DRAG_THRESHOLD) return;
        drag.current.started = true;

        const at = resolveMove ? resolveMove(comp.id, rawAt(ev)) : rawAt(ev);
        dispatch({ type: "MOVE", id: comp.id, x: at.x, y: at.y, carry });
      };

      const up = (ev: PointerEvent) => {
        if (drag.current.started) {
          const at = resolveMove ? resolveMove(comp.id, rawAt(ev)) : rawAt(ev);
          dispatch({
            type: "MOVE",
            id: comp.id,
            x: snapToGrid(at.x),
            y: snapToGrid(at.y),
            carry,
          });
        }
        drag.current.active = false;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [carriedBy, comp.id, comp.x, comp.y, dispatch, holdable, onPress, readOnly, resolveMove, zoom],
  );

  /* Custom element se v TSX chová jako komponenta. React 19 předá `ref`
     jako běžnou vlastnost, takže se přes něj dá sáhnout na Lit prvek. */
  const Tag = spec.wokwiTag as unknown as React.FC<
    Record<string, unknown> & { ref?: React.Ref<HTMLElement> }
  >;

  /* Tečky pinů jsou vidět, když se zapojuje. Breadboard má devět set pinů
     a tečky přes ně jsou oranžová záplava — ukazují se u něj jen ty, na které
     průvodce zrovna ukazuje. Dírky má nakreslené ve své vlastní grafice. */
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
        width: box.w,
        height: box.h,
        zIndex,
        transformOrigin: "0 0",
        transform: rotation ? rotationTransform(comp.type, rotation) : undefined,
        cursor: holdable ? "pointer" : readOnly ? "default" : "grab",
      }}
      onPointerDown={onPointerDown}
    >
      {/* Rámeček výběru obepíná kresbu, ne pinovou mřížku. Deska má kresbu
          posunutou o 22 px a rámeček kolem pinů by ji minul. Je tenký a
          modrý, ne amber: amber je vyhrazená hlavní akce. */}
      {selected && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-sm"
          style={{
            left: drawn.x - 3,
            top: drawn.y - 3,
            width: drawn.w + 6,
            height: drawn.h + 6,
            border: "1.5px solid color-mix(in srgb, var(--color-primary-500) 70%, transparent)",
          }}
        />
      )}

      {/* Kresba se posouvá zvlášť od pinů: nožičky Wokwi prvků skoro nikdy
          neleží na mřížce, tak stojí na mřížce piny a kresba se přisune
          k nim. Posun je v přirozených jednotkách — škáluje se zvlášť. */}
      <div
        className="absolute"
        style={{
          left: 0,
          top: 0,
          transform: `scale(${spec.scale})`,
          transformOrigin: "0 0",
        }}
      >
        <div
          style={
            spec.visualOffset
              ? { transform: `translate(${spec.visualOffset.x}px, ${spec.visualOffset.y}px)` }
              : undefined
          }
        >
          <Tag ref={elementRef} {...(spec.wokwiAttrs ?? {})} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0">
        {spec.pins.map((pin) => {
          const isStart = wireFrom?.compId === comp.id && wireFrom.pinName === pin.name;
          const isTarget = highlighted.has(pin.name);
          const isNearest = nearestPin === pin.name;

          /* Zvýrazněná tečka je znatelně větší — je to jediné, co dítěti
             říká „klepni sem". */
          const dot = isStart || isTarget || isNearest ? 16 : 8;

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
                left: pin.dx * PITCH - PIN_HIT_AREA / 2,
                top: pin.dy * PITCH - PIN_HIT_AREA / 2,
                width: PIN_HIT_AREA,
                height: PIN_HIT_AREA,
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
                      : isNearest
                        ? "bg-primary-500 ring-2 ring-primary-200"
                        : pinsVisible
                        ? "bg-cta-400 ring-1 ring-cta-200"
                        : crowded
                          ? "bg-cta-400 opacity-0"
                          : "bg-cta-400 opacity-0 ring-1 ring-cta-200 group-hover:opacity-100"
                }`}
                style={{
                  width: dot,
                  height: dot,
                  left: `calc(50% - ${dot / 2}px)`,
                  top: `calc(50% - ${dot / 2}px)`,
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
