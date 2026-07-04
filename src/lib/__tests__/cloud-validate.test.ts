import { describe, it, expect } from "vitest";
import { sanitizeCloudState } from "@/lib/cloud-validate";

const validAccount = {
  avatarId: "fox", stars: 5, tokens: 2,
  unlockedThemes: ["classic"], unlockedAvatars: ["fox"],
  currentTheme: "classic", dailyChallengeDate: null, levelBadges: [],
};
const valid = {
  account: validAccount,
  tasks: { "task-1": { status: "done" } },
  sections: { beginner: { unlocked: true } },
  circuits: {},
  codeDrafts: { "task-1": "print(1)" },
};

describe("sanitizeCloudState", () => {
  it("propustí validní stav beze změny", () => {
    expect(sanitizeCloudState(valid)).toEqual(valid);
  });
  it("vrátí null pro ne-objekty", () => {
    expect(sanitizeCloudState(null)).toBeNull();
    expect(sanitizeCloudState("x")).toBeNull();
    expect(sanitizeCloudState([1])).toBeNull();
  });
  it("vrátí null když chybí/nesedí account.stars", () => {
    expect(sanitizeCloudState({ ...valid, account: { ...validAccount, stars: "hodně" } })).toBeNull();
    expect(sanitizeCloudState({ ...valid, account: null })).toBeNull();
  });
  it("vrátí null když tasks/sections nejsou objekty", () => {
    expect(sanitizeCloudState({ ...valid, tasks: 7 })).toBeNull();
    expect(sanitizeCloudState({ ...valid, sections: "no" })).toBeNull();
  });
  it("nahradí nevalidní volitelná pole prázdnými objekty", () => {
    const out = sanitizeCloudState({ ...valid, circuits: "corrupt", codeDrafts: 42 });
    expect(out).not.toBeNull();
    expect(out!.circuits).toEqual({});
    expect(out!.codeDrafts).toEqual({});
  });
  it("ořízne neznámé klíče na root úrovni", () => {
    const out = sanitizeCloudState({ ...valid, __proto__pollution: { hack: 1 }, extra: 1 });
    expect(out).toEqual(valid);
  });
});
