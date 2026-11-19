import { describe, expect, it } from "vitest";
import {
  requestTokenSecret,
  signRequestId,
  verifyRequestToken,
} from "../token";

const SECRET = "test-secret-aaaaaaaaaaaaaaaaaaaaaaaa";
const ID = "3f2b8c1e-5d4a-4c6b-9a1e-0123456789ab";

describe("podepsaný token", () => {
  it("round-trip vrátí původní id", () => {
    expect(verifyRequestToken(signRequestId(ID, SECRET), SECRET)).toBe(ID);
  });

  it("formát je <id>.<base64url>", () => {
    expect(signRequestId(ID, SECRET)).toMatch(
      new RegExp(`^${ID}\.[A-Za-z0-9_-]{43}$`),
    );
  });

  it("změněný podpis vrátí null", () => {
    const token = signRequestId(ID, SECRET);
    const last = token.slice(-1) === "A" ? "B" : "A";
    expect(verifyRequestToken(token.slice(0, -1) + last, SECRET)).toBeNull();
  });

  it("změněné id vrátí null", () => {
    const [, sig] = signRequestId(ID, SECRET).split(".");
    expect(verifyRequestToken(`other-id.${sig}`, SECRET)).toBeNull();
  });

  it("cizí secret vrátí null", () => {
    expect(
      verifyRequestToken(signRequestId(ID, SECRET), "jiny-secret"),
    ).toBeNull();
  });

  it("nesmysl vrátí null", () => {
    expect(verifyRequestToken("abc", SECRET)).toBeNull();
    expect(verifyRequestToken("", SECRET)).toBeNull();
    expect(verifyRequestToken(".", SECRET)).toBeNull();
    expect(verifyRequestToken(`${ID}.`, SECRET)).toBeNull();
  });
});

describe("requestTokenSecret", () => {
  it("vrátí hodnotu z prostředí", () => {
    process.env.DEVICE_LINK_SECRET = "abc";
    expect(requestTokenSecret()).toBe("abc");
  });

  it("bez hodnoty vyhodí (fail-closed)", () => {
    delete process.env.DEVICE_LINK_SECRET;
    expect(() => requestTokenSecret()).toThrow();
    process.env.DEVICE_LINK_SECRET = "  ";
    expect(() => requestTokenSecret()).toThrow();
    delete process.env.DEVICE_LINK_SECRET;
  });
});
