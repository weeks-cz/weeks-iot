import { describe, expect, it } from "vitest";
import { DEFAULT_CAMP_CATCHMENT } from "@/lib/regions";
import { campOfferFor } from "../offer";

const catchment = DEFAULT_CAMP_CATCHMENT;
const zavreno = { "karlovy-vary": { prihlasky: false }, praha: { prihlasky: false } };

describe("campOfferFor", () => {
  it("Karlovarský kraj: open KV", () => {
    expect(campOfferFor({ regionCode: "CZ-KA", catchment, anonymous: false })).toEqual({
      kind: "open",
      city: "karlovy-vary",
    });
  });
  it("Praha: soon praha", () => {
    expect(campOfferFor({ regionCode: "CZ-PR", catchment, anonymous: false })).toEqual({
      kind: "soon",
      city: "praha",
    });
  });
  it("mimo spád: null", () => {
    expect(campOfferFor({ regionCode: "CZ-JM", catchment, anonymous: false })).toBeNull();
    expect(campOfferFor({ regionCode: null, catchment, anonymous: false })).toBeNull();
  });
  it("anonym: obecná open nabídka", () => {
    expect(campOfferFor({ regionCode: null, catchment, anonymous: true })).toEqual({
      kind: "open",
      city: null,
    });
  });
  it("anonym, když se nikde nedá přihlásit: null", () => {
    expect(campOfferFor({ regionCode: null, catchment, anonymous: true }, zavreno)).toBeNull();
  });
  it("spád bez města: open bez města, pokud je kde přihlašovat", () => {
    const wide = [...catchment, "CZ-PL"];
    expect(campOfferFor({ regionCode: "CZ-PL", catchment: wide, anonymous: false })).toEqual({
      kind: "open",
      city: null,
    });
    expect(
      campOfferFor({ regionCode: "CZ-PL", catchment: wide, anonymous: false }, zavreno),
    ).toBeNull();
  });
});
