import { getComponentSpec } from "@/features/circuit/components";
import { PITCH } from "@/features/circuit/constants";
import { pinKey, resolveNets } from "@/features/circuit/nets";
import { resolvePinPosition } from "@/features/circuit/pins";
import type { Circuit, PinRef, Wire } from "@/features/circuit/types";
import {
  findBoard,
  freeHoleInColumn,
  freeRailHole,
  groundRailFor,
  holePosition,
  placeOnBoard,
  plugged,
} from "./board-plan";
import type { WiringStep } from "./wiring-steps";

/**
 * Provedení jednoho kroku zapojení za dítě.
 *
 * ── Proč po krocích, a ne celý obvod naráz ─────────────────────────────────
 * Zaseknout se na zapojování znamenalo konec lekce: tlačítko „Napsat
 * program" se objeví teprve, když zapojení sedí, a nápovědy jednou dojdou.
 * Kdo se nedostal přes drátky, nedostal se ke kódu vůbec.
 *
 * Nabízí se hotový obvod jedním kliknutím. Jenže tím by dítě přišlo o celý
 * krok — a hlavně by nevidělo, CO se stalo. Jeden krok znamená jednu
 * součástku nebo jeden drátek: na ploše je vidět, co přibylo, a další
 * krok už dítě většinou udělá samo.
 *
 * ── Proč se nepoužije referenceCircuit ─────────────────────────────────────
 * `referenceCircuit()` staví obvod od nuly a součástky skládá do řady.
 * Dítěti by přeskládal desku pod rukama a breadboard, na který zrovna
 * kouká, by úplně obešel. Tohle staví na tom, co už na ploše je.
 *
 * ── Do desky, jako na táboře ───────────────────────────────────────────────
 * Součástka se zapíchne do volných sloupců breadboardu co nejblíž nad
 * pinem Arduina, na který povede; drátky končí v dírkách vedle nožiček
 * a zem jde přes lištu −. Pravidla a proč jsou bezpečná: `board-plan.ts`.
 * Co už dítě položilo samo, se nepřesouvá — drátek k tomu vede tam, kde to
 * leží.
 */
export function applyStep(circuit: Circuit, step: WiringStep): Circuit {
  if (step.kind === "place") {
    if (!step.place) return circuit;

    const board = findBoard(circuit);
    const onBoard = board
      ? placeOnBoard(circuit, board, step.place, targetX(circuit, step.near, step.nearOffset))
      : null;

    return {
      ...circuit,
      comps: [
        ...circuit.comps,
        {
          id: crypto.randomUUID(),
          type: step.place,
          ...(onBoard ?? freeSpot(circuit)),
          rotation: 0,
        },
      ],
    };
  }

  const pair = closestPair(circuit, step.from, step.to);
  if (!pair) return circuit;

  return {
    ...circuit,
    wires: [...circuit.wires, ...wiresFor(circuit, pair[0], pair[1], step.to)],
  };
}

/** Vodorovná poloha pinu Arduina, nad kterým má součástka ležet. */
function targetX(
  circuit: Circuit,
  pinName: string | undefined,
  offset = 0,
): number | undefined {
  if (!pinName) return undefined;
  const arduino = circuit.comps.find((c) => c.type === "arduino-uno");
  const x = arduino ? resolvePinPosition(arduino, pinName)?.x : undefined;
  return x === undefined ? undefined : x + offset * PITCH;
}

function isGround(circuit: Circuit, ref: PinRef): boolean {
  const comp = circuit.comps.find((c) => c.id === ref.compId);
  return comp?.type === "arduino-uno" && ref.pinName.startsWith("GND");
}

function positionOf(circuit: Circuit, ref: PinRef): { x: number; y: number } {
  const comp = circuit.comps.find((c) => c.id === ref.compId);
  return (comp && resolvePinPosition(comp, ref.pinName)) ?? { x: 0, y: 0 };
}

function wire(from: PinRef, to: PinRef): Wire {
  return { id: crypto.randomUUID(), from, to };
}

/**
 * Drátky pro jeden spoj.
 *
 * Konec, který vede na zapíchnutou nožičku, skončí v jiné dírce téhož
 * sloupce — sloupec je jeden vodič, takže spoj je stejný, jen vypadá jako
 * na skutečné desce a v dírce nejsou dvě věci naráz. Zem vede přes lištu −:
 * sloupec → lišta, a když lišta ještě není u Arduina, i lišta → GND.
 *
 * Konec mimo desku (Arduino, fotorezistor, součástka, kterou dítě nechalo
 * vedle) se připojí napřímo, jako dřív.
 */
function wiresFor(circuit: Circuit, rawFrom: PinRef, rawTo: PinRef, groundOptions: PinRef[]): Wire[] {
  const board = findBoard(circuit);
  if (!board) return [wire(rawFrom, rawTo)];

  /* Zem ať je vždycky „kam". */
  const [from, to] = isGround(circuit, rawFrom) && !isGround(circuit, rawTo)
    ? [rawTo, rawFrom]
    : [rawFrom, rawTo];

  const fromSpot = plugged(circuit, board, from);
  const toSpot = plugged(circuit, board, to);
  const hole = (name: string): PinRef => ({ compId: board.id, pinName: name });

  if (fromSpot && isGround(circuit, to)) {
    const rail = groundRailFor(fromSpot);
    const railName = freeRailHole(
      circuit,
      board,
      rail,
      holePosition(board, `row-A-${fromSpot.col + 1}`),
    );
    const colName = railName
      ? freeHoleInColumn(circuit, board, fromSpot, holePosition(board, railName))
      : null;

    if (railName && colName) {
      const wires = [wire(hole(colName), hole(railName))];

      /* Lišta ještě nevede k Arduinu? Pak jeden drátek navíc, jen
         jednou — další zemnění už na lištu jen přibude. */
      const nets = resolveNets(circuit);
      const railConnected = circuit.comps.some(
        (c) =>
          c.type === "arduino-uno" &&
          nets.connected(pinKey(board.id, railName), pinKey(c.id, "GND-1")),
      );
      if (!railConnected) {
        const gnd = nearest(
          circuit,
          groundOptions.filter((g) => isGround(circuit, g)),
          holePosition(board, railName),
        ) ?? to;
        const railForGnd = freeRailHole(
          circuit,
          board,
          rail,
          positionOf(circuit, gnd),
          new Set([railName]),
        );
        if (railForGnd) wires.push(wire(hole(railForGnd), gnd));
      }
      return wires;
    }
  }

  const fromEnd = fromSpot
    ? freeHoleInColumn(circuit, board, fromSpot, positionOf(circuit, to))
    : null;
  const toEnd = toSpot
    ? freeHoleInColumn(
        circuit,
        board,
        toSpot,
        positionOf(circuit, from),
        new Set(fromEnd ? [fromEnd] : []),
      )
    : null;

  return [wire(fromEnd ? hole(fromEnd) : from, toEnd ? hole(toEnd) : to)];
}

/**
 * Která dvojice konců. Krok jich smí nabízet víc — tři GND, dvě nožičky
 * rezistoru, na kterých nezáleží — a nejkratší drátek je ten, který
 * nepřekříží půl desky.
 */
function closestPair(circuit: Circuit, from: PinRef[], to: PinRef[]): [PinRef, PinRef] | null {
  let best: { pair: [PinRef, PinRef]; dist: number } | null = null;
  for (const f of from) {
    for (const t of to) {
      const a = positionOf(circuit, f);
      const b = positionOf(circuit, t);
      const dist = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (!best || dist < best.dist) best = { pair: [f, t], dist };
    }
  }
  return best?.pair ?? null;
}

/** Z několika zaměnitelných pinů (GND) ten nejbližší. */
function nearest(
  circuit: Circuit,
  options: PinRef[],
  towards: { x: number; y: number },
): PinRef | null {
  let best: { ref: PinRef; dist: number } | null = null;
  for (const ref of options) {
    const pos = positionOf(circuit, ref);
    const dist = Math.abs(pos.x - towards.x) + Math.abs(pos.y - towards.y);
    if (!best || dist < best.dist) best = { ref, dist };
  }
  return best?.ref ?? null;
}

/**
 * Volné místo napravo od všeho, co na ploše je.
 *
 * Záloha pro lekce bez desky, pro součástky, které se do desky nezapichují
 * (fotorezistor), a pro plnou desku.
 */
function freeSpot(circuit: Circuit): { x: number; y: number } {
  const right = circuit.comps.reduce(
    (max, comp) => Math.max(max, comp.x + getComponentSpec(comp.type).spanX * PITCH),
    0,
  );

  return { x: right + 2 * PITCH, y: 2 * PITCH };
}
