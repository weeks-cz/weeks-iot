"use client";
import { WirePath } from "./WirePath";
import { resolvePinPosition } from "@legacy/lib/cad/pins";
import { WIRE_COLOR_DRAFT, WIRE_STROKE_WIDTH } from "@legacy/lib/cad/constants";
import type { CADAction, CADState } from "./hooks/useCADReducer";

interface Props {
  state: CADState;
  dispatch: React.Dispatch<CADAction>;
}

export function WireLayer({ state, dispatch }: Props) {
  const resolvePin = (compId: string, pinName: string) => {
    const comp = state.circuit.comps.find(c => c.id === compId);
    if (!comp) return null;
    return resolvePinPosition(comp, pinName);
  };

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 10, width: "100%", height: "100%", overflow: "visible" }}
    >
      {state.circuit.wires.map(w => {
        const f = resolvePin(w.from.compId, w.from.pinName);
        const t = resolvePin(w.to.compId, w.to.pinName);
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

      {state.wireInProgress && state.cursorPlane && (() => {
        const f = resolvePin(state.wireInProgress.compId, state.wireInProgress.pinName);
        if (!f) return null;
        return (
          <path
            key="wire-draft"
            d={`M ${f.x} ${f.y} L ${state.cursorPlane.x} ${state.cursorPlane.y}`}
            stroke={WIRE_COLOR_DRAFT} strokeWidth={WIRE_STROKE_WIDTH}
            fill="none" strokeDasharray="4 4"
          />
        );
      })()}
    </svg>
  );
}
