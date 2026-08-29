import { describe, expect, it } from "vitest";
import { PITCH } from "../constants";
import { checkWiring, type WiringSpec } from "../wiring-check";
import type { Circuit, CircuitComponent, Wire } from "../types";

function comp(id: string, type: CircuitComponent["type"]): CircuitComponent {
  return { id, type, x: 0, y: 0, rotation: 0 };
}

let seq = 0;
function w(a: [string, string], b: [string, string]): Wire {
  return {
    id: `w${++seq}`,
    from: { compId: a[0], pinName: a[1] },
    to: { compId: b[0], pinName: b[1] },
  };
}

/** Zadání lekce 1: LED na D8 přes rezistor, katoda na zem. */
const SPEC: WiringSpec = {
  parts: [
    { role: "arduino", type: "arduino-uno", label: "Arduino" },
    { role: "led", type: "led-red", label: "červená LED" },
    { role: "odpor", type: "resistor-220", label: "rezistor" },
  ],
  connections: [
    {
      from: { role: "arduino", pin: "D8" },
      to: { role: "led", pin: "anode" },
      through: ["resistor-220"],
      hint: "Delší nožička LED (anoda) musí vést na pin 8 — ale přes rezistor, jinak se LED spálí.",
    },
    {
      from: { role: "led", pin: "cathode" },
      to: { role: "arduino", pin: "GND-1" },
      hint: "Kratší nožička LED (katoda) musí vést na GND, aby se obvod uzavřel.",
    },
  ],
};

const UNO = comp("uno", "arduino-uno");
const LED = comp("led", "led-red");
const RES = comp("r", "resistor-220");

describe("checkWiring — správné zapojení", () => {
  it("projde, když všechno sedí", () => {
    const c: Circuit = {
      comps: [UNO, LED, RES],
      wires: [
        w(["uno", "D8"], ["r", "a"]),
        w(["r", "b"], ["led", "anode"]),
        w(["led", "cathode"], ["uno", "GND-1"]),
      ],
    };
    const r = checkWiring(c, SPEC);
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
    expect(r.satisfied).toBe(r.total);
  });

  it("projde i při zapojení přes breadboard", () => {
    // Elektricky totéž, jen delší cesta. Kontrola nesmí trestat za to,
    // že to dítě udělalo „jako na obrázku".
    const bb = comp("bb", "breadboard-half");
    const c: Circuit = {
      comps: [UNO, bb, LED, RES],
      wires: [
        w(["uno", "D8"], ["bb", "row-A-3"]),
        w(["bb", "row-C-3"], ["r", "a"]),
        w(["r", "b"], ["bb", "row-A-9"]),
        w(["bb", "row-D-9"], ["led", "anode"]),
        w(["led", "cathode"], ["bb", "bot-−-1"]),
        w(["bb", "bot-−-25"], ["uno", "GND-1"]),
      ],
    };
    expect(checkWiring(c, SPEC).ok).toBe(true);
  });

  it("projde bez ohledu na to, kterou LED dítě použilo", () => {
    // Dvě stejné LED na desce; kontrola si má role dohledat sama.
    const led2 = comp("led2", "led-red");
    const c: Circuit = {
      comps: [UNO, led2, LED, RES],
      wires: [
        w(["uno", "D8"], ["r", "a"]),
        w(["r", "b"], ["led2", "anode"]),
        w(["led2", "cathode"], ["uno", "GND-1"]),
      ],
    };
    expect(checkWiring(c, SPEC).ok).toBe(true);
  });
});

describe("checkWiring — chybějící součástky", () => {
  it("nejdřív řekne, co chybí na desce", () => {
    const c: Circuit = { comps: [UNO], wires: [] };
    const r = checkWiring(c, SPEC);
    expect(r.ok).toBe(false);
    expect(r.issues.every((i) => i.kind === "missing-part")).toBe(true);
    expect(r.issues.map((i) => i.hint).join(" ")).toMatch(/palety/);
  });

  it("chybějící typ hlásí jednou, i když ho zadání chce víckrát", () => {
    const spec: WiringSpec = {
      parts: [
        { role: "a", type: "led-red", label: "červená LED" },
        { role: "b", type: "led-red", label: "červená LED" },
      ],
      connections: [],
    };
    const r = checkWiring({ comps: [UNO], wires: [] }, spec);
    expect(r.issues).toHaveLength(1);
  });

  it("prázdný obvod neprojde", () => {
    expect(checkWiring({ comps: [], wires: [] }, SPEC).ok).toBe(false);
  });
});

describe("checkWiring — chybějící spoje", () => {
  it("součástky bez drátků neprojdou", () => {
    const c: Circuit = { comps: [UNO, LED, RES], wires: [] };
    const r = checkWiring(c, SPEC);
    expect(r.ok).toBe(false);
    expect(r.issues.every((i) => i.kind === "missing-connection")).toBe(true);
    expect(r.satisfied).toBe(0);
  });

  it("chybějící zem hlásí konkrétně", () => {
    const c: Circuit = {
      comps: [UNO, LED, RES],
      wires: [w(["uno", "D8"], ["r", "a"]), w(["r", "b"], ["led", "anode"])],
    };
    const r = checkWiring(c, SPEC);
    expect(r.ok).toBe(false);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]!.hint).toMatch(/katoda|GND/i);
    /* Jeden spoj z dvou sedí — dítě má vidět, že je na půl cesty. */
    expect(r.satisfied).toBe(1);
  });

  it("LED bez rezistoru neprojde, i když je spojení hotové", () => {
    // Nejčastější chyba a zároveň ta, po které LED skutečně odejde.
    const c: Circuit = {
      comps: [UNO, LED, RES],
      wires: [w(["uno", "D8"], ["led", "anode"]), w(["led", "cathode"], ["uno", "GND-1"])],
    };
    const r = checkWiring(c, SPEC);
    expect(r.ok).toBe(false);
    expect(r.issues[0]!.kind).toBe("missing-component-on-path");
    expect(r.issues[0]!.hint).toMatch(/rezistor/i);
  });

  it("prohozená anoda a katoda neprojde", () => {
    // LED je dioda; obráceně nesvítí. Kontrola to musí poznat.
    const c: Circuit = {
      comps: [UNO, LED, RES],
      wires: [
        w(["uno", "D8"], ["r", "a"]),
        w(["r", "b"], ["led", "cathode"]),
        w(["led", "anode"], ["uno", "GND-1"]),
      ],
    };
    expect(checkWiring(c, SPEC).ok).toBe(false);
  });
});

describe("checkWiring — hlášky", () => {
  it("neobsahují slovo špatně", () => {
    // Kontrola kódu má tón „chybí blok, který…", ne „špatně". Zapojení
    // mluví stejně: řekne, co doplnit, ne že se to nepovedlo.
    const r = checkWiring({ comps: [UNO, LED, RES], wires: [] }, SPEC);
    for (const issue of r.issues) {
      expect(issue.hint.toLowerCase()).not.toMatch(/špatn|chyba|nesprávn/);
    }
  });

  it("nesou role pro zvýraznění v builderu", () => {
    const r = checkWiring({ comps: [UNO, LED, RES], wires: [] }, SPEC);
    expect(r.issues[0]!.roles.length).toBeGreaterThan(0);
  });

  it("hlásí nanejvýš to, co je opravdu potřeba", () => {
    const c: Circuit = {
      comps: [UNO, LED, RES],
      wires: [
        w(["uno", "D8"], ["r", "a"]),
        w(["r", "b"], ["led", "anode"]),
        w(["led", "cathode"], ["uno", "GND-1"]),
      ],
    };
    expect(checkWiring(c, SPEC).issues).toHaveLength(0);
    expect(PITCH).toBeGreaterThan(0);
  });
});
