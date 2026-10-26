import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThumbPlaceholder } from "../components/CircuitThumb";

describe("ThumbPlaceholder", () => {
  const html = renderToStaticMarkup(
    createElement(ThumbPlaceholder, { label: "Blikající LED", height: 160 }),
  );

  it("nese popisek a stejnou výšku jako náhled", () => {
    expect(html).toContain('aria-label="Blikající LED"');
    expect(html).toContain("height:160px");
  });

  it("je tmavý a nekreslí žádný obvod", () => {
    expect(html).toContain("bg-ink");
    expect(html).not.toContain("<svg");
  });
});
