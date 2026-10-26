import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Circuit } from "@/features/circuit/types";
import { CourseFinale, type CourseFinaleProps } from "../components/CourseFinale";

const CHILD_ID = "6f1c2a10-0000-4000-8000-000000000001";

const base: CourseFinaleProps = {
  mode: "child",
  nick: "Kuba",
  childId: CHILD_ID,
  courseSlug: "iot",
  courseTitle: "Elektronika a IoT",
  projectTitle: "Noční světlo",
  lessons: 7,
  camp: { kind: "open", city: "karlovy-vary" },
  progressSaved: true,
  afterLesson: { slug: "nocni-svetlo", order: 7 },
  builds: [],
};

const render = (props: Partial<CourseFinaleProps> = {}) =>
  renderToStaticMarkup(createElement(CourseFinale, { ...base, ...props }));

const count = (html: string, needle: string) => html.split(needle).length - 1;
const textOf = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("CourseFinale — dítě s profilem", () => {
  const html = render();

  it("nadpis bez 5. pádu: „{nick} je konstruktér.“", () => {
    expect(html).toContain("Kuba");
    expect(textOf(html)).toContain("Kuba je konstruktér.");
    expect(html).toContain("break-words");
  });

  it("stáhne certifikát z účtu (route s lomítkem na konci, nové okno)", () => {
    expect(html).toMatch(
      new RegExp(`href="/ucet/certifikat/${CHILD_ID}/iot/"[^>]*target="_blank"`),
    );
    expect(textOf(html)).toContain("Stáhnout certifikát");
  });

  it("jediná amber akce je certifikát, lobby je obrysové", () => {
    expect(count(html, "bg-cta-500")).toBe(1);
    expect(html).toMatch(/bg-cta-500[^>]*>Stáhnout certifikát/);
    expect(html).toMatch(/href="\/ucim-se"[^>]*>Zpět do lobby/);
  });

  it("certifikát nese přezdívku, název kurzu a projekt", () => {
    expect(html).toContain("Elektronika a IoT");
    expect(html).toContain("projekt Noční světlo");
    expect(html).toContain("Dokončeno");
    expect(html).not.toContain("Tvoje jméno");
  });

  it("tábor s utm_content=finale", () => {
    expect(html).toContain('utm_content=finale"');
    expect(html).not.toContain("finale-anonym");
  });

  it("„Co dál“ vede do sbírky a slibuje další kurz", () => {
    expect(html).toContain('href="/ucim-se/sbirka"');
    expect(html).toContain("Další kurz chystáme");
  });
});

describe("CourseFinale — ukládání postupu", () => {
  it("dokud se postup ukládá, tlačítko čeká a na PDF neodkazuje", () => {
    const html = render({ progressSaved: new Promise<boolean>(() => {}) });
    expect(textOf(html)).toContain("Chystám certifikát…");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("/ucet/certifikat/");
    expect(count(html, "bg-cta-500")).toBe(1);
  });

  it("postup se neuložil: žádný odkaz na PDF, věta o účtu rodiče, lobby je amber", () => {
    const html = render({ progressSaved: false });
    expect(html).not.toContain("/ucet/certifikat/");
    expect(html).toContain("v účtu rodiče");
    expect(html).toMatch(/bg-cta-500[^>]*>Zpět do lobby/);
    expect(count(html, "bg-cta-500")).toBe(1);
  });

  it("bez id profilu (rodič bez vybraného dítěte) se na PDF neodkazuje", () => {
    const html = render({
      nick: null,
      childId: null,
      progressSaved: false,
      zapsatHref: "/ucim-se?zapsat=iot%2Fnocni-svetlo",
    });
    expect(html).not.toContain("/ucet/certifikat/");
    expect(html).toContain("Postup se zatím neukládá");
    expect(html).toContain('href="/ucim-se?zapsat=iot%2Fnocni-svetlo"');
    expect(textOf(html)).toContain("Kurz máš za sebou.");
  });
});

describe("CourseFinale — anonym", () => {
  const html = render({
    mode: "anon",
    nick: null,
    childId: null,
    progressSaved: false,
    camp: { kind: "open", city: null },
  });

  it("certifikát bez jména, ale s kurzem", () => {
    expect(html).toContain("Tvoje jméno");
    expect(html).toContain("Elektronika a IoT");
    expect(html).toContain("projekt Noční světlo");
  });

  it("nadpis „Kurz máš za sebou.“", () => {
    expect(textOf(html)).toContain("Kurz máš za sebou.");
  });

  it("amber registrace, sekundárně přehled kurzu, žádné PDF ani lobby", () => {
    expect(html).toMatch(/href="\/registrace"[^>]*>Ulož si postup a získej certifikát/);
    expect(count(html, "bg-cta-500")).toBe(1);
    expect(html).toMatch(/href="\/kurz\/iot"[^>]*>Zpět na přehled kurzu/);
    expect(html).not.toContain("/ucet/certifikat");
    expect(html).not.toContain("/ucim-se");
  });

  it("„Co dál“ vysvětlí, že postup je jen v tomhle prohlížeči", () => {
    expect(html).toContain("tvůj postup z tohoto prohlížeče");
    expect(html).toContain("účet zakládá rodič");
  });

  it("tábor s utm_content=finale-anonym", () => {
    expect(html).toContain("utm_content=finale-anonym");
  });
});

describe("CourseFinale — čísla a tábor", () => {
  it("počty se odvozují z publikovaných lekcí kurzu", () => {
    const five = textOf(render({ lessons: 5 }));
    expect(five).toContain("5 lekcí");
    expect(five).toContain("5 postavených obvodů");
    expect(five).toContain("5 / 5");
    expect(five).not.toMatch(/\b7\b/);

    const three = textOf(render({ lessons: 3 }));
    expect(three).toContain("3 lekce");
    expect(three).toContain("3 postavené obvody");
  });

  it("bez nabídky tábora se karta tábora neukáže", () => {
    const html = render({ camp: null });
    expect(html).not.toContain("utm_content");
    expect(html).not.toContain("Léto 2027");
  });

  it("náhledy postavených obvodů jen u dítěte", () => {
    const circuit: Circuit = { comps: [], wires: [] };
    const builds = [{ slug: "semafor", title: "Semafor", circuit, reference: false }];
    expect(render({ builds })).toContain('aria-label="Obvod z lekce Semafor"');
    expect(render({ mode: "anon", nick: null, childId: null, builds })).not.toContain(
      "Obvod z lekce",
    );
  });
});
