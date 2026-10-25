import { describe, expect, it } from "vitest";
import { loginErrorMessage } from "../errors";

describe("loginErrorMessage", () => {
  it("zná známé kódy z URL", () => {
    expect(loginErrorMessage("google")).toMatch(/Google/);
    expect(loginErrorMessage("callback")).toMatch(/platný/);
    expect(loginErrorMessage("expired")).toMatch(/vypršel/);
    expect(loginErrorMessage("potvrzeni")).toMatch(/přihlaste se/);
  });

  it("neznámý nebo chybějící kód nic nehlásí", () => {
    expect(loginErrorMessage(undefined)).toBeUndefined();
    expect(loginErrorMessage("")).toBeUndefined();
    expect(loginErrorMessage("nesmysl")).toBeUndefined();
  });

  /* ?chyba=constructor prošel přes prototyp objektu a vrátil funkci, kterou
     React vykreslit neumí. Hledání musí jít jen přes vlastní klíče. */
  it("nevrací vlastnosti prototypu", () => {
    for (const code of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(loginErrorMessage(code), code).toBeUndefined();
    }
  });
});
