import { describe, expect, it } from "vitest";
import { generateRawNonce, hashNonce } from "../google";
import { afterSignInPath } from "../post-login";

describe("nonce pro Google", () => {
  it("hash je SHA-256 surového nonce (ověřený vektor)", async () => {
    expect(await hashNonce("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("surový nonce je 64 hex znaků a pokaždé jiný", () => {
    const a = generateRawNonce();
    const b = generateRawNonce();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it("hash surového nonce se liší od surového (Google dostane jen hash)", async () => {
    const raw = generateRawNonce();
    expect(await hashNonce(raw)).not.toBe(raw);
  });
});

describe("afterSignInPath", () => {
  it("bez dokončeného onboardingu jde vždy do onboardingu, i s bezpečným next", () => {
    expect(afterSignInPath({ onboardingDone: false, next: "/ucet" })).toBe("/registrace/onboarding");
  });

  it("dokončený onboarding respektuje bezpečný next", () => {
    expect(afterSignInPath({ onboardingDone: true, next: "/ucim-se" })).toBe("/ucim-se");
  });

  it("nebezpečný next spadne na /ucet", () => {
    expect(afterSignInPath({ onboardingDone: true, next: "https://evil.example" })).toBe("/ucet");
    expect(afterSignInPath({ onboardingDone: true, next: "//evil.example" })).toBe("/ucet");
    expect(afterSignInPath({ onboardingDone: true, next: undefined })).toBe("/ucet");
  });
});
