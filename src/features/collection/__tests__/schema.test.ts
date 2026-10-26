import { describe, expect, it } from "vitest";
import { lesson7 } from "@/features/lessons/content";
import { referenceCircuit } from "@/features/lessons/reference-circuit";
import { COMPONENT_REGISTRY } from "@/features/circuit/components";
import { lessonBuildSchema } from "../schema";

const circuit = referenceCircuit(lesson7.wiring);
const valid = {
  courseSlug: "elektronika-a-iot",
  lessonSlug: "nocni-svetlo",
  circuit,
  code: lesson7.solution,
  mode: "code" as const,
};

describe("lessonBuildSchema", () => {
  it("přijme referenční obvod a řešení lekce 7", () => {
    expect(lessonBuildSchema.safeParse(valid).success).toBe(true);
  });

  it("přijme režim bloků s blokovým řešením", () => {
    const r = lessonBuildSchema.safeParse({
      ...valid,
      mode: "blocks",
      blocks: lesson7.blocks.solution,
    });
    expect(r.success).toBe(true);
  });

  it("odmítne 81 součástek", () => {
    const comp = circuit.comps[0];
    const comps = Array.from({ length: 81 }, (_, i) => ({ ...comp, id: `c${i}` }));
    expect(lessonBuildSchema.safeParse({ ...valid, circuit: { ...circuit, comps } }).success).toBe(
      false,
    );
  });

  it("odmítne kód o 20 001 znacích a přijme 20 000", () => {
    expect(lessonBuildSchema.safeParse({ ...valid, code: "a".repeat(20_001) }).success).toBe(false);
    expect(lessonBuildSchema.safeParse({ ...valid, code: "a".repeat(20_000) }).success).toBe(true);
  });

  it("odmítne slug s velkými písmeny", () => {
    expect(lessonBuildSchema.safeParse({ ...valid, lessonSlug: "Nocni-svetlo" }).success).toBe(
      false,
    );
    expect(lessonBuildSchema.safeParse({ ...valid, courseSlug: "Elektronika" }).success).toBe(false);
  });

  it("odmítne obvod bez drátů", () => {
    expect(
      lessonBuildSchema.safeParse({ ...valid, circuit: { comps: circuit.comps } }).success,
    ).toBe(false);
  });

  it("odmítne výtvor přes 100 kB", () => {
    const blocks = {
      blocks: {
        languageVersion: 0,
        blocks: Array.from({ length: 200 }, () => ({ type: "x", pad: "a".repeat(600) })),
      },
    };
    expect(lessonBuildSchema.safeParse({ ...valid, mode: "blocks", blocks }).success).toBe(false);
  });

  it("přijme každý typ součástky z registru", () => {
    for (const type of Object.keys(COMPONENT_REGISTRY)) {
      const comps = [{ id: "c", type, x: 0, y: 0, rotation: 0 }];
      const r = lessonBuildSchema.safeParse({ ...valid, circuit: { comps, wires: [] } });
      expect(r.success, type).toBe(true);
    }
  });
});
