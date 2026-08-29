import { getComponentSpec } from "./components";
import { PITCH } from "./constants";
import { resolvePinPosition } from "./pins";
import type { Circuit, ComponentType, PinRef } from "./types";

/**
 * Který pin dítě myslelo.
 *
 * ── Proč to nedělají samy tlačítka pinů ────────────────────────────────────
 * Dělala, a klikalo se to mizerně. LED má anodu a katodu 16 px od sebe, ale
 * dotykový cíl musí mít aspoň dvacet — po přeškálování součástky se cíle
 * překrývaly skoro úplně a chytal se ten, který byl v DOM později, ne ten
 * bližší. Dítě klikalo na delší nožičku a drátek se chytil na kratší.
 *
 * Odpověď na „kam jsem klikl" nezávisí na pořadí v DOM, ale na vzdálenosti.
 * Tak se to počítá.
 */

/**
 * Jak daleko od pinu se ještě chytá. V souřadnicích plochy.
 *
 * Půldruhé rozteče. Víc vypadá vstřícně, ale u LED, která je široká čtyři
 * rozteče, pak kolem pinů není kde kliknout na tělo — a součástka nejde
 * vybrat, takže ani smazat. Menší nejde: prst má osm milimetrů.
 */
const SNAP_RADIUS = 1.5 * PITCH;

export interface PinHit {
  pin: PinRef;
  /** Vzdálenost od místa kliknutí. */
  distance: number;
}

/** O kolik smí být pin součástky dál než dírka, aby ještě vyhrál. */
const COMPONENT_BIAS = PITCH;

/**
 * Nejbližší pin k bodu na ploše.
 *
 * `exclude` vynechá součástky, na které se nesmí chytat — třeba tu, ze které
 * drátek právě vede.
 */
export function pinAt(
  circuit: Circuit,
  point: { x: number; y: number },
  options: { radius?: number } = {},
): PinHit | null {
  const radius = options.radius ?? SNAP_RADIUS;

  let best: PinHit | null = null;
  let bestScore = Infinity;

  for (const comp of circuit.comps) {
    /* Nožička součástky vyhrává nad dírkou pod sebou. Klikat „na rezistor"
       a chytat dírku, na které leží, je matoucí — i když je to elektricky
       totéž, drát pak vede viditelně jinam, než dítě mířilo. */
    const bias = comp.type === "breadboard-half" ? COMPONENT_BIAS : 0;

    for (const pin of getComponentSpec(comp.type).pins) {
      const pos = resolvePinPosition(comp, pin.name);
      if (!pos) continue;

      const distance = Math.hypot(pos.x - point.x, pos.y - point.y);
      if (distance > radius) continue;

      const score = distance + bias;
      if (score >= bestScore) continue;

      bestScore = score;
      best = { pin: { compId: comp.id, pinName: pin.name }, distance };
    }
  }

  return best;
}

/**
 * Součástka pod bodem.
 *
 * Bere se ta nejmenší, která bod obsahuje — jinak by breadboard pod vším
 * ostatním spolykal každé kliknutí.
 */
export function componentAt(circuit: Circuit, point: { x: number; y: number }): string | null {
  let bestId: string | null = null;
  let bestArea = Infinity;

  for (const comp of circuit.comps) {
    const spec = getComponentSpec(comp.type);
    const width = spec.spanX * PITCH;
    const height = spec.spanY * PITCH;

    const inside =
      point.x >= comp.x && point.x <= comp.x + width &&
      point.y >= comp.y && point.y <= comp.y + height;
    if (!inside) continue;

    const area = width * height;
    if (area >= bestArea) continue;

    bestArea = area;
    bestId = comp.id;
  }

  return bestId;
}

/**
 * Zapíchla by se sem součástka do desky?
 *
 * Náhled podle toho pozná, jestli ukazuje „tady to bude zapojené" nebo
 * „tady to bude jen ležet". Bez toho dítě položí LED vedle desky, vypadá
 * to skoro stejně a rozdíl zjistí až z návodu, který se neodškrtne.
 */
export function wouldPlugIn(
  circuit: Circuit,
  type: ComponentType,
  at: { x: number; y: number },
): boolean {
  const boards = circuit.comps.filter((c) => c.type === "breadboard-half");
  if (boards.length === 0) return false;

  const holes = new Set<string>();
  for (const board of boards) {
    for (const pin of getComponentSpec(board.type).pins) {
      holes.add(`${board.x + pin.dx * PITCH},${board.y + pin.dy * PITCH}`);
    }
  }

  /* Stačí jedna nožička v dírce — druhá může přečnívat, na desce se to
     tak běžně dělá. */
  return getComponentSpec(type).pins.some((pin) =>
    holes.has(`${at.x + pin.dx * PITCH},${at.y + pin.dy * PITCH}`),
  );
}
