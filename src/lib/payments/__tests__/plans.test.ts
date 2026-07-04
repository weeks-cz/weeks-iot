import { describe, it, expect } from "vitest";
import { PLANS, isPlanPeriod, computeNewExpiry, hasPremium } from "@/lib/payments/plans";

const NOW = new Date("2026-07-04T10:00:00Z");

describe("PLANS", () => {
  it("drží schválené ceny", () => {
    expect(PLANS.monthly.priceKc).toBe(79);
    expect(PLANS.yearly.priceKc).toBe(699);
  });
});

describe("isPlanPeriod", () => {
  it("propustí jen monthly/yearly", () => {
    expect(isPlanPeriod("monthly")).toBe(true);
    expect(isPlanPeriod("yearly")).toBe(true);
    expect(isPlanPeriod("weekly")).toBe(false);
    expect(isPlanPeriod(null)).toBe(false);
  });
});

describe("computeNewExpiry", () => {
  it("bez existující expirace počítá od teď", () => {
    expect(computeNewExpiry(null, "monthly", NOW)).toBe("2026-08-04T10:00:00.000Z");
  });
  it("aktivní předplatné prodlužuje od jeho konce", () => {
    expect(computeNewExpiry("2026-07-20T00:00:00.000Z", "yearly", NOW))
      .toBe("2027-07-21T00:00:00.000Z");
  });
  it("prošlé předplatné počítá od teď", () => {
    expect(computeNewExpiry("2026-01-01T00:00:00.000Z", "monthly", NOW))
      .toBe("2026-08-04T10:00:00.000Z");
  });
});

describe("hasPremium", () => {
  it("student s budoucí expirací = premium", () => {
    expect(hasPremium("student", "2026-12-01T00:00:00Z", NOW)).toBe(true);
  });
  it("student s prošlou expirací = ne", () => {
    expect(hasPremium("student", "2026-01-01T00:00:00Z", NOW)).toBe(false);
  });
  it("student bez expirace = premium (neomezené, např. ručně nastavené)", () => {
    expect(hasPremium("student", null, NOW)).toBe(true);
  });
  it("free / undefined = ne", () => {
    expect(hasPremium("free", null, NOW)).toBe(false);
    expect(hasPremium(undefined, undefined, NOW)).toBe(false);
  });
});
