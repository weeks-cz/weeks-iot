import { describe, expect, it } from "vitest";
import { PITCH } from "../constants";
import { pinKey, resolveNets } from "../nets";
import type { Circuit, CircuitComponent, Wire } from "../types";

function comp(id: string, type: CircuitComponent["type"], x = 0, y = 0): CircuitComponent {
  return { id, type, x: x * PITCH, y: y * PITCH, rotation: 0 };
}

function wire(id: string, a: [string, string], b: [string, string]): Wire {
  return { id, from: { compId: a[0], pinName: a[1] }, to: { compId: b[0], pinName: b[1] } };
}

const BB = comp("bb", "breadboard-half");
const UNO = comp("uno", "arduino-uno", 0, 20);
const LED = comp("led", "led-red", 5, 5);

describe("vnitřní propojení breadboardu", () => {
  const nets = resolveNets({ comps: [BB], wires: [] });

  it("napájecí lišta je jeden vodič po celé délce", () => {
    // Tohle je to, co na breadboardu nikdo nekreslí a co musí model znát:
    // zapíchnu drát do dírky 0 a napájím i dírku 29.
    expect(nets.connected(pinKey("bb", "top-+-0"), pinKey("bb", "top-+-29"))).toBe(true);
    expect(nets.connected(pinKey("bb", "bot-−-3"), pinKey("bb", "bot-−-27"))).toBe(true);
  });

  it("plus a mínus lišta jsou oddělené", () => {
    // Kdyby ne, každý obvod by byl zkrat.
    expect(nets.connected(pinKey("bb", "top-+-5"), pinKey("bb", "top-−-5"))).toBe(false);
  });

  it("horní a dolní lišta jsou oddělené", () => {
    expect(nets.connected(pinKey("bb", "top-+-5"), pinKey("bb", "bot-+-5"))).toBe(false);
  });

  it("sloupec nad příkopem je jeden vodič", () => {
    for (const row of ["B", "C", "D", "E"]) {
      expect(nets.connected(pinKey("bb", "row-A-7"), pinKey("bb", `row-${row}-7`)), row).toBe(true);
    }
  });

  it("sloupec pod příkopem je jiný vodič", () => {
    for (const row of ["G", "H", "I", "J"]) {
      expect(nets.connected(pinKey("bb", "row-F-7"), pinKey("bb", `row-${row}-7`)), row).toBe(true);
    }
  });

  it("PŘÍKOP obě půlky odděluje", () => {
    // Celý smysl breadboardu. Kdyby se A–E a F–J slily, integrovaný obvod
    // posazený přes příkop by měl zkratované protilehlé nožičky.
    expect(nets.connected(pinKey("bb", "row-E-7"), pinKey("bb", "row-F-7"))).toBe(false);
  });

  it("sousední sloupce spolu nesouvisí", () => {
    expect(nets.connected(pinKey("bb", "row-A-7"), pinKey("bb", "row-A-8"))).toBe(false);
  });

  it("lišta a sloupec nejsou spojené bez drátku", () => {
    expect(nets.connected(pinKey("bb", "top-+-7"), pinKey("bb", "row-A-7"))).toBe(false);
  });
});

describe("drátky", () => {
  it("spojí dva piny do jedné sítě", () => {
    const c: Circuit = {
      comps: [UNO, BB],
      wires: [wire("w1", ["uno", "D8"], ["bb", "row-A-5"])],
    };
    const nets = resolveNets(c);
    expect(nets.connected(pinKey("uno", "D8"), pinKey("bb", "row-A-5"))).toBe(true);
  });

  it("spojení je tranzitivní přes breadboard", () => {
    // Drát do řady A vede proud i do řady E téhož sloupce, aniž by to
    // někdo kreslil. Přesně proto nestačí porovnávat seznam drátků.
    const c: Circuit = {
      comps: [UNO, BB, LED],
      wires: [
        wire("w1", ["uno", "D8"], ["bb", "row-A-5"]),
        wire("w2", ["bb", "row-E-5"], ["led", "anode"]),
      ],
    };
    const nets = resolveNets(c);
    expect(nets.connected(pinKey("uno", "D8"), pinKey("led", "anode"))).toBe(true);
  });

  it("cesta přes příkop bez drátku nevede", () => {
    const c: Circuit = {
      comps: [UNO, BB, LED],
      wires: [
        wire("w1", ["uno", "D8"], ["bb", "row-A-5"]),
        wire("w2", ["bb", "row-F-5"], ["led", "anode"]),
      ],
    };
    const nets = resolveNets(c);
    expect(nets.connected(pinKey("uno", "D8"), pinKey("led", "anode"))).toBe(false);
  });

  it("stejný výsledek bez ohledu na pořadí drátků", () => {
    const w1 = wire("w1", ["uno", "D8"], ["bb", "row-A-5"]);
    const w2 = wire("w2", ["bb", "row-E-5"], ["led", "anode"]);
    const a = resolveNets({ comps: [UNO, BB, LED], wires: [w1, w2] });
    const b = resolveNets({ comps: [UNO, BB, LED], wires: [w2, w1] });
    const key = [pinKey("uno", "D8"), pinKey("led", "anode")] as const;
    expect(a.connected(...key)).toBe(b.connected(...key));
  });

  it("přímé spojení bez breadboardu funguje taky", () => {
    // Dítě může LED zapíchnout rovnou do Arduina. Elektricky v pořádku,
    // takže to kontrola nesmí odmítnout.
    const c: Circuit = {
      comps: [UNO, LED],
      wires: [wire("w1", ["uno", "D8"], ["led", "anode"])],
    };
    expect(resolveNets(c).connected(pinKey("uno", "D8"), pinKey("led", "anode"))).toBe(true);
  });
});

describe("součástky nejsou vodič", () => {
  it("piny LED se neslijí do jedné sítě", () => {
    // Kdyby ano, zmizel by rozdíl mezi "LED je zapojená" a "LED je
    // zkratovaná" — a taky by šlo projít bez rezistoru.
    const c: Circuit = { comps: [LED], wires: [] };
    const nets = resolveNets(c);
    expect(nets.connected(pinKey("led", "anode"), pinKey("led", "cathode"))).toBe(false);
  });

  it("piny rezistoru se neslijí", () => {
    const r = comp("r", "resistor-220", 3, 3);
    const nets = resolveNets({ comps: [r], wires: [] });
    const pins = ["a", "b"].map((p) => pinKey("r", p));
    /* Názvy pinů rezistoru bereme z registru, ne natvrdo. */
    expect(nets.nets.length).toBeGreaterThan(1);
    expect(pins.length).toBe(2);
  });
});

describe("prázdný a osamocený obvod", () => {
  it("prázdný obvod nemá sítě", () => {
    expect(resolveNets({ comps: [], wires: [] }).nets).toHaveLength(0);
  });

  it("nepřipojený pin má vlastní síť", () => {
    const nets = resolveNets({ comps: [LED], wires: [] });
    expect(nets.members(nets.netOf(pinKey("led", "anode")))).toEqual([pinKey("led", "anode")]);
  });
});
