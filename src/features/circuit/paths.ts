import { getComponentSpec } from "./components";
import { pinKey, resolveNets, type NetMap, type PinKey } from "./nets";
import type { Circuit, CircuitComponent, ComponentType } from "./types";

/**
 * Cesty přes součástky.
 *
 * `nets.ts` odpovídá na otázku „jsou tyhle dva body spojené drátem?".
 * Jenže skoro nic v obvodu není spojené jen drátem — LED visí na pinu
 * PŘES rezistor a to je právě to, co má dítě pochopit.
 *
 * Proto druhá vrstva: sítě jsou uzly grafu, součástky jsou hrany mezi nimi.
 * Otázka se pak dá položit přesně: „vede z D8 do anody LED cesta, na které
 * je právě jeden rezistor?"
 *
 * Bez rozlišení „přes co" by kontrola přijala LED zapojenou napřímo, což
 * je nejčastější začátečnická chyba a taky ta, po které LED skutečně
 * odejde.
 */

export interface ComponentEdge {
  compId: string;
  type: ComponentType;
  fromPin: string;
  toPin: string;
  fromNet: string;
  toNet: string;
}

/**
 * Které součástky vedou proud mezi svými piny.
 *
 * Breadboard a Arduino tu nejsou schválně: breadboard má vlastní vnitřní
 * propojení už v sítích a Arduino není průchozí součástka — jeho piny
 * jsou zdroje a spotřebiče, ne vodič.
 */
const CONDUCTIVE: ReadonlySet<ComponentType> = new Set<ComponentType>([
  "resistor-220",
  "led-red",
  "led-yellow",
  "led-green",
  "led-blue",
  "led-rgb",
  "pushbutton",
  "piezo-buzzer",
  "potentiometer",
  "photoresistor",
]);

function edgesOf(comp: CircuitComponent, nets: NetMap): ComponentEdge[] {
  if (!CONDUCTIVE.has(comp.type)) return [];

  const pins = getComponentSpec(comp.type).pins;
  const out: ComponentEdge[] = [];

  /* Každá dvojice pinů je potenciální cesta. U dvoupinových součástek je
     to jedna hrana, u RGB LED nebo potenciometru jich je víc — a to je
     správně, protože proud jimi opravdu může téct různě. */
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      const a = pinKey(comp.id, pins[i]!.name);
      const b = pinKey(comp.id, pins[j]!.name);
      out.push({
        compId: comp.id,
        type: comp.type,
        fromPin: pins[i]!.name,
        toPin: pins[j]!.name,
        fromNet: nets.netOf(a),
        toNet: nets.netOf(b),
      });
    }
  }

  return out;
}

export interface PathResult {
  found: boolean;
  /** Typy součástek na nalezené cestě, v pořadí. */
  through: ComponentType[];
  /** Id součástek na cestě — pro zvýraznění v builderu. */
  componentIds: string[];
}

export interface PathQuery {
  /**
   * Součástky, přes které cesta smí vést. Prázdné = jen drát.
   *
   * POZOR: je to seznam POVOLENÝCH typů, ne vyžadovaných. „Vede tam cesta
   * a je na ní rezistor?" se ptá tak, že se k tomu doptáš na výsledek:
   * `result.found && result.through.includes("resistor-220")`. Samotné
   * `through` jen zužuje, kudy se smí jít.
   */
  through?: ComponentType[];
  /** Nejvíc součástek na cestě. Brání „projde to oklikou přes půl obvodu". */
  maxHops?: number;
  /**
   * Hotový rozklad do sítí, když ho volající už má.
   *
   * Bez něj si ho `findPath` spočítá sám — jenže u obvodu s breadboardem
   * je to devět set pinů a kontrola zapojení volá `findPath` pro každý
   * spoj v každé permutaci rolí. Předání ušetří řádově víc práce, než
   * kolik zabere samo hledání.
   */
  nets?: NetMap;
}

/**
 * Hledá cestu ze `from` do `to`.
 *
 * Prohledává se do šířky, takže se najde nejkratší cesta — a ta odpovídá
 * tomu, jak by obvod nakreslil člověk. Delší oklikou by šlo najít cestu
 * skoro odkudkoli kamkoli, což by kontrolu udělalo bezcennou.
 */
export function findPath(
  circuit: Circuit,
  from: PinKey,
  to: PinKey,
  query: PathQuery = {},
): PathResult {
  const nets = query.nets ?? resolveNets(circuit);
  const maxHops = query.maxHops ?? 3;

  const startNet = nets.netOf(from);
  const goalNet = nets.netOf(to);

  if (startNet === goalNet) {
    return { found: true, through: [], componentIds: [] };
  }

  const allowed = query.through ? new Set(query.through) : null;

  const edges: ComponentEdge[] = [];
  for (const comp of circuit.comps) edges.push(...edgesOf(comp, nets));

  interface Step {
    net: string;
    through: ComponentType[];
    ids: string[];
    used: Set<string>;
  }

  const queue: Step[] = [{ net: startNet, through: [], ids: [], used: new Set() }];
  const seen = new Set<string>([startNet]);

  while (queue.length > 0) {
    const step = queue.shift()!;
    if (step.through.length >= maxHops) continue;

    for (const edge of edges) {
      /* Jednu součástku po cestě dvakrát nepoužijeme — proud se nevrací
         zpátky skrz tutéž LED. */
      if (step.used.has(edge.compId)) continue;
      if (allowed && !allowed.has(edge.type)) continue;

      let next: string | null = null;
      if (edge.fromNet === step.net) next = edge.toNet;
      else if (edge.toNet === step.net) next = edge.fromNet;
      if (next === null) continue;

      const through = [...step.through, edge.type];
      const ids = [...step.ids, edge.compId];

      if (next === goalNet) {
        return { found: true, through, componentIds: ids };
      }

      if (seen.has(next)) continue;
      seen.add(next);
      queue.push({ net: next, through, ids, used: new Set([...step.used, edge.compId]) });
    }
  }

  return { found: false, through: [], componentIds: [] };
}

/** Jsou body spojené jen drátem, bez součástky mezi nimi? */
export function directlyConnected(circuit: Circuit, from: PinKey, to: PinKey): boolean {
  return resolveNets(circuit).connected(from, to);
}
