import { describe, expect, it } from "vitest";
import type { Circuit } from "@/features/circuit/types";
import type { PathLesson } from "@/features/lobby/model";
import { collectionItems, type SavedBuild } from "../queries";

const circuit = (id: string): Circuit => ({ comps: [], wires: [], id } as unknown as Circuit);

const lesson = (slug: string, order: number, done: boolean): PathLesson => ({
  slug,
  title: `Lekce ${slug}`,
  order,
  minutes: null,
  done,
});

const build = (slug: string): SavedBuild => ({
  lessonSlug: slug,
  title: slug,
  updatedAt: "2026-10-01T10:00:00Z",
  data: { courseSlug: "iot", lessonSlug: slug, circuit: circuit(slug), code: "", mode: "code" },
});

const ref = (slug: string) => circuit(`ref-${slug}`);

describe("collectionItems", () => {
  const path = [lesson("a", 1, true), lesson("b", 2, true), lesson("c", 3, true), lesson("d", 4, false)];

  it("3 hotové, 1 s výtvorem → 3 položky, 2 ze vzoru", () => {
    const items = collectionItems(path, new Map([["b", build("b")]]), ref);
    expect(items.map((i) => i.slug)).toEqual(["a", "b", "c"]);
    expect(items.filter((i) => i.reference)).toHaveLength(2);
    const own = items.find((i) => i.slug === "b")!;
    expect(own.reference).toBe(false);
    expect(own.updatedAt).toBe("2026-10-01T10:00:00Z");
    expect(items[0]?.updatedAt).toBeNull();
  });

  it("výtvor k nehotové nebo nepublikované lekci se nevrátí", () => {
    const items = collectionItems(
      path,
      new Map([["d", build("d")], ["zrusena", build("zrusena")]]),
      ref,
    );
    expect(items.map((i) => i.slug)).toEqual(["a", "b", "c"]);
  });

  it("hotová lekce bez výtvoru i bez vzoru se vynechá", () => {
    expect(collectionItems(path, new Map(), (s) => (s === "b" ? null : ref(s))).map((i) => i.slug))
      .toEqual(["a", "c"]);
  });
});
