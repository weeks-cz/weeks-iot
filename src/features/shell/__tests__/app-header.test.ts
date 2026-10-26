import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppHeader } from "../components/AppHeader";
import type { Viewer } from "../home-href";

const render = (viewer: Viewer, extra: { tone?: "dark" | "light"; inLesson?: boolean } = {}) =>
  renderToStaticMarkup(createElement(AppHeader, { viewer, ...extra }));

/** href loga — Logo má jako jediný odkaz aria-label „Weeks Učebna — domů“. */
const logoHref = (html: string) =>
  html.match(/<a[^>]*href="([^"]*)"[^>]*aria-label="Weeks Učebna — domů"/)?.[1] ??
  html.match(/<a[^>]*aria-label="Weeks Učebna — domů"[^>]*href="([^"]*)"/)?.[1];

describe("AppHeader", () => {
  it("anonym: Přihlásit a Zkusit zdarma, žádná dětská navigace, logo na /", () => {
    const html = render({ kind: "anon" });
    expect(html).toContain("Přihlásit");
    expect(html).toContain("Zkusit zdarma");
    expect(html).not.toContain("Sbírka");
    expect(logoHref(html)).toBe("/");
  });

  it("anonym v lekci: bez amber Zkusit zdarma", () => {
    const html = render({ kind: "anon" }, { inLesson: true });
    expect(html).toContain("Přihlásit");
    expect(html).not.toContain("Zkusit zdarma");
  });

  it("rodič bez profilu: Vybrat profil a Účet rodiče, logo do učebny", () => {
    const html = render({ kind: "parent" });
    expect(html).toContain("Vybrat profil");
    expect(html).toContain("Účet rodiče");
    expect(html).not.toContain("Přihlásit");
    expect(logoHref(html)).toBe("/ucim-se");
  });

  it("dítě: navigace se Sbírkou, přezdívka, menu pod avatarem, logo do lobby", () => {
    const html = render({ kind: "child", nick: "Ája", avatar: "raketa" });
    expect(html).toContain("Sbírka");
    expect(html).toContain('href="/ucim-se/sbirka"');
    expect(html).toContain("Ája");
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Přihlásit");
    expect(logoHref(html)).toBe("/ucim-se");
  });

  it("světlá varianta pro přihlášeného: Do učebny místo Přihlásit", () => {
    for (const viewer of [{ kind: "parent" }, { kind: "child", nick: "Ája", avatar: "robot" }] as const) {
      const html = render(viewer, { tone: "light" });
      expect(html).toContain("Do učebny");
      expect(html).not.toContain("Přihlásit");
      expect(logoHref(html)).toBe("/ucim-se");
    }
  });

  it("světlá varianta pro anonyma: Přihlásit jako dnes", () => {
    const html = render({ kind: "anon" }, { tone: "light" });
    expect(html).toContain("Přihlásit");
    expect(html).not.toContain("Do učebny");
  });
});
