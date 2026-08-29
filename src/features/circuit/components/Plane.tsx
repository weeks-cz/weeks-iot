"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PlacedComponent } from "./PlacedComponent";
import { WireLayer } from "./WireLayer";
import { getComponentSpec } from "../components";
import { GRID_DOT_OPACITY, GRID_DOT_SIZE, PITCH, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "../constants";
import { componentAt, pinAt, wouldPlugIn } from "../hit-test";
import { snapToGrid, type BuilderAction, type BuilderState } from "./state";
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
  /**
   * Zavření plochy na celé obrazovce.
   *
   * Escape má jeden význam: „zpátky o krok". Nejdřív odloží rozdělaný
   * drátek nebo nachystanou součástku, a teprve když není co odkládat,
   * zavře plochu. Když si to hlídaly dvě komponenty zvlášť, udělal jeden
   * stisk obojí naráz.
   */
  onEscape?: () => void;
  readOnly?: boolean;
}

/**
 * Pracovní plocha.
 *
 * Plocha je velká 4000 × 4000 a posouvá se pod výřezem. Díky tomu se dá
 * odjet stranou a nic se „neztratí za okrajem" — pro dítě, které si zrovna
 * rozházelo součástky, je to důležitější než přesné hranice.
 *
 * ── Tah není kliknutí ──────────────────────────────────────────────────────
 * Prohlížeč po každém tahu pošle ještě `click`. Když dítě posunulo LED po
 * breadboardu, ten click dobublal sem, plocha ho vzala jako klepnutí na
 * nejbližší pin a začala kreslit drátek — takže se posouváním součástek
 * samovolně vyráběly dráty. Proto se u každého gesta měří, o kolik se
 * ukazatel pohnul, a co je tah, to není klik.
 */
export function Plane({
  state,
  dispatch,
  live,
  flagged,
  highlightPins,
  showPins,
  onEscape,
  readOnly,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);

  /** Odkud gesto začalo a jestli už překročilo práh tahu. */
  const gesture = useRef({ x: 0, y: 0, dragged: false, panning: false, panX: 0, panY: 0 });
  /** Kde je ukazatel — pro náhled nachystané součástky a zvýraznění pinu. */
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  /** Nad kolik pixelů je to tah, ne klepnutí. Prst se vždycky trochu smýkne. */
  const DRAG_THRESHOLD = 5;

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
        else if (state.selection) dispatch({ type: "SELECT", target: null });
        else onEscape?.();
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
  }, [state.wireFrom, state.armed, state.selection, dispatch, onEscape, readOnly]);

  const planePoint = useCallback(
    (clientX: number, clientY: number) => {
      const plane = planeRef.current;
      if (!plane) return null;
      const rect = plane.getBoundingClientRect();
      return { x: (clientX - rect.left) / state.zoom, y: (clientY - rect.top) / state.zoom };
    },
    [state.zoom],
  );

  /* Zachytává se v capture fázi, takže sem dorazí i gesta začatá na
     součástce — ta si `pointerdown` zastavuje, aby jí plocha nepodjela
     výřez, ale změřit ho potřebujeme tak jako tak. */
  const onPointerDownCapture = useCallback(
    (e: React.PointerEvent) => {
      const onEmpty = e.target === e.currentTarget || e.target === planeRef.current;

      gesture.current = {
        x: e.clientX,
        y: e.clientY,
        dragged: false,
        /* Po prázdné ploše se posouvá výřez; nad součástkou ne — tam tah
           patří té součástce. */
        panning: onEmpty && !state.armed,
        panX: state.pan.x,
        panY: state.pan.y,
      };

      if (gesture.current.panning) {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    },
    [state.armed, state.pan],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const g = gesture.current;
      const moved = Math.hypot(e.clientX - g.x, e.clientY - g.y);
      if (moved > DRAG_THRESHOLD) g.dragged = true;

      if (g.panning && g.dragged) {
        dispatch({
          type: "SET_PAN",
          pan: { x: g.panX + (e.clientX - g.x), y: g.panY + (e.clientY - g.y) },
        });
        return;
      }

      const pos = planePoint(e.clientX, e.clientY);
      if (!pos) return;

      setHover(pos);
      if (state.wireFrom) dispatch({ type: "SET_CURSOR", pos });
    },
    [dispatch, planePoint, state.wireFrom],
  );

  const endGesture = useCallback((e: React.PointerEvent) => {
    if (!gesture.current.panning) return;
    gesture.current.panning = false;
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

      /* Konec tahu prohlížeč hlásí i jako kliknutí. Bez tohohle by
         posouvání součástek po desce samo od sebe vyrábělo drátky. */
      if (gesture.current.dragged) {
        gesture.current.dragged = false;
        return;
      }

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

  /* Pin pod ukazatelem. Zvýrazní se, takže je dopředu vidět, co se chytne —
     bez toho je míření hádání, protože se chytá i pin, na který dítě
     přesně neklepne. */
  const nearest =
    !readOnly && hover && !state.armed ? (pinAt(state.circuit, hover)?.pin ?? null) : null;

  /* Náhled nachystané součástky. Tinkercad ukazuje, co se položí a kam,
     ještě než se klepne — bez toho dítě kliká naslepo. */
  const ghost = state.armed ? getComponentSpec(state.armed) : null;
  const ghostAt = hover ? { x: snapToGrid(hover.x), y: snapToGrid(hover.y) } : null;
  /* A rovnou i to, jestli se tam součástka zapíchne, nebo jen položí. */
  const ghostPlugs =
    state.armed && ghostAt ? wouldPlugIn(state.circuit, state.armed, ghostAt) : false;
  const GhostTag = ghost
    ? (ghost.wokwiTag as unknown as React.FC<Record<string, unknown>>)
    : null;

  return (
    <div
      ref={viewportRef}
      /* Ruka při tahu řeší CSS, ne stav. Ref se během renderu číst nesmí
         a překreslovat plochu kvůli tvaru kurzoru by bylo plýtvání. */
      className="absolute inset-0 touch-none overflow-hidden bg-paper-soft active:cursor-grabbing"
      style={{ cursor: state.armed ? "copy" : state.wireFrom ? "crosshair" : undefined }}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onPointerLeave={() => setHover(null)}
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
            nearestPin={nearest?.compId === comp.id ? nearest.pinName : null}
            showPins={showPins}
            readOnly={readOnly}
            zoom={state.zoom}
          />
        ))}

        {GhostTag && ghost && ghostAt && (
          <>
            {/* Zelený obrys = nožičky padnou do dírek a bude to spojené.
                Bez obrysu součástka jen leží vedle desky. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute rounded-sm transition-colors"
              style={{
                left: ghostAt.x - 4,
                top: ghostAt.y - 4,
                width: ghost.spanX * PITCH + 8,
                height: ghost.spanY * PITCH + 8,
                border: ghostPlugs
                  ? "2px solid var(--color-trust-500)"
                  : "2px dashed color-mix(in srgb, var(--color-ink) 25%, transparent)",
                background: ghostPlugs
                  ? "color-mix(in srgb, var(--color-trust-500) 10%, transparent)"
                  : undefined,
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute opacity-60"
              style={{
                left: ghostAt.x,
                top: ghostAt.y,
                transform: `scale(${ghost.scale})`,
                transformOrigin: "0 0",
              }}
            >
              <GhostTag {...(ghost.wokwiAttrs ?? {})} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
