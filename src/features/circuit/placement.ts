import { getComponentSpec } from "./components";
import { PLUGGABLE, pinKey } from "./nets";
import { PITCH } from "./constants";
import { holeMap, occupiedSockets } from "./occupancy";
import { positionKey, toPlane, normalizeRotation, type Rotation } from "./pins";
import type { Circuit, ComponentType } from "./types";

/**
 * Kam součástka padne, když ji dítě táhne nebo pokládá z palety.
 *
 * ── Proč magnet jen nad deskou ─────────────────────────────────────────────
 * Dřív se zarovnávalo až po puštění: během tahu jela součástka plynule
 * a nožičky LED visely mezi dírkami. Zapadly teprve po puštění, takže
 * dítě mířilo naslepo. Kdyby naopak přicvakávala všude, poskakovala by
 * po šestnácti pixelech i ve volné ploše, kde na přesnosti nezáleží.
 * Proto obojí: volně, dokud pod nožičkami není deska, a jakmile by se
 * aspoň jedna zapíchla, přicvakne — dítě vidí přesně to, co dostane.
 */

export interface LandingPoint {
  x: number;
  y: number;
  /** false = dírka je už obsazená jinou nožičkou. */
  ok: boolean;
}

export interface Landing {
  /** Levý horní roh, kam se součástka právě vykreslí. */
  at: { x: number; y: number };
  /** Přicvaknutá do dírek? */
  snapped: boolean;
  /** Nožičky, které by padly do dírek. */
  points: LandingPoint[];
}

/**
 * Bod, za který se součástka drží — střed jejího obrysu.
 *
 * Levý horní roh pod prstem působil, jako by dítě drželo součástku za
 * roh: u LED pak nožičky skončily pět roztečí pod kurzorem.
 */
export function grabAnchor(type: ComponentType, rotation: Rotation = 0): { x: number; y: number } {
  const spec = getComponentSpec(type);
  const quarter = rotation === 90 || rotation === 270;
  const w = quarter ? spec.spanY : spec.spanX;
  const h = quarter ? spec.spanX : spec.spanY;
  return {
    x: Math.round(w / 2) * PITCH,
    y: Math.round(h / 2) * PITCH,
  };
}

function snap(value: number): number {
  return Math.round(value / PITCH) * PITCH;
}

export function landing(
  circuit: Circuit,
  type: ComponentType,
  raw: { x: number; y: number },
  options: { excludeId?: string; rotation?: Rotation } = {},
): Landing {
  /* Jen to, co se do desky zapichuje, se magnetem přitahuje. Deska sama ani
     Arduino se nikam nezapichují — ty leží, kam je dítě položilo. */
  if (!PLUGGABLE.has(type)) return { at: raw, snapped: false, points: [] };

  const rotation = normalizeRotation(options.rotation ?? 0);
  const holes = holeMap(circuit);
  if (holes.size === 0) return { at: raw, snapped: false, points: [] };

  /* Dírky, které drží něco jiného. Nožička přesouvané součástky je nesmí
     blokovat — přesouvá se sama. */
  const exclude = new Set(options.excludeId ? [options.excludeId] : []);
  const taken = occupiedSockets(circuit, { exclude });

  const at = { x: snap(raw.x), y: snap(raw.y) };
  const probe = { id: "_landing", type, x: at.x, y: at.y, rotation };

  const points: LandingPoint[] = [];
  for (const pin of getComponentSpec(type).pins) {
    const pos = toPlane(probe, { x: pin.dx * PITCH, y: pin.dy * PITCH });
    const hole = holes.get(positionKey(pos));
    if (!hole) continue;
    points.push({ x: pos.x, y: pos.y, ok: !taken.has(pinKey(hole.compId, hole.pinName)) });
  }

  if (points.length === 0) return { at: raw, snapped: false, points: [] };
  return { at, snapped: true, points };
}
