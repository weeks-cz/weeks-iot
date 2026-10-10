import { describe, expect, it } from "vitest";
import { PITCH } from "../constants";
import { pinAt, targetAt } from "../hit-test";
import { wireAt, wireCurve, distanceToWire } from "../wire-geometry";
import { resolvePinPosition } from "../pins";
import { clampPan, contentBounds, screenToPlane, wheelZoomFactor, zoomAt, PLANE_OFFSET } from "../components/view";
import type { Circuit } from "../types";

/**
 * Co je pod klikem. Tohle se dítě naučí přes prst: pin vyhrává nad dírkou,
 * tělo součástky vybírá, drátek se trefuje do tloušťky čáry. Když se to
 * pomotá, nejde ani vybrat, ani zapojit.
 */

const board = { id: "bb", type: "breadboard-half" as const, x: 0, y: 0, rotation: 0 as const };

describe("nejbližší cíl vyhrává, ne pořadí", () => {
  /* Odpor na desce: nožička a na (0, 2 rozteče) = dírka A-1. Dírka vlevo
     vedle něj je volná (dx −1 → sloupec 0 nenese nic). */
  const onBoard: Circuit = {
    comps: [board, { id: "r", type: "resistor-220", x: 0, y: 2 * PITCH, rotation: 0 }],
    wires: [],
  };

  it("volná dírka vedle nožičky vyhraje, když na ni kliknu přesně", () => {
    /* Odpor leží na (0, 32); pod ním je lišta (dy 1 = y 16), která pod
       tělem není. Klik přesně na ni je dírka, ne nožička. */
    const hit = pinAt(onBoard, { x: 0, y: PITCH });
    expect(hit?.pin.compId).toBe("bb");
    expect(hit?.pin.pinName).toMatch(/^top-.-0$/);
  });

  it("nožička vyhraje, když kliknu na ni — dírka pod ní je obsazená, ne cíl", () => {
    const leg = resolvePinPosition(onBoard.comps[1]!, "a")!;
    const hit = pinAt(onBoard, leg);
    expect(hit?.pin).toEqual({ compId: "r", pinName: "a" });
  });

  it("klik 2 px od nožičky je nožička, klik blízko volné dírky je dírka", () => {
    const leg = resolvePinPosition(onBoard.comps[1]!, "a")!;
    expect(pinAt(onBoard, { x: leg.x + 2, y: leg.y })?.pin.compId).toBe("r");
    /* Dírka řady B pod nožičkou (y 48) je o 16 níž; klik 2 px nad ní vyhraje. */
    expect(pinAt(onBoard, { x: leg.x, y: leg.y + 14 })?.pin.compId).toBe("bb");
  });
});

describe("tělo součástky na desce", () => {
  /* LED na desce: dírky pod tělem nejsou cíle, klepnutí na tělo vybere LED. */
  const withLed: Circuit = {
    comps: [board, { id: "led", type: "led-red", x: 160, y: 160, rotation: 0 }],
    wires: [],
  };

  it("klepnutí doprostřed těla vybere LED, ne dírku pod ní", () => {
    const target = targetAt(withLed, { x: 200, y: 220 });
    expect(target).toEqual({ kind: "part", id: "led" });
  });

  it("klepnutí na prázdnou část desky vybere desku", () => {
    /* Okraj desky, kde není žádná dírka do dosahu. */
    const target = targetAt(withLed, { x: -10, y: -8 });
    expect(target).toEqual({ kind: "board", id: "bb" });
  });

  it("klepnutí na nožičku LED začne drátek, i když leží na tělo", () => {
    const anode = resolvePinPosition(withLed.comps[1]!, "anode")!;
    const target = targetAt(withLed, anode);
    expect(target?.kind).toBe("pin");
  });
});

describe("obsazená dírka", () => {
  const taken: Circuit = {
    comps: [board],
    wires: [{ id: "w", from: { compId: "bb", pinName: "row-B-3" }, to: { compId: "bb", pinName: "row-B-7" } }],
  };
  const at = { x: 2 * PITCH, y: 3 * PITCH }; // řada B, sloupec 3

  it("není cíl pro drátek", () => {
    expect(pinAt(taken, at)).toBeNull();
  });

  it("ale červený náhled ji ukáže jako obsazenou", () => {
    const hit = pinAt(taken, at, { includeOccupied: true });
    expect(hit?.occupied).toBe(true);
  });
});

describe("otočená součástka se trefuje tam, kde je vidět", () => {
  it("odpor po čtvrtotočení se chytí na svých nožičkách", () => {
    const rotated: Circuit = {
      comps: [{ id: "r", type: "resistor-220", x: 320, y: 320, rotation: 90 }],
      wires: [],
    };
    const a = resolvePinPosition(rotated.comps[0]!, "a")!;
    const b = resolvePinPosition(rotated.comps[0]!, "b")!;
    expect(a.x).toBe(b.x);
    expect(pinAt(rotated, a)?.pin.pinName).toBe("a");
    expect(pinAt(rotated, b)?.pin.pinName).toBe("b");
  });

  it("vodorovné klepnutí vedle svislého odporu ho netrefí", () => {
    const rotated: Circuit = {
      comps: [{ id: "r", type: "resistor-220", x: 320, y: 320, rotation: 90 }],
      wires: [],
    };
    expect(pinAt(rotated, { x: 320 + 4 * PITCH, y: 320 })).toBeNull();
  });
});

describe("drátek pod prstem", () => {
  const c: Circuit = {
    comps: [
      { id: "a", type: "led-red", x: 0, y: 0, rotation: 0 },
      { id: "b", type: "led-red", x: 400, y: 0, rotation: 0 },
    ],
    wires: [{ id: "w", from: { compId: "a", pinName: "anode" }, to: { compId: "b", pinName: "anode" } }],
  };

  it("klepnutí přesně na drátek ho najde", () => {
    const from = resolvePinPosition(c.comps[0]!, "anode")!;
    const to = resolvePinPosition(c.comps[1]!, "anode")!;
    const curve = wireCurve(from.x, from.y, to.x, to.y);
    /* Střed oblouku (t = 0,5) leží přesně na křivce. */
    const onCurve = { x: (curve.x1 + 2 * curve.mx + curve.x2) / 4, y: (curve.y1 + 2 * curve.my + curve.y2) / 4 };
    expect(wireAt(c, onCurve)?.id).toBe("w");
  });

  it("tenhle drátek nezachytí dál než za pár pixelů", () => {
    expect(wireAt(c, { x: 200, y: -200 })).toBeNull();
  });

  it("vzdálenost od oblouku je nula přímo na něm", () => {
    const curve = wireCurve(0, 0, 100, 0);
    /* Průvěs 14 px, střed oblouku je na y = 7. */
    expect(distanceToWire(curve, { x: 50, y: 7 }, 200)).toBeLessThan(0.5);
  });
});

describe("výřez a zoom", () => {
  it("zoom u kurzoru nechá bod pod kurzorem na místě", () => {
    const view = { zoom: 1, pan: { x: -2000, y: -2000 } };
    const screen = { x: 300, y: 200 };
    const before = screenToPlane(view, screen);
    const next = zoomAt(view, screen, 2);
    const after = screenToPlane(next, screen);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it("vodorovný tah trackpadu nezvětšuje", () => {
    expect(wheelZoomFactor(0, 0)).toBe(1);
  });

  it("řádkový krok kolečka (deltaMode 1) je silnější než pixelový", () => {
    expect(wheelZoomFactor(3, 1)).toBeLessThan(wheelZoomFactor(3, 0));
  });

  it("zoom se nepustí mimo meze", () => {
    const next = zoomAt({ zoom: 1, pan: { x: 0, y: 0 } }, { x: 0, y: 0 }, 99);
    expect(next.zoom).toBeLessThanOrEqual(3);
  });

  it("posun drží aspoň kus obvodu na obrazovce", () => {
    const content = { x: 0, y: 0, w: 200, h: 100 };
    const pan = clampPan({ x: -50000, y: 50000 }, 1, content, { width: 800, height: 600 });
    /* Pravý krajní bod obvodu je aspoň 60 px od levého okraje výřezu. */
    expect(PLANE_OFFSET + pan.x + (content.x + content.w) * 1).toBeGreaterThanOrEqual(60);
    /* Levý krajní bod je aspoň 60 px od pravého okraje. */
    expect(PLANE_OFFSET + pan.x + content.x * 1).toBeLessThanOrEqual(800 - 60);
    expect(PLANE_OFFSET + pan.y + content.y * 1).toBeLessThanOrEqual(600 - 60);
  });

  it("obsah bez součástek nemá obal", () => {
    expect(contentBounds({ comps: [], wires: [] })).toBeNull();
  });

  it("obal obsahu obsahuje kresbu desky, ne jen její piny", () => {
    const b = contentBounds({ comps: [board], wires: [] });
    expect(b?.x).toBe(-22);
    expect(b?.y).toBe(-16);
  });
});
