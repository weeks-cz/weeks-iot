import { describe, it, expect } from "vitest";
import { COURSE_LESSONS, lesson4 } from "../content";
import { waitingLine } from "@/features/lobby/copy";

describe("texty oslavy", () => {
  it.each(COURSE_LESSONS.map((l) => [l.slug, l] as const))("%s má dovětek a větu", (_s, l) => {
    expect(l.celebrate.title.length).toBeGreaterThanOrEqual(2);
    expect(l.celebrate.title.length).toBeLessThanOrEqual(20);
    expect(l.celebrate.title).toMatch(/[.!]$/);
    expect(l.celebrate.line.length).toBeGreaterThanOrEqual(10);
    expect(l.celebrate.line.length).toBeLessThanOrEqual(120);
  });
});

describe("waitingLine", () => {
  it("bere výchozí text", () => {
    expect(waitingLine(lesson4, "wiring")).toBe("čeká na dráty.");
    expect(waitingLine(lesson4, "next")).toBe("je na řadě.");
  });
  it("vlastní text lekce má přednost", () => {
    const l = { ...lesson4, waiting: { code: "čeká na zvuk." } };
    expect(waitingLine(l, "code")).toBe("čeká na zvuk.");
    expect(waitingLine(l, "wiring")).toBe("čeká na dráty.");
  });
});
