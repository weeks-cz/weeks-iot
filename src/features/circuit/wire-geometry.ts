import type { Circuit, Wire } from "./types";
import { resolvePinPosition } from "./pins";

/**
 * Tvar drátku na ploše.
 *
 * Kreslí ho WireLayer a podle stejné křivky se trefuje klik. Kdyby se obojí
 * počítalo zvlášť, klik by míjel viditelný drátek nebo naopak.
 *
 * Drátek je oblouk s mírným průvěsem, jako by ležel na stole: průvěs jde
 * vždycky dolů a je úměrný délce.
 */

export interface WireCurve {
  x1: number;
  y1: number;
  mx: number;
  my: number;
  x2: number;
  y2: number;
}

export function wireCurve(x1: number, y1: number, x2: number, y2: number): WireCurve {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const sag = Math.min(18, length * 0.14);
  return {
    x1,
    y1,
    mx: (x1 + x2) / 2,
    my: (y1 + y2) / 2 + sag,
    x2,
    y2,
  };
}

export function wirePathD(x1: number, y1: number, x2: number, y2: number): string {
  const c = wireCurve(x1, y1, x2, y2);
  return `M ${c.x1} ${c.y1} Q ${c.mx} ${c.my} ${c.x2} ${c.y2}`;
}

/** Vzdálenost bodu od drátku — křivku vzorkuje, na přesnost tu nezáleží. */
export function distanceToWire(
  curve: WireCurve,
  point: { x: number; y: number },
  samples = 24,
): number {
  let best = Infinity;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    const x = u * u * curve.x1 + 2 * u * t * curve.mx + t * t * curve.x2;
    const y = u * u * curve.y1 + 2 * u * t * curve.my + t * t * curve.y2;
    best = Math.min(best, Math.hypot(x - point.x, y - point.y));
  }
  return best;
}

/** Drátek, který leží pod bodem (do tolerance), nebo null. */
export function wireAt(
  circuit: Circuit,
  point: { x: number; y: number },
  tolerance = 8,
): Wire | null {
  let best: { wire: Wire; dist: number } | null = null;

  for (const wire of circuit.wires) {
    const a = endpoint(circuit, wire.from);
    const b = endpoint(circuit, wire.to);
    if (!a || !b) continue;

    const dist = distanceToWire(wireCurve(a.x, a.y, b.x, b.y), point);
    if (dist > tolerance) continue;
    if (!best || dist < best.dist) best = { wire, dist };
  }

  return best?.wire ?? null;
}

function endpoint(circuit: Circuit, ref: Wire["from"]): { x: number; y: number } | null {
  const comp = circuit.comps.find((c) => c.id === ref.compId);
  return comp ? resolvePinPosition(comp, ref.pinName) : null;
}
