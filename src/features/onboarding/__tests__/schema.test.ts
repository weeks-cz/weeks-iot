import { describe, expect, it } from "vitest";
import {
  DIGITAL_CONSENT_AGE,
  MAX_AGE,
  MIN_AGE,
  MIN_PASSWORD_LENGTH,
  approximateAge,
  birthYearRange,
  emailSchema,
  needsParentalConsent,
  newPasswordSchema,
  nickSchema,
  onboardingSchema,
  passwordSchema,
  regionSchema,
  waitlistSchema,
} from "../schema";

const NOW = new Date("2026-08-29T00:00:00Z");

function validOnboarding(over: Record<string, unknown> = {}) {
  return {
    regionCode: "CZ-PR",
    childNick: "Kuba",
    childBirthYear: 2014,
    acceptTerms: true,
    parentalConsent: true,
    marketingConsent: false,
    ...over,
  };
}

describe("emailSchema", () => {
  it("přijme běžnou adresu", () => {
    expect(emailSchema.parse("rodic@example.com")).toBe("rodic@example.com");
  });

  it("ořízne mezery a převede na malá písmena", () => {
    // Bez normalizace by "Rodic@Example.com" a "rodic@example.com" byly
    // dva různé účty a atribuce na tábor podle e-mailu by je nespojila.
    expect(emailSchema.parse("  Rodic@Example.COM  ")).toBe("rodic@example.com");
  });

  it("odmítne nesmysl", () => {
    for (const bad of ["", "rodic", "rodic@", "@example.com", "a b@c.cz"]) {
      expect(emailSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("odmítne přehnaně dlouhou adresu", () => {
    expect(emailSchema.safeParse(`${"a".repeat(250)}@example.com`).success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("přijme dostatečně dlouhé heslo", () => {
    expect(passwordSchema.safeParse("modrykonvalinka").success).toBe(true);
  });

  it("odmítne krátké heslo", () => {
    expect(passwordSchema.safeParse("a".repeat(MIN_PASSWORD_LENGTH - 1)).success).toBe(false);
  });

  it("nevyžaduje velké písmeno ani symbol", () => {
    // Skladba znaků lidi tlačí k "Heslo123!". Délka je lepší kritérium.
    expect(passwordSchema.safeParse("tricervenekone").success).toBe(true);
  });

  it("odmítne nejčastější hesla bez ohledu na velikost písmen", () => {
    expect(passwordSchema.safeParse("heslo12345").success).toBe(false);
    expect(passwordSchema.safeParse("Heslo12345").success).toBe(false);
    expect(passwordSchema.safeParse("QWERTYUIOP").success).toBe(false);
  });

  it("nese českou hlášku, ne anglickou", () => {
    const result = passwordSchema.safeParse("krátké");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/znak/i);
    }
  });
});

describe("newPasswordSchema", () => {
  it("vyžaduje shodu obou polí", () => {
    expect(
      newPasswordSchema.safeParse({ password: "modrykonvalinka", confirm: "modrykonvalinka" })
        .success,
    ).toBe(true);
  });

  it("odmítne neshodu a chybu připne k druhému poli", () => {
    const result = newPasswordSchema.safeParse({
      password: "modrykonvalinka",
      confirm: "modrykonvalinky",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["confirm"]);
    }
  });
});

describe("věk a rok narození", () => {
  it("rozsah odpovídá cílové skupině", () => {
    const { min, max } = birthYearRange(NOW);
    expect(max - min).toBe(MAX_AGE - MIN_AGE);
    expect(2026 - max).toBe(MIN_AGE);
    expect(2026 - min).toBe(MAX_AGE);
  });

  it("spočítá přibližný věk", () => {
    expect(approximateAge(2014, NOW)).toBe(12);
    expect(approximateAge(2011, NOW)).toBe(15);
  });

  it("dítě pod 15 potřebuje souhlas zákonného zástupce", () => {
    // § 7 zák. 110/2019: věk digitálního souhlasu je v ČR 15 let.
    expect(needsParentalConsent(2014, NOW)).toBe(true);
    expect(approximateAge(2012, NOW)).toBeLessThan(DIGITAL_CONSENT_AGE);
    expect(needsParentalConsent(2012, NOW)).toBe(true);
  });

  it("od 15 let už souhlas zákonného zástupce nutný není", () => {
    expect(needsParentalConsent(2011, NOW)).toBe(false);
  });

  it("odmítne nesmyslný ročník", () => {
    expect(onboardingSchema.safeParse(validOnboarding({ childBirthYear: 1900 })).success).toBe(false);
    expect(onboardingSchema.safeParse(validOnboarding({ childBirthYear: 2050 })).success).toBe(false);
    expect(onboardingSchema.safeParse(validOnboarding({ childBirthYear: 0 })).success).toBe(false);
  });

  it("přijme rok jako řetězec ze select boxu", () => {
    const result = onboardingSchema.safeParse(validOnboarding({ childBirthYear: "2014" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.childBirthYear).toBe(2014);
  });
});

describe("nickSchema", () => {
  it("přijme běžnou přezdívku a ořízne mezery", () => {
    expect(nickSchema.parse("  Kuba  ")).toBe("Kuba");
  });

  it("odmítne prázdnou nebo jen z mezer", () => {
    expect(nickSchema.safeParse("").success).toBe(false);
    expect(nickSchema.safeParse("    ").success).toBe(false);
  });

  it("odmítne příliš dlouhou", () => {
    expect(nickSchema.safeParse("a".repeat(25)).success).toBe(false);
  });

  it("pustí diakritiku i emoji", () => {
    // Přezdívku si volí dítě. Omezovat ji na ASCII by bylo zbytečně kruté.
    expect(nickSchema.safeParse("Žofka").success).toBe(true);
    expect(nickSchema.safeParse("Kuba 🚀").success).toBe(true);
  });
});

describe("regionSchema", () => {
  it("přijme platný kód", () => {
    expect(regionSchema.safeParse("CZ-KA").success).toBe(true);
  });

  it("odmítne vymyšlený kód", () => {
    expect(regionSchema.safeParse("CZ-XX").success).toBe(false);
    expect(regionSchema.safeParse("").success).toBe(false);
  });
});

describe("onboardingSchema — souhlasy", () => {
  it("projde s oběma povinnými souhlasy", () => {
    expect(onboardingSchema.safeParse(validOnboarding()).success).toBe(true);
  });

  it("neprojde bez potvrzení podmínek", () => {
    expect(onboardingSchema.safeParse(validOnboarding({ acceptTerms: false })).success).toBe(false);
  });

  it("neprojde bez souhlasu zákonného zástupce", () => {
    const result = onboardingSchema.safeParse(validOnboarding({ parentalConsent: false }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/zákonného zástupce/i);
    }
  });

  it("projde bez obchodních sdělení", () => {
    // Marketing musí jít odmítnout, aniž by to cokoli zablokovalo —
    // jinak by souhlas nebyl svobodný.
    const result = onboardingSchema.safeParse(validOnboarding({ marketingConsent: false }));
    expect(result.success).toBe(true);
  });

  it("obchodní sdělení chybí-li, jsou false, ne true", () => {
    const input = validOnboarding();
    delete (input as Record<string, unknown>).marketingConsent;
    const result = onboardingSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.marketingConsent).toBe(false);
  });

  it("nepřijme souhlas poslaný jako řetězec", () => {
    // "false" je v JS pravdivý řetězec. Kdyby schéma coercovalo,
    // odmítnutý souhlas by se uložil jako udělený.
    expect(onboardingSchema.safeParse(validOnboarding({ parentalConsent: "false" })).success).toBe(false);
    expect(onboardingSchema.safeParse(validOnboarding({ acceptTerms: "true" })).success).toBe(false);
  });
});

describe("waitlistSchema", () => {
  it("přijme město", () => {
    expect(waitlistSchema.safeParse({ city: "Brno" }).success).toBe(true);
  });

  it("odmítne příliš krátké nebo dlouhé", () => {
    expect(waitlistSchema.safeParse({ city: "B" }).success).toBe(false);
    expect(waitlistSchema.safeParse({ city: "a".repeat(81) }).success).toBe(false);
  });
});
