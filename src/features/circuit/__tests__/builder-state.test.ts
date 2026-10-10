import { describe, expect, it } from "vitest";
import { PITCH } from "../constants";
import { occupiedSockets, placementConflicts, pluggedInto, pluggedLegs } from "../occupancy";
import { builderReducer, initBuilderState, normalizeCircuit } from "../components/state";
import type { Circuit, CircuitComponent, Wire } from "../types";

/**
 * Pravidla skládání: obsazenost, otáčení, přesun desky se součástkami,
 * výběr po položení a odmítání zkratů. Všechno, co se mění v obvodu, jde
 * přes reducer — takže se to testuje tady, bez prohlížeče.
 */

const board: CircuitComponent = { id: "bb", type: "breadboard-half", x: 0, y: 0, rotation: 0 };

function led(id: string, x: number, y: number, rotation: 0 | 90 | 180 | 270 = 0): CircuitComponent {
  return { id, type: "led-red", x, y, rotation };
}

const start = (circuit: Circuit) => initBuilderState(circuit);

describe("položení součástky", () => {
  it("nově položená součástka se nevybere sama", () => {
    const s = builderReducer(start({ comps: [board], wires: [] }), {
      type: "PLACE",
      comp: led("l", 300, 300),
    });
    expect(s.selection).toBeNull();
  });

  it("nožička, která by padla do obsazené dírky, se nepoloží", () => {
    /* Drátek už končí v dírce, kam by přišla anoda. */
    /* Drátek končí v dírce, kam by na (0,0) padla katoda. */
    const withWire: Circuit = {
      comps: [board],
      wires: [{ id: "w", from: { compId: "bb", pinName: "row-D-3" }, to: { compId: "bb", pinName: "row-A-1" } }],
    };
    const s = builderReducer(start(withWire), { type: "PLACE", comp: led("l", 0, 0) });
    expect(s.circuit.comps.map((c) => c.id)).toEqual(["bb"]);
  });
});

describe("otáčení", () => {
  it("otočí o čtvrt kola a zachová střed", () => {
    const s0 = start({ comps: [board, led("l", 0, 0)], wires: [] });
    const s1 = builderReducer(s0, { type: "ROTATE", id: "l" });
    const l1 = s1.circuit.comps.find((c) => c.id === "l")!;
    expect(l1.rotation).toBe(90);
    /* Střed LED zůstal na místě; počátek se posunul a zarovnal na mřížku.
       Po otočení leží obě nožičky na dírkách sloupce 1 (řady C a B). */
    expect({ x: l1.x, y: l1.y }).toEqual({ x: -PITCH, y: PITCH });
  });

  it("čtyři otočení se vrátí na nulu", () => {
    let s = start({ comps: [board, led("l", 0, 0)], wires: [] });
    for (let i = 0; i < 4; i++) s = builderReducer(s, { type: "ROTATE", id: "l" });
    expect(s.circuit.comps.find((c) => c.id === "l")!.rotation).toBe(0);
  });

  it("deska se neotáčí", () => {
    const s0 = start({ comps: [board], wires: [] });
    expect(builderReducer(s0, { type: "ROTATE", id: "bb" })).toBe(s0);
  });

  it("otočení, které položí nožičku do obsazené dírky, se neudělá", () => {
    /* LED na (0,0) se po otočení postaví na sloupec 1; drátek v dírce C-1
       tedy brání otočení. */
    const blocked: Circuit = {
      comps: [board, led("l", 0, 0)],
      wires: [{ id: "w", from: { compId: "bb", pinName: "row-J-30" }, to: { compId: "bb", pinName: "row-C-1" } }],
    };
    const s0 = start(blocked);
    expect(builderReducer(s0, { type: "ROTATE", id: "l" })).toBe(s0);
  });

  it("nakreslená součástka po otočení přidá pozici nožičkám — ROTATE_ARMED čeká v paletě", () => {
    const s0 = { ...start({ comps: [], wires: [] }), armed: "led-red" as const };
    const s1 = builderReducer(s0, { type: "ROTATE_ARMED" });
    expect(s1.armedRotation).toBe(90);
    const placed = builderReducer(s1, { type: "PLACE", comp: led("l", 320, 320, 90) });
    expect(placed.circuit.comps[0]!.rotation).toBe(90);
  });

  it("ROTATE_ARMED nic nedělá, když nic nečeká", () => {
    const s0 = start({ comps: [], wires: [] });
    expect(builderReducer(s0, { type: "ROTATE_ARMED" })).toBe(s0);
  });
});

describe("přesun desky se zapíchnutými díly", () => {
  const plugged: Circuit = {
    comps: [board, led("l", 0, 0), led("loose", 800, 800)],
    wires: [],
  };

  it("součástky v dírkách jedou s deskou o stejný posun", () => {
    expect(pluggedInto(plugged, "bb")).toEqual(["l"]);
    const s = builderReducer(start(plugged), {
      type: "MOVE",
      id: "bb",
      x: 160,
      y: 96,
      carry: ["l"],
    });
    const l = s.circuit.comps.find((c) => c.id === "l")!;
    expect(l.x).toBe(160);
    expect(l.y).toBe(96);
    /* Nožička zůstala na své dírce — po posunu leží na nové. */
    expect(pluggedLegs(s.circuit).map((p) => p.leg.compId)).toContain("l");
  });

  it("součástka, která jen leží vedle, se nepřesune", () => {
    const s = builderReducer(start(plugged), {
      type: "MOVE",
      id: "bb",
      x: 160,
      y: 96,
      carry: ["l"],
    });
    expect(s.circuit.comps.find((c) => c.id === "loose")).toEqual(led("loose", 800, 800));
  });

  it("deska se posouvá po celém kroku mřížky, ne po pixelech", () => {
    const s = builderReducer(start(plugged), { type: "MOVE", id: "bb", x: 7, y: 9, carry: [] });
    const b = s.circuit.comps.find((c) => c.id === "bb")!;
    expect(b.x % PITCH).toBe(0);
    expect(b.y % PITCH).toBe(0);
  });

  it("posun, který by dal zapíchnutou součástku na obsazenou dírku, se odmítne", () => {
    /* Druhá součástka leží přesně v dírkách, na které by se první posunula. */
    const crowded: Circuit = {
      comps: [board, led("l", 0, 0), led("blocker", 160, 96)],
      wires: [],
    };
    const s0 = start(crowded);
    const s1 = builderReducer(s0, { type: "MOVE", id: "bb", x: 160, y: 96, carry: ["l"] });
    expect(s1).toBe(s0);
  });
});

describe("drátky a obsazené dírky", () => {
  const wired: Circuit = {
    comps: [board, led("l", 0, 0)],
    wires: [],
  };

  it("drátek nejde začít z dírky, do které už něco vede", () => {
    const taken: Circuit = {
      comps: wired.comps,
      wires: [{ id: "w", from: { compId: "bb", pinName: "row-B-3" }, to: { compId: "bb", pinName: "row-B-7" } }],
    };
    const s0 = start(taken);
    expect(builderReducer(s0, { type: "BEGIN_WIRE", from: { compId: "bb", pinName: "row-B-3" } })).toBe(s0);
  });

  it("drátek nejde dokončit do obsazené dírky, rozdělaný zůstane", () => {
    const taken: Circuit = {
      comps: wired.comps,
      wires: [{ id: "w", from: { compId: "bb", pinName: "row-B-3" }, to: { compId: "bb", pinName: "row-B-7" } }],
    };
    let s = start(taken);
    s = builderReducer(s, { type: "BEGIN_WIRE", from: { compId: "bb", pinName: "row-C-1" } });
    const next = builderReducer(s, { type: "FINISH_WIRE", to: { compId: "bb", pinName: "row-B-7" } });
    expect(next.circuit.wires).toHaveLength(1);
    expect(next.wireFrom).toEqual({ compId: "bb", pinName: "row-C-1" });
  });

  it("nožička ke své vlastní nožičce se nespojí", () => {
    let s = start(wired);
    s = builderReducer(s, { type: "BEGIN_WIRE", from: { compId: "l", pinName: "anode" } });
    const next = builderReducer(s, { type: "FINISH_WIRE", to: { compId: "l", pinName: "cathode" } });
    expect(next.circuit.wires).toHaveLength(0);
    expect(next.wireFrom).toEqual({ compId: "l", pinName: "anode" });
  });

  it("drátek z dírky na dírku projde", () => {
    let s = start(wired);
    s = builderReducer(s, { type: "BEGIN_WIRE", from: { compId: "bb", pinName: "row-A-1" } });
    s = builderReducer(s, { type: "FINISH_WIRE", to: { compId: "bb", pinName: "row-A-4" } });
    expect(s.circuit.wires).toHaveLength(1);
  });

  it("obsazenost počítá nožičky i konce drátků", () => {
    const wire: Wire = { id: "w", from: { compId: "bb", pinName: "row-A-9" }, to: { compId: "bb", pinName: "row-A-10" } };
    const occupied = occupiedSockets({ comps: [board, led("l", 0, 0)], wires: [wire] });
    expect(occupied.has("bb#row-A-9")).toBe(true);
    expect(occupied.has("bb#row-D-3")).toBe(true);
    expect(occupied.has("bb#row-D-4")).toBe(true);
  });

  it("součástka se neplánuje na dírky, ve kterých už je drátek", () => {
    const wire: Wire = { id: "w", from: { compId: "bb", pinName: "row-D-3" }, to: { compId: "bb", pinName: "row-A-2" } };
    expect(placementConflicts({ comps: [board], wires: [wire] }, led("new", 0, 0))).toBe(true);
    expect(placementConflicts({ comps: [board], wires: [] }, led("new", 0, 0))).toBe(false);
  });
});

describe("smazání a výchozí stav", () => {
  it("smazání desky odnese drátky k ní a součástky zůstanou stát", () => {
    const c: Circuit = {
      comps: [board, led("l", 0, 0)],
      wires: [{ id: "w", from: { compId: "bb", pinName: "row-A-1" }, to: { compId: "l", pinName: "anode" } }],
    };
    const s = builderReducer(start(c), { type: "DELETE_COMPONENT", id: "bb" });
    expect(s.circuit.wires).toHaveLength(0);
    expect(s.circuit.comps.map((x) => x.id)).toEqual(["l"]);
  });

  it("starý koncept bez otočení se načte jako nula", () => {
    const old = { comps: [{ id: "l", type: "led-red", x: 0, y: 0 }], wires: [] } as unknown as Circuit;
    expect(normalizeCircuit(old).comps[0]!.rotation).toBe(0);
  });

  it("RESET zachová výřez, ať obvod přišel zvenku", () => {
    const s0 = { ...start({ comps: [], wires: [] }), zoom: 1.7, pan: { x: -300, y: 40 } };
    const s1 = builderReducer(s0, { type: "RESET", circuit: { comps: [board], wires: [] } });
    expect(s1.zoom).toBe(1.7);
    expect(s1.pan).toEqual({ x: -300, y: 40 });
    expect(s1.circuit.comps).toHaveLength(1);
  });
});
