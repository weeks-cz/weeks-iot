import { describe, expect, it } from "vitest";
import {
  coursePath,
  heroState,
  isCourseDone,
  type LessonStep,
} from "../model";

const SLUGS = [
  "rozsvit-ledku",
  "blikani",
  "tlacitko",
  "semafor",
  "plynuly-jas",
  "zvuk",
  "nocni-svetlo",
];

const published = SLUGS.map((slug, i) => ({
  slug,
  title: `Lekce ${i + 1}`,
  orderIndex: i + 1,
  estimatedMinutes: 15,
}));

const noDraft = () => null;

describe("coursePath", () => {
  it("řadí podle orderIndex, i když vstup přijde neseřazený", () => {
    const path = coursePath([...published].reverse(), new Set());
    expect(path.map((l) => l.slug)).toEqual(SLUGS);
  });

  it("mapuje pole a označí hotové lekce", () => {
    const path = coursePath(published, new Set(["blikani"]));
    expect(path[1]).toEqual({
      slug: "blikani",
      title: "Lekce 2",
      order: 2,
      minutes: 15,
      done: true,
    });
    expect(path[0]?.done).toBe(false);
  });
});

describe("heroState", () => {
  it("bez postupu a konceptů je start na první lekci", () => {
    const s = heroState(coursePath(published, new Set()), noDraft);
    expect(s.kind).toBe("start");
    if (s.kind === "start") expect(s.lesson.slug).toBe("rozsvit-ledku");
  });

  it("po lekcích 1–3 je next na čtvrtou", () => {
    const done = new Set(SLUGS.slice(0, 3));
    const s = heroState(coursePath(published, done), noDraft);
    expect(s.kind).toBe("next");
    if (s.kind === "next") expect(s.lesson.slug).toBe("semafor");
  });

  it("koncept na cílové lekci dává draft s krokem", () => {
    const done = new Set(SLUGS.slice(0, 3));
    const s = heroState(coursePath(published, done), (slug) =>
      slug === "semafor" ? "wiring" : null,
    );
    expect(s.kind).toBe("draft");
    if (s.kind === "draft") {
      expect(s.step).toBe("wiring");
      expect(s.lesson.slug).toBe("semafor");
    }
  });

  it("koncept u jiné než cílové lekce se ignoruje", () => {
    const done = new Set(SLUGS.slice(0, 3));
    const s = heroState(coursePath(published, done), (slug) =>
      slug === "zvuk" ? ("code" as LessonStep) : null,
    );
    expect(s.kind).toBe("next");
  });

  it("koncept v kroku brief se nepočítá", () => {
    const s = heroState(coursePath(published, new Set()), () => "brief");
    expect(s.kind).toBe("start");
  });

  it("koncept bez hotových lekcí je draft, ne start", () => {
    const s = heroState(coursePath(published, new Set()), (slug) =>
      slug === "rozsvit-ledku" ? "code" : null,
    );
    expect(s.kind).toBe("draft");
  });

  it("všech 7 hotových je done", () => {
    const s = heroState(coursePath(published, new Set(SLUGS)), noDraft);
    expect(s).toEqual({ kind: "done" });
  });

  it("přidaná 8. publikovaná lekce po dokončení všech 7 dává next", () => {
    const eight = [
      ...published,
      { slug: "osma", title: "Lekce 8", orderIndex: 8, estimatedMinutes: null },
    ];
    const s = heroState(coursePath(eight, new Set(SLUGS)), noDraft);
    expect(s.kind).toBe("next");
    if (s.kind === "next") {
      expect(s.lesson.slug).toBe("osma");
      expect(s.lesson.minutes).toBeNull();
    }
  });
});

describe("isCourseDone", () => {
  it("prázdný kurz není hotový", () => {
    expect(isCourseDone([], new Set(SLUGS))).toBe(false);
  });

  it("hotový je, jen když jsou hotové všechny publikované", () => {
    expect(isCourseDone(SLUGS, new Set(SLUGS))).toBe(true);
    expect(isCourseDone(SLUGS, new Set(SLUGS.slice(1)))).toBe(false);
  });
});
