import { describe, expect, it } from "vitest";
import { buildLessonLink, buildUnsubscribeLink } from "../link";

const ORIGIN = "https://ucebna.example";

describe("buildLessonLink", () => {
  it("zachová čtyři UTM, přepíše utm_term a přidá odkaz", () => {
    const url = new URL(
      buildLessonLink(
        {
          utmSource: "meta",
          utmMedium: "paid",
          utmCampaign: "ucebna-seed-2026-11",
          utmContent: "video-v6-reel-rodice",
        },
        "tok.en",
        "odkaz-na-pc",
        ORIGIN,
      ),
    );
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe("/kurz/iot/rozsvit-ledku/");
    expect(url.searchParams.get("utm_source")).toBe("meta");
    expect(url.searchParams.get("utm_medium")).toBe("paid");
    expect(url.searchParams.get("utm_campaign")).toBe("ucebna-seed-2026-11");
    expect(url.searchParams.get("utm_content")).toBe("video-v6-reel-rodice");
    expect(url.searchParams.get("utm_term")).toBe("odkaz-na-pc");
    expect(url.searchParams.get("odkaz")).toBe("tok.en");
  });

  it("bez UTM dosadí ucebna/email/odkaz-na-pc", () => {
    const url = new URL(buildLessonLink({}, "t", "odkaz-na-pc", ORIGIN));
    expect(url.searchParams.get("utm_source")).toBe("ucebna");
    expect(url.searchParams.get("utm_medium")).toBe("email");
    expect(url.searchParams.get("utm_campaign")).toBe("odkaz-na-pc");
    expect(url.searchParams.has("utm_content")).toBe(false);
    expect(url.searchParams.get("utm_term")).toBe("odkaz-na-pc");
  });

  it("připomínka nese utm_term=pripominka-na-pc", () => {
    const url = new URL(
      buildLessonLink({ utmSource: "meta" }, "t", "pripominka-na-pc", ORIGIN),
    );
    expect(url.searchParams.get("utm_term")).toBe("pripominka-na-pc");
  });

  it("utm_term z atribuce se nepřenáší", () => {
    const url = new URL(
      buildLessonLink(
        { utmSource: "x", utmTerm: "cizi" } as never,
        "t",
        "odkaz-na-pc",
        ORIGIN,
      ),
    );
    expect(url.searchParams.getAll("utm_term")).toEqual(["odkaz-na-pc"]);
  });
});

describe("buildUnsubscribeLink", () => {
  it("vede na /odhlasit?t=<token>", () => {
    expect(buildUnsubscribeLink("a.b", ORIGIN)).toBe(
      `${ORIGIN}/odhlasit?t=a.b`,
    );
  });
});
