import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeLessonBuild } from "../write";
import type { LessonBuild } from "../schema";

/* Falešný servisní klient. Každý dotaz je řetězec, který končí buď
   `maybeSingle()` (course, lesson), nebo je sám thenable (update…select). */
const state = {
  updatedRows: [] as { id: string }[],
  update: vi.fn(),
  insert: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from(table: string) {
      if (table === "courses") {
        return chain({ maybeSingle: async () => ({ data: { id: "course-1" } }) });
      }
      if (table === "lessons") {
        return chain({
          maybeSingle: async () => ({ data: { id: "lesson-1", title: "Noční světlo" } }),
        });
      }
      return {
        update(values: unknown) {
          state.update(values);
          const q = chain({ select: async () => ({ data: state.updatedRows, error: null }) });
          return q;
        },
        insert: async (values: unknown) => {
          state.insert(values);
          return { error: null };
        },
      };
    },
  }),
}));

function chain(terminal: Record<string, unknown>) {
  const q: Record<string, unknown> = { ...terminal };
  for (const m of ["select", "eq"]) {
    if (!(m in terminal)) q[m] = () => q;
  }
  return q;
}

const build: LessonBuild = {
  courseSlug: "elektronika-a-iot",
  lessonSlug: "nocni-svetlo",
  circuit: { comps: [], wires: [] },
  code: "void setup() {}",
  mode: "code",
};

beforeEach(() => {
  state.updatedRows = [];
  state.update.mockClear();
  state.insert.mockClear();
});

describe("writeLessonBuild", () => {
  it("existující řádek aktualizuje a nevkládá nový", async () => {
    state.updatedRows = [{ id: "p1" }];
    expect(await writeLessonBuild("child-1", build)).toBe(true);
    expect(state.update).toHaveBeenCalledTimes(1);
    expect(state.insert).not.toHaveBeenCalled();
  });

  it("bez existujícího řádku vloží nový s kind circuit a názvem lekce", async () => {
    expect(await writeLessonBuild("child-1", build)).toBe(true);
    expect(state.insert).toHaveBeenCalledWith({
      child_id: "child-1",
      lesson_id: "lesson-1",
      kind: "circuit",
      title: "Noční světlo",
      data: { v: 1, circuit: build.circuit, code: build.code, mode: "code" },
    });
  });
});
