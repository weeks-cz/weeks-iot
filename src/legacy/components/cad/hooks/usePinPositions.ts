import { resolvePinPosition, type PinPos } from "@legacy/lib/cad/pins";
import type { CircuitComponent } from "@legacy/types/cad";

export function usePinPositions() {
  const getPin = (comp: CircuitComponent, pinName: string): PinPos | null =>
    resolvePinPosition(comp, pinName);
  return { getPin };
}
