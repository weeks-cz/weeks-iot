"use client";

import { useEffect, useState } from "react";
import { CircuitBuilder } from "@/features/circuit/components/CircuitBuilder";
import { PITCH } from "@/features/circuit/constants";
import type { SimulationFrame } from "@/features/circuit/simulate";
import type { Circuit } from "@/features/circuit/types";

/**
 * Obvod z první lekce, jak ho dítě postaví — a LED v něm bliká.
 *
 * Místo fotky, protože fotka z tábora by slibovala tábor. Tohle je přímo
 * to, co učebna dělá: stejné součástky, stejná plocha, stejný simulátor.
 * Zapojení je čisté jako v učebnici (LED i rezistor v breadboardu, dva
 * krátké drátky), ne tak, jak ho skládá „Zapoj za mě".
 */
const CIRCUIT: Circuit = {
  comps: [
    { id: "bb", type: "breadboard-half", x: 0, y: 0, rotation: 0 },
    /* Nožičky v řadě F, sloupce 15 (katoda) a 16 (anoda). Tělo LED je nad
       nimi a díry G–J zůstanou volné pro rezistor a drátek. */
    { id: "led", type: "led-red", x: 12 * PITCH, y: 3 * PITCH, rotation: 0 },
    /* Řada H, sloupce 16–20: jeden konec ve sloupci anody. */
    { id: "r", type: "resistor-220", x: 15 * PITCH, y: 10 * PITCH, rotation: 0 },
    { id: "uno", type: "arduino-uno", x: 0, y: 17 * PITCH, rotation: 0 },
  ],
  wires: [
    { id: "w1", from: { compId: "uno", pinName: "D8" }, to: { compId: "bb", pinName: "row-J-20" } },
    { id: "w2", from: { compId: "bb", pinName: "row-J-15" }, to: { compId: "uno", pinName: "GND-1" } },
  ],
};

const frame = (on: boolean): SimulationFrame => ({
  leds: [{ compId: "led", brightness: on ? 255 : 0 }],
  buzzers: [],
  serial: [],
  elapsedMs: 0,
});

export function HeroCircuit() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    /* Kdo si vyžádal omezený pohyb, dostane LED, která prostě svítí. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setOn((v) => !v), 700);
    return () => window.clearInterval(id);
  }, []);

  return (
    <CircuitBuilder
      palette={[]}
      initialCircuit={CIRCUIT}
      onChange={() => {}}
      frame={frame(on)}
      readOnly
      bare
      height={380}
    />
  );
}
