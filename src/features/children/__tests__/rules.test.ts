import { describe, expect, it } from "vitest";
import { childCreationRule } from "../rules";

const NOW = new Date("2026-10-11T12:00:00Z");

describe("childCreationRule", () => {
  it("zákonný zástupce založí dítě do 15 let, ale souhlas je nutný", () => {
    expect(childCreationRule("guardian", "2016-05-01", NOW)).toEqual({
      allowed: true,
      needsParentalConsent: true,
    });
  });

  it("účet spravovaný sám nesmí založit profil pod 15 let", () => {
    expect(childCreationRule("self", "2016-05-01", NOW)).toEqual({
      allowed: false,
      reason: "self-managed-under-15",
    });
  });

  it("účet spravovaný sám smí založit profil od 15 let, souhlas za něj nedává rodič", () => {
    expect(childCreationRule("self", "2000-01-01", NOW)).toEqual({
      allowed: true,
      needsParentalConsent: false,
    });
  });

  it("zákonný zástupce s dítětem od 15 let nepotřebuje souhlas zástupce", () => {
    expect(childCreationRule("guardian", "2000-01-01", NOW)).toEqual({
      allowed: true,
      needsParentalConsent: false,
    });
  });

  it("den před patnáctými narozeninami je ještě pod hranicí", () => {
    // 2011-10-12 → 15 let přesně 2026-10-12, dnes je 2026-10-11
    expect(childCreationRule("self", "2011-10-12", NOW).allowed).toBe(false);
    expect(childCreationRule("self", "2011-10-11", NOW).allowed).toBe(true);
  });

  it("neznámý typ účtu se chová jako rodičovský", () => {
    expect(childCreationRule(null, "2016-05-01", NOW)).toEqual({
      allowed: true,
      needsParentalConsent: true,
    });
  });
});
