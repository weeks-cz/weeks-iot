import { getComponentSpec } from "./components";
import { PITCH } from "./constants";
import type { CircuitComponent } from "@/types/cad";

export interface PinPos { x: number; y: number; }

export function resolvePinPosition(comp: CircuitComponent, pinName: string): PinPos | null {
  const spec = getComponentSpec(comp.type);
  const pin = spec.pins.find(p => p.name === pinName);
  if (!pin) return null;
  return {
    x: comp.x + pin.dx * PITCH,
    y: comp.y + pin.dy * PITCH,
  };
}
