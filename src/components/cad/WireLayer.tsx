"use client";
import { useEffect, useState } from "react";
import { WirePath } from "./WirePath";
import { usePinPositions } from "./hooks/usePinPositions";
import { WIRE_COLOR_DRAFT, WIRE_STROKE_WIDTH } from "@/lib/cad/constants";
import type { CADAction, CADState } from "./hooks/useCADReducer";

interface Props {
  planeRef: React.RefObject<HTMLDivElement>;
  state: CADState;
  dispatch: React.Dispatch<CADAction>;
}

export function WireLayer({ planeRef, state, dispatch }: Props) {
  const { getPin, invalidateAll } = usePinPositions(planeRef);
  const [tick, setTick] = useState(0);

  // Force re-render after mount to let shadow DOM populate
  useEffect(() => {
    const id = requestAnimationFrame(() => setTick(t => t + 1));
    return () => cancelAnimationFrame(id);
  }, [state.circuit.comps.length, state.zoom, state.pan]);

  // Invalidate pin position cache when components move
  useEffect(() => {
    invalidateAll();
  }, [state.circuit.comps, state.zoom, state.pan, invalidateAll]);

  const resolveWireEnds = (compId: string, pinName: string) => {
    const comp = state.circuit.comps.find(c => c.id === compId);
    if (!comp) return null;
    const compEl = document.querySelector(`[data-comp-id="${compId}"]`) as HTMLElement | null;
    if (!compEl) return null;
    return getPin(compId, pinName, compEl, comp.type);
  };

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 10 }}
      data-tick={tick}
    >
      {state.circuit.wires.map(w => {
        const f = resolveWireEnds(w.from.compId, w.from.pinName);
        const t = resolveWireEnds(w.to.compId,   w.to.pinName);
        if (!f || !t) return null;
        return (
          <WirePath
            key={w.id}
            fromX={f.x} fromY={f.y} toX={t.x} toY={t.y}
            selected={state.selection?.kind === "wire" && state.selection.id === w.id}
            onClick={() => dispatch({ type: "SELECT", target: { kind: "wire", id: w.id } })}
          />
        );
      })}

      {/* in-progress wire follows cursor */}
      {state.wireInProgress && state.cursorPlane && (() => {
        const f = resolveWireEnds(state.wireInProgress.compId, state.wireInProgress.pinName);
        if (!f) return null;
        return (
          <path
            d={`M ${f.x} ${f.y} L ${state.cursorPlane.x} ${state.cursorPlane.y}`}
            stroke={WIRE_COLOR_DRAFT} strokeWidth={WIRE_STROKE_WIDTH}
            fill="none" strokeDasharray="4 4"
          />
        );
      })()}
    </svg>
  );
}
