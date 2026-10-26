import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AnonSession } from "@/features/anon-session/schema";
import { lessonBySlug } from "@/features/lessons/content";
import { referenceCircuit } from "@/features/lessons/reference-circuit";
import { heroCopy } from "../copy";
import { coursePath } from "../model";
import { anonLobbyModel } from "../refine";
import { LobbyHeroView } from "../components/LobbyHeroView";

const SLUGS = [
  "rozsvit-ledku",
  "blikani",
  "tlacitko",
  "semafor",
  "plynuly-jas",
  "zvuk",
  "nocni-svetlo",
];

const outline = {
  slug: "iot",
  lessons: [
    ...SLUGS.map((slug, i) => ({
      slug,
      title: slug,
      orderIndex: i + 1,
      estimatedMinutes: 25,
      isPublished: true,
    })),
    {
      slug: "osma",
      title: "Osmá",
      orderIndex: 8,
      estimatedMinutes: null,
      isPublished: false,
    },
  ],
};

const session = (done: string[], courseSlug = "iot"): AnonSession => ({
  v: 1,
  anonId: "a".repeat(32),
  createdAt: "2026-10-01T10:00:00.000Z",
  attribution: {},
  lessons: done.map((lessonSlug) => ({
    courseSlug,
    lessonSlug,
    startedAt: "2026-10-01T10:00:00.000Z",
    completedAt: "2026-10-01T10:20:00.000Z",
  })),
});

const noDraft = () => null;

describe("anonLobbyModel", () => {
  it("bez relace nebo bez hotové lekce → null (stránka zůstane dnešní)", () => {
    expect(anonLobbyModel(outline, null, noDraft)).toBeNull();
    expect(anonLobbyModel(outline, session([]), noDraft)).toBeNull();
    const started = session([]);
    started.lessons.push({
      courseSlug: "iot",
      lessonSlug: "blikani",
      startedAt: "2026-10-01T10:00:00.000Z",
    });
    expect(anonLobbyModel(outline, started, noDraft)).toBeNull();
  });

  it("hotová lekce jiného kurzu se nepočítá", () => {
    expect(anonLobbyModel(outline, session(["blikani"], "jiny"), noDraft)).toBeNull();
  });

  it("jedna hotová lekce → další na řadě, cesta jen z publikovaných lekcí", () => {
    const model = anonLobbyModel(outline, session(["rozsvit-ledku"]), noDraft);
    expect(model?.state.kind).toBe("next");
    expect(model?.path).toHaveLength(7);
    expect(model?.path.filter((l) => l.done).map((l) => l.slug)).toEqual(["rozsvit-ledku"]);
    expect(model?.circuit).toBeNull();
  });

  it("koncept cílové lekce → stav draft a obvod z konceptu", () => {
    const semafor = lessonBySlug("semafor")!;
    const ref = referenceCircuit(semafor.wiring);
    const circuit = { comps: ref.comps, wires: ref.wires.slice(0, 2) };
    const load = vi.fn((slug: string) =>
      slug === "semafor" ? { code: semafor.starterCode, circuit } : null,
    );
    const model = anonLobbyModel(outline, session(["rozsvit-ledku", "blikani", "tlacitko"]), load);
    expect(model?.state.kind).toBe("draft");
    expect(model?.circuit).toBe(circuit);
    expect(load).toHaveBeenCalledWith("semafor");
  });

  it("celý kurz hotový → stav done", () => {
    expect(anonLobbyModel(outline, session(SLUGS), noDraft)?.state.kind).toBe("done");
  });
});

describe("LobbyHeroView — doneAction pro anonyma", () => {
  const path = coursePath(
    outline.lessons.filter((l) => l.isPublished),
    new Set(SLUGS),
  );
  const props = {
    state: { kind: "done" } as const,
    course: { slug: "iot", title: "Elektronika a IoT" },
    path,
    labels: heroCopy({ kind: "done" }, null),
  };

  it("bez přepisu míří do sbírky, s přepisem do registrace", () => {
    const def = renderToStaticMarkup(createElement(LobbyHeroView, props));
    expect(def).toContain('href="/ucim-se/sbirka"');
    const anon = renderToStaticMarkup(
      createElement(LobbyHeroView, {
        ...props,
        doneAction: {
          href: "/registrace",
          label: "Ulož si postup a získej certifikát",
        },
      }),
    );
    expect(anon).toContain('href="/registrace"');
    expect(anon).toContain("Ulož si postup a získej certifikát");
    expect(anon).not.toContain("/ucim-se/sbirka");
  });
});
