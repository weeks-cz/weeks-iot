import { getComponentSpec } from "./components";
import type { ComponentType } from "@/types/cad";

export interface PinScreenPos { x: number; y: number; }

export function resolvePinPosition(
  componentEl: HTMLElement,
  componentType: ComponentType,
  pinName: string,
  planeEl: HTMLElement,
): PinScreenPos | null {
  getComponentSpec(componentType); // validate — throws on unknown type

  // wokwi/elements exposes pinInfo: { name, x, y }[] — coords relative to component origin
  const wokwiEl = componentEl as unknown as { pinInfo?: Array<{ name: string; x: number; y: number }> };
  const pinData = wokwiEl.pinInfo?.find(p => p.name === pinName);
  if (!pinData) return null;

  const elRect = componentEl.getBoundingClientRect();
  const planeRect = planeEl.getBoundingClientRect();
  return {
    x: elRect.left - planeRect.left + pinData.x,
    y: elRect.top - planeRect.top + pinData.y,
  };
}
