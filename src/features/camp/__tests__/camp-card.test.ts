import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CampCard } from "../components/CampCard";

const render = (props: Parameters<typeof CampCard>[0]) =>
  renderToStaticMarkup(createElement(CampCard, props));
const textOf = (html: string) => html.replace(/<[^>]*>/g, " ");

describe("CampCard", () => {
  it("lobby: UTM s placementem a text karty", () => {
    const html = render({
      offer: { kind: "open", city: "karlovy-vary" },
      placement: "lobby",
      size: "tile",
    });
    expect(html).toContain("utm_content=lobby");
    expect(html).toContain("Tohle všechno naživo");
    expect(html).toContain("v Karlových Varech");
  });

  it("v textu žádná čísla kromě 2027 (a 3D tisku), tedy žádná data ani ceny", () => {
    for (const offer of [
      { kind: "open", city: null },
      { kind: "soon", city: "praha" },
    ] as const) {
      const text = textOf(render({ offer, placement: "finale" }))
        .replace("2027", "")
        .replace("3D", "");
      expect(text).not.toMatch(/\d/);
    }
  });

  it("soon: termíny připravujeme; obecná nabídka jmenuje obě města", () => {
    expect(render({ offer: { kind: "soon", city: "praha" }, placement: "finale" })).toContain(
      "termíny připravujeme",
    );
    expect(render({ offer: { kind: "open", city: null }, placement: "finale-anonym" })).toContain(
      "v Praze a Karlových Varech",
    );
  });
});
