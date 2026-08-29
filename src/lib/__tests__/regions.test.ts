import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAMP_CATCHMENT,
  REGION_CODES,
  isRegionCode,
  regionOptions,
  segmentForRegion,
} from "../regions";

describe("číselník krajů", () => {
  it("obsahuje všech 14 krajů", () => {
    expect(REGION_CODES).toHaveLength(14);
  });

  it("nemá duplicitní kódy", () => {
    expect(new Set(REGION_CODES).size).toBe(REGION_CODES.length);
  });

  it("pozná platný kód", () => {
    expect(isRegionCode("CZ-PR")).toBe(true);
    expect(isRegionCode("CZ-MO")).toBe(true);
  });

  it("odmítne neplatný vstup", () => {
    expect(isRegionCode("CZ-XX")).toBe(false);
    expect(isRegionCode("praha")).toBe(false);
    expect(isRegionCode("")).toBe(false);
    expect(isRegionCode(null)).toBe(false);
    expect(isRegionCode(undefined)).toBe(false);
    expect(isRegionCode(42)).toBe(false);
  });
});

describe("segmentForRegion", () => {
  it("vrací camp pro všechny tři spádové kraje", () => {
    expect(segmentForRegion("CZ-PR")).toBe("camp");
    expect(segmentForRegion("CZ-ST")).toBe("camp");
    expect(segmentForRegion("CZ-KA")).toBe("camp");
  });

  it("vrací waitlist pro zbytek republiky", () => {
    const rest = REGION_CODES.filter((c) => !DEFAULT_CAMP_CATCHMENT.includes(c));
    expect(rest).toHaveLength(11);
    for (const code of rest) {
      expect(segmentForRegion(code)).toBe("waitlist");
    }
  });

  it("bez kraje padá na waitlist, ne na camp", () => {
    // Raději nabídneme čekačku někomu ze spádu než kartu termínu někomu,
    // kdo na tábor nemá jak dojet.
    expect(segmentForRegion(null)).toBe("waitlist");
    expect(segmentForRegion(undefined)).toBe("waitlist");
  });

  it("respektuje spád předaný z databáze místo výchozího", () => {
    // Až se spád zúží nebo rozšíří, mění se řádek v DB, ne kód.
    expect(segmentForRegion("CZ-ST", ["CZ-PR", "CZ-KA"])).toBe("waitlist");
    expect(segmentForRegion("CZ-JM", ["CZ-JM"])).toBe("camp");
    expect(segmentForRegion("CZ-PR", [])).toBe("waitlist");
  });
});

describe("regionOptions", () => {
  it("staví spádové kraje na začátek", () => {
    const options = regionOptions();
    const firstThree = options.slice(0, 3).map((o) => o.code);
    expect(firstThree).toEqual(expect.arrayContaining(["CZ-PR", "CZ-ST", "CZ-KA"]));
    expect(options.slice(0, 3).every((o) => o.isCatchment)).toBe(true);
    expect(options.slice(3).every((o) => !o.isCatchment)).toBe(true);
  });

  it("řadí podle českého porovnání, ne podle ASCII", () => {
    const rest = regionOptions().filter((o) => !o.isCatchment).map((o) => o.name);
    // "Ústecký" musí skončit až za "Zlínský" jen tehdy, když se řadí špatně.
    const sorted = [...rest].sort((a, b) => a.localeCompare(b, "cs"));
    expect(rest).toEqual(sorted);
  });

  it("nabízí všechny kraje, žádný nevynechá", () => {
    expect(regionOptions()).toHaveLength(14);
  });
});
