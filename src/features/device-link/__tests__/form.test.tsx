import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());

vi.mock("@/features/analytics/track", async (orig) => ({
  ...(await orig<typeof import("@/features/analytics/track")>()),
  track,
}));
/* Formulář v testu nikdy nic neodešle: akce je podvržená. */
vi.mock("../actions", () => ({
  requestDeviceLink: vi.fn(async () => ({})),
}));

import { DeviceLinkForm } from "../components/DeviceLinkForm";
import { DeviceOrder } from "../components/DeviceOrder";

function stubPointer(coarse: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === "(pointer: coarse)" ? coarse : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

const viewCalls = () => track.mock.calls.filter(([name]) => name === "device_link_view");

beforeEach(() => {
  track.mockReset();
});
afterEach(() => {
  cleanup();
  /* jsdom matchMedia nemá; po testu ho zase odebereme. */
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("DeviceLinkForm", () => {
  it("souhlas s dalšími e-maily není předvyplněný", () => {
    render(<DeviceLinkForm variant="mobile" />);
    const consent = screen.getByRole("checkbox");
    expect(consent).toHaveProperty("checked", false);
    expect(consent.getAttribute("name")).toBe("marketingConsent");
  });

  it("honeypot je skrytý před lidmi i čtečkou", () => {
    const { container } = render(<DeviceLinkForm variant="mobile" />);
    const honeypot = container.querySelector<HTMLInputElement>('input[name="website"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot!.tabIndex).toBe(-1);
    expect(honeypot!.closest('[aria-hidden="true"]')).not.toBeNull();
    /* Jediné textové pole, které čtečka uvidí, je e-mail. */
    expect(screen.getAllByRole("textbox").map((el) => el.getAttribute("name"))).toEqual(["email"]);
  });

  it("na telefonu radí počítač, na počítači nabízí jiný počítač", () => {
    const { unmount } = render(<DeviceLinkForm variant="mobile" />);
    expect(
      screen.getByRole("heading", { name: /^Nejlíp to jde na počítači s\u00a0myší\. Pošleme vám odkaz\.$/ }),
    ).toBeTruthy();
    unmount();

    render(<DeviceLinkForm variant="desktop" />);
    expect(screen.getByRole("heading", { name: "Poslat odkaz na jiný počítač" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Poslat odkaz na počítač" })).toBeTruthy();
  });

  it("zobrazení měří jednou, s variantou", () => {
    const { rerender } = render(<DeviceLinkForm variant="desktop" />);
    rerender(<DeviceLinkForm variant="desktop" />);
    expect(viewCalls()).toEqual([["device_link_view", { variant: "desktop" }]]);
  });

  it("dokud není zařízení rozpoznané, zobrazení neměří", () => {
    const { rerender } = render(<DeviceLinkForm variant="mobile" trackView={false} />);
    expect(viewCalls()).toEqual([]);
    rerender(<DeviceLinkForm variant="desktop" trackView />);
    expect(viewCalls()).toEqual([["device_link_view", { variant: "desktop" }]]);
  });
});

describe("DeviceOrder", () => {
  const href = "/kurz/iot/rozsvit-ledku";

  it("na počítači nahoře lekce, formulář je druhá možnost", async () => {
    stubPointer(false);
    await act(async () => {
      render(<DeviceOrder lessonHref={href} />);
    });

    const lesson = screen.getByRole("link", { name: /Začít první lekci/ });
    expect(lesson.getAttribute("href")).toMatch(/\/kurz\/iot\/rozsvit-ledku\/?$/);
    expect(screen.getByRole("heading", { name: "Poslat odkaz na jiný počítač" })).toBeTruthy();
    expect(viewCalls()).toEqual([["device_link_view", { variant: "desktop" }]]);
  });

  it("na telefonu formulář a pod ním odkaz do lekce", async () => {
    stubPointer(true);
    await act(async () => {
      render(<DeviceOrder lessonHref={href} />);
    });

    const lesson = screen.getByRole("link", { name: /Přesto zkusit na telefonu/ });
    expect(lesson.getAttribute("href")).toMatch(/\/kurz\/iot\/rozsvit-ledku\/?$/);
    expect(viewCalls()).toEqual([["device_link_view", { variant: "mobile" }]]);
  });

  it("klik do lekce měří umístění", async () => {
    stubPointer(true);
    await act(async () => {
      render(<DeviceOrder lessonHref={href} />);
    });
    screen.getByRole("link", { name: /Přesto zkusit na telefonu/ }).addEventListener(
      "click",
      (e) => e.preventDefault(),
    );
    act(() => {
      screen.getByRole("link", { name: /Přesto zkusit na telefonu/ }).click();
    });
    expect(track).toHaveBeenCalledWith("parent_page_lesson_click", { placement: "phone_anyway" });
  });
});
