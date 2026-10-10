"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PlacedComponent } from "./PlacedComponent";
import { WireLayer } from "./WireLayer";
import { getComponentSpec, pinLabel } from "../components";
import { GRID_DOT_OPACITY, GRID_DOT_SIZE, PITCH } from "../constants";
import { pinAt, pluggedPoints, targetAt } from "../hit-test";
import { grabAnchor, landing } from "../placement";
import { pluggedInto } from "../occupancy";
import { normalizeRotation, positionKey, resolvePinPosition, rotationTransform, type Rotation } from "../pins";
import { snapToGrid, type BuilderAction, type BuilderState } from "./state";
import { PLANE_OFFSET, clampPan, contentBounds, wheelZoomFactor, zoomAt } from "./view";
import type { ComponentType, PinRef } from "../types";

interface Props {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
  /** Co která součástka právě dělá — z běžící simulace. */
  live: Map<string, { brightness?: number; sounding?: boolean; pressed?: boolean }>;
  /** Piny, na které se dítě má právě trefit — od průvodce zapojením. */
  highlightPins?: PinRef[];
  /** Ukázat tečky pinů i bez najetí myší. */
  showPins?: boolean;
  /**
   * Zmáčknutí tlačítka v obvodu.
   *
   * Bez tohohle je tlačítko na desce dekorace: dítě napíše program,
   * spustí ho a nic se nestane, protože zmáčknout ho nemá jak.
   */
  onPress?: (compId: string, down: boolean) => void;
  /**
   * Zavření plochy na celé obrazovce.
   *
   * Escape má jeden význam: „zpátky o krok". Nejdřív odloží rozdělaný
   * drátek nebo nachystanou součástku, a teprve když není co odkládat,
   * zavře plochu.
   */
  onEscape?: () => void;
  readOnly?: boolean;
}

/** Nad kolik pixelů je to tah, ne klepnutí. Prst se vždycky trochu smýkne. */
const DRAG_THRESHOLD = 5;

/** Součásti, které leží POD drátky: deska a Arduino. */
const BASE_TYPES: ReadonlySet<ComponentType> = new Set<ComponentType>([
  "breadboard-half",
  "arduino-uno",
]);

/** Vrstvy na ploše, zdola nahoru: deska a Arduino → drátky → součástky → kroužky. */
const Z = { base: 1, wires: 5, part: 6, ring: 12, ghost: 13 } as const;

/**
 * Pracovní plocha.
 *
 * Plocha se posouvá pod výřezem; zvětšuje se kolem kurzoru (kolečko) nebo
 * středu výřezu (tlačítka). Mřížka je nakreslená na výřezu, ne na ploše,
 * takže je vidět všude kolem obvodu — i když je obvod uprostřed.
 *
 * ── Pořadí klepnutí ────────────────────────────────────────────────────────
 * Pin → tělo součástky → drátek → deska → prázdno. Viz `hit-test.ts`.
 *
 * ── Tah není kliknutí ──────────────────────────────────────────────────────
 * Prohlížeč po každém tahu pošle ještě `click`. Proto se u každého gesta
 * měří, o kolik se ukazatel pohnul, a co je tah, to není klik.
 */
export function Plane({
  state,
  dispatch,
  live,
  highlightPins,
  showPins,
  onPress,
  onEscape,
  readOnly,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);

  /** Odkud gesto začalo a jestli už překročilo práh tahu. */
  const gesture = useRef({ x: 0, y: 0, dragged: false, panning: false, panX: 0, panY: 0 });
  /** Kde je ukazatel — pro náhled nachystané součástky a zvýraznění pinu. */
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  /* Obsluha kolečka se váže jednou, takže čte stav přes referenci. Aktualizuje
     se po každém vykreslení; rozdíl je o jeden snímek, na zoom nepoznatelný. */
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    setSize({ width: el.clientWidth, height: el.clientHeight });
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /** Výřez, který nepustí obvod z dohledu. */
  const bounded = useCallback(
    (pan: { x: number; y: number }, zoom: number) =>
      clampPan(pan, zoom, contentBounds(latest.current.circuit), size),
    [size],
  );

  /* Kolečko. Svislý pohyb zvětšuje (podle velikosti kroku, takže trackpad
     jemně, myš po krocích), vodorovný jen posouvá — jinak by trackpad
     přiblížil při každém šikmém tahu. Kurzor zůstává na místě. Musí se
     navěsit ručně s passive:false, jinak by preventDefault neprošel a stránka
     by se rolovala místo plochy. */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = latest.current;
      const rect = el.getBoundingClientRect();
      const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      if (e.deltaY === 0) {
        const pan = bounded({ x: s.pan.x - e.deltaX, y: s.pan.y }, s.zoom);
        dispatch({ type: "SET_PAN", pan });
        return;
      }

      const next = zoomAt(
        { zoom: s.zoom, pan: s.pan },
        screen,
        s.zoom * wheelZoomFactor(e.deltaY, e.deltaMode),
      );
      dispatch({ type: "SET_ZOOM", zoom: next.zoom });
      dispatch({ type: "SET_PAN", pan: bounded(next.pan, next.zoom) });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [bounded, dispatch]);

  /* Escape ruší rozkreslený drátek, Delete maže vybrané, R otáčí. Klávesnice
     není jediná cesta — na dotyku je od toho tlačítko — ale kdo má
     klávesnici, čeká, že to bude fungovat. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (state.wireFrom) dispatch({ type: "CANCEL_WIRE" });
        else if (state.armed) dispatch({ type: "ARM", kind: null });
        else if (state.selection) dispatch({ type: "SELECT", target: null });
        else onEscape?.();
        return;
      }

      if (readOnly) return;

      /* Klávesy v textových polích patří jim, ne ploše: Backspace maže
         písmena, R píše do kódu. */
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;

      if (e.key === "r" || e.key === "R") {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (state.armed) {
          dispatch({ type: "ROTATE_ARMED" });
        } else if (state.selection?.kind === "component") {
          dispatch({ type: "ROTATE", id: state.selection.id });
        }
        return;
      }

      if (e.key !== "Delete" && e.key !== "Backspace") return;

      if (state.selection?.kind === "component") {
        dispatch({ type: "DELETE_COMPONENT", id: state.selection.id });
      } else if (state.selection?.kind === "wire") {
        dispatch({ type: "DELETE_WIRE", id: state.selection.id });
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.wireFrom, state.armed, state.selection, dispatch, onEscape, readOnly]);

  /** Poslední puštění bylo z palety — `click`, který po něm prohlížeč
      pošle, nesmí začít drátek ani nic vybrat. */
  const justDropped = useRef(false);

  const planePoint = useCallback(
    (clientX: number, clientY: number) => {
      const plane = planeRef.current;
      if (!plane) return null;
      const rect = plane.getBoundingClientRect();
      return { x: (clientX - rect.left) / state.zoom, y: (clientY - rect.top) / state.zoom };
    },
    [state.zoom],
  );

  /** Kam padne nachystaná součástka, když je ukazatel v bodě `pos`.
      Drží se za střed, ne za levý horní roh. */
  const armedLanding = useCallback(
    (type: ComponentType, pos: { x: number; y: number }) => {
      const anchor = grabAnchor(type, state.armedRotation);
      return landing(state.circuit, type, { x: pos.x - anchor.x, y: pos.y - anchor.y }, {
        rotation: state.armedRotation,
      });
    },
    [state.armedRotation, state.circuit],
  );

  /** Položí nachystanou součástku. Vrací false, když by se nožičky měly
      zapíchnout do obsazené dírky — pak se nic nepoloží. */
  const placeArmed = useCallback(
    (type: ComponentType, pos: { x: number; y: number }): boolean => {
      const { at, points } = armedLanding(type, pos);
      if (points.some((p) => !p.ok)) return false;
      dispatch({
        type: "PLACE",
        comp: {
          id: crypto.randomUUID(),
          type,
          x: snapToGrid(at.x),
          y: snapToGrid(at.y),
          rotation: state.armedRotation,
        },
      });
      return true;
    },
    [armedLanding, dispatch, state.armedRotation],
  );

  /* Tah z palety končí puštěním. Poslouchá se na okně, protože tah začal
     mimo plochu — v paletě. Pustí-li dítě mimo plochu, rozmyslelo si to. */
  useEffect(() => {
    if (!state.dragging || !state.armed) return;
    const type = state.armed;

    const onUp = (e: PointerEvent) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      const inside =
        rect &&
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom;
      const pos = inside ? planePoint(e.clientX, e.clientY) : null;

      if (pos) {
        justDropped.current = true;
        if (!placeArmed(type, pos)) dispatch({ type: "ARM", kind: null });
      } else {
        dispatch({ type: "ARM", kind: null });
      }
    };

    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [state.dragging, state.armed, planePoint, placeArmed, dispatch]);

  /** Magnet pro součástku, se kterou se hýbe. */
  const resolveMove = useCallback(
    (compId: string, raw: { x: number; y: number }) => {
      const comp = state.circuit.comps.find((c) => c.id === compId);
      if (!comp) return raw;
      return landing(state.circuit, comp.type, raw, {
        excludeId: compId,
        rotation: normalizeRotation(comp.rotation) as Rotation,
      }).at;
    },
    [state.circuit],
  );

  /** Součástky, které pojedou s deskou. Volá se jen při začátku tahu. */
  const carriedBy = useCallback(
    (compId: string) => pluggedInto(state.circuit, compId),
    [state.circuit],
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
        const pan = bounded(
          { x: g.panX + (e.clientX - g.x), y: g.panY + (e.clientY - g.y) },
          state.zoom,
        );
        dispatch({ type: "SET_PAN", pan });
        return;
      }

      const pos = planePoint(e.clientX, e.clientY);
      if (!pos) return;

      /* Se zmáčknutým tlačítkem se táhne součástka (nebo výřez). Bublina
         s popisem pinu by pak visela nad tím, co dítě posouvá. Nachystaná
         součástka z palety naopak náhled potřebuje právě během tahu. */
      if (e.buttons !== 0 && !state.armed) {
        setHover(null);
        return;
      }

      setHover(pos);
      if (state.wireFrom) dispatch({ type: "SET_CURSOR", pos });
    },
    [bounded, dispatch, planePoint, state.armed, state.wireFrom, state.zoom],
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
   * Pořadí řeší `targetAt`: pin, pak tělo součástky, pak drátek, pak deska.
   * Obsazená dírka se nic nedělá (červený kroužek ukáže proč). Drátek pod
   * prstem se mid-draw nevybírá — dítě v tu chvíli míří na dírku.
   */
  const onPlaneClick = useCallback(
    (e: React.MouseEvent) => {
      if (readOnly) return;

      if (justDropped.current) {
        justDropped.current = false;
        return;
      }

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
        placeArmed(state.armed, pos);
        return;
      }

      /* Obsazená dírka: nic se nezačne ani nedokončí. Kroužek nad ní to
         ukazuje, takže se dítě nemusí dohadovat proč. */
      const occupied = pinAt(state.circuit, pos, { includeOccupied: true });
      if (occupied?.occupied) return;

      const target = targetAt(state.circuit, pos);
      if (!target) {
        dispatch({ type: "CANCEL_WIRE" });
        dispatch({ type: "SELECT", target: null });
        return;
      }

      switch (target.kind) {
        case "pin":
          onPinAction(target.hit.pin);
          return;
        case "part":
          if (state.wireFrom) dispatch({ type: "CANCEL_WIRE" });
          else dispatch({ type: "SELECT", target: { kind: "component", id: target.id } });
          return;
        case "wire":
          /* Rozdělaný drátek se klikem na jiný drátek nezruší ani nevybere. */
          if (state.wireFrom) return;
          dispatch({ type: "SELECT", target: { kind: "wire", id: target.id } });
          return;
        case "board":
          if (state.wireFrom) dispatch({ type: "CANCEL_WIRE" });
          else dispatch({ type: "SELECT", target: { kind: "component", id: target.id } });
          return;
      }
    },
    [dispatch, onPinAction, placeArmed, planePoint, readOnly, state.armed, state.circuit, state.wireFrom],
  );

  /* Pin pod ukazatelem. Zvýrazní se, takže je dopředu vidět, co se chytne. */
  const nearest =
    !readOnly && hover && !state.armed ? (pinAt(state.circuit, hover)?.pin ?? null) : null;
  /* Obsazená dírka pod ukazatelem: červený kroužek a slovo „obsazeno". */
  const blocked =
    !readOnly && hover && !state.armed && !nearest
      ? pinAt(state.circuit, hover, { includeOccupied: true })
      : null;
  const blockedPin = blocked?.occupied ? blocked.pin : null;
  const blockedAt = blockedPin ? holePosition(state.circuit, blockedPin) : null;

  /* Odstup popisku od kurzoru v obou osách. */
  const TOOLTIP_GAP = 18;

  /* Popisek nožičky pod kurzorem — nejrychlejší způsob, jak se dítě naučí,
     která nožička je která. Vykresluje se MIMO škálovanou plochu, aby se při
     oddálení nezmenšil do nečitelna. */
  const nearestComp = nearest ? state.circuit.comps.find((c) => c.id === nearest.compId) : null;
  const tooltipText = blockedPin
    ? "obsazeno"
    : nearest && nearestComp
      ? `${getComponentSpec(nearestComp.type).label} · ${pinLabel(nearestComp.type, nearest.pinName)}`
      : null;
  const tooltipAt = tooltipText && hover ? hover : null;
  const tooltip =
    tooltipAt && tooltipText
      ? {
          text: tooltipText,
          x: PLANE_OFFSET + state.pan.x + tooltipAt.x * state.zoom,
          y: PLANE_OFFSET + state.pan.y + tooltipAt.y * state.zoom,
        }
      : null;

  /* Zapíchnuté nožičky: zelené kroužky. */
  const plugged = pluggedPoints(state.circuit);
  /* Dvě nožičky v jedné dírce: nemělo by nastat, ale starý koncept by mohl.
     Svítí červeně, aby to nezůstalo tiše. */
  const pluggedCount = new Map<string, number>();
  for (const pt of plugged) {
    const key = positionKey(pt);
    pluggedCount.set(key, (pluggedCount.get(key) ?? 0) + 1);
  }

  /* Náhled nachystané součástky. Ukáže, co se položí a kam — a jestli se
     zapíchne, nebo jen leží. Při kolizi je červený. */
  const ghost = state.armed ? getComponentSpec(state.armed) : null;
  const ghostLanding = state.armed && hover ? armedLanding(state.armed, hover) : null;
  const ghostAt = ghostLanding?.at ?? null;
  const ghostPlugs = ghostLanding?.snapped ?? false;
  const ghostClash = ghostLanding?.points.some((p) => !p.ok) ?? false;
  const GhostTag = ghost
    ? (ghost.wokwiTag as unknown as React.FC<Record<string, unknown>>)
    : null;

  /* Mřížka na výřezu. Každá tečka je na násobku rozteče na ploše, takže se
     posouvá a zvětšuje spolu s plochou; počátek dlaždice je v souřadnicích
     výřezu, ne plochy. Díky tomu je vidět všude kolem obvodu. */
  const dot = `radial-gradient(circle, rgba(12,14,26,${GRID_DOT_OPACITY}) ${GRID_DOT_SIZE}px, transparent ${GRID_DOT_SIZE}px)`;
  const tile = PITCH * state.zoom;

  return (
    <div
      ref={viewportRef}
      /* Ruka při tahu řeší CSS, ne stav. */
      className="absolute inset-0 touch-none overflow-hidden bg-paper-soft active:cursor-grabbing"
      style={{
        cursor: state.armed ? "copy" : state.wireFrom ? "crosshair" : undefined,
        backgroundImage: dot,
        backgroundSize: `${tile}px ${tile}px`,
        backgroundPosition: `${PLANE_OFFSET + state.pan.x}px ${PLANE_OFFSET + state.pan.y}px`,
      }}
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
          width: 0,
          height: 0,
          left: PLANE_OFFSET,
          top: PLANE_OFFSET,
          transform: `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {/* Vrstvy zdola nahoru: deska a Arduino → drátky → součástky. Drátek
            se nesmí schovat za LED, deska se nesmí schovat za LED a LED se
            nesmí schovat za drátek. */}
        {state.circuit.comps
          .filter((c) => BASE_TYPES.has(c.type))
          .map((comp) => (
            <PlacedComponent
              key={comp.id}
              comp={comp}
              selected={state.selection?.kind === "component" && state.selection.id === comp.id}
              dispatch={dispatch}
              wireFrom={state.wireFrom}
              onPinAction={onPinAction}
              brightness={live.get(comp.id)?.brightness}
              sounding={live.get(comp.id)?.sounding}
              pressed={live.get(comp.id)?.pressed}
              onPress={onPress}
              highlightPins={(highlightPins ?? [])
                .filter((p) => p.compId === comp.id)
                .map((p) => p.pinName)}
              nearestPin={nearest?.compId === comp.id ? nearest.pinName : null}
              resolveMove={resolveMove}
              carriedBy={carriedBy}
              showPins={showPins}
              readOnly={readOnly}
              zoom={state.zoom}
              zIndex={Z.base}
            />
          ))}

        <WireLayer state={state} dispatch={dispatch} readOnly={readOnly} />

        {state.circuit.comps
          .filter((c) => !BASE_TYPES.has(c.type))
          .map((comp) => (
            <PlacedComponent
              key={comp.id}
              comp={comp}
              selected={state.selection?.kind === "component" && state.selection.id === comp.id}
              dispatch={dispatch}
              wireFrom={state.wireFrom}
              onPinAction={onPinAction}
              brightness={live.get(comp.id)?.brightness}
              sounding={live.get(comp.id)?.sounding}
              pressed={live.get(comp.id)?.pressed}
              onPress={onPress}
              highlightPins={(highlightPins ?? [])
                .filter((p) => p.compId === comp.id)
                .map((p) => p.pinName)}
              nearestPin={nearest?.compId === comp.id ? nearest.pinName : null}
              resolveMove={resolveMove}
              carriedBy={carriedBy}
              showPins={showPins}
              readOnly={readOnly}
              zoom={state.zoom}
              zIndex={Z.part}
            />
          ))}

        {/* Zelené kroužky: tahle nožička je opravdu v dírce. */}
        {plugged.map((pt, i) => (
          <PlugRing
            key={`plug-${i}`}
            x={pt.x}
            y={pt.y}
            ok={(pluggedCount.get(positionKey(pt)) ?? 0) < 2}
          />
        ))}

        {/* Obsazená dírka pod kurzorem: červený kroužek. */}
        {blockedAt && <PlugRing key="blocked" x={blockedAt.x} y={blockedAt.y} ok={false} />}

        {/* Dírky, do kterých by nachystaná součástka padla. */}
        {ghostLanding?.points.map((pt, i) => (
          <PlugRing key={`ghost-plug-${i}`} x={pt.x} y={pt.y} ok={pt.ok} />
        ))}

        {GhostTag && ghost && ghostAt && (
          <div
            style={{
              zIndex: Z.ghost,
              position: "absolute",
              left: ghostAt.x,
              top: ghostAt.y,
              width: ghost.spanX * PITCH,
              height: ghost.spanY * PITCH,
              transformOrigin: "0 0",
              transform: state.armedRotation ? rotationTransform(state.armed!, state.armedRotation) : undefined,
            }}
          >
            {/* Zelený obrys = nožičky padnou do dírek a bude to spojené.
                Červený = nožička by padla do obsazené dírky, položení se
                nepovede. Bez obrysu součástka jen leží vedle desky. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute rounded-sm transition-colors"
              style={{
                left: -4,
                top: -4,
                width: ghost.spanX * PITCH + 8,
                height: ghost.spanY * PITCH + 8,
                border: ghostClash
                  ? "2px solid var(--color-danger-500)"
                  : ghostPlugs
                    ? "2px solid var(--color-trust-500)"
                    : "2px dashed color-mix(in srgb, var(--color-ink) 25%, transparent)",
                background: ghostClash
                  ? "color-mix(in srgb, var(--color-danger-500) 10%, transparent)"
                  : ghostPlugs
                    ? "color-mix(in srgb, var(--color-trust-500) 10%, transparent)"
                    : undefined,
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute opacity-60"
              style={{
                left: 0,
                top: 0,
                transform: `scale(${ghost.scale})`,
                transformOrigin: "0 0",
              }}
            >
              <div style={ghost.visualOffset ? { transform: `translate(${ghost.visualOffset.x}px, ${ghost.visualOffset.y}px)` } : undefined}>
                <GhostTag {...(ghost.wokwiAttrs ?? {})} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Popisek šikmo nad kurzorem, ne přímo nad ním. U pravého okraje se
          otočí doleva, jinak by ho výřez uřízl. */}
      {tooltip && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute z-20 -translate-y-full whitespace-nowrap rounded-md border border-ink/20 px-2.5 py-1 font-mono text-xs shadow-hard-sm ${
            blockedPin ? "bg-danger-600 text-paper" : "bg-ink text-paper"
          } ${size.width > 0 && tooltip.x > size.width - 240 ? "-translate-x-full" : ""}`}
          style={{
            left:
              size.width > 0 && tooltip.x > size.width - 240
                ? tooltip.x - TOOLTIP_GAP
                : tooltip.x + TOOLTIP_GAP,
            top: tooltip.y - TOOLTIP_GAP,
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

/** Poloha dírky na ploše, pro kroužek obsazené dírky. */
function holePosition(circuit: BuilderState["circuit"], pin: PinRef): { x: number; y: number } | null {
  const comp = circuit.comps.find((c) => c.id === pin.compId);
  return comp ? resolvePinPosition(comp, pin.pinName) : null;
}

/** Kroužek kolem dírky: zelený = nožička je v ní, červený = dírka je už
    obsazená. */
function PlugRing({ x, y, ok }: { x: number; y: number; ok: boolean }) {
  const color = ok ? "var(--color-trust-500)" : "var(--color-danger-500)";
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute rounded-full"
      style={{
        left: x - 7,
        top: y - 7,
        width: 14,
        height: 14,
        border: `2.5px solid ${color}`,
        background: `color-mix(in srgb, ${color} 22%, transparent)`,
        zIndex: Z.ring,
      }}
    />
  );
}
