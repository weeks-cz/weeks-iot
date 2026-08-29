import { getComponentSpec } from "../components";
import { PITCH } from "../constants";
import { resolvePinPosition } from "../pins";
import type { Circuit, PinRef } from "../types";

/**
 * Zvětšení a posun, při kterých je vidět celý obvod.
 *
 * Náhled v kroku s programem je vysoký tři sta pixelů. Bez tohohle by při
 * stoprocentním zvětšení koukalo dítě na kus Arduina a jeho LED by byla za
 * okrajem — zrovna ta LED, kvůli které tam ten náhled je.
 */

/** Plocha je 4000 × 4000 a v CSS sedí na left/top 2000. */
const PLANE_OFFSET = 2000;
/** Volné místo kolem obvodu, aby se nedotýkal okrajů. */
const PADDING = 16;
/**
 * Pod tohle se nezmenšuje, ani kdyby se obvod nevešel.
 *
 * Při 0,6 jsou nožičky LED jedenáct pixelů od sebe a míří se mezi ně
 * prstem mizerně. Radši ať kus obvodu přesahuje — posunout výřez se dá,
 * trefit se do jedenácti pixelů ne.
 */
const MIN_FIT_ZOOM = 0.75;

export interface Viewport {
  width: number;
  height: number;
}

export interface Fit {
  zoom: number;
  pan: { x: number; y: number };
}

export function fitCircuit(circuit: Circuit, viewport: Viewport): Fit | null {
  if (circuit.comps.length === 0) return null;
  if (viewport.width <= 0 || viewport.height <= 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const comp of circuit.comps) {
    const spec = getComponentSpec(comp.type);
    minX = Math.min(minX, comp.x);
    minY = Math.min(minY, comp.y);
    maxX = Math.max(maxX, comp.x + spec.spanX * PITCH);
    maxY = Math.max(maxY, comp.y + spec.spanY * PITCH);
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  /* Nikdy se nezvětšuje nad sto procent. Rozmazané Arduino přes celou
     obrazovku vypadá jako chyba, ne jako přiblížení. */
  const zoom = Math.max(
    MIN_FIT_ZOOM,
    Math.min(1, (viewport.width - 2 * PADDING) / width, (viewport.height - 2 * PADDING) / height),
  );

  return {
    zoom: Number(zoom.toFixed(2)),
    pan: {
      x: (viewport.width - width * zoom) / 2 - PLANE_OFFSET - minX * zoom,
      y: (viewport.height - height * zoom) / 2 - PLANE_OFFSET - minY * zoom,
    },
  };
}

/**
 * Posun výřezu tak, aby byly vidět dané piny.
 *
 * Průvodce zvýrazní piny, na které se má dítě trefit — jenže když jsou za
 * okrajem, je zvýraznění k ničemu a plocha vypadá, že bliká někde jinde.
 * Vrací `null`, když už vidět jsou; s posouváním pod rukama se šetří.
 */
export function ensureVisible(
  circuit: Circuit,
  pins: PinRef[],
  viewport: Viewport,
  view: { zoom: number; pan: { x: number; y: number } },
): { x: number; y: number } | null {
  if (pins.length === 0) return null;

  const points = pins
    .map((pin) => {
      const comp = circuit.comps.find((c) => c.id === pin.compId);
      return comp ? resolvePinPosition(comp, pin.pinName) : null;
    })
    .filter((p): p is { x: number; y: number } => p !== null);

  if (points.length === 0) return null;

  /* Kde piny leží na obrazovce při současném výřezu. */
  const toScreen = (p: { x: number; y: number }) => ({
    x: PLANE_OFFSET + view.pan.x + p.x * view.zoom,
    y: PLANE_OFFSET + view.pan.y + p.y * view.zoom,
  });

  const screen = points.map(toScreen);
  const margin = 3 * PITCH;

  const allVisible = screen.every(
    (p) =>
      p.x >= margin &&
      p.y >= margin &&
      p.x <= viewport.width - margin &&
      p.y <= viewport.height - margin,
  );
  if (allVisible) return null;

  /* Vystředit na těžiště zvýrazněných pinů — u spoje jsou to oba konce
     a mezi nimi dítě kliká. */
  const midX = (Math.min(...points.map((p) => p.x)) + Math.max(...points.map((p) => p.x))) / 2;
  const midY = (Math.min(...points.map((p) => p.y)) + Math.max(...points.map((p) => p.y))) / 2;

  return {
    x: viewport.width / 2 - PLANE_OFFSET - midX * view.zoom,
    y: viewport.height / 2 - PLANE_OFFSET - midY * view.zoom,
  };
}
