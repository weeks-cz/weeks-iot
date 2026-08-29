import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildFbc, normalizeEmail } from "../meta-capi";

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

describe("normalizeEmail", () => {
  it("ořízne mezery a převede na malá písmena", () => {
    // Meta páruje podle hashe, takže normalizace musí sedět přesně na
    // jejich specifikaci — jinak se stejný člověk nespáruje se sebou.
    expect(normalizeEmail("  Rodic@Example.COM ")).toBe("rodic@example.com");
  });

  it("prázdný vstup vrací undefined, ne prázdný řetězec", () => {
    // Prázdný řetězec by se zahashoval a poslal jako platný identifikátor.
    expect(normalizeEmail("")).toBeUndefined();
    expect(normalizeEmail("   ")).toBeUndefined();
    expect(normalizeEmail(undefined)).toBeUndefined();
  });

  it("hash normalizované adresy je stabilní", () => {
    const a = sha256(normalizeEmail("Rodic@Example.com")!);
    const b = sha256(normalizeEmail("rodic@example.com")!);
    expect(a).toBe(b);
  });
});

describe("buildFbc", () => {
  const NOW = new Date("2026-08-29T12:00:00Z");

  it("sestaví _fbc ve formátu, který Meta čeká", () => {
    expect(buildFbc("abc123", NOW)).toBe(`fb.1.${NOW.getTime()}.abc123`);
  });

  it("bez fbclid nevrací nic", () => {
    // Vymyšlené _fbc by párování zhoršilo, ne zlepšilo.
    expect(buildFbc(null, NOW)).toBeUndefined();
    expect(buildFbc(undefined, NOW)).toBeUndefined();
    expect(buildFbc("", NOW)).toBeUndefined();
  });
});
