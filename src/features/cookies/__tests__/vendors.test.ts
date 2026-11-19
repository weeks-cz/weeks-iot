import { afterEach, describe, expect, it, vi } from "vitest";
import { gaPageView, pageLocation } from "../vendors";

describe("pageLocation", () => {
  it("odstraní token z odkazu do lekce (odkaz) i z odhlášení (t)", () => {
    expect(
      pageLocation(
        "https://ucebna.weeks.cz/kurz/iot/rozsvit-ledku/?utm_source=ig&odkaz=abc.def&utm_term=odkaz-na-pc",
      ),
    ).toBe("https://ucebna.weeks.cz/kurz/iot/rozsvit-ledku/?utm_source=ig&utm_term=odkaz-na-pc");
    expect(pageLocation("https://ucebna.weeks.cz/odhlasit?t=xyz")).toBe(
      "https://ucebna.weeks.cz/odhlasit",
    );
  });

  it("ostatní parametry a adresu bez tokenu nechá být", () => {
    const href = "https://ucebna.weeks.cz/pro-rodice/?utm_source=ig&utm_campaign=ucebna";
    expect(pageLocation(href)).toBe(href);
    expect(pageLocation("https://ucebna.weeks.cz/")).toBe("https://ucebna.weeks.cz/");
  });

  it("neparsovatelná adresa: radši bez dotazu než s tokenem", () => {
    expect(pageLocation("nesmysl?odkaz=abc")).toBe("nesmysl");
  });
});

describe("gaPageView", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("page_location do GA neobsahuje token", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", {
      gtag,
      location: { href: "https://ucebna.weeks.cz/kurz/iot/rozsvit-ledku/?odkaz=tajne&utm_source=ig" },
    });
    gaPageView("/kurz/iot/rozsvit-ledku/");
    expect(gtag).toHaveBeenCalledWith("event", "page_view", {
      page_location: "https://ucebna.weeks.cz/kurz/iot/rozsvit-ledku/?utm_source=ig",
      page_path: "/kurz/iot/rozsvit-ledku/",
    });
    expect(JSON.stringify(gtag.mock.calls)).not.toContain("tajne");
  });
});
