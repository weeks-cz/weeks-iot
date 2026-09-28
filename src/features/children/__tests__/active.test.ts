import { describe, expect, it } from "vitest";
import { pickActiveChild } from "../active";

const ALIK = { id: "child-alik", hasPin: false };
const BETA = { id: "child-beta", hasPin: false };
const PINNED = { id: "child-pin", hasPin: true };

describe("pickActiveChild", () => {
  it("vybere profil z cookie, když patří k účtu", () => {
    expect(pickActiveChild([ALIK, BETA], "child-beta")).toBe(BETA);
  });

  it("cizí id v cookie ignoruje — cookie je volba, ne oprávnění", () => {
    expect(pickActiveChild([ALIK, BETA], "child-cizi")).toBeNull();
  });

  it("jediný profil bez PINu je aktivní i bez cookie", () => {
    expect(pickActiveChild([ALIK], undefined)).toBe(ALIK);
  });

  it("jediný profil s PINem bez cookie aktivní není — PIN se musí zadat", () => {
    expect(pickActiveChild([PINNED], undefined)).toBeNull();
  });

  it("dva profily bez cookie nehádá", () => {
    expect(pickActiveChild([ALIK, BETA], undefined)).toBeNull();
  });

  it("bez profilů vrátí null", () => {
    expect(pickActiveChild([], "child-alik")).toBeNull();
  });
});
