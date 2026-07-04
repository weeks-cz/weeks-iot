import { describe, it, expect } from "vitest";
import { retentionCutoffIso } from "@/lib/retention";

describe("retentionCutoffIso", () => {
  it("vrátí ISO datum 365 dní zpět", () => {
    expect(retentionCutoffIso(new Date("2026-07-04T08:00:00Z"))).toBe("2025-07-04T08:00:00.000Z");
  });
  it("respektuje vlastní počet dní", () => {
    expect(retentionCutoffIso(new Date("2026-07-04T08:00:00Z"), 30)).toBe("2026-06-04T08:00:00.000Z");
  });
});
