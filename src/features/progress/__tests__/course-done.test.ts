import { describe, expect, it } from "vitest";
import { celebrationAfter, lessonsDoneAfter, type DoneAfterInput } from "../course-done";

const SLUGS = ["l1", "l2", "l3", "l4", "l5", "l6", "l7"];

/** Finále, nebo malá oslava — přesně to, co `LessonRunner` skládá. */
function celebration(input: DoneAfterInput): "finale" | "lesson" {
  return celebrationAfter(SLUGS, lessonsDoneAfter(input));
}

describe("lessonsDoneAfter", () => {
  it("dítě s lekcemi jen v prohlížeči dostane malou oslavu", () => {
    // Sourozenec dokončil l1–l6 na stejném notebooku; tohle dítě má na serveru nic.
    const input = {
      completedSlugs: [],
      sessionDoneSlugs: SLUGS.slice(0, 6),
      lessonSlug: "l7",
      profileBacked: true,
    };
    expect(celebration(input)).toBe("lesson");
    expect([...lessonsDoneAfter(input)]).toEqual(["l7"]);
  });

  it("dítě se vším na serveru dostane finále", () => {
    expect(
      celebration({
        completedSlugs: SLUGS.slice(0, 6),
        sessionDoneSlugs: [],
        lessonSlug: "l7",
        profileBacked: true,
      }),
    ).toBe("finale");
  });

  it("anonym se vším v relaci dostane finále", () => {
    expect(
      celebration({
        completedSlugs: [],
        sessionDoneSlugs: SLUGS.slice(0, 6),
        lessonSlug: "l7",
        profileBacked: false,
      }),
    ).toBe("finale");
  });

  it("rodič bez profilu počítá relaci jako dřív", () => {
    expect(
      lessonsDoneAfter({
        completedSlugs: [],
        sessionDoneSlugs: ["l1", "l2"],
        lessonSlug: "l3",
        profileBacked: false,
      }),
    ).toEqual(new Set(["l1", "l2", "l3"]));
  });

  it("poslední lekce, když ostatní chybí, je malá oslava", () => {
    expect(
      celebration({
        completedSlugs: ["l1", "l2"],
        sessionDoneSlugs: ["l3"],
        lessonSlug: "l7",
        profileBacked: false,
      }),
    ).toBe("lesson");
    expect(
      celebration({
        completedSlugs: ["l1", "l2"],
        sessionDoneSlugs: [],
        lessonSlug: "l7",
        profileBacked: true,
      }),
    ).toBe("lesson");
  });
});
