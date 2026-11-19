import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
const requestDeviceLink = vi.hoisted(() => vi.fn(async () => ({}) as Record<string, string>));

vi.mock("@/features/analytics/track", async (orig) => ({
  ...(await orig<typeof import("@/features/analytics/track")>()),
  track,
}));
/* Formulář v testu nikdy nic neodešle: akce je podvržená. */
vi.mock("../actions", () => ({ requestDeviceLink }));

import { DEVICE_LINK_MARKETING_TEXT } from "@/features/consent/texts";
import { DeviceLinkForm } from "../components/DeviceLinkForm";
import { DeviceOrder } from "../components/DeviceOrder";

const MOBILE_HEADING = /^Nejlíp to jde na počítači s\u00a0myší\. Pošleme vám odkaz\.$/;
const DESKTOP_HEADING = "Nemáte teď čas? Pošleme vám odkaz e-mailem.";

/** `fine` = myš (počítač), jinak prst (telefon). */
function stubPointer(fine: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === "(pointer: fine)" ? fine : query === "(pointer: coarse)" ? !fine : false,
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
  requestDeviceLink.mockReset();
  requestDeviceLink.mockResolvedValue({});
});
afterEach(() => {
  cleanup();
  /* jsdom matchMedia nemá; po testu ho zase odebereme. */
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("DeviceLinkForm", () => {
  it("souhlas s dalšími e-maily není předvyplněný a znění je beze změny", () => {
    render(<DeviceLinkForm variant="mobile" />);
    const consent = screen.getByRole("checkbox");
    expect(consent).toHaveProperty("checked", false);
    expect(consent.getAttribute("name")).toBe("marketingConsent");
    /* Testing Library v textu stránky slévá bílé znaky (i nezlomitelnou
       mezeru) do mezery; hledaný text proto stejně. Že nezlomitelné mezery
       v popisku jsou, hlídá textContent níž. */
    const label = DEVICE_LINK_MARKETING_TEXT.label.replace(/\s+/g, " ");
    expect(screen.getByLabelText(label)).toBe(consent);
    expect(consent.closest("label")?.textContent ?? document.body.textContent).toContain(
      DEVICE_LINK_MARKETING_TEXT.label,
    );
    expect(screen.getByText("Zobrazit plné znění")).toBeTruthy();
  });

  it("souhlas stojí mezi e-mailem a tlačítkem, věta o údajích pod tlačítkem", () => {
    render(<DeviceLinkForm variant="mobile" />);
    const email = screen.getByRole("textbox", { name: /e-mail/i });
    const consent = screen.getByRole("checkbox");
    const submit = screen.getByRole("button", { name: "Poslat odkaz na počítač" });
    const privacy = screen.getByRole("link", { name: "ochraně údajů" });

    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(email, consent)).toBe(true);
    expect(follows(consent, submit)).toBe(true);
    expect(follows(submit, privacy)).toBe(true);
  });

  it("honeypot je skrytý před lidmi i čtečkou", () => {
    const { container } = render(<DeviceLinkForm variant="mobile" />);
    const honeypot = container.querySelector<HTMLInputElement>('input[name="hp_field_x"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot!.tabIndex).toBe(-1);
    expect(honeypot!.getAttribute("autocomplete")).toBe("off");
    /* Název ani popisek nesmí vypadat jako pole, které vyplní automatické
       doplňování prohlížeče (web, url, jméno…): rodič by „byl robot“. */
    expect(container.querySelector('input[name="website"]')).toBeNull();
    expect(honeypot!.closest("label")?.textContent).not.toMatch(/web|url|www|jméno|telefon/i);
    expect(honeypot!.closest('[aria-hidden="true"]')).not.toBeNull();
    /* Jediné textové pole, které čtečka uvidí, je e-mail. */
    expect(screen.getAllByRole("textbox").map((el) => el.getAttribute("name"))).toEqual(["email"]);
  });

  it("na telefonu radí počítač, na počítači nabízí odkaz na později", () => {
    const { unmount } = render(<DeviceLinkForm variant="mobile" />);
    expect(screen.getByRole("heading", { name: MOBILE_HEADING })).toBeTruthy();
    unmount();

    render(<DeviceLinkForm variant="desktop" />);
    expect(screen.getByRole("heading", { name: DESKTOP_HEADING })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Poslat odkaz e-mailem" })).toBeTruthy();
  });

  it("HTML ze serveru drží nezlomitelné mezery (k odeslání, v ochraně, s myší)", () => {
    const html = renderToString(<DeviceLinkForm variant="auto" />);
    const text = new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
    expect(text).toContain("k\u00a0odeslání");
    expect(text).toContain("v\u00a0ochraně údajů");
    expect(text).toContain("s\u00a0myší");
    expect(text).toContain(DEVICE_LINK_MARKETING_TEXT.label);
  });

  it("auto: oba nadpisy v HTML ze serveru, nesprávný schová CSS podle ukazatele", () => {
    const html = renderToString(<DeviceLinkForm variant="auto" />);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const headings = [...doc.querySelectorAll("h2")];
    expect(headings.map((h) => h.textContent)).toEqual([
      "Nejlíp to jde na počítači s\u00a0myší. Pošleme vám odkaz.",
      DESKTOP_HEADING,
    ]);
    expect(headings[0]!.className).toContain("pointer-fine:hidden");
    expect(headings[1]!.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(headings[1]!.className).toContain("pointer-fine:block");
    /* Tlačítko je amber a na počítači ho přebarví CSS. */
    expect(doc.querySelector('button[type="submit"]')?.className).toContain("pointer-fine:bg-ink");
  });

  it("zobrazení měří jednou, s pevnou variantou", () => {
    const { rerender } = render(<DeviceLinkForm variant="desktop" />);
    rerender(<DeviceLinkForm variant="desktop" />);
    expect(viewCalls()).toEqual([["device_link_view", { variant: "desktop" }]]);
  });

  it("auto měří zařízení podle ukazatele; bez matchMedia jako telefon", () => {
    stubPointer(true);
    const first = render(<DeviceLinkForm variant="auto" />);
    expect(viewCalls()).toEqual([["device_link_view", { variant: "desktop" }]]);
    first.unmount();

    track.mockReset();
    stubPointer(false);
    const second = render(<DeviceLinkForm variant="auto" />);
    expect(viewCalls()).toEqual([["device_link_view", { variant: "mobile" }]]);
    second.unmount();

    track.mockReset();
    delete (window as { matchMedia?: unknown }).matchMedia;
    render(<DeviceLinkForm variant="auto" />);
    expect(viewCalls()).toEqual([["device_link_view", { variant: "mobile" }]]);
  });

  it("po úspěchu přejde fokus na potvrzení", async () => {
    requestDeviceLink.mockResolvedValue({
      success: "Hotovo. Odkaz je na cestě na rodic@example.cz. Otevřete ho na počítači.",
    });
    render(<DeviceLinkForm variant="mobile" />);
    fireEvent.change(screen.getByRole("textbox", { name: /e-mail/i }), {
      target: { value: "rodic@example.cz" },
    });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Poslat odkaz na počítač" }).closest("form")!);
    });

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Odkaz je na cestě");
    expect(document.activeElement).toBe(status.parentElement);
    expect(document.activeElement?.getAttribute("tabindex")).toBe("-1");
    /* Gmail e-mail umí odložit do Promoakcí: rodič má vědět, kde hledat. */
    expect(document.body.textContent).toContain("i do záložky Promoakce nebo do spamu");
  });
});

describe("DeviceOrder", () => {
  const href = "/kurz/iot/rozsvit-ledku";

  it("HTML ze serveru má obě cesty do lekce a pořadí řeší CSS", () => {
    const html = renderToString(<DeviceOrder lessonHref={href} />);
    const doc = new DOMParser().parseFromString(html, "text/html");

    const phone = [...doc.querySelectorAll("a")].find((a) =>
      a.textContent?.includes("Přesto zkusit na telefonu"),
    );
    const primary = [...doc.querySelectorAll("a")].find((a) =>
      a.textContent?.includes("Začít první lekci"),
    );
    expect(phone?.getAttribute("href")).toMatch(/\/kurz\/iot\/rozsvit-ledku\/?$/);
    expect(primary?.getAttribute("href")).toMatch(/\/kurz\/iot\/rozsvit-ledku\/?$/);
    expect(phone?.parentElement?.className).toContain("pointer-fine:hidden");
    expect(primary?.parentElement?.className).toContain("pointer-fine:block");

    const form = doc.querySelector("form")!;
    expect(form.closest(".order-1")?.className).toContain("pointer-fine:order-2");
    expect(phone?.closest(".order-2")?.className).toContain("pointer-fine:order-1");
  });

  it("každý odkaz do lekce měří své umístění", async () => {
    await act(async () => {
      render(<DeviceOrder lessonHref={href} />);
    });
    for (const name of [/Přesto zkusit na telefonu/, /Začít první lekci/]) {
      const link = screen.getByRole("link", { name });
      link.addEventListener("click", (e) => e.preventDefault());
      act(() => link.click());
    }
    expect(track).toHaveBeenCalledWith("parent_page_lesson_click", { placement: "phone_anyway" });
    expect(track).toHaveBeenCalledWith("parent_page_lesson_click", { placement: "primary" });
  });
});
