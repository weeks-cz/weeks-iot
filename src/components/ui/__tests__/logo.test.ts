import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Logo } from "../Logo";

describe("Logo", () => {
  it("s mark přidá W před název a nechá aria-label", () => {
    const html = renderToStaticMarkup(createElement(Logo, { mark: true, href: "/ucim-se" }));
    expect(html).toContain('src="/brand/weeks-w.png"');
    expect(html).toContain('alt=""');
    expect(html).toContain('href="/ucim-se"');
    expect(html).toContain("Weeks");
    expect(html).toContain("Učebna");
    expect(html).toContain('aria-label="Weeks Učebna — domů"');
  });

  it("bez mark W nevykreslí", () => {
    const html = renderToStaticMarkup(createElement(Logo, { href: "/" }));
    expect(html).not.toContain("weeks-w.png");
  });
});
