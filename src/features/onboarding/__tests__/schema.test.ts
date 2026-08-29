import { describe, expect, it } from "vitest";
import {
  MAX_AGE,
  MIN_AGE,
  MIN_PASSWORD_LENGTH,
  ageOn,
  birthDateRange,
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
    childBirthDate: "2014-06-15",
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

describe("ageOn — přesný věk", () => {
  it("počítá věk z celého data, ne z ročníku", () => {
    expect(ageOn("2011-01-05", NOW)).toBe(15);
    expect(ageOn("2014-06-15", NOW)).toBe(12);
  });

  it("před narozeninami je o rok míň", () => {
    // Tohle je ta chyba, kvůli které se přešlo z ročníku na datum:
    // 2026 − 2011 = 15, ale 20. 12. 2011 → 29. 8. 2026 je teprve 14.
    expect(ageOn("2011-12-20", NOW)).toBe(14);
    expect(ageOn("2011-09-01", NOW)).toBe(14);
  });

  it("v den narozenin už věk platí", () => {
    expect(ageOn("2011-08-29", NOW)).toBe(15);
  });

  it("den po narozeninách taky", () => {
    expect(ageOn("2011-08-28", NOW)).toBe(15);
  });

  it("den před narozeninami ještě ne", () => {
    expect(ageOn("2011-08-30", NOW)).toBe(14);
  });

  it("zvládne přestupný 29. únor", () => {
    expect(ageOn("2012-02-29", NOW)).toBe(14);
  });

  it("nečitelné datum vrátí NaN", () => {
    expect(Number.isNaN(ageOn("nesmysl", NOW))).toBe(true);
  });
});

describe("needsParentalConsent", () => {
  it("dítě pod 15 potřebuje souhlas zákonného zástupce", () => {
    // § 7 zák. 110/2019: věk digitálního souhlasu je v ČR 15 let.
    expect(needsParentalConsent("2014-06-15", NOW)).toBe(true);
    expect(needsParentalConsent("2011-12-20", NOW)).toBe(true);
  });

  it("od 15 let už souhlas zákonného zástupce nutný není", () => {
    expect(needsParentalConsent("2011-08-29", NOW)).toBe(false);
    expect(needsParentalConsent("2010-01-01", NOW)).toBe(false);
  });

  it("hranice sedí na den", () => {
    expect(needsParentalConsent("2011-08-30", NOW)).toBe(true);
    expect(needsParentalConsent("2011-08-29", NOW)).toBe(false);
  });

  it("nečitelné datum padne na přísnější variantu", () => {
    // Když nevíme, musí rozhodnout rodič. Opačná volba by vyrobila
    // neplatný souhlas.
    expect(needsParentalConsent("", NOW)).toBe(true);
    expect(needsParentalConsent("nesmysl", NOW)).toBe(true);
  });
});

describe("birthDateSchema", () => {
  it("přijme platné datum v rozsahu", () => {
    expect(onboardingSchema.safeParse(validOnboarding()).success).toBe(true);
  });

  it("odmítne neexistující datum", () => {
    // Regex pustí 2014-02-31; zpětný převod odhalí, že takový den není.
    const r = onboardingSchema.safeParse(validOnboarding({ childBirthDate: "2014-02-31" }));
    expect(r.success).toBe(false);
  });

  it("odmítne špatný formát", () => {
    for (const bad of ["15.6.2014", "2014/06/15", "2014-6-15", "", "včera"]) {
      expect(onboardingSchema.safeParse(validOnboarding({ childBirthDate: bad })).success, bad).toBe(false);
    }
  });

  it("pustí i dospělého — horní strop registraci neomezuje", () => {
    // Cílová skupina je 10–15 let, ale to je věc měření, ne přístupu.
    const r = onboardingSchema.safeParse(
      validOnboarding({ childBirthDate: "1990-01-01", parentalConsent: false, selfConsent: true }),
    );
    expect(r.success).toBe(true);
  });

  it("odmítne příliš mladé dítě", () => {
    expect(onboardingSchema.safeParse(validOnboarding({ childBirthDate: "2025-01-01" })).success).toBe(false);
  });

  it("odmítne nesmyslný rok jako překlep", () => {
    expect(onboardingSchema.safeParse(validOnboarding({ childBirthDate: "1890-01-01" })).success).toBe(false);
  });

  it("rozsah pro pole odpovídá povolenému věku", () => {
    const { min, max } = birthDateRange(NOW);
    expect(ageOn(min, NOW)).toBe(MAX_AGE);
    expect(ageOn(max, NOW)).toBe(MIN_AGE);
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

  it("u dítěte nestačí vlastní souhlas místo rodičovského", () => {
    const r = onboardingSchema.safeParse(
      validOnboarding({ parentalConsent: false, selfConsent: true }),
    );
    expect(r.success).toBe(false);
  });

  it("od 15 let stačí vlastní souhlas", () => {
    const r = onboardingSchema.safeParse(
      validOnboarding({ childBirthDate: "2010-01-01", parentalConsent: false, selfConsent: true }),
    );
    expect(r.success).toBe(true);
  });

  it("od 15 let nestačí rodičovský místo vlastního", () => {
    const r = onboardingSchema.safeParse(
      validOnboarding({ childBirthDate: "2010-01-01", parentalConsent: true, selfConsent: false }),
    );
    expect(r.success).toBe(false);
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
