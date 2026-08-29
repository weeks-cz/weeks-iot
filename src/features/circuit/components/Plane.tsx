"use client";

import { useCallback, useEffect, useRef } from "react";
import { PlacedComponent } from "./PlacedComponent";
import { WireLayer } from "./WireLayer";
import { GRID_DOT_OPACITY, GRID_DOT_SIZE, PITCH, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "../constants";
import { snapToGrid, type BuilderAction, type BuilderState } from "./state";
import { componentAt, pinAt } from "../hit-test";
import type { ComponentType, PinRef } from "../types";

interface Props {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
  /** Co která součástka právě dělá — z běžící simulace. */
  live: Map<string, { brightness?: number; sounding?: boolean; pressed?: boolean }>;
  /** Součástky, kterých se týká nesplněný bod zapojení. */
  flagged: Set<string>;
  /** Piny, na které se dítě má právě trefit — od průvodce zapojením. */
  highlightPins?: PinRef[];
  /** Ukázat tečky pinů i bez najetí myší. */
  showPins?: boolean;
  readOnly?: boolean;
}

/**
 * Pracovní plocha.
 *
 * Plocha je velká 4000 × 4000 a posouvá se pod výřezem. Díky tomu se dá
 * odjet stranou a nic se „neztratí za okrajem" — pro dítě, které si zrovna
 * rozházelo součástky, je to důležitější než přesné hranice.
 */
export function Plane({ state, dispatch, live, flagged, highlightPins, showPins, readOnly }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const pan = useRef({ active: false, startX: 0, startY: 0, panX: 0, panY: 0 });

  /* Kolečko zvětšuje. Musí se navěsit ručně s passive:false — React dává
     wheel listener pasivně a preventDefault by neprošel, takže by se
     kolečkem místo zoomu rolovala celá stránka. */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = state.zoom + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP);
      dispatch({
        type: "SET_ZOOM",
        zoom: Number(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)).toFixed(2)),
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [state.zoom, dispatch]);

  /* Escape ruší rozkreslený drátek, Delete maže vybrané. Klávesnice není
     jediná cesta — na dotyku je od toho tlačítko — ale kdo má klávesnici,
     čeká, že to bude fungovat. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (state.wireFrom) dispatch({ type: "CANCEL_WIRE" });
        else if (state.armed) dispatch({ type: "ARM", kind: null });
        else dispatch({ type: "SELECT", target: null });
        return;
      }

      if (readOnly || (e.key !== "Delete" && e.key !== "Backspace")) return;

      /* Backspace v textovém poli maže písmena, ne součástky. */
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;

      if (state.selection?.kind === "component") {
        dispatch({ type: "DELETE_COMPONENT", id: state.selection.id });
      } else if (state.selection?.kind === "wire") {
        dispatch({ type: "DELETE_WIRE", id: state.selection.id });
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.wireFrom, state.armed, state.selection, dispatch, readOnly]);

  const planePoint = useCallback(
    (clientX: number, clientY: number) => {
      const plane = planeRef.current;
      if (!plane) return null;
      const rect = plane.getBoundingClientRect();
      return { x: (clientX - rect.left) / state.zoom, y: (clientY - rect.top) / state.zoom };
    },
    [state.zoom],
  );

  /* Tah po prázdné ploše posouvá výřez. Pro dítě je to nejpřirozenější
     gesto — a nekoliduje s ničím jiným, protože přetahovat se dají jen
     součástky, a ty tah zachytí samy. */
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.target !== e.currentTarget && e.target !== planeRef.current) return;

      pan.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        panX: state.pan.x,
        panY: state.pan.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [state.pan],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (pan.current.active) {
        dispatch({
          type: "SET_PAN",
          pan: {
            x: pan.current.panX + (e.clientX - pan.current.startX),
            y: pan.current.panY + (e.clientY - pan.current.startY),
          },
        });
        return;
      }

      if (state.wireFrom) {
        const pos = planePoint(e.clientX, e.clientY);
        if (pos) dispatch({ type: "SET_CURSOR", pos });
      }
    },
    [dispatch, planePoint, state.wireFrom],
  );

  const endPan = useCallback((e: React.PointerEvent) => {
    if (!pan.current.active) return;
    pan.current.active = false;
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  }, []);

  const onPinAction = useCallback(
    (pin: PinRef) => {
      if (!state.wireFrom) {
        dispatch({ type: "BEGIN_WIRE", from: pin });
        return;
      }
      dispatch({ type: "FINISH_WIRE", to: pin });
    },
    [dispatch, state.wireFrom],
  );

  /**
   * Kliknutí kamkoli do plochy.
   *
   * Pořadí je záměrné: nejdřív pin (i když se dítě netrefilo přesně), pak
   * součástka, pak prázdno. Kliknutí na pin je to jediné, co se v builderu
   * dělá pořád dokola — musí vyhrát nad vším ostatním.
   */
  const onPlaneClick = useCallback(
    (e: React.MouseEvent) => {
      if (readOnly) return;

      const pos = planePoint(e.clientX, e.clientY);
      if (!pos) return;

      /* Nachystaná součástka z palety se položí tam, kam dítě kleplo. */
      if (state.armed) {
        dispatch({
          type: "PLACE",
          comp: {
            id: crypto.randomUUID(),
            type: state.armed as ComponentType,
            x: snapToGrid(pos.x),
            y: snapToGrid(pos.y),
            rotation: 0,
          },
        });
        return;
      }

      const hit = pinAt(state.circuit, pos);
      if (hit) {
        onPinAction(hit.pin);
        return;
      }

      /* Vedle pinu, ale na součástce: vybrat ji (jde pak smazat). Rozdělaný
         drátek to zruší — kdo mine, chce nejspíš přestat. */
      if (state.wireFrom) {
        dispatch({ type: "CANCEL_WIRE" });
        return;
      }

      const compId = componentAt(state.circuit, pos);
      dispatch({
        type: "SELECT",
        target: compId ? { kind: "component", id: compId } : null,
      });
    },
    [dispatch, onPinAction, planePoint, readOnly, state.armed, state.circuit, state.wireFrom],
  );

  return (
    <div
      ref={viewportRef}
      /* Ruka při tahu řeší CSS, ne stav. Ref se během renderu číst nesmí
         a překreslovat plochu kvůli tvaru kurzoru by bylo plýtvání. */
      className="absolute inset-0 touch-none overflow-hidden bg-paper-soft active:cursor-grabbing"
      style={{ cursor: state.armed ? "copy" : undefined }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onClick={onPlaneClick}
    >
      <div
        ref={planeRef}
        className="absolute"
        style={{
          width: 4000,
          height: 4000,
          left: 2000,
          top: 2000,
          transform: `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`,
          transformOrigin: "0 0",
          backgroundImage: `radial-gradient(circle, rgba(12,14,26,${GRID_DOT_OPACITY}) ${GRID_DOT_SIZE}px, transparent ${GRID_DOT_SIZE}px)`,
          backgroundSize: `${PITCH}px ${PITCH}px`,
        }}
      >
        <WireLayer state={state} dispatch={dispatch} readOnly={readOnly} />

        {state.circuit.comps.map((comp) => (
          <PlacedComponent
            key={comp.id}
            comp={comp}
            selected={state.selection?.kind === "component" && state.selection.id === comp.id}
            dispatch={dispatch}
            wireFrom={state.wireFrom}
            onPinAction={onPinAction}
            brightness={live.get(comp.id)?.brightness}
            sounding={live.get(comp.id)?.sounding}
            flagged={flagged.has(comp.id)}
            highlightPins={(highlightPins ?? [])
              .filter((p) => p.compId === comp.id)
              .map((p) => p.pinName)}
            showPins={showPins}
            readOnly={readOnly}
            zoom={state.zoom}
          />
        ))}
      </div>
    </div>
  );
}
