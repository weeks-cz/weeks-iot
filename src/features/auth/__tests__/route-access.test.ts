import { describe, expect, it } from "vitest";
import { decideAccess, isGuestOnly, normalizePath, requiresAuth } from "../route-access";

describe("normalizePath", () => {
  it("odstraní koncové lomítko", () => {
    // Projekt jede s trailingSlash: true, takže sem chodí "/registrace/".
    expect(normalizePath("/registrace/")).toBe("/registrace");
    expect(normalizePath("/ucet/deti/")).toBe("/ucet/deti");
  });

  it("kořen nechá být", () => {
    expect(normalizePath("/")).toBe("/");
  });

  it("cestu bez lomítka nemění", () => {
    expect(normalizePath("/registrace")).toBe("/registrace");
  });
});

describe("requiresAuth", () => {
  it("chrání rodičovskou a dětskou zónu", () => {
    for (const p of ["/ucet", "/ucet/", "/ucet/deti", "/ucet/souhlasy/", "/ucim-se", "/ucim-se/prepnout/"]) {
      expect(requiresAuth(p), p).toBe(true);
    }
  });

  it("veřejnou část nechrání", () => {
    for (const p of ["/", "/kurz/iot/", "/kurz/iot/rozsvit-ledku/", "/prihlaseni/", "/registrace/", "/tabor/"]) {
      expect(requiresAuth(p), p).toBe(false);
    }
  });

  it("nenechá se zmást podobným začátkem", () => {
    // "/ucetnictvi" není "/ucet".
    expect(requiresAuth("/ucetnictvi")).toBe(false);
    expect(requiresAuth("/ucim-se-neco")).toBe(false);
  });
});

describe("isGuestOnly", () => {
  it("přihlášeného vyhodí z přihlášení a registrace", () => {
    expect(isGuestOnly("/prihlaseni")).toBe(true);
    expect(isGuestOnly("/prihlaseni/")).toBe(true);
    expect(isGuestOnly("/registrace")).toBe(true);
    expect(isGuestOnly("/registrace/")).toBe(true);
    expect(isGuestOnly("/obnova-hesla/")).toBe(true);
  });

  it("dokončení onboardingu NENÍ jen pro nepřihlášené", () => {
    // Tohle je ta chyba z 29. 8.: proxy vyhazovala přihlášeného
    // z /registrace/onboarding, layout ho posílal zpět a vznikla smyčka.
    expect(isGuestOnly("/registrace/onboarding")).toBe(false);
    expect(isGuestOnly("/registrace/onboarding/")).toBe(false);
  });

  it("nastavení nového hesla NENÍ jen pro nepřihlášené", () => {
    // Odkaz z e-mailu vymění token za session, takže sem člověk přichází
    // už přihlášený.
    expect(isGuestOnly("/obnova-hesla/nove")).toBe(false);
    expect(isGuestOnly("/obnova-hesla/nove/")).toBe(false);
  });

  it("veřejné stránky nejsou jen pro nepřihlášené", () => {
    for (const p of ["/", "/kurz/iot/", "/ucet/", "/tabor/"]) {
      expect(isGuestOnly(p), p).toBe(false);
    }
  });
});

describe("decideAccess — celý graf přechodů", () => {
  const cases: Array<[string, boolean, "allow" | "toLogin" | "toAccount"]> = [
    // veřejné stránky projdou vždy
    ["/", false, "allow"],
    ["/", true, "allow"],
    ["/kurz/iot/rozsvit-ledku/", false, "allow"],
    ["/kurz/iot/rozsvit-ledku/", true, "allow"],
    ["/tabor/", false, "allow"],

    // chráněné zóny
    ["/ucet/", false, "toLogin"],
    ["/ucet/", true, "allow"],
    ["/ucim-se/", false, "toLogin"],
    ["/ucim-se/", true, "allow"],

    // stránky pro nepřihlášené
    ["/prihlaseni/", false, "allow"],
    ["/prihlaseni/", true, "toAccount"],
    ["/registrace/", false, "allow"],
    ["/registrace/", true, "toAccount"],

    // výjimky — sem se přihlášený DOSTAT MUSÍ
    ["/registrace/onboarding/", true, "allow"],
    ["/obnova-hesla/nove/", true, "allow"],
  ];

  for (const [path, authed, expected] of cases) {
    it(`${path} ${authed ? "(přihlášen)" : "(nepřihlášen)"} → ${expected}`, () => {
      expect(decideAccess(path, authed).action).toBe(expected);
    });
  }

  it("žádná cesta nevede na smyčku", () => {
    // Smyčka vzniká tehdy, když cíl přesměrování sám přesměrovává zpět.
    // Ověřujeme obě strany: kam se posílá nepřihlášený a kam přihlášený.
    const target = { toLogin: "/prihlaseni", toAccount: "/ucet" } as const;

    const paths = [
      "/", "/kurz/iot/", "/prihlaseni/", "/registrace/", "/registrace/onboarding/",
      "/obnova-hesla/", "/obnova-hesla/nove/", "/ucet/", "/ucet/deti/", "/ucim-se/", "/tabor/",
    ];

    for (const path of paths) {
      for (const authed of [true, false]) {
        const first = decideAccess(path, authed);
        if (first.action === "allow") continue;

        // Cíl přesměrování už musí projít, jinak se to zacyklí.
        const second = decideAccess(target[first.action], authed);
        expect(second.action, `${path} (${authed}) → ${target[first.action]}`).toBe("allow");
      }
    }
  });
});
