import { describe, expect, it } from "vitest";
import {
  COOKIE_CONSENT_VERSION,
  parseCookieConsent,
  pixelAllowedFor,
  serializeCookieConsent,
} from "../consent";

describe("parseCookieConsent", () => {
  it("chybějící hodnota znamená nerozhodnuto", () => {
    expect(parseCookieConsent(null)).toBeNull();
  });

  it("poškozený JSON znamená nerozhodnuto, nevyhodí výjimku", () => {
    expect(parseCookieConsent("{nesmysl")).toBeNull();
  });

  it("souhlas z jiné verze se ptá znovu", () => {
    const old = JSON.stringify({ analytics: true, marketing: true, v: COOKIE_CONSENT_VERSION + 1, ts: 1 });
    expect(parseCookieConsent(old)).toBeNull();
  });

  it("neúplný objekt nepřijme", () => {
    const raw = JSON.stringify({ analytics: true, v: COOKIE_CONSENT_VERSION, ts: 1 });
    expect(parseCookieConsent(raw)).toBeNull();
  });

  it("zapsaná volba se přečte zpět beze ztráty", () => {
    const raw = serializeCookieConsent({ analytics: true, marketing: false }, 123);
    expect(parseCookieConsent(raw)).toEqual({
      analytics: true,
      marketing: false,
      v: COOKIE_CONSENT_VERSION,
      ts: 123,
    });
  });
});

describe("pixelAllowedFor", () => {
  it("povoluje veřejnou část a rodičovskou zónu", () => {
    for (const p of ["/", "/kurz/iot", "/registrace", "/registrace/onboarding", "/prihlaseni", "/ucet", "/ucet/deti/", "/ochrana-udaju"]) {
      expect(pixelAllowedFor(p), p).toBe(true);
    }
  });

  it("nepouští pixel na dětské obrazovky ani na lekce", () => {
    for (const p of ["/ucim-se", "/ucim-se/prepnout", "/kurz/iot/lekce-1", "/kurz/iot/lekce-1/"]) {
      expect(pixelAllowedFor(p), p).toBe(false);
    }
  });

  it("nepouští pixel na legacy tábor", () => {
    expect(pixelAllowedFor("/tabor")).toBe(false);
    expect(pixelAllowedFor("/tabor/admin")).toBe(false);
  });
});
