import { describe, expect, it } from "vitest";
import { isEditorMode, resolveEditorMode } from "../mode";

describe("resolveEditorMode", () => {
  it("anonym: platí to, co si pamatuje prohlížeč", () => {
    expect(resolveEditorMode(undefined, "code")).toEqual({ mode: "code", adopt: null });
    expect(resolveEditorMode(undefined, null)).toEqual({ mode: "blocks", adopt: null });
  });

  it("profil s uloženým režimem: vyhrává profil, i proti prohlížeči", () => {
    expect(resolveEditorMode("blocks", "code")).toEqual({ mode: "blocks", adopt: null });
    expect(resolveEditorMode("code", null)).toEqual({ mode: "code", adopt: null });
  });

  it("profil bez režimu převezme volbu z prohlížeče a uloží si ji", () => {
    expect(resolveEditorMode(null, "code")).toEqual({ mode: "code", adopt: "code" });
  });

  it("profil bez režimu a prohlížeč bez volby: bloky, nic se neukládá", () => {
    expect(resolveEditorMode(null, null)).toEqual({ mode: "blocks", adopt: null });
  });
});

describe("isEditorMode", () => {
  it("pustí jen dvě hodnoty", () => {
    expect(isEditorMode("blocks")).toBe(true);
    expect(isEditorMode("code")).toBe(true);
    expect(isEditorMode("Code")).toBe(false);
    expect(isEditorMode(null)).toBe(false);
    expect(isEditorMode({})).toBe(false);
  });
});
