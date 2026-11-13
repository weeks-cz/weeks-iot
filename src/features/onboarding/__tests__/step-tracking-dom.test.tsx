import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const trackOnce = vi.hoisted(() => vi.fn());

vi.mock("@/features/analytics/track", async (orig) => ({
  ...(await orig<typeof import("@/features/analytics/track")>()),
  trackOnce,
}));
vi.mock("@/features/onboarding/actions", () => ({
  completeOnboardingAction: vi.fn(async () => ({})),
}));

import { OnboardingWizard } from "../components/OnboardingWizard";

const regions = [
  { code: "PHA", name: "Hlavní město Praha", isCatchment: true },
  { code: "JHM", name: "Jihomoravský kraj", isCatchment: false },
];

beforeEach(() => {
  trackOnce.mockReset();
  window.sessionStorage.clear();
});
afterEach(cleanup);

const stepCalls = () =>
  trackOnce.mock.calls.filter(([name]) => name === "onboarding_step_view");

describe("onboarding měří vstup do kroků", () => {
  it("krok 1 hned při zobrazení, i když fokus první vykreslení přeskakuje", () => {
    render(<OnboardingWizard regions={regions} />);
    expect(stepCalls()).toContainEqual(["onboarding_step_view", "1", { step: 1 }]);
  });

  it("každý krok má vlastní klíč, takže návrat zpět nic nezdvojí", () => {
    render(<OnboardingWizard regions={regions} />);

    fireEvent.click(screen.getByRole("button", { name: "Pokračovat" }));
    expect(stepCalls()).toContainEqual(["onboarding_step_view", "2", { step: 2 }]);

    /* Skrytý krok 1 není v přístupnostním stromu, takže tlačítko je jen
       jedno — to z kroku 2. */
    fireEvent.click(screen.getByRole("button", { name: "Pokračovat" }));
    expect(stepCalls()).toContainEqual(["onboarding_step_view", "3", { step: 3 }]);

    /* Klíče jsou jen "1", "2", "3" — deduplikaci pak dělá trackOnce. */
    const keys = new Set(stepCalls().map(([, key]) => key));
    expect([...keys].sort()).toEqual(["1", "2", "3"]);
  });
});
