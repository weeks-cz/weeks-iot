import { describe, expect, it } from "vitest";
import { nextUnfinishedLesson, nudgeEmail, planSequence } from "../sequence";

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

describe("nextUnfinishedLesson", () => {
  const lessons = [
    { id: "a", slug: "rozsvit-ledku", orderIndex: 1 },
    { id: "b", slug: "blikani", orderIndex: 2 },
    { id: "c", slug: "tlacitko", orderIndex: 3 },
  ];

  it("bez postupu je první lekce", () => {
    expect(nextUnfinishedLesson(lessons, new Set())?.slug).toBe("rozsvit-ledku");
  });

  it("jde na první nedokončenou, ne za poslední dokončenou", () => {
    // Lekce 2 přeskočená, lekce 1 hotová: vrací se k lekci 2.
    expect(nextUnfinishedLesson(lessons, new Set(["a"]))?.slug).toBe("blikani");
    expect(nextUnfinishedLesson(lessons, new Set(["a", "c"]))?.slug).toBe("blikani");
  });

  it("řadí podle orderIndex, ne podle pořadí v poli", () => {
    const shuffled = [
      { id: "c", slug: "tlacitko", orderIndex: 3 },
      { id: "a", slug: "rozsvit-ledku", orderIndex: 1 },
      { id: "b", slug: "blikani", orderIndex: 2 },
    ];
    expect(nextUnfinishedLesson(shuffled, new Set(["a"]))?.slug).toBe("blikani");
  });

  it("když je hotovo všechno, vrací null", () => {
    expect(nextUnfinishedLesson(lessons, new Set(["a", "b", "c"]))).toBeNull();
  });
});

describe("nudgeEmail odkaz", () => {
  const base = { nick: "Tomáš", formal: false, inCatchment: false };

  it("pokračování vede na první nedokončenou lekci", () => {
    const t = nudgeEmail({ ...base, startedLearning: true, nextLessonSlug: "tlacitko" });
    expect(t.content.button?.url).toContain("/kurz/iot/tlacitko/?");
    expect(t.content.button?.label).toBe("Pokračovat");
  });

  it("kurz hotový → odkaz na kurz, ne na lekci 1", () => {
    const t = nudgeEmail({ ...base, startedLearning: true, nextLessonSlug: null });
    expect(t.content.button?.url).toMatch(/\/kurz\/iot\/\?/);
    expect(t.content.button?.url).not.toContain("rozsvit-ledku");
  });

  it("bez postupu se zve na první lekci", () => {
    const t = nudgeEmail({ ...base, startedLearning: false, nextLessonSlug: null });
    expect(t.content.button?.url).toContain("/kurz/iot/rozsvit-ledku/?");
  });
});
