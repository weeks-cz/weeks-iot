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
  it("výchozí code je „čeká na program.“", () => {
    expect(waitingLine(lesson4, "code")).toBe("čeká na program.");
  });
  it("věty v lobby navazují na názvy všech lekcí", () => {
    const out = COURSE_LESSONS.flatMap((l) =>
      (["next", "wiring", "code"] as const).map((k) => `${l.title} ${waitingLine(l, k)}`),
    );
    expect(out).toMatchInlineSnapshot(`
      [
        "Rozsviť LEDku — začneme tady.",
        "Rozsviť LEDku — dráty čekají.",
        "Rozsviť LEDku — chybí už jen program.",
        "Blikání je na řadě.",
        "Blikání čeká na dráty.",
        "Blikání čeká na program.",
        "Tlačítko je na řadě.",
        "Tlačítko čeká na dráty.",
        "Tlačítko čeká na program.",
        "Semafor je na řadě.",
        "Semafor čeká na dráty.",
        "Semafor čeká na program.",
        "Plynulý jas je na řadě.",
        "Plynulý jas čeká na dráty.",
        "Plynulý jas čeká na program.",
        "Zvuk na stisk je na řadě.",
        "Zvuk na stisk čeká na dráty.",
        "Zvuk na stisk čeká na program.",
        "Noční světlo je na řadě.",
        "Noční světlo čeká na dráty.",
        "Noční světlo čeká na program.",
      ]
    `);
  });
});
