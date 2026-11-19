import { describe, expect, it } from "vitest";
import {
  DEVICE_LINK_UTM_TERMS,
  summarizeDeviceLink,
} from "../device-link-stats";

describe("summarizeDeviceLink", () => {
  const requests = [
    { opened_at: "2026-11-20T10:00:00Z", verified_at: "2026-11-20T10:00:00Z" },
    // otevřeno jen na telefonu: ověřená schránka, ale ne počítač
    { opened_at: null, verified_at: "2026-11-20T11:00:00Z" },
    { opened_at: null, verified_at: null },
  ];
  const parents = [
    { utm_term: "odkaz-na-pc", onboarding_completed_at: "2026-11-21T10:00:00Z" },
    // nedokončený onboarding se nepočítá
    { utm_term: "pripominka-na-pc", onboarding_completed_at: null },
    // jiný zdroj se nepočítá
    { utm_term: "jiny", onboarding_completed_at: "2026-11-21T10:00:00Z" },
    { utm_term: null, onboarding_completed_at: "2026-11-21T10:00:00Z" },
  ];

  it("počítá sloupce, ne události", () => {
    expect(summarizeDeviceLink(requests, parents)).toEqual({
      requested: 3,
      openedOnComputer: 1,
      verified: 2,
      registrations: 1,
    });
  });

  it("do registrací počítá i připomínku", () => {
    const r = summarizeDeviceLink([], [
      { utm_term: "pripominka-na-pc", onboarding_completed_at: "2026-11-21T10:00:00Z" },
    ]);
    expect(r.registrations).toBe(1);
    expect(DEVICE_LINK_UTM_TERMS).toEqual(["odkaz-na-pc", "pripominka-na-pc"]);
  });

  it("prázdný vstup dá nuly", () => {
    expect(summarizeDeviceLink([], [])).toEqual({
      requested: 0,
      openedOnComputer: 0,
      verified: 0,
      registrations: 0,
    });
  });
});
