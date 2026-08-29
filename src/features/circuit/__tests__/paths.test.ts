import { describe, expect, it } from "vitest";
import { PITCH } from "../constants";
import { pinKey } from "../nets";
import { findPath } from "../paths";
import type { Circuit, CircuitComponent, Wire } from "../types";

function comp(id: string, type: CircuitComponent["type"], x = 0, y = 0): CircuitComponent {
  return { id, type, x: x * PITCH, y: y * PITCH, rotation: 0 };
}

let wireSeq = 0;
function w(a: [string, string], b: [string, string]): Wire {
  return {
    id: `w${++wireSeq}`,
    from: { compId: a[0], pinName: a[1] },
    to: { compId: b[0], pinName: b[1] },
  };
}

/* Rozmístěné, ne všechny na (0,0). Nožička ležící v dírce breadboardu je
   od teď elektricky spojená — součástky naskládané na sebe by proto
   propojily i to, co tenhle test schválně nepropojuje drátkem. */
const UNO = comp("uno", "arduino-uno", 0, 40);
const BB = comp("bb", "breadboard-half", 0, 0);
const LED = comp("led", "led-red", 40, 40);
const RES = comp("r", "resistor-220", 50, 40);

/** Správné zapojení: D8 → rezistor → anoda, katoda → GND. */
function correctCircuit(): Circuit {
  return {
    comps: [UNO, BB, LED, RES],
    wires: [
      w(["uno", "D8"], ["bb", "row-A-5"]),
      w(["bb", "row-B-5"], ["r", "a"]),
      w(["r", "b"], ["bb", "row-A-10"]),
      w(["bb", "row-B-10"], ["led", "anode"]),
      w(["led", "cathode"], ["bb", "bot-−-3"]),
      w(["uno", "GND-1"], ["bb", "bot-−-20"]),
    ],
  };
}

describe("findPath — správné zapojení", () => {
  it("najde cestu z pinu do anody přes rezistor", () => {
    const c = correctCircuit();
    const r = findPath(c, pinKey("uno", "D8"), pinKey("led", "anode"), {
      through: ["resistor-220"],
    });
    expect(r.found).toBe(true);
    expect(r.through).toEqual(["resistor-220"]);
  });

  it("katoda je spojená se zemí přímo, bez součástky", () => {
    const c = correctCircuit();
    const r = findPath(c, pinKey("led", "cathode"), pinKey("uno", "GND-1"));
    expect(r.found).toBe(true);
    expect(r.through).toEqual([]);
  });

  it("cesta funguje i při zapojení přes jinou řadu téhož sloupce", () => {
    // Dítě zapíchne drát do A5, my čteme z B5 — elektricky totéž.
    const c = correctCircuit();
    expect(findPath(c, pinKey("uno", "D8"), pinKey("bb", "row-E-5")).found).toBe(true);
  });
});

describe("findPath — chyby, které má odhalit", () => {
  it("LED napřímo bez rezistoru NEprojde požadavkem na rezistor", () => {
    // Nejčastější začátečnická chyba a zároveň ta, po které LED odejde.
    const c: Circuit = {
      comps: [UNO, LED],
      wires: [w(["uno", "D8"], ["led", "anode"]), w(["led", "cathode"], ["uno", "GND-1"])],
    };
    const r = findPath(c, pinKey("uno", "D8"), pinKey("led", "anode"), {
      through: ["resistor-220"],
    });
    /* Přímé spojení najde (stejná síť), ale bez rezistoru — volající
       pozná podle `through`, že požadavek nesplňuje. */
    expect(r.through).toEqual([]);
  });

  it("nepropojený obvod cestu nenajde", () => {
    const c: Circuit = { comps: [UNO, LED, RES], wires: [] };
    expect(findPath(c, pinKey("uno", "D8"), pinKey("led", "anode")).found).toBe(false);
  });

  it("cesta přes příkop bez drátku neexistuje", () => {
    const c: Circuit = {
      comps: [UNO, BB, LED],
      wires: [w(["uno", "D8"], ["bb", "row-A-5"]), w(["bb", "row-F-5"], ["led", "anode"])],
    };
    expect(findPath(c, pinKey("uno", "D8"), pinKey("led", "anode")).found).toBe(false);
  });

  it("nepovolená součástka cestu neotevře", () => {
    // Přes tlačítko se k anodě dostat dá, ale zadání chce rezistor.
    const btn = comp("btn", "pushbutton");
    const c: Circuit = {
      comps: [UNO, LED, btn],
      wires: [
        w(["uno", "D8"], ["btn", "1.l"]),
        w(["btn", "2.l"], ["led", "anode"]),
      ],
    };
    const r = findPath(c, pinKey("uno", "D8"), pinKey("led", "anode"), {
      through: ["resistor-220"],
    });
    expect(r.found).toBe(false);
  });

  it("strop na počet součástek brání nalezení okliky", () => {
    // Bez stropu by se cesta našla skoro odkudkoli kamkoli a kontrola by
    // ztratila smysl.
    const c = correctCircuit();
    const r = findPath(c, pinKey("uno", "D8"), pinKey("led", "anode"), {
      through: ["resistor-220"],
      maxHops: 0,
    });
    expect(r.found).toBe(false);
  });
});

describe("findPath — vlastnosti", () => {
  it("stejný bod je spojený sám se sebou bez součástky", () => {
    const c = correctCircuit();
    const r = findPath(c, pinKey("uno", "D8"), pinKey("uno", "D8"));
    expect(r.found).toBe(true);
    expect(r.through).toEqual([]);
  });

  it("vrací id součástek na cestě pro zvýraznění", () => {
    const c = correctCircuit();
    const r = findPath(c, pinKey("uno", "D8"), pinKey("led", "anode"), {
      through: ["resistor-220"],
    });
    expect(r.componentIds).toEqual(["r"]);
  });

  it("hledání je symetrické", () => {
    const c = correctCircuit();
    const there = findPath(c, pinKey("uno", "D8"), pinKey("led", "anode"), {
      through: ["resistor-220"],
    });
    const back = findPath(c, pinKey("led", "anode"), pinKey("uno", "D8"), {
      through: ["resistor-220"],
    });
    expect(there.found).toBe(back.found);
    expect(there.through).toEqual(back.through);
  });
});
