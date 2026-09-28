import { getComponentSpec } from "./components";
import { PLUGGABLE } from "./nets";
import { PITCH } from "./constants";
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
export function grabAnchor(type: ComponentType): { x: number; y: number } {
  const spec = getComponentSpec(type);
  return {
    x: Math.round(spec.spanX / 2) * PITCH,
    y: Math.round(spec.spanY / 2) * PITCH,
  };
}

function snap(value: number): number {
  return Math.round(value / PITCH) * PITCH;
}

export function landing(
  circuit: Circuit,
  type: ComponentType,
  raw: { x: number; y: number },
  options: { excludeId?: string } = {},
): Landing {
  const others = circuit.comps.filter((c) => c.id !== options.excludeId);
  const boards = others.filter((c) => c.type === "breadboard-half");
  if (boards.length === 0) return { at: raw, snapped: false, points: [] };

  const holes = new Set<string>();
  for (const board of boards) {
    for (const pin of getComponentSpec(board.type).pins) {
      holes.add(`${board.x + pin.dx * PITCH},${board.y + pin.dy * PITCH}`);
    }
  }

  /* Dírky, ve kterých už nožička je. Dvě nožičky do jedné dírky se na
     skutečné desce nevejdou a dítě má vidět, že tohle je chyba. */
  const occupied = new Set<string>();
  for (const comp of others) {
    if (!PLUGGABLE.has(comp.type)) continue;
    for (const pin of getComponentSpec(comp.type).pins) {
      occupied.add(`${comp.x + pin.dx * PITCH},${comp.y + pin.dy * PITCH}`);
    }
  }

  const at = { x: snap(raw.x), y: snap(raw.y) };
  const points: LandingPoint[] = [];
  for (const pin of getComponentSpec(type).pins) {
    const x = at.x + pin.dx * PITCH;
    const y = at.y + pin.dy * PITCH;
    const key = `${x},${y}`;
    if (holes.has(key)) points.push({ x, y, ok: !occupied.has(key) });
  }

  if (points.length === 0) return { at: raw, snapped: false, points: [] };
  return { at, snapped: true, points };
}
