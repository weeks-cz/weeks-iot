import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Circuit } from "@/features/circuit/types";
import type { SavedBuild } from "@/features/collection/queries";

/* Náhled obvodu je líný klientský prvek s wokwi součástkami — tady stačí
   vědět, že se vykreslil a s jakým popiskem. */
vi.mock("@/features/collection/components/CircuitThumb", () => ({
  CircuitThumb: ({ label }: { label: string }) =>
    createElement("div", { "data-thumb": label }),
}));

import { heroCopy, plural } from "../copy";
import { coursePath, heroState, lobbyBuilds, type HeroState, type PathLesson } from "../model";
import { CoursePath } from "../components/CoursePath";
import { LobbyBottom } from "../components/LobbyBottom";
import { LobbyHero } from "../components/LobbyHero";
import { LobbyHeroView, type LobbyHeroViewProps } from "../components/LobbyHeroView";
import { lessonBySlug } from "@/features/lessons/content";
import { lessonSeedCircuit } from "@/features/lessons/seed-circuit";
import { referenceCircuit } from "@/features/lessons/reference-circuit";
import { refineHero } from "../refine";

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

const pathWith = (doneCount: number): PathLesson[] =>
  coursePath(published, new Set(SLUGS.slice(0, doneCount).map(([s]) => s)));

const course = { slug: "iot", title: "Elektronika a IoT" };
const stats = { lessons: 3, builds: 3, certificates: 0 };

function heroProps(state: HeroState, path: PathLesson[], nick = "Lukáš"): LobbyHeroViewProps {
  const lesson = state.kind === "done" ? null : lessonBySlug(state.lesson.slug);
  return { state, course, path, labels: heroCopy(state, lesson), nick, avatar: "robot", stats };
}

const renderHero = (props: LobbyHeroViewProps) =>
  renderToStaticMarkup(createElement(LobbyHeroView, props));

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("LobbyHeroView — čtyři stavy", () => {
  const p0 = pathWith(0);
  const p3 = pathWith(3);
  const p7 = pathWith(7);
  const semafor = p3[3]!;

  const cases: { name: string; state: HeroState; path: PathLesson[]; button: string; href: string }[] = [
    {
      name: "start",
      state: heroState(p0, () => null),
      path: p0,
      button: "Začít první lekcí →",
      href: 'href="/kurz/iot/rozsvit-ledku"',
    },
    {
      name: "next",
      state: heroState(p3, () => null),
      path: p3,
      button: "Pokračovat v lekci →",
      href: 'href="/kurz/iot/semafor"',
    },
    {
      name: "draft",
      state: { kind: "draft", lesson: semafor, step: "wiring" },
      path: p3,
      button: "Pokračovat, kde jsi skončil →",
      href: 'href="/kurz/iot/semafor?pokracovat=1"',
    },
    {
      name: "done",
      state: heroState(p7, () => null),
      path: p7,
      button: "Prohlédnout certifikát →",
      href: 'href="/ucim-se/sbirka"',
    },
  ];

  const [startCase, nextCase, draftCase, doneCase] = cases as [
    (typeof cases)[number],
    (typeof cases)[number],
    (typeof cases)[number],
    (typeof cases)[number],
  ];

  for (const c of cases) {
    it(`${c.name}: tlačítko „${c.button}“ s ${c.href}, amber jen jednou`, () => {
      const html = renderHero(heroProps(c.state, c.path));
      expect(c.state.kind).toBe(c.name);
      expect(html).toContain(c.button);
      expect(html).toContain(c.href);
      expect(count(html, "bg-cta-500")).toBe(1);
    });
  }

  it("nadpisy podle stavu", () => {
    const start = renderHero(heroProps(startCase.state, p0));
    expect(start).toContain("Ahoj Lukáš.");
    expect(start).toMatch(/Postavíme první <em[^>]*>obvod\?<\/em>/);

    const next = renderHero(heroProps(nextCase.state, p3));
    expect(next).toContain("Vítej zpátky.");
    expect(next).toMatch(/Semafor <em[^>]*>je na řadě\.<\/em>/);

    const draft = renderHero(heroProps(draftCase.state, p3));
    expect(draft).toMatch(/Semafor <em[^>]*>čeká na dráty\.<\/em>/);
    expect(draft).toContain("Rozdělaná práce");

    const done = renderHero(heroProps(doneCase.state, p7));
    expect(done).toMatch(/Kurz Elektronika a IoT máš <em[^>]*>hotový\.<\/em>/);
  });

  it("pozice v kurzu se odvozuje z publikovaných lekcí, ne napevno", () => {
    expect(renderHero(heroProps(nextCase.state, p3))).toContain("lekce 4 / 7");
    const five = p3.slice(0, 5);
    expect(renderHero(heroProps(heroState(five, () => null), five))).toContain("lekce 4 / 5");
  });

  it("dlouhá přezdívka: jednou v markupu, ve sloupci s avatarem s truncate", () => {
    const nick = "Maximiliánekxxxxxxxxxxxx";
    expect(nick).toHaveLength(24);
    const html = renderHero(heroProps(nextCase.state, p3, nick));
    expect(count(html, nick)).toBe(1);
    expect(html).toMatch(new RegExp(`class="[^"]*\\btruncate\\b[^"]*">${nick}<`));
  });

  it("přezdívka v nadpisu (start) se láme, nepřetéká", () => {
    const html = renderHero(heroProps(startCase.state, p0, "Maximiliánekxxxxxxxxxxxx"));
    expect(html).toMatch(/<h1 class="[^"]*\bbreak-words\b[^"]*">Ahoj Maximiliánekxxxxxxxxxxxx\./);
  });

  it("čísla dítěte s českými tvary; bez přezdívky (anonym) sloupec chybí", () => {
    const html = renderHero({
      ...heroProps(nextCase.state, p3),
      stats: { lessons: 1, builds: 5, certificates: 0 },
    });
    expect(html).toMatch(/lekce<\/dt><dd[^>]*>1</);
    expect(html).toMatch(/obvodů<\/dt><dd[^>]*>5</);
    expect(html).toMatch(/certifikátů<\/dt><dd[^>]*>0</);

    const anon = renderHero({ ...heroProps(nextCase.state, p3), nick: undefined, stats: undefined });
    expect(anon).not.toContain("<dl");
    expect(anon).toContain("Pokračovat v lekci →");
  });
});

describe("LobbyHeroView — délka první lekce", () => {
  it("minuty v českém tvaru", () => {
    for (const [minutes, text] of [
      [1, "asi 1 minutu"],
      [3, "asi 3 minuty"],
      [20, "asi 20 minut"],
    ] as const) {
      const path = coursePath(
        published.map((l) => ({ ...l, estimatedMinutes: minutes })),
        new Set(),
      );
      expect(renderHero(heroProps(heroState(path, () => null), path))).toContain(text);
    }
  });
});

describe("refineHero — zpřesnění hera podle konceptu", () => {
  const path = pathWith(3);
  const semafor = lessonBySlug("semafor")!;
  const ref = referenceCircuit(semafor.wiring);

  it("koncept v cílové lekci (rozdělané zapojení) → stav draft s obvodem dítěte", () => {
    const circuit = { comps: ref.comps, wires: ref.wires.slice(0, 2) };
    const asked: string[] = [];
    const refined = refineHero(path, (slug) => {
      asked.push(slug);
      return slug === "semafor" ? { code: semafor.starterCode, circuit } : null;
    });
    expect(asked).toEqual(["semafor"]);
    expect(refined?.state).toEqual({ kind: "draft", lesson: path[3], step: "wiring" });
    expect(refined?.labels.waiting).toBe("čeká na dráty.");
    expect(refined?.circuit).toBe(circuit);
  });

  it("koncept jen v kroku zadání (výchozí obvod i kód) → beze změny", () => {
    expect(
      refineHero(path, () => ({
        code: semafor.starterCode,
        circuit: lessonSeedCircuit(semafor),
      })),
    ).toBeNull();
  });

  it("žádný koncept → beze změny; hotový kurz se na koncept neptá", () => {
    expect(refineHero(path, () => null)).toBeNull();
    const load = vi.fn(() => null);
    expect(refineHero(pathWith(7), load)).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
});

describe("LobbyHero — serverová obálka", () => {
  it("vykreslí stav bez konceptu: další lekce", () => {
    const html = renderToStaticMarkup(
      createElement(LobbyHero, {
        data: {
          course,
          path: pathWith(3),
          builds: new Map(),
          certificate: null,
          camp: null,
          stats,
        },
        childId: "c1",
        nick: "Lukáš",
        avatar: "robot",
      }),
    );
    expect(html).toContain("Pokračovat v lekci →");
    expect(html).not.toContain("pokracovat=1");
  });
});

describe("CoursePath", () => {
  const html = renderToStaticMarkup(createElement(CoursePath, { course, path: pathWith(3) }));

  it("7 uzlů jako odkazy na lekce", () => {
    expect(count(html, "<li")).toBe(7);
    expect(count(html, 'href="/kurz/iot/')).toBe(7);
  });

  it("právě jeden uzel „právě tady“, hotové mají aria-label „hotovo“", () => {
    expect(count(html, "právě tady")).toBe(2); // viditelný popisek + aria-label
    expect(count(html, 'aria-current="step"')).toBe(1);
    expect(html.match(/aria-label="[^"]*hotovo"/g)).toHaveLength(3);
    expect(html).toContain("3 / 7 hotovo");
    expect(html).toContain("→ certifikát");
  });

  it("hotový kurz nemá „právě tady“", () => {
    const done = renderToStaticMarkup(createElement(CoursePath, { course, path: pathWith(7) }));
    expect(done).not.toContain("právě tady");
    expect(done.match(/aria-label="[^"]*hotovo"/g)).toHaveLength(7);
  });
});

describe("LobbyBottom", () => {
  const base = {
    course,
    path: pathWith(3),
    builds: new Map<string, SavedBuild>(),
    certificate: null,
    nick: "Lukáš",
    childId: "c1",
  };
  const render = (camp: Parameters<typeof LobbyBottom>[0]["camp"]) =>
    renderToStaticMarkup(createElement(LobbyBottom, { ...base, camp }));

  it("s táborem tři sekce, bez tábora dvě", () => {
    const three = render({ kind: "open", city: "karlovy-vary" });
    expect(three).toContain("md:grid-cols-3");
    expect(count(three, "<section")).toBe(4); // obal + 3 sekce
    expect(three).toContain("utm_content=lobby");

    const two = render(null);
    expect(two).toContain("md:grid-cols-2");
    expect(two).not.toContain("md:grid-cols-3");
    expect(count(two, "<section")).toBe(3); // obal + 2 sekce
  });

  it("sekce mají stejnou výšku (společné minimum)", () => {
    const html = render({ kind: "open", city: null });
    expect(count(html, "h-full md:min-h-[22rem]")).toBe(3);
  });

  it("hotové lekce bez výtvoru ukážou vzor, prázdné místo jmenuje další lekci", () => {
    const html = render(null);
    expect(count(html, "data-thumb=")).toBe(3);
    expect(count(html, ">vzor<")).toBe(3);
    expect(html).toContain("Semafor");
    expect(html).toContain('href="/ucim-se/sbirka"');
  });

  it("certifikát před dokončením zamčený „po lekci 7“, bez odkazu na PDF", () => {
    const html = render(null);
    expect(html).toContain("po lekci 7");
    expect(html).toContain("Chybí ti ještě 4 lekce.");
    expect(html).not.toContain("/ucet/certifikat/");
  });

  it("vydaný certifikát otevře PDF", () => {
    const html = renderToStaticMarkup(
      createElement(LobbyBottom, {
        ...base,
        path: pathWith(7),
        camp: null,
        certificate: {
          courseSlug: "iot",
          lessons: 7,
          data: {
            name: "Lukáš",
            courseTitle: "Elektronika a IoT",
            projectTitle: "Noční světlo",
            skills: [],
            completedAt: "2026-10-20T10:00:00Z",
          },
        },
      }),
    );
    expect(html).toContain('href="/ucet/certifikat/c1/iot/"');
    expect(html).not.toContain("po lekci");
  });
});

describe("lobbyBuilds", () => {
  const own: Circuit = { comps: [], wires: [] };
  const ref: Circuit = { comps: [], wires: [{ id: "w" } as never] };

  it("posledních N hotových lekcí; vlastní výtvor má přednost před vzorem", () => {
    const saved = new Map([["blikani", { data: { circuit: own } }]]);
    const tiles = lobbyBuilds(pathWith(6), saved, () => ref);
    expect(tiles.map((t) => t.slug)).toEqual(["tlacitko", "semafor", "plynuly-jas", "zvuk"]);

    const early = lobbyBuilds(pathWith(2), saved, () => ref);
    expect(early).toEqual([
      { slug: "rozsvit-ledku", title: "Rozsviť LEDku", circuit: ref, reference: true },
      { slug: "blikani", title: "Blikání", circuit: own, reference: false },
    ]);
  });

  it("lekce bez výtvoru i bez vzoru se vynechá", () => {
    expect(lobbyBuilds(pathWith(2), new Map(), () => null)).toEqual([]);
  });
});

describe("plural", () => {
  it("1 / 2–4 / ostatní", () => {
    expect([0, 1, 2, 4, 5, 7].map((n) => plural(n, "lekce", "lekce", "lekcí"))).toEqual([
      "lekcí",
      "lekce",
      "lekce",
      "lekce",
      "lekcí",
      "lekcí",
    ]);
  });
});
