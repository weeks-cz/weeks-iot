import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CertificateTile } from "../components/CertificateTile";

const props = {
  certificate: null,
  pdfHref: "/ucet/certifikat/child-1/iot/",
  nick: "Kuba",
  course: { title: "IoT", projectTitle: "Chytrý dům" },
  lessons: 7,
};

describe("CertificateTile — kurz hotový, certifikát se nenačetl", () => {
  it("neposílá do sbírky (tam dlaždice sama stojí), ale do účtu rodiče", () => {
    const html = renderToStaticMarkup(createElement(CertificateTile, { ...props, remaining: 0 }));
    expect(html).toContain("Certifikát se nenačetl, zkus to za chvíli znovu.");
    expect(html).toContain('href="/ucet"');
    expect(html).not.toContain("/ucim-se/sbirka");
  });

  it("před dokončením zůstává zámek a počet chybějících lekcí", () => {
    const html = renderToStaticMarkup(createElement(CertificateTile, { ...props, remaining: 2 }));
    expect(html).toContain("Chybí ti ještě 2 lekce.");
    expect(html).not.toContain("se nenačetl");
  });
});
