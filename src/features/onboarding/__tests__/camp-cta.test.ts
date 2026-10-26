import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CampCta } from "../components/CampCta";

const render = (props: Parameters<typeof CampCta>[0]) =>
  renderToStaticMarkup(createElement(CampCta, props));

describe("CampCta podle kraje", () => {
  it("Karlovarsko: otevřené přihlašování a odkaz na termíny v KV", () => {
    const html = render({ segment: "camp", city: "karlovy-vary", placement: "ucet" });
    expect(html).toContain("Příměstský tábor v Karlových Varech — skutečné Arduino a 3D tisk.");
    expect(html).toContain("Podívat se na termíny");
    expect(html).not.toContain("připravujeme");
    expect(html).toContain("/tabory?mesto=karlovy-vary&amp;utm_source=ucebna");
  });

  it("Praha a Středočeský: sběr zájmu, žádný slib termínu", () => {
    const html = render({ segment: "camp", city: "praha", placement: "ucet" });
    expect(html).toContain("Příměstský tábor v Praze — skutečné Arduino a 3D tisk, termíny připravujeme.");
    expect(html).toContain("Dát mi vědět o termínech");
    expect(html).toContain("/tabory?mesto=praha&amp;");
  });

  it("mimo spád čekačka na město, žádný odkaz na tábory", () => {
    const html = render({ segment: "waitlist", city: null, placement: "ucet" });
    expect(html).toContain("Zatím jezdíme jen v Praze a Karlových Varech");
    expect(html).not.toContain("weeks.cz/tabory");
  });
});
