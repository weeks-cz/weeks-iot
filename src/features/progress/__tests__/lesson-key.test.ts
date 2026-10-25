import { describe, expect, it } from "vitest";
import { parseLessonKey } from "../lesson-key";

describe("parseLessonKey", () => {
  it("pustí klíč kurz/lekce", () => {
    expect(parseLessonKey("iot/blikani")).toBe("iot/blikani");
    expect(parseLessonKey("iot/rozsvit-ledku")).toBe("iot/rozsvit-ledku");
  });

  it("odmítne cokoli jiného", () => {
    for (const bad of [undefined, null, "", "iot", "iot/", "/blikani", "iot/blikani/x", "IOT/blikani", "iot/../ucet", "https://x.cz", ["iot/blikani"]]) {
      expect(parseLessonKey(bad), String(bad)).toBeNull();
    }
  });
});
