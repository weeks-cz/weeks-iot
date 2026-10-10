import { getComponentSpec } from "./components";
import { drawBounds, positionKey, resolvePinPosition } from "./pins";
import { coveredByBody, holeMap, occupiedSockets, pluggedPointList } from "./occupancy";
import { wireAt } from "./wire-geometry";
import { PLUGGABLE, pinKey } from "./nets";
import type { Circuit, ComponentType, PinRef } from "./types";

/**
 * Co dítě mělo na mysli.
 *
 * ── Pravidla, v tomhle pořadí ──────────────────────────────────────────────
 *   1. Nožička (součástky i Arduina) nebo volná dírka v dosahu. Vyhrává
 *      NEJBLIŽŠÍ — ne ta, která je zrovna v pořadí. Dírka vedle nožičky
 *      tedy vyhraje, když na ni dítě kliklo přesně.
 *   2. Tělo součástky položené na desce. Klepnutí na tělo vybírá, nezačíná
 *      drátek — součástka na desce přes všechny dírky pod sebou by jinak
 *      nešla vybrat nikdy.
 *   3. Drátek pod prstem.
 *   4. Deska (její prázdná část).
 *
 * Dírka pod tělem součástky se nepočítá jako cíl — kresba ji zakrývá.
 * Dírka pod nožičkou se nepočítá vůbec — tam sedí nožička.
 *
 * ── Obsazené dírky ─────────────────────────────────────────────────────────
 * Dírka nebo pin Arduina s něčím v sobě se do cíle nepočítá (`includeOccupied`
 * je tu jen pro červený „obsazeno" náhled). Drátek do ní nejde.
 */

/** Jak daleko od nožičky se ještě chytá. Dvě rozteče by se u LED a tlačítka
    překrývaly s tělem; jedna je tak akorát pro prst i myš. */
export const LEG_RADIUS = 18;
/** Jak daleko od volné dírky. Půl rozteče pod ní by vedle nožiček nic
    netrefilo; dvanáct pixelů stačí na přesné klepnutí. */
export const HOLE_RADIUS = 12;

export interface PinHit {
  pin: PinRef;
  /** Vzdálenost od místa kliknutí, v plochových pixelech. */
  distance: number;
  /** Je to dírka nebo pin Arduina, který už něco drží? */
  occupied: boolean;
}

/**
 * Nejbližší pin k bodu na ploše.
 *
 * `includeOccupied` vrací i obsazené dírky (s příznakem), aby se dalo říct
 * „tady ne, je to obsazené". Bez něj jsou pryč.
 */
export function pinAt(
  circuit: Circuit,
  point: { x: number; y: number },
  options: { radius?: number; holeRadius?: number; includeOccupied?: boolean } = {},
): PinHit | null {
  const legRadius = options.radius ?? LEG_RADIUS;
  const holeRadius = options.holeRadius ?? HOLE_RADIUS;

  const occupied = occupiedSockets(circuit);
  /* Dírky pod nožičkou nejsou samostatný cíl — je v nich nožička. Vyjdou
     z mapy dírek, co už je obsazená (`occupied`), a navíc z nožiček
     zapíchnutých: ty mají vlastní pin v součástce a ten vyhrává. */
  const underLeg = new Set(pluggedPointList(circuit).map(positionKey));

  let best: PinHit | null = null;

  for (const comp of circuit.comps) {
    const isBoard = comp.type === "breadboard-half";

    for (const pin of getComponentSpec(comp.type).pins) {
      const pos = resolvePinPosition(comp, pin.name);
      if (!pos) continue;

      if (isBoard) {
        if (underLeg.has(positionKey(pos))) continue;
        if (coveredByBody(circuit, pos)) continue;
      }

      const radius = isBoard ? holeRadius : legRadius;
      const distance = Math.hypot(pos.x - point.x, pos.y - point.y);
      if (distance > radius) continue;

      const busy = occupied.has(pinKey(comp.id, pin.name));
      if (busy && !options.includeOccupied) continue;

      if (best && distance >= best.distance) continue;
      best = { pin: { compId: comp.id, pinName: pin.name }, distance, occupied: busy };
    }
  }

  return best;
}

/**
 * Tělo součástky pod bodem — ta nejmenší, která bod obsahuje.
 *
 * Bere se nejmenší, jinak by deska pod vším ostatním spolykala každé
 * klepnutí. Deska se sem zahrnuje, aby šla vybrat (smazat, přesunout).
 */
export function componentAt(circuit: Circuit, point: { x: number; y: number }): string | null {
  return bodyAt(circuit, point, () => true);
}

/** Tělo součástky, které NENÍ deska. Má přednost před drátkem. */
export function partAt(circuit: Circuit, point: { x: number; y: number }): string | null {
  return bodyAt(circuit, point, (type) => type !== "breadboard-half");
}

function bodyAt(
  circuit: Circuit,
  point: { x: number; y: number },
  accept: (type: ComponentType) => boolean,
): string | null {
  let bestId: string | null = null;
  let bestArea = Infinity;

  for (const comp of circuit.comps) {
    if (!accept(comp.type)) continue;
    const b = drawBounds(comp);
    const inside =
      point.x >= b.x && point.x <= b.x + b.w && point.y >= b.y && point.y <= b.y + b.h;
    if (!inside) continue;

    const area = b.w * b.h;
    if (area >= bestArea) continue;

    bestArea = area;
    bestId = comp.id;
  }

  return bestId;
}

export type Target =
  | { kind: "pin"; hit: PinHit }
  | { kind: "part"; id: string }
  | { kind: "wire"; id: string }
  | { kind: "board"; id: string }
  | null;

/** Co je pod klikem — v pořadí pravidel nahoře. */
export function targetAt(circuit: Circuit, point: { x: number; y: number }): Target {
  const hit = pinAt(circuit, point);
  if (hit) return { kind: "pin", hit };

  const part = partAt(circuit, point);
  if (part) return { kind: "part", id: part };

  const wire = wireAt(circuit, point);
  if (wire) return { kind: "wire", id: wire.id };

  const board = componentAt(circuit, point);
  if (board) return { kind: "board", id: board };

  return null;
}

/**
 * Zapíchla by se sem součástka do desky?
 *
 * Náhled podle toho pozná, jestli ukazuje „tady to bude zapojené" nebo
 * „tady to bude jen ležet".
 */
export function wouldPlugIn(
  circuit: Circuit,
  type: ComponentType,
  at: { x: number; y: number },
): boolean {
  if (!PLUGGABLE.has(type)) return false;
  const holes = holeMap(circuit);
  const probe = { id: "_probe", type, x: at.x, y: at.y, rotation: 0 as const };
  return getComponentSpec(type).pins.some((pin) => {
    const pos = resolvePinPosition(probe, pin.name);
    return pos !== null && holes.has(positionKey(pos));
  });
}

/**
 * Body, kde nožička součástky sedí v dírce breadboardu.
 *
 * Plocha na nich kreslí zelené kroužky — stejnou zpětnou vazbu, jakou
 * dává Tinkercad.
 */
export function pluggedPoints(circuit: Circuit): Array<{ x: number; y: number }> {
  return pluggedPointList(circuit);
}

/** Obsazená dírka pod bodem, nebo null. Pro červený kroužek. */
export function occupiedHoleAt(
  circuit: Circuit,
  point: { x: number; y: number },
): PinRef | null {
  const hit = pinAt(circuit, point, { includeOccupied: true });
  return hit?.occupied ? hit.pin : null;
}
