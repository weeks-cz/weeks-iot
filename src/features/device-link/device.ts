/**
 * Telefon, nebo počítač s myší.
 *
 * Rozhoduje hlavní ukazatel, ne user agent: `pointer: fine` je myš nebo
 * touchpad, cokoli jiného (prst, žádný ukazatel) se bere jako telefon.
 * Stejné pravidlo používají CSS varianty `pointer-fine:` v rozvržení
 * `/pro-rodice`, takže měření a to, co člověk vidí, se neliší.
 *
 * Volat jen v prohlížeči (efekt, obsluha události). Bez `matchMedia`
 * vrací „mobile“ – stejně jako HTML pro zařízení, které nic nehlásí.
 */
export type DeviceVariant = "mobile" | "desktop";

export const FINE_POINTER = "(pointer: fine)";

export function detectDevice(): DeviceVariant {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "mobile";
  return window.matchMedia(FINE_POINTER).matches ? "desktop" : "mobile";
}
