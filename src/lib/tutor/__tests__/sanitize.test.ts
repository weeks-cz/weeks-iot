import { describe, it, expect } from "vitest";
import { LIMITS, clampText, stripControlChars, sanitizeText } from "../sanitize";

const NUL = String.fromCharCode(0);
const BEL = String.fromCharCode(7);

describe("clampText", () => {
  it("leaves short text untouched", () => {
    expect(clampText("ahoj", 10)).toBe("ahoj");
  });
  it("truncates text longer than max", () => {
    expect(clampText("abcdefghij", 4)).toBe("abcd");
  });
});

describe("stripControlChars", () => {
  it("removes NUL and other control chars but keeps newlines and tabs", () => {
    expect(stripControlChars("a" + NUL + "b" + BEL + "c")).toBe("abc");
    expect(stripControlChars("line1\nline2\tend")).toBe("line1\nline2\tend");
  });
});

describe("sanitizeText", () => {
  it("trims, strips control chars and clamps", () => {
    expect(sanitizeText("  hej   ", 100)).toBe("hej");
  });
  it("never exceeds the max length", () => {
    const long = "x".repeat(5000);
    expect(sanitizeText(long, LIMITS.userMsgLen).length).toBe(LIMITS.userMsgLen);
  });
  it("handles non-string input defensively", () => {
    expect(sanitizeText(undefined, 100)).toBe("");
    expect(sanitizeText(42, 100)).toBe("");
  });
});

describe("LIMITS", () => {
  it("exposes sane caps", () => {
    expect(LIMITS.userMsgLen).toBeGreaterThan(0);
    expect(LIMITS.code).toBeGreaterThan(LIMITS.userMsgLen);
    expect(LIMITS.maxMessages).toBeGreaterThan(1);
  });
});
