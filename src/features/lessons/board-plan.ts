import { getComponentSpec } from "@/features/circuit/components";
import { PITCH } from "@/features/circuit/constants";
import { PLUGGABLE } from "@/features/circuit/nets";
import { resolvePinPosition } from "@/features/circuit/pins";
import type { Circuit, CircuitComponent, ComponentType, PinRef } from "@/features/circuit/types";

/**
 * Plánování na breadboardu pro „zapoj to za mě".
 *
 * Staví se tak, jak se staví na skutečné desce na táboře: součástka se
 * zapíchne do sloupců, drátek z Arduina vede do jiné dírky téhož sloupce,
 * zem jde přes lištu −. Dřív se součástky kladly vedle desky a drátky
 * vedly šikmo přes celou desku přímo na nožičky — obvod fungoval, ale
 * nevypadal jako nic, co dítě kdy drželo v ruce.
 *
 * ── Jediné pravidlo, na kterém všechno stojí ───────────────────────────────
 * Sloupec desky (pět dírek nad příkopem, nebo pět pod ním) je JEDEN vodič.
 * Součástka se proto smí zapíchnout jen do sloupců, ve kterých ještě nic
 * není — jinak by se tiše spojila s cizí sítí. Drátek pak smí končit jen
 * ve sloupci té nožičky, kterou má připojit. Tím se nemůže spojit nic,
 * co spojit nemá; hlídají to testy v `__tests__/apply-step.test.ts`.
 *
 * Funkce jsou čisté: berou obvod, vracejí souřadnice nebo jména dírek.
 */

type Half = "top" | "bottom";

/** Řádky obou polovin a jejich posun v roztečích od horního okraje desky. */
const HALF_ROWS: Record<Half, Array<[string, number]>> = {
  top: [["A", 2], ["B", 3], ["C", 4], ["D", 5], ["E", 6]],
  bottom: [["F", 8], ["G", 9], ["H", 10], ["I", 11], ["J", 12]],
};

/** Lišta −, na kterou vede zem z téhle poloviny. Ta bližší. */
const GROUND_RAIL: Record<Half, { name: string; dy: number }> = {
  top: { name: "top-−", dy: 1 },
  bottom: { name: "bot-−", dy: 14 },
};

const COLUMNS = 30;

export function findBoard(circuit: Circuit): CircuitComponent | null {
  return circuit.comps.find((c) => c.type === "breadboard-half") ?? null;
}

/** Kde leží nožička vůči desce: sloupec (0–29) a polovina, nebo nic. */
export interface Plugged {
  col: number;
  half: Half;
}

function halfOfDy(dy: number): Half | null {
  if (dy >= 2 && dy <= 6) return "top";
  if (dy >= 8 && dy <= 12) return "bottom";
  return null;
}

/** Jméno dírky na dané pozici plochy, nebo null, když tam dírka není. */
function holeAt(board: CircuitComponent, x: number, y: number): string | null {
  const dx = (x - board.x) / PITCH;
  const dy = (y - board.y) / PITCH;
  if (!Number.isInteger(dx) || !Number.isInteger(dy)) return null;
  const pin = getComponentSpec(board.type).pins.find((p) => p.dx === dx && p.dy === dy);
  return pin?.name ?? null;
}

function holePosition(board: CircuitComponent, name: string): { x: number; y: number } {
  return resolvePinPosition(board, name)!;
}

/**
 * Dírky, ve kterých už něco je — nožička zapíchnuté součástky, nebo
 * konec drátku. Do takové dírky se nic dalšího nezapíchne.
 */
export function occupiedHoles(circuit: Circuit, board: CircuitComponent): Set<string> {
  const taken = new Set<string>();

  for (const comp of circuit.comps) {
    if (!PLUGGABLE.has(comp.type)) continue;
    for (const pin of getComponentSpec(comp.type).pins) {
      const pos = resolvePinPosition(comp, pin.name)!;
      const hole = holeAt(board, pos.x, pos.y);
      if (hole) taken.add(hole);
    }
  }

  for (const wire of circuit.wires) {
    for (const end of [wire.from, wire.to]) {
      if (end.compId === board.id) taken.add(end.pinName);
    }
  }

  return taken;
}

/**
 * Sloupce, které jsou „něčí": je v nich nožička nebo drátek, nebo přes ně
 * vede tělo zapíchnuté součástky. Klíč `polovina:sloupec`.
 */
function usedColumns(circuit: Circuit, board: CircuitComponent): Set<string> {
  const used = new Set<string>();

  for (const name of occupiedHoles(circuit, board)) {
    const match = /^row-([A-J])-(\d+)$/.exec(name);
    if (!match) continue;
    const dy = getComponentSpec(board.type).pins.find((p) => p.name === name)!.dy;
    used.add(`${halfOfDy(dy)}:${Number(match[2]) - 1}`);
  }

  /* Tělo součástky mezi nožičkami. Zapíchnout něco pod rezistor by šlo
     elektricky, ale na ploše by se to překrývalo a dítě by nevidělo, co
     kam vede. */
  for (const comp of circuit.comps) {
    if (!PLUGGABLE.has(comp.type)) continue;
    const spots = getComponentSpec(comp.type)
      .pins.map((pin) => plugged(circuit, board, { compId: comp.id, pinName: pin.name }))
      .filter((p): p is Plugged => p !== null);
    if (spots.length === 0) continue;
    const cols = spots.map((s) => s.col);
    for (let c = Math.min(...cols); c <= Math.max(...cols); c++) {
      used.add(`${spots[0]!.half}:${c}`);
    }
  }

  return used;
}

/** Je nožička zapíchnutá v poli desky? Kde? (Lišty se nepočítají.) */
export function plugged(circuit: Circuit, board: CircuitComponent, ref: PinRef): Plugged | null {
  const comp = circuit.comps.find((c) => c.id === ref.compId);
  if (!comp || !PLUGGABLE.has(comp.type)) return null;

  const pos = resolvePinPosition(comp, ref.pinName);
  if (!pos) return null;
  const dx = (pos.x - board.x) / PITCH;
  const dy = (pos.y - board.y) / PITCH;
  if (!Number.isInteger(dx) || !Number.isInteger(dy) || dx < 0 || dx >= COLUMNS) return null;

  const half = halfOfDy(dy);
  return half ? { col: dx, half } : null;
}

/**
 * Kam na desku zapíchnout novou součástku.
 *
 * Hledá místo, kde každá nožička dostane vlastní prázdný sloupec a kolem
 * zůstane sloupec volný, co nejblíž nad pinem, na který součástka povede —
 * drátek pak jde skoro svisle. Přednost má spodní polovina (F–J), protože
 * je blíž Arduinu. Nožičky jdou do horní řady
 * poloviny, aby dírky pod nimi zůstaly volné pro drátky.
 *
 * Vrací levý horní roh součástky, nebo null, když se na desku nevejde
 * (nebo se do desky nezapichuje vůbec — fotorezistor).
 */
export function placeOnBoard(
  circuit: Circuit,
  board: CircuitComponent,
  type: ComponentType,
  targetX?: number,
): { x: number; y: number } | null {
  if (!PLUGGABLE.has(type)) return null;

  const pins = getComponentSpec(type).pins;
  const minDx = Math.min(...pins.map((p) => p.dx));
  const maxDx = Math.max(...pins.map((p) => p.dx));
  const minDy = Math.min(...pins.map((p) => p.dy));
  const maxDy = Math.max(...pins.map((p) => p.dy));
  if (maxDy - minDy > 4) return null;

  const used = usedColumns(circuit, board);
  let choice: { x: number; y: number; cost: number } | null = null;

  /* Horní polovina je dál od Arduina a drátek k ní přejíždí celou spodní.
     Proto přirážka: vyhraje jen tehdy, když by spodní nabídla místo o víc
     než tři sloupce vedle pinu. */
  for (const [half, penalty] of [["bottom", 0], ["top", 3]] as const) {
    const firstRowDy = HALF_ROWS[half][0]![1];
    const originY = board.y + (firstRowDy - minDy) * PITCH;

    let best: { offset: number; cost: number } | null = null;

    for (let offset = -minDx; offset + maxDx < COLUMNS; offset++) {
      let free = true;
      for (let c = offset + minDx - 1; c <= offset + maxDx + 1; c++) {
        if (c >= 0 && c < COLUMNS && used.has(`${half}:${c}`)) {
          free = false;
          break;
        }
      }
      if (!free) continue;

      /* Vzdálenost nejbližší nožičky od sloupce nad cílovým pinem. Bez
         cíle se plní zleva, ať se deska nezaplňuje náhodně. */
      const cost =
        targetX === undefined
          ? offset
          : Math.min(
              ...pins.map((p) => Math.abs(board.x + (offset + p.dx) * PITCH - targetX) / PITCH),
            );

      if (!best || cost < best.cost) best = { offset, cost };
    }

    if (best && (!choice || best.cost + penalty < choice.cost)) {
      choice = { x: board.x + best.offset * PITCH, y: originY, cost: best.cost + penalty };
    }
  }

  return choice ? { x: choice.x, y: choice.y } : null;
}

/**
 * Volná dírka ve sloupci nožičky, co nejblíž bodu, kam drátek povede.
 *
 * Tím drátek nekončí na nožičce (dvě věci v jedné dírce), ale vedle ní —
 * a protože je ve stejném sloupci, spojí přesně tu jednu síť.
 */
export function freeHoleInColumn(
  circuit: Circuit,
  board: CircuitComponent,
  spot: Plugged,
  towards: { x: number; y: number },
  exclude: ReadonlySet<string> = new Set(),
): string | null {
  const taken = occupiedHoles(circuit, board);
  let best: { name: string; dist: number } | null = null;

  for (const [row] of HALF_ROWS[spot.half]) {
    const name = `row-${row}-${spot.col + 1}`;
    if (taken.has(name) || exclude.has(name)) continue;
    const pos = holePosition(board, name);
    const dist = Math.abs(pos.y - towards.y) + Math.abs(pos.x - towards.x);
    if (!best || dist < best.dist) best = { name, dist };
  }

  return best?.name ?? null;
}

/** Lišta −, kam vede zem z poloviny, ve které nožička je. */
export function groundRailFor(spot: Plugged): string {
  return GROUND_RAIL[spot.half].name;
}

/**
 * Volná dírka na liště, co nejblíž danému sloupci / bodu.
 */
export function freeRailHole(
  circuit: Circuit,
  board: CircuitComponent,
  rail: string,
  towards: { x: number; y: number },
  exclude: ReadonlySet<string> = new Set(),
): string | null {
  const taken = occupiedHoles(circuit, board);
  let best: { name: string; dist: number } | null = null;

  for (let c = 0; c < COLUMNS; c++) {
    const name = `${rail}-${c}`;
    if (taken.has(name) || exclude.has(name)) continue;
    const pos = holePosition(board, name);
    const dist = Math.abs(pos.x - towards.x) + Math.abs(pos.y - towards.y);
    if (!best || dist < best.dist) best = { name, dist };
  }

  return best?.name ?? null;
}

export { holePosition };
