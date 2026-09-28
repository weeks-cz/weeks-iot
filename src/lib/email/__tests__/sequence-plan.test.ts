import { describe, expect, it } from "vitest";
import { planSequence } from "../sequence";

const none = new Set<string>();

describe("planSequence", () => {
  it("čerstvý účet dostane uvítání", () => {
    expect(planSequence(0.1, none)).toEqual({ send: "welcome", missed: [] });
  });

  it("za jeden běh pošle nejvýš jeden krok", () => {
    // Den 2 a nic neodešlo (cron dva dny neběžel): uvítání je pořád
    // v toleranci. Připomenutí ještě není na řadě, takže jde jen uvítání.
    expect(planSequence(2, none)).toEqual({ send: "welcome", missed: [] });
    // Den 3,5: uvítání už je prošvihnuté, připomenutí je na řadě — jeden e-mail.
    expect(planSequence(3.5, none)).toEqual({ send: "nudge", missed: ["welcome"] });
  });

  it("krok zpožděný o víc než 2 dny se neposílá, jen označí", () => {
    const plan = planSequence(10, none);
    expect(plan.send).toBeNull();
    expect(plan.missed).toEqual(["welcome", "nudge", "camp"]);
  });

  it("po delším výpadku pošle jen krok, který je ještě v toleranci", () => {
    const plan = planSequence(8, none);
    expect(plan.send).toBe("camp");
    expect(plan.missed).toEqual(["welcome", "nudge"]);
  });

  it("odeslané kroky přeskočí", () => {
    expect(planSequence(3.2, new Set(["welcome"]))).toEqual({ send: "nudge", missed: [] });
  });

  it("krok, který ještě není na řadě, nechá být", () => {
    expect(planSequence(1, new Set(["welcome"]))).toEqual({ send: null, missed: [] });
  });

  it("hranice tolerance: přesně 2 dny zpoždění se ještě posílá", () => {
    expect(planSequence(5, new Set(["welcome"]))).toEqual({ send: "nudge", missed: [] });
  });
});
