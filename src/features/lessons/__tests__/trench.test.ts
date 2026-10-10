import { describe, expect, it } from "vitest";
import { PITCH } from "@/features/circuit/constants";
import { getComponentSpec } from "@/features/circuit/components";
import { holeMap, occupiedSockets, placementConflicts, pluggedLegs } from "@/features/circuit/occupancy";
import { resolvePinPosition } from "@/features/circuit/pins";
import { checkWiring } from "@/features/circuit/wiring-check";
import type { Circuit, CircuitComponent } from "@/features/circuit/types";
import { COURSE_LESSONS, lesson3 } from "../content";
import { placeOnBoard } from "../board-plan";
import { applyStep } from "../apply-step";
import { referenceCircuit } from "../reference-circuit";
import { lessonSeedCircuit } from "../seed-circuit";
import { wiringSteps } from "../wiring-steps";

/**
 * Tlačítko přes prostřední drážku a pravidlo „jedna věc v dírce".
 *
 * Zapoj za mě je nejčastější způsob, jak se dítě dostane přes lekci, když
 * se zasekne. Kdyby tiše zapichovalo do obsazené dírky, zkrat by vypadal
 * jako správné zapojení — a kontrola by ho dokonce pustila.
 */

function board(circuit: Circuit): CircuitComponent {
  const b = circuit.comps.find((c) => c.type === "breadboard-half");
  if (!b) throw new Error("bez desky");
  return b;
}

/** Počet věcí v každé dírce a pinu Arduina. Víc než jedna je zkrat. */
function duplicates(circuit: Circuit): string[] {
  const count = new Map<string, number>();
  const bump = (key: string) => count.set(key, (count.get(key) ?? 0) + 1);

  for (const pl of pluggedLegs(circuit)) bump(`${pl.hole.compId}#${pl.hole.pinName}`);
  for (const wire of circuit.wires) {
    for (const end of [wire.from, wire.to]) {
      const comp = circuit.comps.find((c) => c.id === end.compId);
      if (comp?.type === "breadboard-half" || comp?.type === "arduino-uno") {
        bump(`${end.compId}#${end.pinName}`);
      }
    }
  }
  return [...count.entries()].filter(([, n]) => n > 1).map(([k]) => k);
}

describe("tlačítko přes prostřední drážku", () => {
  it("položí se tak, že každá strana má nožičku v horní i dolní půlce", () => {
    const empty: Circuit = { comps: [{ id: "bb", type: "breadboard-half", x: 0, y: 0, rotation: 0 }], wires: [] };
    const at = placeOnBoard(empty, board(empty), "pushbutton");
    expect(at).not.toBeNull();

    const btn: CircuitComponent = { id: "btn", type: "pushbutton", x: at!.x, y: at!.y, rotation: 0 };
    const withBtn: Circuit = { comps: [...empty.comps, btn], wires: [] };
    const legs = pluggedLegs(withBtn).filter((pl) => pl.leg.compId === "btn");

    expect(legs).toHaveLength(4);
    const row = (name: string) => /^row-([A-J])-/.exec(name)?.[1] ?? "";
    const halfOf = (name: string) => (["A", "B", "C", "D", "E"].includes(row(name)) ? "top" : "bottom");
    const halves = Object.fromEntries(legs.map((pl) => [pl.leg.pinName, halfOf(pl.hole.pinName)]));
    expect(halves["1a"]).toBe("top");
    expect(halves["1b"]).toBe("bottom");
    expect(halves["2a"]).toBe("top");
    expect(halves["2b"]).toBe("bottom");
  });

  it("obě strany sedí ve dvou různých sloupcích", () => {
    const empty: Circuit = { comps: [{ id: "bb", type: "breadboard-half", x: 0, y: 0, rotation: 0 }], wires: [] };
    const at = placeOnBoard(empty, board(empty), "pushbutton")!;
    const btn: CircuitComponent = { id: "btn", type: "pushbutton", x: at.x, y: at.y, rotation: 0 };
    const legs = pluggedLegs({ comps: [...empty.comps, btn], wires: [] });
    const col = (pin: string) => legs.find((pl) => pl.leg.pinName === pin)!.hole.pinName.split("-")[2]!;
    expect(col("1a")).toBe(col("1b"));
    expect(col("2a")).toBe(col("2b"));
    expect(col("1a")).not.toBe(col("2a"));
  });

  it("zapíchnuté tlačítko nemá zkrat přes příkop", () => {
    const empty: Circuit = { comps: [{ id: "bb", type: "breadboard-half", x: 0, y: 0, rotation: 0 }], wires: [] };
    const at = placeOnBoard(empty, board(empty), "pushbutton")!;
    const btn: CircuitComponent = { id: "btn", type: "pushbutton", x: at.x, y: at.y, rotation: 0 };
    expect(placementConflicts({ comps: [...empty.comps], wires: [] }, btn)).toBe(false);
  });

  it("zadání přijme kteroukoli nožičku strany, ne jen tu přesnou", () => {
    /* Vzorové zapojení s D7 na 1b a GND na 2b: stejné spoje, jen jiné nožičky
       téže strany. Kontrola je musí přijmout. */
    const circuit = referenceCircuit(lesson3.wiring);
    const alt: Circuit = {
      comps: circuit.comps,
      wires: circuit.wires.map((w) => {
        if (w.to.pinName === "1a") return { ...w, to: { ...w.to, pinName: "1b" } };
        if (w.from.pinName === "2a") return { ...w, from: { ...w.from, pinName: "2b" } };
        return w;
      }),
    };
    expect(checkWiring(alt, lesson3.wiring).ok).toBe(true);
  });

  it("otočené tlačítko na jedné polovině desky dostane varování, ne tichý zkrat", () => {
    /* Na horní polovině: otočené 90° má obě strany ve stejném sloupci. */
    const seed = lessonSeedCircuit(lesson3);
    const uno = seed.comps.find((c) => c.type === "arduino-uno")!;
    const bb = board(seed);
    const btn: CircuitComponent = {
      id: "btn",
      type: "pushbutton",
      x: bb.x,
      y: bb.y + 2 * PITCH,
      rotation: 90,
    };
    /* Kontrola přiřazuje role jen tehdy, když jsou na ploše všechny díly
       zadání — bez LED a rezistoru by varování nemělo kde vzniknout. */
    const circuit: Circuit = {
      comps: [
        ...seed.comps,
        { id: "led", type: "led-red", x: 600, y: 0, rotation: 0 },
        { id: "r", type: "resistor-220", x: 400, y: 0, rotation: 0 },
        btn,
      ],
      wires: [],
    };
    const steps = wiringSteps(circuit, lesson3.wiring);
    const warned = steps.some((s) => s.warning?.includes("Tlačítko je otočené špatně"));
    expect(warned).toBe(true);
    expect(uno).toBeDefined();
  });
});

describe("Zapoj za mě", () => {
  it.each(COURSE_LESSONS.map((l) => [l.slug, l] as const))(
    "lekce %s: žádná dírka ani pin Arduina nedostane dvě věci",
    (_slug, lesson) => {
      let circuit = lessonSeedCircuit(lesson);
      for (let i = 0; i < 60; i++) {
        const next = wiringSteps(circuit, lesson.wiring).find((s) => !s.done);
        if (!next) break;
        circuit = applyStep(circuit, next);
        expect(duplicates(circuit)).toEqual([]);
      }
    },
  );

  it("nikdy nepoloží součástku na obsazenou dírku", () => {
    let circuit = lessonSeedCircuit(lesson3);
    for (let i = 0; i < 60; i++) {
      const next = wiringSteps(circuit, lesson3.wiring).find((s) => !s.done);
      if (!next) break;
      circuit = applyStep(circuit, next);
    }
    for (const comp of circuit.comps) {
      expect(placementConflicts(circuit, comp), comp.type).toBe(false);
    }
  });

  it("obsazenost sčítá nožičky i konce drátků", () => {
    const seed = lessonSeedCircuit(lesson3);
    const bb = board(seed);
    const wired: Circuit = {
      comps: seed.comps,
      wires: [{ id: "w", from: { compId: bb.id, pinName: "row-A-1" }, to: { compId: bb.id, pinName: "row-A-2" } }],
    };
    expect(occupiedSockets(wired).has(`${bb.id}#row-A-1`)).toBe(true);
    expect(holeMap(wired).size).toBeGreaterThan(0);
  });
});

describe("referenční zapojení lekcí", () => {
  it.each(COURSE_LESSONS.map((l) => [l.slug, l] as const))(
    "lekce %s: žádný pin Arduina není na dvou drátcích",
    (_slug, lesson) => {
      const circuit = referenceCircuit(lesson.wiring);
      const seen = new Map<string, number>();
      for (const wire of circuit.wires) {
        for (const end of [wire.from, wire.to]) {
          const comp = circuit.comps.find((c) => c.id === end.compId);
          if (comp?.type !== "arduino-uno") continue;
          const key = `${end.compId}#${end.pinName}`;
          seen.set(key, (seen.get(key) ?? 0) + 1);
        }
      }
      const doubled = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
      expect(doubled).toEqual([]);
    },
  );

  it("spec tlačítka mluví jen o nožičkách, které na součástce jsou", () => {
    const pins = getComponentSpec("pushbutton").pins.map((p) => p.name).sort();
    expect(pins).toEqual(["1a", "1b", "2a", "2b"]);
    const btn: CircuitComponent = { id: "btn", type: "pushbutton", x: 0, y: 0, rotation: 0 };
    expect(resolvePinPosition(btn, "2b")).toEqual({ x: 2 * PITCH, y: 2 * PITCH });
  });
});
