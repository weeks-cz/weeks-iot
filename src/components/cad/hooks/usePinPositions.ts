import { useCallback, useRef } from "react";
import { resolvePinPosition, type PinScreenPos } from "@/lib/cad/pins";
import type { ComponentType } from "@/types/cad";

export function usePinPositions(planeRef: React.RefObject<HTMLElement>) {
  const cache = useRef(new Map<string, PinScreenPos>());

  const getPin = useCallback((
    compId: string,
    pinName: string,
    componentEl: HTMLElement,
    componentType: ComponentType,
  ): PinScreenPos | null => {
    const key = `${compId}:${pinName}`;
    const cached = cache.current.get(key);
    if (cached) return cached;

    const plane = planeRef.current;
    if (!plane) return null;

    const pos = resolvePinPosition(componentEl, componentType, pinName, plane);
    if (pos) cache.current.set(key, pos);
    return pos;
  }, [planeRef]);

  const invalidate = useCallback((compId: string) => {
    for (const k of cache.current.keys()) {
      if (k.startsWith(`${compId}:`)) cache.current.delete(k);
    }
  }, []);

  const invalidateAll = useCallback(() => {
    cache.current.clear();
  }, []);

  return { getPin, invalidate, invalidateAll };
}
