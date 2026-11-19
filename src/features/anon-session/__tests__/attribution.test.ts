// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { captureAttribution } from "../storage";

describe("captureAttribution", () => {
  beforeEach(() => window.localStorage.clear());

  it("do landingPath neukládá token odkazu z e-mailu", () => {
    const url = new URL(
      "https://ucebna.weeks.cz/kurz/iot/rozsvit-ledku/?utm_source=ig&odkaz=abc.def&utm_term=odkaz-na-pc",
    );
    const s = captureAttribution(url, "");
    expect(s.attribution.landingPath).toBe(
      "/kurz/iot/rozsvit-ledku/?utm_source=ig&utm_term=odkaz-na-pc",
    );
    expect(JSON.stringify(window.localStorage)).not.toContain("abc.def");
  });

  it("bez odkaz zůstane query beze změny", () => {
    const s = captureAttribution(new URL("https://ucebna.weeks.cz/?utm_source=ig"), "");
    expect(s.attribution.landingPath).toBe("/?utm_source=ig");
  });

  it("jen odkaz: landingPath bez otazníku", () => {
    const s = captureAttribution(new URL("https://ucebna.weeks.cz/kurz/?odkaz=x.y"), "");
    expect(s.attribution.landingPath).toBe("/kurz/");
  });

  it("na /odhlasit se první dotyk nezaznamená", () => {
    const s = captureAttribution(new URL("https://ucebna.weeks.cz/odhlasit?t=abc.def"), "");
    expect(s.attribution).toEqual({});
    expect(JSON.stringify(window.localStorage)).not.toContain("abc.def");
    /* Další návštěva jinde pak první dotyk zaznamená normálně. */
    const next = captureAttribution(new URL("https://ucebna.weeks.cz/?utm_source=ig"), "");
    expect(next.attribution.landingPath).toBe("/?utm_source=ig");
  });
});
