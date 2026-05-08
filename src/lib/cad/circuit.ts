import type { Circuit, CircuitComponent } from "@/types/cad";
import { PITCH } from "./constants";

function uid(): string {
  return crypto.randomUUID();
}

export function createDefaultCircuit(): Circuit {
  return {
    comps: [
      { id: uid(), type: "arduino-uno",     x: 0,          y: 0, rotation: 0 },
      { id: uid(), type: "breadboard-half", x: 18 * PITCH, y: 0, rotation: 0 },
    ],
    wires: [],
  };
}

// Accept a loose type here — Task.cad gets added in Task 9
export function applyTaskSeed(task: { cad?: { palette: string[]; seed?: CircuitComponent[] } }): Circuit {
  const seed = task.cad?.seed;
  if (!seed) return createDefaultCircuit();
  return { comps: seed.map(c => ({ ...c })), wires: [] };
}

export function isCircuitEmpty(c: Circuit): boolean {
  if (c.wires.length > 0) return false;
  if (c.comps.length === 2 && c.comps.every(co => co.type === "arduino-uno" || co.type === "breadboard-half")) {
    return true;
  }
  return false;
}

export function snapToGrid(value: number): number {
  return Math.round(value / PITCH) * PITCH;
}

export function snapPoint(x: number, y: number): { x: number; y: number } {
  return { x: snapToGrid(x), y: snapToGrid(y) };
}
