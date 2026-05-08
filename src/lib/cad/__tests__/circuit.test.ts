import { describe, it, expect } from "vitest";
import { createDefaultCircuit, applyTaskSeed, isCircuitEmpty } from "../circuit";

describe("createDefaultCircuit", () => {
  it("returns Arduino + breadboard, no wires", () => {
    const c = createDefaultCircuit();
    expect(c.comps).toHaveLength(2);
    expect(c.comps.map(co => co.type).sort()).toEqual(["arduino-uno", "breadboard-half"]);
    expect(c.wires).toEqual([]);
  });

  it("each call produces fresh ids", () => {
    const a = createDefaultCircuit();
    const b = createDefaultCircuit();
    expect(a.comps[0].id).not.toBe(b.comps[0].id);
  });
});

describe("applyTaskSeed", () => {
  it("uses task.cad.seed when provided", () => {
    const seed = [{ id: "x", type: "led-red" as const, x: 0, y: 0, rotation: 0 as const }];
    const c = applyTaskSeed({ cad: { palette: ["led-red"], seed } } as never);
    expect(c.comps).toEqual(seed);
  });

  it("falls back to default when task.cad.seed missing", () => {
    const c = applyTaskSeed({ cad: { palette: ["led-red"] } } as never);
    expect(c.comps).toHaveLength(2);
  });

  it("falls back to default when task.cad missing", () => {
    const c = applyTaskSeed({} as never);
    expect(c.comps).toHaveLength(2);
  });
});

describe("isCircuitEmpty", () => {
  it("treats default circuit as empty (only seed comps, no wires)", () => {
    expect(isCircuitEmpty(createDefaultCircuit())).toBe(true);
  });
});
