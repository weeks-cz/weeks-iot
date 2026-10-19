import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CampCta } from "../components/CampCta";

const render = (props: Parameters<typeof CampCta>[0]) =>
  renderToStaticMarkup(createElement(CampCta, props));

describe("CampCta podle kraje", () => {
  it("Karlovarsko: otevřené přihlašování a odkaz na termíny v KV", () => {
    const html = render({ segment: "camp", city: "karlovy-vary", placement: "ucet" });
    expect(html).toContain("v Karlových Varech — přihlašování na léto 2027 je otevřené");
    expect(html).toContain("Podívat se na termíny");
    expect(html).toContain("/tabory?mesto=karlovy-vary&amp;utm_source=ucebna");
  });

  it("Praha a Středočeský: sběr zájmu, žádný slib termínu", () => {
    const html = render({ segment: "camp", city: "praha", placement: "ucet" });
    expect(html).toContain("v Praze na léto 2027 připravujeme");
    expect(html).toContain("Dát mi vědět o termínech");
    expect(html).toContain("/tabory?mesto=praha&amp;");
  });

  it("mimo spád čekačka na město, žádný odkaz na tábory", () => {
    const html = render({ segment: "waitlist", city: null, placement: "ucet" });
    expect(html).toContain("Zatím jezdíme jen v Praze a Karlových Varech");
    expect(html).not.toContain("weeks.cz/tabory");
  });
});
