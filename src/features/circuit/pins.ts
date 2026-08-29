import { getComponentSpec } from "./components";
import { PITCH } from "./constants";
import type { CircuitComponent } from "./types";

export interface PinPos {
  x: number;
  y: number;
}

/** Kde na ploše leží pin součástky. Souřadnice jsou v mřížce, ne na obrazovce. */
export function resolvePinPosition(comp: CircuitComponent, pinName: string): PinPos | null {
  const pin = getComponentSpec(comp.type).pins.find((p) => p.name === pinName);
  if (!pin) return null;

  return {
    x: comp.x + pin.dx * PITCH,
    y: comp.y + pin.dy * PITCH,
  };
}
