import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CertificateFace } from "../components/CertificateFace";
import { formatCertificateDate, type CertificateData } from "../document";

const data: CertificateData = {
  name: "Lukáš",
  courseTitle: "IoT a elektronika",
  projectTitle: "Noční světlo",
  skills: [],
  completedAt: "2026-10-26T15:30:00.000Z",
};

function render(props: Parameters<typeof CertificateFace>[0]) {
  return renderToStaticMarkup(createElement(CertificateFace, props));
}

describe("CertificateFace", () => {
  describe("s daty", () => {
    const html = render({ data, lessons: 7 });

    it("nese jméno, kurz, projekt a vydavatele", () => {
      expect(html).toContain("Lukáš");
      expect(html).toContain("IoT a elektronika");
      expect(html).toContain("Noční světlo");
      expect(html).toContain("Weeks s.r.o.");
    });

    it("datum píše stejně jako PDF", () => {
      expect(html).toContain(`Dokončeno ${formatCertificateDate(data.completedAt)}`);
    });

    it("pečeť počítá lekce z kurzu, ne napevno", () => {
      expect(html).toContain("7 / 7");
      expect(render({ data, lessons: 9 })).toContain("9 / 9");
      expect(html).toContain("lekcí");
      expect(render({ data, lessons: 1 })).toMatch(/1 \/ 1<br\/>lekce</);
    });

    it("je dekorace — čtečka ho přeskočí", () => {
      /* React 19 před první element přidá <link rel="preload"> pro obrázek. */
      expect(html.slice(html.indexOf("<div"))).toMatch(/^<div aria-hidden="true"/);
    });

    it("jméno se zalomí, nejvýš na dva řádky", () => {
      expect(html).toContain("break-words");
      expect(html).toContain("line-clamp-2");
    });
  });

  describe("bez účtu", () => {
    it("místo jména ukáže vybledlé „Tvoje jméno“", () => {
      const html = render({ data: null, lessons: 7 });
      expect(html).toContain("Tvoje jméno");
      expect(html).toContain("text-ink/40");
      expect(html).toContain("7 / 7");
      expect(html).not.toContain("Dokončeno");
    });

    it("vlastní zástupné jméno a kurz", () => {
      const html = render({
        data: null,
        placeholderName: "Tady bude tvoje jméno",
        lessons: 7,
        course: { title: "IoT a elektronika", projectTitle: "Noční světlo" },
      });
      expect(html).toContain("Tady bude tvoje jméno");
      expect(html).toContain("IoT a elektronika");
      expect(html).toContain("projekt Noční světlo");
    });
  });

  describe("dlouhá přezdívka", () => {
    const NAME_CLASS = /<p class="([^"]*)">([^<]*)<\/p>/g;

    function nameClass(html: string, name: string): string {
      for (const [, cls, text] of html.matchAll(NAME_CLASS)) {
        if (text === name && cls) return cls;
      }
      throw new Error(`jméno ${name} v markupu není`);
    }

    it("24 znaků dostane menší písmo než krátké jméno", () => {
      const long = "Maximiliánekxxxxxxxxxxxx";
      expect(long).toHaveLength(24);
      const longCls = nameClass(render({ data: { ...data, name: long }, lessons: 7 }), long);
      const shortCls = nameClass(render({ data, lessons: 7 }), "Lukáš");
      expect(longCls).toContain("text-[6.5cqw]");
      expect(shortCls).toContain("text-[10cqw]");
      expect(longCls).not.toContain("text-[10cqw]");
    });

    it("14 znaků ještě plnou velikostí", () => {
      const name = "Abcdefghijklmn";
      expect(nameClass(render({ data: { ...data, name }, lessons: 7 }), name)).toContain(
        "text-[10cqw]",
      );
    });
  });
});
