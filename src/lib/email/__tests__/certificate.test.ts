import { describe, expect, it } from "vitest";
import { certificateEmail } from "../certificate";

const base = { nick: "Kuba", courseTitle: "Elektronika a IoT", projectTitle: "Noční světlo" };

function allText(t: ReturnType<typeof certificateEmail>): string {
  const c = t.content;
  return [t.subject, c.preheader, c.heading, ...c.paragraphs, c.button?.label ?? "", c.footnote ?? ""].join(" ");
}

describe("certificateEmail", () => {
  it("nepotřebuje znát pohlaví dítěte", () => {
    for (const formal of [true, false]) {
      for (const camp of [true, false]) {
        expect(allText(certificateEmail({ ...base, formal, camp }))).not.toMatch(
          /(prošel|prošla|dokončil|dokončila|zvládl|zvládla)/,
        );
      }
    }
  });

  it("rodiči vyká a jmenuje dítě i kurz", () => {
    const t = certificateEmail({ ...base, formal: true, camp: false });
    expect(t.subject).toContain("Kuba");
    expect(allText(t)).toContain("Elektronika a IoT");
    expect(allText(t)).toMatch(/Vám|vám|najdete/);
  });

  it("samostatnému účtu tyká", () => {
    const t = certificateEmail({ ...base, formal: false, camp: false });
    expect(allText(t)).not.toMatch(/\bVaše\b|\bvaše\b|najdete/);
    expect(allText(t)).toMatch(/najdeš|máš|Tvůj|tvůj/);
  });

  it("bez souhlasu žádný tábor a žádná zmínka o obchodním sdělení", () => {
    const t = certificateEmail({ ...base, formal: true, camp: false });
    expect(allText(t)).not.toMatch(/tábor/i);
    expect(allText(t)).not.toMatch(/obchodní sdělení/i);
    expect(t.content.button?.url ?? "").not.toContain("weeks.cz/tabory");
  });

  it("se souhlasem přidá tábor a řekne, že je to obchodní sdělení", () => {
    const t = certificateEmail({ ...base, formal: true, camp: true });
    expect(allText(t)).toMatch(/tábor/i);
    expect(t.content.footnote).toMatch(/obchodní sdělení/i);
  });
});
