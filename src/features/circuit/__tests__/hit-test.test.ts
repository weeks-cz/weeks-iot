import { describe, expect, it } from "vitest";
import { componentAt, pinAt } from "../hit-test";
import { PITCH } from "../constants";
import type { Circuit } from "../types";

/**
 * Klikání na piny je ta jediná věc, kterou dítě v builderu dělá pořád.
 * Když se netrefí, nedostane se dál — a u LED jsou nožičky 16 px od sebe,
 * takže „skoro" nestačí.
 */

const circuit: Circuit = {
  comps: [
    { id: "led", type: "led-red", x: 0, y: 0, rotation: 0 },
    { id: "r", type: "resistor-220", x: 200, y: 200, rotation: 0 },
    { id: "bb", type: "breadboard-half", x: 0, y: 400, rotation: 0 },
  ],
  wires: [],
};

/* LED: anoda dx=2, katoda dx=3, obě dy=5 → 32/48 px vodorovně, 80 svisle. */
const ANODE = { x: 2 * PITCH, y: 5 * PITCH };
const CATHODE = { x: 3 * PITCH, y: 5 * PITCH };

describe("nejbližší pin", () => {
  it("přesný zásah chytne ten pin", () => {
    expect(pinAt(circuit, ANODE)?.pin.pinName).toBe("anode");
    expect(pinAt(circuit, CATHODE)?.pin.pinName).toBe("cathode");
  });

  it("mezi dvěma nožičkami LED vyhraje ta bližší, ne ta pozdější v pořadí", () => {
    /* Tohle je ta chyba, kterou to opravuje: cíle se překrývaly a chytal
       se pin podle pořadí v DOM. Dítě klikalo na plus a dostalo mínus. */
    expect(pinAt(circuit, { x: ANODE.x + 4, y: ANODE.y })?.pin.pinName).toBe("anode");
    expect(pinAt(circuit, { x: CATHODE.x - 4, y: CATHODE.y })?.pin.pinName).toBe("cathode");
  });

  it("mimo dosah nechytá nic", () => {
    expect(pinAt(circuit, { x: 2000, y: 2000 })).toBeNull();
  });

  it("chytá i vedle pinu, ne jen přesně na něm", () => {
    /* Prst má osm milimetrů. Bez tolerance by se to nedalo ovládat. */
    expect(pinAt(circuit, { x: ANODE.x, y: ANODE.y - 12 })?.pin.pinName).toBe("anode");
  });
});

describe("součástka pod bodem", () => {
  it("najde tu, na kterou se kleplo", () => {
    expect(componentAt(circuit, { x: 210, y: 200 })).toBe("r");
  });

  it("menší součástka vyhrává nad deskou pod sebou", () => {
    /* Součástka položená na breadboardu leží uvnitř jeho obdélníku. Kdyby
       vyhrával breadboard, nešla by ta menší nikdy vybrat ani odstranit. */
    const stacked: Circuit = {
      comps: [
        { id: "bb", type: "breadboard-half", x: 0, y: 0, rotation: 0 },
        { id: "led", type: "led-red", x: 100, y: 32, rotation: 0 },
      ],
      wires: [],
    };
    expect(componentAt(stacked, { x: 110, y: 60 })).toBe("led");
  });

  it("mimo součástky nevrací nic", () => {
    expect(componentAt(circuit, { x: 5000, y: 5000 })).toBeNull();
  });
});

describe("výřez na celý obvod", () => {
  it("nezmenší pod mez, pod kterou se nedá mířit", async () => {
    const { fitCircuit } = await import("../components/fit");

    /* Malý výřez by při doslovném dopočtu vyšel na dvacet procent —
       tam jsou nožičky LED tři pixely od sebe. */
    const fit = fitCircuit(circuit, { width: 200, height: 120 });

    expect(fit).not.toBeNull();
    expect(fit!.zoom).toBeGreaterThanOrEqual(0.75);
  });

  it("velký výřez nezvětšuje nad sto procent", () => {
    /* Rozmazané Arduino přes celou obrazovku vypadá jako chyba. */
    return import("../components/fit").then(({ fitCircuit }) => {
      const fit = fitCircuit(circuit, { width: 4000, height: 4000 });
      expect(fit!.zoom).toBeLessThanOrEqual(1);
    });
  });

  it("prázdný obvod nemá co doostřit", () => {
    return import("../components/fit").then(({ fitCircuit }) => {
      expect(fitCircuit({ comps: [], wires: [] }, { width: 800, height: 600 })).toBeNull();
    });
  });
});

describe("posun na zvýrazněné piny", () => {
  const view = { zoom: 1, pan: { x: -2000, y: -2000 } };
  const viewport = { width: 600, height: 400 };

  it("piny pohodlně uvnitř výřezu s ním nehýbou", async () => {
    const { ensureVisible } = await import("../components/fit");

    /* Skákání pod rukama je horší než nic — posouvat se smí jen tehdy,
       když je opravdu potřeba. */
    const middle: Circuit = {
      comps: [{ id: "led", type: "led-red", x: 250, y: 150, rotation: 0 }],
      wires: [],
    };
    const pins = [{ compId: "led", pinName: "anode" }];

    expect(ensureVisible(middle, pins, viewport, view)).toBeNull();
  });

  it("pin namáčknutý na okraj se vycentruje", async () => {
    const { ensureVisible } = await import("../components/fit");

    /* Tečka půl centimetru od hrany je sice technicky vidět, ale míří se
       na ni mizerně — a u dotyku ji zakryje vlastní prst. */
    const edge: Circuit = {
      comps: [{ id: "led", type: "led-red", x: 0, y: 0, rotation: 0 }],
      wires: [],
    };

    expect(ensureVisible(edge, [{ compId: "led", pinName: "anode" }], viewport, view)).not.toBeNull();
  });

  it("pin za okrajem výřez posune", async () => {
    const { ensureVisible } = await import("../components/fit");

    const far: Circuit = {
      comps: [{ id: "led", type: "led-red", x: 3000, y: 3000, rotation: 0 }],
      wires: [],
    };
    const pan = ensureVisible(far, [{ compId: "led", pinName: "anode" }], viewport, view);

    expect(pan).not.toBeNull();
    /* Po posunu musí pin skutečně padnout dovnitř. */
    const screen = {
      x: 2000 + pan!.x + (3000 + 2 * PITCH),
      y: 2000 + pan!.y + (3000 + 5 * PITCH),
    };
    expect(screen.x).toBeGreaterThan(0);
    expect(screen.x).toBeLessThan(viewport.width);
    expect(screen.y).toBeGreaterThan(0);
    expect(screen.y).toBeLessThan(viewport.height);
  });

  it("bez pinů se neposouvá", async () => {
    const { ensureVisible } = await import("../components/fit");
    expect(ensureVisible(circuit, [], viewport, view)).toBeNull();
  });
});

describe("součástka zapíchnutá do breadboardu", () => {
  /* Rezistor nožičkami přesně v dírkách A-1 a A-5. Breadboard je na
     (0,400), řada A má dy=2, sloupce začínají na dx=0. */
  const stuck: Circuit = {
    comps: [
      { id: "bb", type: "breadboard-half", x: 0, y: 400, rotation: 0 },
      { id: "r", type: "resistor-220", x: 0, y: 400 + 2 * PITCH, rotation: 0 },
    ],
    wires: [],
  };

  it("nožička v dírce je s tou dírkou spojená", async () => {
    const { resolveNets, pinKey } = await import("../nets");

    /* Bez tohohle byla deska jen obrázek: dítě do ní zapíchlo součástku,
       vypadalo to zapojeně a nebylo. */
    const nets = resolveNets(stuck);
    expect(nets.connected(pinKey("r", "a"), pinKey("bb", "row-A-1"))).toBe(true);
  });

  it("spojení se šíří celým sloupcem, ne jen do té jedné dírky", async () => {
    const { resolveNets, pinKey } = await import("../nets");

    const nets = resolveNets(stuck);
    expect(nets.connected(pinKey("r", "a"), pinKey("bb", "row-E-1"))).toBe(true);
  });

  it("příkop pořád odděluje — spodní půlka spojená není", async () => {
    const { resolveNets, pinKey } = await import("../nets");

    const nets = resolveNets(stuck);
    expect(nets.connected(pinKey("r", "a"), pinKey("bb", "row-F-1"))).toBe(false);
  });

  it("dvě součástky na sobě se nespojí — to není zapíchnutí, to je nepořádek", async () => {
    const { resolveNets, pinKey } = await import("../nets");

    const stacked: Circuit = {
      comps: [
        { id: "bb", type: "breadboard-half", x: 0, y: 0, rotation: 0 },
        { id: "r1", type: "resistor-220", x: 500, y: 500, rotation: 0 },
        { id: "r2", type: "resistor-220", x: 500, y: 500, rotation: 0 },
      ],
      wires: [],
    };

    const nets = resolveNets(stacked);
    expect(nets.connected(pinKey("r1", "a"), pinKey("r2", "a"))).toBe(false);
  });

  it("klik na nožičku chytne nožičku, ne dírku pod ní", () => {
    /* Jinak drát vede viditelně jinam, než dítě mířilo — a přesně to
       působilo, že se builder ovládá mizerně. */
    const hit = pinAt(stuck, { x: 0, y: 400 + 2 * PITCH });
    expect(hit?.pin.compId).toBe("r");
  });
});

describe("náhled pozná, jestli se součástka zapíchne", () => {
  const board: Circuit = {
    comps: [{ id: "bb", type: "breadboard-half", x: 0, y: 0, rotation: 0 }],
    wires: [],
  };

  it("nad dírkami ano", async () => {
    const { wouldPlugIn } = await import("../hit-test");
    /* Řada A je dy=2, sloupec 1 je dx=0 → rezistor s nožičkou na (0, 2×PITCH). */
    expect(wouldPlugIn(board, "resistor-220", { x: 0, y: 2 * PITCH })).toBe(true);
  });

  it("vedle desky ne", async () => {
    const { wouldPlugIn } = await import("../hit-test");
    expect(wouldPlugIn(board, "resistor-220", { x: 2000, y: 2000 })).toBe(false);
  });

  it("mezi dírkami ne — nožička musí sedět přesně", async () => {
    const { wouldPlugIn } = await import("../hit-test");
    expect(wouldPlugIn(board, "resistor-220", { x: 8, y: 2 * PITCH })).toBe(false);
  });

  it("bez desky na ploše není kam zapíchnout", async () => {
    const { wouldPlugIn } = await import("../hit-test");
    const empty: Circuit = { comps: [], wires: [] };
    expect(wouldPlugIn(empty, "led-red", { x: 0, y: 0 })).toBe(false);
  });
});

describe("pokládání součástek", () => {
  it("dvě stejné na totéž místo se nepoloží", async () => {
    const { builderReducer, initBuilderState } = await import("../components/state");

    /* Překrývaly by se přesně, takže by to vypadalo jako jedna — dítě
       klepne, nevidí změnu, klepne znovu a má neviditelný nepořádek. */
    const start = initBuilderState({ comps: [], wires: [] });
    const comp = { id: "a", type: "led-red" as const, x: 64, y: 64, rotation: 0 as const };

    const once = builderReducer(start, { type: "PLACE", comp });
    const twice = builderReducer(once, { type: "PLACE", comp: { ...comp, id: "b" } });

    expect(twice.circuit.comps).toHaveLength(1);
  });

  it("stejná součástka jinam se položí normálně", async () => {
    const { builderReducer, initBuilderState } = await import("../components/state");

    const start = initBuilderState({ comps: [], wires: [] });
    const comp = { id: "a", type: "led-red" as const, x: 64, y: 64, rotation: 0 as const };

    const once = builderReducer(start, { type: "PLACE", comp });
    const twice = builderReducer(once, {
      type: "PLACE",
      comp: { ...comp, id: "b", x: 128 },
    });

    expect(twice.circuit.comps).toHaveLength(2);
  });
});

describe("výběr součástky vedle pinů", () => {
  it("klik na tělo LED míří na součástku, ne na nožičku", () => {
    /* Nožičky LED jsou dole (dy=5). Vršek těla musí zůstat volný, jinak
       se součástka nedá vybrat — a tedy ani smazat. */
    const led: Circuit = {
      comps: [{ id: "led", type: "led-red", x: 0, y: 0, rotation: 0 }],
      wires: [],
    };

    const telo = { x: 2 * PITCH, y: 1 * PITCH };
    expect(pinAt(led, telo)).toBeNull();
    expect(componentAt(led, telo)).toBe("led");
  });

  it("nožička se pořád chytá i s rezervou na netrefení", () => {
    const led: Circuit = {
      comps: [{ id: "led", type: "led-red", x: 0, y: 0, rotation: 0 }],
      wires: [],
    };

    /* Šest pixelů vedle a osm nad — pořád jednoznačně blíž k anodě než
       ke katodě, která je o celou rozteč vpravo. */
    const vedleAnody = { x: 2 * PITCH - 6, y: 5 * PITCH - 8 };
    expect(pinAt(led, vedleAnody)?.pin.pinName).toBe("anode");
  });
});
