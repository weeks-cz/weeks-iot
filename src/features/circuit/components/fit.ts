import { getComponentSpec } from "../components";
import { PITCH, ZOOM_MIN } from "../constants";
import type { Circuit } from "../types";

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
    ZOOM_MIN,
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
