import { resolvePinPosition, type PinPos } from "@/lib/cad/pins";
import type { CircuitComponent } from "@/types/cad";

export function usePinPositions() {
  const getPin = (comp: CircuitComponent, pinName: string): PinPos | null =>
    resolvePinPosition(comp, pinName);
  return { getPin };
}
