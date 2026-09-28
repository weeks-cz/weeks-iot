import { describe, expect, it } from "vitest";
import { certificateStep, earnedCertificate } from "../eligibility";
import { CERTIFICATES } from "../content";
import { COURSE_LESSONS } from "@/features/lessons/content";

const lessons = [
  { id: "l1", slug: "a" },
  { id: "l2", slug: "b" },
  { id: "l3", slug: "c" },
];

describe("earnedCertificate", () => {
  it("bez všech lekcí certifikát není", () => {
    expect(
      earnedCertificate(lessons, [
        { lessonId: "l1", completedAt: "2026-09-01T10:00:00Z" },
        { lessonId: "l3", completedAt: "2026-09-03T10:00:00Z" },
      ]),
    ).toBeNull();
  });

  it("všechny lekce hotové: datum je poslední dokončení, ne pořadí lekcí", () => {
    expect(
      earnedCertificate(lessons, [
        { lessonId: "l3", completedAt: "2026-09-02T10:00:00Z" },
        { lessonId: "l1", completedAt: "2026-09-01T10:00:00Z" },
        { lessonId: "l2", completedAt: "2026-09-05T08:00:00Z" },
      ]),
    ).toEqual({ completedAt: "2026-09-05T08:00:00Z" });
  });

  it("kurz bez publikovaných lekcí certifikát nedává", () => {
    expect(earnedCertificate([], [])).toBeNull();
  });

  it("dokončení lekce, která už v kurzu není, nic nenahradí", () => {
    expect(
      earnedCertificate(lessons, [
        { lessonId: "l1", completedAt: "2026-09-01T10:00:00Z" },
        { lessonId: "l2", completedAt: "2026-09-01T10:00:00Z" },
        { lessonId: "stara", completedAt: "2026-09-01T10:00:00Z" },
      ]),
    ).toBeNull();
  });
});

describe("certificateStep", () => {
  it("klíč je po dítěti i kurzu — sourozenci dostanou každý svůj", () => {
    expect(certificateStep("iot", "child-1")).toBe("certificate:iot:child-1");
    expect(certificateStep("iot", "child-1")).not.toBe(certificateStep("iot", "child-2"));
  });
});

describe("obsah certifikátu", () => {
  it("projekt je poslední lekce kurzu a dovednosti jsou 3–4", () => {
    const iot = CERTIFICATES.iot!;
    const last = [...COURSE_LESSONS].sort((a, b) => b.order - a.order)[0]!;
    expect(iot.projectLessonSlug).toBe(last.slug);
    expect(iot.skills.length).toBeGreaterThanOrEqual(3);
    expect(iot.skills.length).toBeLessThanOrEqual(4);
  });
});
