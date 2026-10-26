import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { coursePath, type PathLesson } from "@/features/lobby/model";
import { lessonBySlug } from "@/features/lessons/content";
import type { Lesson } from "@/features/lessons/types";
import { LessonDone, nextLesson, type LessonDoneProps } from "../components/LessonDone";

const SLUGS = [
  ["rozsvit-ledku", "Rozsviť LEDku"],
  ["blikani", "Blikání"],
  ["tlacitko", "Tlačítko"],
  ["semafor", "Semafor"],
  ["plynuly-jas", "Plynulý jas"],
  ["zvuk", "Zvuk na stisk"],
  ["nocni-svetlo", "Noční světlo"],
] as const;

const published = SLUGS.map(([slug, title], i) => ({
  slug,
  title,
  orderIndex: i + 1,
  estimatedMinutes: 25,
}));

const pathDone = (slugs: string[]): PathLesson[] => coursePath(published, new Set(slugs));
const firstN = (n: number) => SLUGS.slice(0, n).map(([s]) => s);

const semafor = lessonBySlug("semafor") as Lesson;
const nocni = lessonBySlug("nocni-svetlo") as Lesson;

function render(props: Partial<LessonDoneProps> & Pick<LessonDoneProps, "lesson" | "path">) {
  const full: LessonDoneProps = {
    courseSlug: "iot",
    next: nextLesson(props.path, props.lesson.slug),
    viewer: "child",
    savedToCollection: true,
    ...props,
  };
  return renderToStaticMarkup(createElement(LessonDone, full));
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("nextLesson", () => {
  it("vybere první nedokončenou lekci za tou právě hotovou", () => {
    expect(nextLesson(pathDone(firstN(4)), "semafor")?.slug).toBe("plynuly-jas");
  });

  it("přeskočí lekce, které už má dítě hotové", () => {
    const path = pathDone([...firstN(4), "plynuly-jas"]);
    expect(nextLesson(path, "semafor")?.slug).toBe("zvuk");
  });

  it("za poslední lekcí se vrátí na první nedokončenou", () => {
    const path = pathDone(["rozsvit-ledku", "semafor", "plynuly-jas", "zvuk", "nocni-svetlo"]);
    expect(nextLesson(path, "nocni-svetlo")?.slug).toBe("blikani");
  });

  it("hotový kurz nemá další lekci", () => {
    expect(nextLesson(pathDone(firstN(7)), "nocni-svetlo")).toBeNull();
  });
});

describe("LessonDone — dítě s profilem", () => {
  const html = render({ lesson: semafor, path: pathDone(firstN(4)) });

  it("slaví lekci jejím vlastním dovětkem", () => {
    expect(html).toContain("Semafor");
    expect(html).toContain("jede.");
    expect(html).toContain("Lekce 4 hotová");
    expect(html).toContain(semafor.celebrate.line);
  });

  it("nabídne další lekci jediným amber tlačítkem a vedle něj lobby", () => {
    expect(html).toContain("Další lekce");
    expect(html).toContain('href="/kurz/iot/plynuly-jas"');
    expect(count(html, "bg-cta-500")).toBe(1);
    expect(html).toMatch(/href="\/ucim-se"[^>]*>Do lobby/);
  });

  it("karta další lekce: pořadí, název, věta a čas", () => {
    expect(html).toContain("lekce 5");
    expect(html).toContain("Plynulý jas");
    expect(html).toContain(lessonBySlug("plynuly-jas")!.goal);
    expect(html).toContain("~25\u00a0min");
  });

  it("„Přidáno do tvé sbírky.“ jen když se výtvor opravdu uložil", () => {
    expect(html).toContain("Přidáno do tvé sbírky.");
    const notSaved = render({ lesson: semafor, path: pathDone(firstN(4)), savedToCollection: false });
    expect(notSaved).not.toContain("Přidáno do tvé sbírky.");
  });
});

describe("LessonDone — anonym", () => {
  const html = render({ lesson: semafor, path: pathDone(firstN(4)), viewer: "anon" });

  it("pravá půlka je zeď „Ulož si to“ a dál se dá jít i bez účtu", () => {
    expect(html).toContain("Ulož si to");
    expect(html).toContain("Ať ti to nezmizí");
    expect(html).toContain("Uložit můj postup");
    expect(html).toContain('href="/registrace"');
    expect(html).toContain("Další lekce");
    expect(html).toContain('href="/kurz/iot/plynuly-jas"');
  });

  it("amber má jen registrace, lobby anonym nemá", () => {
    expect(count(html, "bg-cta-500")).toBe(1);
    expect(html).not.toContain("/ucim-se");
  });
});

describe("LessonDone — rodič bez profilu", () => {
  const zapsatHref = "/ucim-se?zapsat=iot%2Fsemafor";
  const html = render({
    lesson: semafor,
    path: pathDone(firstN(4)),
    viewer: "parent-no-profile",
    savedToCollection: false,
    zapsatHref,
  });

  it("varuje, že se postup neukládá, a nabídne výběr profilu", () => {
    expect(html).toContain("Postup se zatím neukládá");
    expect(html).toContain(`href="${zapsatHref}"`);
    expect(html).toContain("Vybrat profil");
  });

  it("i tak má cestu dál a jen jednu amber akci", () => {
    expect(html).toContain('href="/kurz/iot/plynuly-jas"');
    expect(count(html, "bg-cta-500")).toBe(1);
  });

  it("nemluví o sbírce dítěte, i když se výtvor uložil v prohlížeči", () => {
    const saved = render({
      lesson: semafor,
      path: pathDone(firstN(4)),
      viewer: "parent-no-profile",
      savedToCollection: true,
      zapsatHref,
    });
    expect(saved).not.toContain("Přidáno do tvé sbírky");
  });
});

describe("LessonDone — poslední lekce, ale kurz hotový není", () => {
  const path = pathDone(["rozsvit-ledku", "semafor", "plynuly-jas", "zvuk", "nocni-svetlo"]);
  const html = render({ lesson: nocni, path });

  it("řekne, kolik lekcí zbývá do certifikátu, a pošle na první nedokončenou", () => {
    expect(html).toContain("Zbývají ti 2 lekce do certifikátu.");
    expect(html).toContain('href="/kurz/iot/blikani"');
  });

  it("jedna chybějící lekce — tvar jednotného čísla", () => {
    const one = render({
      lesson: nocni,
      path: pathDone(["rozsvit-ledku", "blikani", "semafor", "plynuly-jas", "zvuk", "nocni-svetlo"]),
    });
    expect(one).toContain("Zbývá ti 1 lekce do certifikátu.");
  });

  it("u anonyma taky", () => {
    const anon = render({ lesson: nocni, path, viewer: "anon" });
    expect(anon).toContain("Zbývají ti 2 lekce do certifikátu.");
    expect(anon).toContain('href="/kurz/iot/blikani"');
  });
});

describe("LessonDone — mini mapa kurzu", () => {
  it("odvozuje počet uzlů z publikovaných lekcí", () => {
    const html = render({ lesson: semafor, path: pathDone(firstN(4)) });
    expect(html).toContain("4 z 7 lekcí hotovo");
    const short = render({ lesson: semafor, path: pathDone(firstN(4)).slice(0, 5) });
    expect(short).toContain("4 z 5 lekcí hotovo");
  });
});
