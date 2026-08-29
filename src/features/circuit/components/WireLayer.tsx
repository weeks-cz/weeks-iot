"use client";

import { resolvePinPosition } from "../pins";
import { WIRE_COLOR_DEFAULT, WIRE_COLOR_DRAFT, WIRE_COLOR_SELECTED, WIRE_STROKE_WIDTH } from "../constants";
import type { BuilderAction, BuilderState } from "./state";

interface Props {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
  readOnly?: boolean;
}

/**
 * Drátky.
 *
 * Kreslí se rovnou čarou od pinu k pinu. Ne proto, že by to bylo hezčí než
 * ohyby, ale protože elektricky na tvaru nezáleží a rovná čára se dá
 * jednoznačně trefit prstem.
 */
export function WireLayer({ state, dispatch, readOnly }: Props) {
  const at = (compId: string, pinName: string) => {
    const comp = state.circuit.comps.find((c) => c.id === compId);
    return comp ? resolvePinPosition(comp, pinName) : null;
  };

  const draftFrom = state.wireFrom ? at(state.wireFrom.compId, state.wireFrom.pinName) : null;

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 10, width: "100%", height: "100%", overflow: "visible" }}
      aria-hidden="true"
    >
      {state.circuit.wires.map((wire) => {
        const from = at(wire.from.compId, wire.from.pinName);
        const to = at(wire.to.compId, wire.to.pinName);
        if (!from || !to) return null;

        const selected = state.selection?.kind === "wire" && state.selection.id === wire.id;

        return (
          <g key={wire.id}>
            {/* Široká neviditelná čára pod tenkou viditelnou — jinak se do
                dvoupixelového drátku nedá prstem trefit. */}
            <path
              d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
              stroke="transparent"
              strokeWidth={16}
              fill="none"
              style={{ pointerEvents: readOnly ? "none" : "stroke", cursor: "pointer" }}
              onClick={() => dispatch({ type: "SELECT", target: { kind: "wire", id: wire.id } })}
            />
            <path
              d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
              stroke={selected ? WIRE_COLOR_SELECTED : WIRE_COLOR_DEFAULT}
              strokeWidth={selected ? WIRE_STROKE_WIDTH + 1 : WIRE_STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              pointerEvents="none"
            />
          </g>
        );
      })}

      {draftFrom && state.cursor && (
        <path
          d={`M ${draftFrom.x} ${draftFrom.y} L ${state.cursor.x} ${state.cursor.y}`}
          stroke={WIRE_COLOR_DRAFT}
          strokeWidth={WIRE_STROKE_WIDTH}
          strokeDasharray="4 4"
          fill="none"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
