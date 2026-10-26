import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/ucim-se/" }));
/* Serverová akce v jsdom nepoběží a táhne serverové moduly; tady jde jen o ovládání. */
vi.mock("@/features/auth/actions", () => ({ signOutAction: vi.fn() }));

import { AvatarMenu } from "../components/AvatarMenu";

describe("AvatarMenu — klávesnice a klik mimo", () => {
  beforeEach(() => {
    /* jsdom nepočítá layout, takže by žádná položka nebyla „vidět“. */
    vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const trigger = () => screen.getByRole("button", { name: /Ája/ });

  it("otevře se, fokus jde na první položku, Esc zavře a vrátí fokus", () => {
    render(<AvatarMenu nick="Ája" avatar="raketa" />);
    expect(trigger().getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "Domů",
      "Kurzy",
      "Sbírka",
      "Změnit avatar",
      "Přepnout profil",
      "Účet rodiče",
      "Odhlásit",
    ]);
    expect(document.activeElement).toBe(items[0]);
    expect(items[0]!.getAttribute("aria-current")).toBe("page");

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("šipky chodí dokola, End/Home na kraje; ArrowDown na spouštěči otevře", () => {
    render(<AvatarMenu nick="Ája" avatar="raketa" />);
    trigger().focus();
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    const items = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(items[0]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement?.textContent).toBe("Odhlásit");
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
  });

  it("odkazy vedou na avatar, přepnutí profilu a účet rodiče", () => {
    render(<AvatarMenu nick="Ája" avatar="raketa" />);
    fireEvent.click(trigger());
    const href = (name: string) => screen.getByRole("menuitem", { name }).getAttribute("href");
    expect(href("Změnit avatar")).toBe("/ucim-se/avatar");
    expect(href("Přepnout profil")).toBe("/ucim-se/prepnout");
    expect(href("Účet rodiče")).toBe("/ucet");
  });

  it("klik mimo menu zavře", () => {
    render(
      <div>
        <p>venku</p>
        <AvatarMenu nick="Ája" avatar="raketa" />
      </div>,
    );
    fireEvent.click(trigger());
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.pointerDown(screen.getByText("venku"));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
