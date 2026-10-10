import { getComponentSpec } from "./components";
import { PLUGGABLE, pinKey } from "./nets";
import { drawBounds, positionKey, resolvePinPosition } from "./pins";
import type { Circuit, CircuitComponent, PinRef } from "./types";

/**
 * Kdo drží kterou dírku a kterou nožičku Arduina.
 *
 * ── Pravidlo ───────────────────────────────────────────────────────────────
 * Dírka na desce a pin Arduina patří nejvýš jedné věci: jedné nožičce
 * součástky, nebo jednomu konci drátku. Na skutečné desce dvě nožičky do
 * jedné dírky nejdou a na dvou drátcích v jedné nožičce Arduina nic
 * dobrého není — dítě má vidět, že tohle je chyba, ne tiše zkrat.
 *
 * Dřív to počítaly dvě věci zvlášť: hit-test jen nožičky, lekce jen
 * konce drátků. Tady je to jedno místo, a obě strany se na něj odvolávají.
 *
 * Klíč obsazenosti je `pinKey(deska nebo Arduino, jméno dírky/pinu)` —
 * stejný tvar jako všude jinde v obvodu.
 */

const BASE_TYPES: ReadonlySet<string> = new Set(["breadboard-half", "arduino-uno"]);

/** Mapa „souřadnice → dírka" přes všechny desky. */
export function holeMap(circuit: Circuit): Map<string, PinRef> {
  const holes = new Map<string, PinRef>();
  for (const comp of circuit.comps) {
    if (comp.type !== "breadboard-half") continue;
    for (const pin of getComponentSpec(comp.type).pins) {
      const pos = resolvePinPosition(comp, pin.name);
      if (!pos) continue;
      const key = positionKey(pos);
      if (!holes.has(key)) holes.set(key, { compId: comp.id, pinName: pin.name });
    }
  }
  return holes;
}

export interface PluggedLeg {
  leg: PinRef;
  hole: PinRef;
  /** Poloha nožičky (= dírky) na ploše. */
  at: { x: number; y: number };
}

export interface OccupancyOptions {
  /** Součástka, jejíž nožičky se nepočítají (právě se přesouvá). */
  exclude?: ReadonlySet<string>;
}

/** Které nožičky stojí přesně v dírkách desky. */
export function pluggedLegs(circuit: Circuit, options: OccupancyOptions = {}): PluggedLeg[] {
  const holes = holeMap(circuit);
  const out: PluggedLeg[] = [];

  for (const comp of circuit.comps) {
    if (!PLUGGABLE.has(comp.type)) continue;
    if (options.exclude?.has(comp.id)) continue;

    for (const pin of getComponentSpec(comp.type).pins) {
      const pos = resolvePinPosition(comp, pin.name);
      if (!pos) continue;
      const hole = holes.get(positionKey(pos));
      if (hole) out.push({ leg: { compId: comp.id, pinName: pin.name }, hole, at: pos });
    }
  }

  return out;
}

/**
 * Obsazené dírky a piny Arduina, jako klíče `pinKey`.
 *
 * Obsazuje je nožička zapíchnutá do dírky a konec drátku v dírce nebo na
 * pinu Arduina.
 */
export function occupiedSockets(circuit: Circuit, options: OccupancyOptions = {}): Set<string> {
  const taken = new Set<string>();

  for (const pl of pluggedLegs(circuit, options)) {
    taken.add(pinKey(pl.hole.compId, pl.hole.pinName));
  }

  const baseIds = new Set(
    circuit.comps.filter((c) => BASE_TYPES.has(c.type)).map((c) => c.id),
  );
  for (const wire of circuit.wires) {
    for (const end of [wire.from, wire.to]) {
      if (baseIds.has(end.compId)) taken.add(pinKey(end.compId, end.pinName));
    }
  }

  return taken;
}

/** Je tenhle konkrétní pin (dírka nebo pin Arduina) obsazený? */
export function isSocketOccupied(circuit: Circuit, ref: PinRef): boolean {
  return occupiedSockets(circuit).has(pinKey(ref.compId, ref.pinName));
}

/**
 * Nedá se součástka položit na tohle místo? (Její nožička by padla do
 * dírky, která už je něčí.)
 *
 * Součástky z `ignoreIds` se nepočítají — přesouvají se spolu s deskou
 * nebo se právě táhnou. Drátky se počítají vždycky.
 */
export function placementConflicts(
  circuit: Circuit,
  comp: CircuitComponent,
  ignoreIds: ReadonlySet<string> = new Set(),
): boolean {
  if (!PLUGGABLE.has(comp.type)) return false;

  const ignore = new Set([...ignoreIds, comp.id]);
  const holes = holeMap(circuit);
  const taken = occupiedSockets(circuit, { exclude: ignore });

  for (const pin of getComponentSpec(comp.type).pins) {
    const pos = resolvePinPosition(comp, pin.name);
    if (!pos) continue;
    const hole = holes.get(positionKey(pos));
    if (hole && taken.has(pinKey(hole.compId, hole.pinName))) return true;
  }
  return false;
}

/** Součástky, které jsou zapíchnuté do dané desky (aspoň jednou nožičkou). */
export function pluggedInto(circuit: Circuit, boardId: string): string[] {
  const ids = new Set<string>();
  for (const pl of pluggedLegs(circuit)) {
    if (pl.hole.compId === boardId) ids.add(pl.leg.compId);
  }
  return [...ids];
}

/** Nožičky, které leží v dírkách — pro zelené kroužky. */
export function pluggedPointList(circuit: Circuit): Array<{ x: number; y: number }> {
  return pluggedLegs(circuit).map((pl) => pl.at);
}

/** Tělo součástky (ne deska, ne Arduino) pod daným bodem? Kreslí se nad dírkami. */
export function coveredByBody(circuit: Circuit, point: { x: number; y: number }): boolean {
  for (const comp of circuit.comps) {
    if (BASE_TYPES.has(comp.type)) continue;
    const b = drawBounds(comp);
    if (point.x >= b.x && point.x <= b.x + b.w && point.y >= b.y && point.y <= b.y + b.h) {
      return true;
    }
  }
  return false;
}
