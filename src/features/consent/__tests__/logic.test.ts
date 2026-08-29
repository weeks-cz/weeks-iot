import { describe, expect, it } from "vitest";
import type { ConsentEntry } from "../logic";
import {
  consentStatuses,
  hasAllRequiredConsents,
  hasConsent,
  latestConsent,
  needsReconsent,
} from "../logic";
import { MARKETING_TEXT, PARENTAL_TEXT, SELF_TEXT, TERMS_TEXT, consentTextsForAge } from "../texts";

function entry(
  kind: ConsentEntry["kind"],
  granted: boolean,
  created_at: string,
  version = "x-v1",
  id?: number,
): ConsentEntry {
  return { kind, granted, created_at, version, id };
}

const grantAllCurrent: ConsentEntry[] = [
  entry("terms", true, "2026-08-01T10:00:00Z", TERMS_TEXT.version, 1),
  entry("parental", true, "2026-08-01T10:00:00Z", PARENTAL_TEXT.version, 2),
];

describe("latestConsent", () => {
  it("bez záznamů vrací null", () => {
    expect(latestConsent([], "parental")).toBeNull();
  });

  it("vybírá nejnovější záznam daného druhu", () => {
    const entries = [
      entry("parental", true, "2026-08-01T10:00:00Z"),
      entry("parental", false, "2026-08-05T10:00:00Z"),
      entry("parental", true, "2026-08-03T10:00:00Z"),
    ];
    expect(latestConsent(entries, "parental")?.granted).toBe(false);
  });

  it("nemíchá druhy souhlasu", () => {
    const entries = [
      entry("parental", true, "2026-08-01T10:00:00Z"),
      entry("marketing", false, "2026-08-09T10:00:00Z"),
    ];
    expect(latestConsent(entries, "parental")?.granted).toBe(true);
    expect(latestConsent(entries, "marketing")?.granted).toBe(false);
  });

  it("při shodném čase rozhoduje id, ne pořadí v poli", () => {
    // Bez tiebreaku by o platnosti souhlasu rozhodovalo, jak databáze
    // zrovna vrátila řádky — tedy náhoda.
    const sameInstant = "2026-08-01T10:00:00Z";
    const entries = [
      entry("marketing", true, sameInstant, "m-v1", 7),
      entry("marketing", false, sameInstant, "m-v1", 8),
    ];
    expect(latestConsent(entries, "marketing")?.granted).toBe(false);
    expect(latestConsent([...entries].reverse(), "marketing")?.granted).toBe(false);
  });

  it("nezávisí na pořadí vstupu", () => {
    const entries = [
      entry("parental", false, "2026-08-05T10:00:00Z"),
      entry("parental", true, "2026-08-01T10:00:00Z"),
    ];
    expect(latestConsent(entries, "parental")?.granted).toBe(false);
    expect(latestConsent([...entries].reverse(), "parental")?.granted).toBe(false);
  });
});

describe("hasConsent", () => {
  it("chybějící záznam znamená ne", () => {
    // Výchozí odpověď musí být zákaz. Kdyby prázdný ledger znamenal souhlas,
    // měl by každý nový účet souhlas, který nikdy nedal.
    expect(hasConsent([], "parental")).toBe(false);
    expect(hasConsent([], "marketing")).toBe(false);
  });

  it("respektuje odvolání", () => {
    const entries = [
      entry("marketing", true, "2026-08-01T10:00:00Z"),
      entry("marketing", false, "2026-08-02T10:00:00Z"),
    ];
    expect(hasConsent(entries, "marketing")).toBe(false);
  });

  it("respektuje opětovné udělení po odvolání", () => {
    const entries = [
      entry("marketing", true, "2026-08-01T10:00:00Z"),
      entry("marketing", false, "2026-08-02T10:00:00Z"),
      entry("marketing", true, "2026-08-03T10:00:00Z"),
    ];
    expect(hasConsent(entries, "marketing")).toBe(true);
  });
});

describe("needsReconsent", () => {
  it("souhlas k aktuální verzi se znovu neptá", () => {
    expect(needsReconsent(grantAllCurrent, "parental")).toBe(false);
  });

  it("souhlas ke staré verzi se musí obnovit", () => {
    const entries = [entry("parental", true, "2026-01-01T10:00:00Z", "parental-v0")];
    expect(needsReconsent(entries, "parental")).toBe(true);
  });

  it("odvolaný souhlas se neobnovuje, jen chybí", () => {
    // Neptáme se „potvrď novou verzi" někoho, kdo souhlas právě odvolal.
    const entries = [entry("marketing", false, "2026-01-01T10:00:00Z", "marketing-v0")];
    expect(needsReconsent(entries, "marketing")).toBe(false);
    expect(hasConsent(entries, "marketing")).toBe(false);
  });

  it("bez záznamu není co obnovovat", () => {
    expect(needsReconsent([], "parental")).toBe(false);
  });
});

describe("hasAllRequiredConsents", () => {
  it("projde s oběma povinnými k aktuálnímu znění", () => {
    expect(hasAllRequiredConsents(grantAllCurrent, true)).toBe(true);
  });

  it("neprojde bez souhlasu zákonného zástupce", () => {
    const entries = [entry("terms", true, "2026-08-01T10:00:00Z", TERMS_TEXT.version)];
    expect(hasAllRequiredConsents(entries, true)).toBe(false);
  });

  it("neprojde po odvolání povinného souhlasu", () => {
    const entries = [
      ...grantAllCurrent,
      entry("parental", false, "2026-08-10T10:00:00Z", PARENTAL_TEXT.version, 3),
    ];
    expect(hasAllRequiredConsents(entries, true)).toBe(false);
  });

  it("neprojde se zastaralou verzí povinného souhlasu", () => {
    const entries = [
      entry("terms", true, "2026-08-01T10:00:00Z", TERMS_TEXT.version),
      entry("parental", true, "2026-08-01T10:00:00Z", "parental-v0"),
    ];
    expect(hasAllRequiredConsents(entries, true)).toBe(false);
  });

  it("chybějící obchodní sdělení nic neblokují", () => {
    expect(hasAllRequiredConsents(grantAllCurrent, true)).toBe(true);
    expect(hasConsent(grantAllCurrent, "marketing")).toBe(false);
  });
});

describe("consentStatuses", () => {
  it("vrací řádek pro každý druh, i když záznam chybí", () => {
    const statuses = consentStatuses([]);
    expect(statuses).toHaveLength(3);
    expect(statuses.map((s) => s.kind)).toEqual(["terms", "parental", "marketing"]);
    expect(statuses.every((s) => s.granted === false)).toBe(true);
    expect(statuses.every((s) => s.changedAt === null)).toBe(true);
  });

  it("označí obchodní sdělení jako nepovinná", () => {
    const marketing = consentStatuses([]).find((s) => s.kind === "marketing");
    expect(marketing?.required).toBe(false);
    expect(MARKETING_TEXT.required).toBe(false);
  });

  it("nese čas poslední změny", () => {
    const entries = [
      entry("marketing", true, "2026-08-01T10:00:00Z", MARKETING_TEXT.version),
      entry("marketing", false, "2026-08-07T09:30:00Z", MARKETING_TEXT.version),
    ];
    const marketing = consentStatuses(entries).find((s) => s.kind === "marketing");
    expect(marketing?.granted).toBe(false);
    expect(marketing?.changedAt).toBe("2026-08-07T09:30:00Z");
  });
});

describe("znění souhlasů", () => {
  it("povinné jsou podmínky a souhlas zákonného zástupce, marketing ne", () => {
    expect(TERMS_TEXT.required).toBe(true);
    expect(PARENTAL_TEXT.required).toBe(true);
    expect(MARKETING_TEXT.required).toBe(false);
  });

  it("každé znění nese verzi a neprázdný text", () => {
    for (const text of [TERMS_TEXT, PARENTAL_TEXT, MARKETING_TEXT]) {
      expect(text.version).toMatch(/-v\d+$/);
      expect(text.full.trim().length).toBeGreaterThan(200);
      expect(text.label.trim().length).toBeGreaterThan(10);
    }
  });

  it("souhlas zákonného zástupce zmiňuje odvolání i práva subjektu", () => {
    // Bez informace o odvolání a o právech není souhlas informovaný.
    expect(PARENTAL_TEXT.full).toMatch(/odvolat/i);
    expect(PARENTAL_TEXT.full).toMatch(/Úřadu pro ochranu osobních údajů/);
    expect(PARENTAL_TEXT.full).toMatch(/čl\. 8/);
  });

  it("verze jsou napříč druhy jedinečné", () => {
    const versions = [TERMS_TEXT, PARENTAL_TEXT, MARKETING_TEXT].map((t) => t.version);
    expect(new Set(versions).size).toBe(versions.length);
  });
});

describe("rozvětvení podle věku", () => {
  it("dítě do 15 let dostane souhlas zákonného zástupce, ne vlastní", () => {
    const kinds = consentTextsForAge(true).map((t) => t.kind);
    expect(kinds).toContain("parental");
    expect(kinds).not.toContain("self");
  });

  it("od 15 let dostane vlastní souhlas, ne rodičovský", () => {
    // Nutit patnáctiletého prohlásit "jsem zákonný zástupce" by vyrobilo
    // nepravdivý záznam — a ledger s nepravdou přestává být dokladem.
    const kinds = consentTextsForAge(false).map((t) => t.kind);
    expect(kinds).toContain("self");
    expect(kinds).not.toContain("parental");
  });

  it("podmínky a marketing platí pro obě skupiny", () => {
    for (const minor of [true, false]) {
      const kinds = consentTextsForAge(minor).map((t) => t.kind);
      expect(kinds).toContain("terms");
      expect(kinds).toContain("marketing");
    }
  });

  it("nikdy se neptá na oba souhlasy se zpracováním naráz", () => {
    for (const minor of [true, false]) {
      const kinds = consentTextsForAge(minor).map((t) => t.kind);
      expect(kinds.filter((k) => k === "parental" || k === "self")).toHaveLength(1);
    }
  });

  it("dospělejší účet neprojde s rodičovským souhlasem místo vlastního", () => {
    const entries = [
      entry("terms", true, "2026-08-01T10:00:00Z", TERMS_TEXT.version, 1),
      entry("parental", true, "2026-08-01T10:00:00Z", PARENTAL_TEXT.version, 2),
    ];
    expect(hasAllRequiredConsents(entries, true)).toBe(true);
    expect(hasAllRequiredConsents(entries, false)).toBe(false);
  });

  it("účet od 15 let projde s vlastním souhlasem", () => {
    const entries = [
      entry("terms", true, "2026-08-01T10:00:00Z", TERMS_TEXT.version, 1),
      entry("self", true, "2026-08-01T10:00:00Z", SELF_TEXT.version, 2),
    ];
    expect(hasAllRequiredConsents(entries, false)).toBe(true);
    expect(hasAllRequiredConsents(entries, true)).toBe(false);
  });

  it("starý rodičovský souhlas zůstane vidět i po překlopení přes 15", () => {
    // Dítě, kterému mezitím bylo patnáct, nemá o historii přijít.
    const entries = [entry("parental", true, "2026-01-01T10:00:00Z", PARENTAL_TEXT.version, 1)];
    const kinds = consentStatuses(entries, false).map((s) => s.kind);
    expect(kinds).toContain("parental");
    expect(kinds).toContain("self");
  });

  it("vlastní souhlas nese odkaz na § 7 a na práva", () => {
    expect(SELF_TEXT.full).toMatch(/§ 7/);
    expect(SELF_TEXT.full).toMatch(/odvolat/i);
    expect(SELF_TEXT.full).toMatch(/Úřadu pro ochranu osobních údajů/);
    expect(SELF_TEXT.required).toBe(true);
  });

  it("vlastní souhlas říká, co i tak potřebuje rodiče", () => {
    // Nezletilý nad 15 sice souhlasí sám, ale platit a jet na tábor bez
    // zákonného zástupce nemůže. Musí to být napsané.
    expect(SELF_TEXT.full).toMatch(/18/);
    expect(SELF_TEXT.full).toMatch(/zákonný zástupce|zákonný zástupce/);
  });
});
