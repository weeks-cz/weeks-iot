import { describe, expect, it } from "vitest";
import { CAMP_CITIES, campCityForRegion, campUrl } from "../camp-offer";
import { DEFAULT_CAMP_CATCHMENT, REGION_CODES } from "../regions";
import { campEmail } from "../email/sequence";

describe("campCityForRegion", () => {
  it("Karlovarsko vede do Karlových Varů, Praha i Středočeský do Prahy", () => {
    expect(campCityForRegion("CZ-KA")).toBe("karlovy-vary");
    expect(campCityForRegion("CZ-PR")).toBe("praha");
    expect(campCityForRegion("CZ-ST")).toBe("praha");
  });

  it("každý výchozí spádový kraj má město", () => {
    // Kraj ve spádu bez města by dostal jen obecnou kartu — u výchozího
    // spádu je to chyba, ne záměr.
    for (const code of DEFAULT_CAMP_CATCHMENT) {
      expect(campCityForRegion(code)).not.toBeNull();
    }
  });

  it("mimo spád ani bez kraje město nemá", () => {
    const rest = REGION_CODES.filter((c) => !DEFAULT_CAMP_CATCHMENT.includes(c));
    for (const code of rest) expect(campCityForRegion(code)).toBeNull();
    expect(campCityForRegion(null)).toBeNull();
    expect(campCityForRegion(undefined)).toBeNull();
    expect(campCityForRegion("")).toBeNull();
  });
});

describe("campUrl", () => {
  it("s městem vede na jeho výpis a nese UTM", () => {
    expect(campUrl("karlovy-vary", "utm_source=ucebna")).toBe(
      "https://weeks.cz/tabory?mesto=karlovy-vary&utm_source=ucebna",
    );
  });

  it("bez města vede na celý výpis", () => {
    expect(campUrl(null, "utm_source=ucebna")).toBe("https://weeks.cz/tabory?utm_source=ucebna");
  });
});

describe("campEmail podle města", () => {
  const base = {
    nick: "Tomáš",
    formal: true,
    inCatchment: true,
    startedLearning: true,
    nextLessonSlug: null,
  };

  it("Karlovy Vary: otevřené přihlašování a odkaz na jejich termíny", () => {
    const t = campEmail({ ...base, campCity: "karlovy-vary" });
    expect(t.content.paragraphs.join(" ")).toContain("Přihlašování na léto 2027 v Karlových Varech je otevřené");
    expect(t.content.button?.label).toBe("Podívat se na termíny");
    expect(t.content.button?.url).toContain("/tabory?mesto=karlovy-vary&");
  });

  it("Praha: nic neslibuje, zve jen k zanechání e-mailu", () => {
    expect(CAMP_CITIES.praha.prihlasky).toBe(false);
    const t = campEmail({ ...base, campCity: "praha" });
    expect(t.content.paragraphs.join(" ")).toContain("připravujeme");
    expect(t.content.button?.label).toBe("Dát mi vědět o termínech");
    expect(t.content.button?.url).toContain("/tabory?mesto=praha&");
  });

  it("bez města zůstává obecná pozvánka", () => {
    const t = campEmail({ ...base, campCity: null });
    expect(t.content.button?.url).toMatch(/^https:\/\/weeks\.cz\/tabory\?utm_source=/);
  });
});
