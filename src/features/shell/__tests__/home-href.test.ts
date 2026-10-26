import { describe, expect, it } from "vitest";
import { homeHref, toViewer } from "../home-href";
import { activeNavHref } from "../nav";

describe("homeHref", () => {
  it("dítě s profilem → lobby", () => {
    expect(homeHref({ kind: "child", nick: "Ája", avatar: "robot" })).toBe("/ucim-se");
  });

  it("rodič bez vybraného profilu → lobby (ukáže výběr profilu)", () => {
    expect(homeHref({ kind: "parent" })).toBe("/ucim-se");
  });

  it("anonym s postupem → přehled kurzu", () => {
    expect(homeHref({ kind: "anon", hasProgress: true })).toBe("/kurz/iot");
  });

  it("anonym bez postupu (nebo s neznámým) → úvodní stránka", () => {
    expect(homeHref({ kind: "anon" })).toBe("/");
    expect(homeHref({ kind: "anon", hasProgress: false })).toBe("/");
  });
});

describe("toViewer", () => {
  it("bez uživatele anonym, s profilem dítě, bez profilu rodič", () => {
    expect(toViewer(null, null)).toEqual({ kind: "anon" });
    expect(toViewer({ id: "u" }, null)).toEqual({ kind: "parent" });
    expect(toViewer({ id: "u" }, { nick: "Ája", avatar: "raketa" })).toEqual({
      kind: "child",
      nick: "Ája",
      avatar: "raketa",
    });
  });
});

describe("activeNavHref", () => {
  it("Domů jen na samotném lobby, ne pod ním", () => {
    expect(activeNavHref("/ucim-se")).toBe("/ucim-se");
    expect(activeNavHref("/ucim-se/")).toBe("/ucim-se");
    expect(activeNavHref("/ucim-se/sbirka/rozsvit-ledku/")).toBe("/ucim-se/sbirka");
  });

  it("Kurzy na přehledu i v lekci; jinde nic", () => {
    expect(activeNavHref("/kurz/iot/")).toBe("/kurz/iot");
    expect(activeNavHref("/kurz/iot/rozsvit-ledku")).toBe("/kurz/iot");
    expect(activeNavHref("/ucim-se/prepnout")).toBeNull();
    expect(activeNavHref(null)).toBeNull();
  });
});
