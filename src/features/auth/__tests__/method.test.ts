import { describe, expect, it } from "vitest";
import { signUpMethod } from "../method";

describe("signUpMethod", () => {
  it("účet založený Googlem", () => {
    expect(signUpMethod({ app_metadata: { provider: "google" } })).toBe("google");
  });

  it("účet založený e-mailem", () => {
    expect(signUpMethod({ app_metadata: { provider: "email" } })).toBe("email");
  });

  /* Rozhoduje první identita: e-mailový účet s později propojeným Googlem
     se registroval e-mailem. */
  it("propojený Google nemění způsob registrace", () => {
    expect(
      signUpMethod({ app_metadata: { provider: "email", providers: ["email", "google"] } as never }),
    ).toBe("email");
  });

  it("bez uživatele nebo metadat je to e-mail", () => {
    expect(signUpMethod(null)).toBe("email");
    expect(signUpMethod(undefined)).toBe("email");
    expect(signUpMethod({})).toBe("email");
    expect(signUpMethod({ app_metadata: null })).toBe("email");
  });
});
