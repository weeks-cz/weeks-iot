import type { Circuit, CircuitComponent, PinRef } from "./types";
import { getComponentSpec } from "./components";

/**
 * Elektrický model obvodu.
 *
 * ── Proč to musí být sítě, a ne seznam drátků ──────────────────────────────
 * Dítě může tutéž věc zapojit deseti způsoby. LED může viset přímo na pinu
 * Arduina, nebo přes tři řady breadboardu a dva drátky. Kontrola, která
 * porovnává seznam drátků se vzorem, by první způsob přijala a druhý
 * odmítla — přestože oba fungují.
 *
 * Elektricky je správná otázka jiná: **jsou ty dva body ve stejné síti?**
 * Odpověď na ni nezávisí na cestě, jen na propojení.
 *
 * ── Jak se sítě tvoří ──────────────────────────────────────────────────────
 * Breadboard má vlastní vnitřní propojení, které nikdo nekreslí:
 *   • napájecí lišta `top-+-0..29` je jeden vodič po celé délce
 *   • sloupec nad příkopem (`row-A-7` až `row-E-7`) je jeden vodič
 *   • sloupec pod příkopem (`row-F-7` až `row-J-7`) je jiný vodič
 *   • příkop obě půlky odděluje — to je celý smysl breadboardu
 *
 * K tomu se přidají drátky. Výsledkem je rozklad všech pinů do sítí.
 */

/** Jednoznačný klíč pinu napříč obvodem. */
export type PinKey = string;

export function pinKey(compId: string, pinName: string): PinKey {
  return `${compId}#${pinName}`;
}

export function parsePinKey(key: PinKey): PinRef {
  const idx = key.indexOf("#");
  return { compId: key.slice(0, idx), pinName: key.slice(idx + 1) };
}

/* ── Union-find ─────────────────────────────────────────────────────────── */

class UnionFind {
  private parent = new Map<string, string>();

  find(x: string): string {
    const p = this.parent.get(x);
    if (p === undefined) {
      this.parent.set(x, x);
      return x;
    }
    if (p === x) return x;
    const root = this.find(p);
    /* Zkracování cesty — bez něj se u breadboardu s 900 piny
       vyhodnocení znatelně zpomalí. */
    this.parent.set(x, root);
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/**
 * Vnitřní propojení breadboardu.
 *
 * Vrací skupiny pinů, které jsou spojené už z výroby.
 */
export function breadboardGroups(comp: CircuitComponent): PinKey[][] {
  if (comp.type !== "breadboard-half") return [];

  const groups: PinKey[][] = [];

  /* Čtyři napájecí lišty, každá jeden vodič po celé délce. */
  for (const rail of ["top-+", "top-−", "bot-+", "bot-−"]) {
    groups.push(
      Array.from({ length: 30 }, (_, i) => pinKey(comp.id, `${rail}-${i}`)),
    );
  }

  /* Sloupce. A–E je jedna půlka, F–J druhá; příkop mezi nimi je izolant. */
  for (let col = 1; col <= 30; col++) {
    groups.push(["A", "B", "C", "D", "E"].map((r) => pinKey(comp.id, `row-${r}-${col}`)));
    groups.push(["F", "G", "H", "I", "J"].map((r) => pinKey(comp.id, `row-${r}-${col}`)));
  }

  return groups;
}

export interface NetMap {
  /** Pin → identifikátor jeho sítě. */
  netOf: (key: PinKey) => string;
  /** Jsou oba piny ve stejné síti? */
  connected: (a: PinKey, b: PinKey) => boolean;
  /** Všechny piny dané sítě. */
  members: (net: string) => PinKey[];
  nets: string[];
}

/**
 * Rozklad obvodu do sítí.
 *
 * Součástky se sem NEZAPOČÍTÁVAJÍ. Rezistor ani LED nejsou vodič — spojení
 * skrz ně řeší `paths.ts`, protože u nich záleží na tom, že tam jsou.
 * Kdyby se piny součástek slily do jedné sítě, zmizel by rozdíl mezi
 * „LED je připojená přes rezistor" a „LED je zkratovaná".
 */
export function resolveNets(circuit: Circuit): NetMap {
  const uf = new UnionFind();

  /* Nejdřív každý pin jako vlastní síť, ať existují i nepřipojené. */
  for (const comp of circuit.comps) {
    for (const pin of getComponentSpec(comp.type).pins) {
      uf.find(pinKey(comp.id, pin.name));
    }
    for (const group of breadboardGroups(comp)) {
      for (let i = 1; i < group.length; i++) uf.union(group[0]!, group[i]!);
    }
  }

  for (const wire of circuit.wires) {
    uf.union(pinKey(wire.from.compId, wire.from.pinName), pinKey(wire.to.compId, wire.to.pinName));
  }

  const byNet = new Map<string, PinKey[]>();
  for (const comp of circuit.comps) {
    for (const pin of getComponentSpec(comp.type).pins) {
      const key = pinKey(comp.id, pin.name);
      const net = uf.find(key);
      const list = byNet.get(net) ?? [];
      list.push(key);
      byNet.set(net, list);
    }
  }

  return {
    netOf: (key) => uf.find(key),
    connected: (a, b) => uf.find(a) === uf.find(b),
    members: (net) => byNet.get(net) ?? [],
    nets: [...byNet.keys()],
  };
}
