"use client";

import { useState } from "react";
import { resolvePinPosition } from "../pins";
import { wirePathD } from "../wire-geometry";
import { WIRE_COLOR_DRAFT } from "../constants";
import type { BuilderAction, BuilderState } from "./state";
import type { Circuit, Wire } from "../types";

interface Props {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
  readOnly?: boolean;
}

/**
 * Barva drátku podle toho, co spojuje.
 *
 * Konvence ze skutečného stolu: červená je plus, černá zem, signály
 * zelené. Dítě se ji tady naučí mimochodem — a na táboře pak samo sáhne
 * po správné barvě drátku.
 *
 * Rozhoduje se jen podle KONCŮ drátku, ne podle celé sítě. Je to
 * předvídatelné: drátek zapíchnutý do − lišty je modročerný vždycky,
 * i když lišta zrovna nikam nevede.
 */
function wireColor(circuit: Circuit, wire: Wire): string {
  const pinNames = [wire.from, wire.to].map((end) => {
    const comp = circuit.comps.find((c) => c.id === end.compId);
    return { type: comp?.type, name: end.pinName };
  });

  for (const pin of pinNames) {
    const isGround =
      (pin.type === "arduino-uno" && pin.name.startsWith("GND")) ||
      (pin.type === "breadboard-half" && pin.name.includes("-−-"));
    if (isGround) return "#1f2430";
  }

  for (const pin of pinNames) {
    const isPower =
      (pin.type === "arduino-uno" && ["5V", "3V3", "VIN"].includes(pin.name)) ||
      (pin.type === "breadboard-half" && pin.name.includes("-+-"));
    if (isPower) return "#d64545";
  }

  return "#3a9e4d";
}

/* Tvar drátku (průvěs na stole) žije v `wire-geometry.ts`, aby ho kreslení
   i klik počítaly stejně. */

/**
 * Drátky.
 *
 * Vrstva drátků leží NAD deskou a Arduinem, ale POD součástkami: LED položená
 * na desku se nesmí schovat za drátek. Proto tu nejsou žádné kliky na
 * drátek — ty řeší plocha, která drží pořadí (pin → součástka → drátek).
 * Tady zůstává jen hover, aby se drátek při najetí zvýraznil.
 */
export function WireLayer({ state, readOnly }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const at = (compId: string, pinName: string) => {
    const comp = state.circuit.comps.find((c) => c.id === compId);
    return comp ? resolvePinPosition(comp, pinName) : null;
  };

  const draftFrom = state.wireFrom ? at(state.wireFrom.compId, state.wireFrom.pinName) : null;

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 5, width: "100%", height: "100%", overflow: "visible" }}
      aria-hidden="true"
    >
      {state.circuit.wires.map((wire) => {
        const from = at(wire.from.compId, wire.from.pinName);
        const to = at(wire.to.compId, wire.to.pinName);
        if (!from || !to) return null;

        const selected = state.selection?.kind === "wire" && state.selection.id === wire.id;
        const isHovered = hovered === wire.id;
        const color = selected ? "var(--color-cta-500)" : wireColor(state.circuit, wire);
        const d = wirePathD(from.x, from.y, to.x, to.y);

        return (
          <g key={wire.id}>
            {/* Široká neviditelná čára pod tenkou viditelnou — jinak se do
                drátku nedá prstem trefit. stopPropagation je nutná: klik
                by probublal na plochu, ta by vybrala součástku pod drátkem
                a výběr drátku okamžitě přepsala. */}
            <path
              d={d}
              stroke="transparent"
              strokeWidth={16}
              fill="none"
              style={{ pointerEvents: readOnly ? "none" : "stroke", cursor: "pointer" }}
              onMouseEnter={() => setHovered(wire.id)}
              onMouseLeave={() => setHovered((prev) => (prev === wire.id ? null : prev))}
            />

            <path
              d={d}
              stroke={color}
              strokeWidth={selected || isHovered ? 4 : 3}
              fill="none"
              strokeLinecap="round"
              pointerEvents="none"
              opacity={isHovered && !selected ? 0.85 : 1}
            />

            {/* Kulaté koncovky v dírkách — jako zapíchnutý drátek
                v Tinkercadu. Bez nich čára jen tak končí ve vzduchu. */}
            {[from, to].map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={selected ? 5 : 4}
                fill={color}
                stroke="#fff"
                strokeWidth={1.2}
                pointerEvents="none"
              />
            ))}
          </g>
        );
      })}

      {draftFrom && state.cursor && (
        <g>
          <path
            d={wirePathD(draftFrom.x, draftFrom.y, state.cursor.x, state.cursor.y)}
            stroke={WIRE_COLOR_DRAFT}
            strokeWidth={3}
            strokeDasharray="6 5"
            fill="none"
            strokeLinecap="round"
            pointerEvents="none"
          />
          <circle
            cx={draftFrom.x}
            cy={draftFrom.y}
            r={5}
            fill={WIRE_COLOR_DRAFT}
            stroke="#fff"
            strokeWidth={1.2}
            pointerEvents="none"
          />
        </g>
      )}
    </svg>
  );
}
