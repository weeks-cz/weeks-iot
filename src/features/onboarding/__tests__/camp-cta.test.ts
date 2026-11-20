import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CampCta } from "../components/CampCta";

const render = (props: Parameters<typeof CampCta>[0]) =>
  renderToStaticMarkup(createElement(CampCta, props));

describe("CampCta podle kraje", () => {
  it("Karlovarsko: otevřené přihlašování a odkaz na termíny v KV", () => {
    const html = render({ segment: "camp", offer: { kind: "open", city: "karlovy-vary" }, placement: "ucet" });
    expect(html).toContain("Příměstský tábor v Karlových Varech — skutečné Arduino a 3D tisk.");
    expect(html).toContain("Podívat se na termíny");
    expect(html).not.toContain("připravujeme");
    expect(html).toContain("/tabory?mesto=karlovy-vary&amp;utm_source=ucebna");
  });

  it("Praha otevřená: jmenuje všechny tři pražské tábory", () => {
    const html = render({ segment: "camp", offer: { kind: "open", city: "praha" }, placement: "ucet" });
    expect(html).toContain("Příměstský tábor v Praze — 3D tisk a elektronika, vlastní hra v enginu Godot nebo AI a chytrá elektronika.");
    expect(html).toContain("Podívat se na termíny");
    expect(html).not.toContain("— skutečné Arduino a 3D tisk.");
  });

  it("Praha a Středočeský: sběr zájmu, žádný slib termínu", () => {
    // Popisek tlačítka čte živý `CAMP_CITIES` (Praha je od 10. 11. 2026
    // otevřená), proto tu kontrolujeme jen větu „soon" a odkaz.
    const html = render({ segment: "camp", offer: { kind: "soon", city: "praha" }, placement: "ucet" });
    expect(html).toContain("Příměstský tábor v Praze — skutečné Arduino a 3D tisk, termíny připravujeme.");
    expect(html).toContain("/tabory?mesto=praha&amp;");
  });

  it("mimo spád čekačka na město, žádný odkaz na tábory", () => {
    const html = render({ segment: "waitlist", offer: null, placement: "ucet" });
    expect(html).toContain("Zatím jezdíme jen v Praze a Karlových Varech");
    expect(html).not.toContain("weeks.cz/tabory");
  });

  it("ve spádu bez otevřeného tábora nic — ani falešné „otevřeno“, ani čekačka", () => {
    expect(render({ segment: "camp", offer: null, placement: "ucet" })).toBe("");
  });
});
