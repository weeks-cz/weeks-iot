import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANON_STORAGE_KEY } from "@/features/anon-session/schema";
import { draftKey } from "@/features/lessons/draft";
import { lessonBySlug } from "@/features/lessons/content";
import { lessonSeedCircuit } from "@/features/lessons/seed-circuit";
import { referenceCircuit } from "@/features/lessons/reference-circuit";

const readAnonSession = vi.hoisted(() => vi.fn());
const track = vi.hoisted(() => vi.fn());

/* Skutečné čtení relace z localStorage se tu hlídá voláním; zbytek modulu
   (zápisy) test nepotřebuje. */
vi.mock("@/features/anon-session/storage", async (orig) => ({
  ...(await orig<typeof import("@/features/anon-session/storage")>()),
  readAnonSession,
}));
vi.mock("@/features/analytics/track", async (orig) => ({
  ...(await orig<typeof import("@/features/analytics/track")>()),
  track,
}));
vi.mock("@/features/collection/components/CircuitThumb", () => ({
  CircuitThumb: () => <div data-thumb />,
}));

import { AnonLobby, loadAnonDraft } from "../components/AnonLobby";
import { CourseOutlineList } from "@/features/courses/components/CourseOutlineList";
import { anonLobbyModel } from "../refine";

const SLUGS = [
  "rozsvit-ledku",
  "blikani",
  "tlacitko",
  "semafor",
  "plynuly-jas",
  "zvuk",
  "nocni-svetlo",
];
const lessons = SLUGS.map((slug, i) => ({
  id: `id-${i}`,
  slug,
  title: slug,
  summary: null,
  orderIndex: i + 1,
  estimatedMinutes: 25,
  isPublished: true,
}));
const outline = { slug: "iot", lessons };
const course = { slug: "iot", title: "Elektronika a IoT" };

const session = (done: string[]) => ({
  v: 1 as const,
  anonId: "a".repeat(32),
  createdAt: "2026-10-01T10:00:00.000Z",
  attribution: {},
  lessons: done.map((lessonSlug) => ({
    courseSlug: "iot",
    lessonSlug,
    startedAt: "2026-10-01T10:00:00.000Z",
    completedAt: "2026-10-01T10:20:00.000Z",
  })),
});

const noNavigation = (e: Event) => e.preventDefault();

beforeEach(() => {
  readAnonSession.mockReset();
  track.mockReset();
  window.localStorage.clear();
  /* jsdom navigaci neumí; klik na odkaz se jen změří. */
  document.addEventListener("click", noNavigation);
});
afterEach(() => {
  cleanup();
  document.removeEventListener("click", noNavigation);
});

describe("AnonLobby", () => {
  it("enabled={false}: relaci nečte a vykreslí děti beze změny", () => {
    readAnonSession.mockReturnValue(session(["rozsvit-ledku"]));
    render(
      <AnonLobby enabled={false} outline={outline} course={course} camp={null}>
        <p>dnešní stránka</p>
      </AnonLobby>,
    );
    expect(readAnonSession).not.toHaveBeenCalled();
    expect(screen.getByText("dnešní stránka")).toBeTruthy();
    expect(screen.queryByText(/Vítej zpátky/)).toBeNull();
  });

  it("enabled s postupem: děti nahradí lobby", () => {
    readAnonSession.mockReturnValue(session(["rozsvit-ledku"]));
    render(
      <AnonLobby enabled outline={outline} course={course} camp={null}>
        <p>dnešní stránka</p>
      </AnonLobby>,
    );
    expect(screen.queryByText("dnešní stránka")).toBeNull();
    expect(screen.getByText(/Vítej zpátky/)).toBeTruthy();
  });

  it("hotový kurz: tlačítko hera vede na registraci a měří signup_start", () => {
    readAnonSession.mockReturnValue(session(SLUGS));
    render(
      <AnonLobby enabled outline={outline} course={course} camp={null}>
        <p>dnešní stránka</p>
      </AnonLobby>,
    );
    const link = screen.getByRole("link", { name: "Ulož si postup a získej certifikát" });
    expect(link.getAttribute("href")).toBe("/registrace");
    fireEvent.click(link);
    expect(track).toHaveBeenCalledWith("signup_start", {
      source: "kurz-lobby",
      after_lesson: null,
    });

    track.mockClear();
    fireEvent.click(screen.getByRole("link", { name: "Ulož si postup" }));
    expect(track).toHaveBeenCalledWith("signup_start", {
      source: "kurz-lobby",
      after_lesson: null,
    });
  });
});

describe("loadAnonDraft — klíč v1 bez profilu", () => {
  it("najde koncept uložený pod `weeks.lesson-draft.v1.<slug>`", () => {
    const semafor = lessonBySlug("semafor")!;
    const ref = referenceCircuit(semafor.wiring);
    const circuit = { comps: ref.comps, wires: ref.wires.slice(0, 2) };
    expect(draftKey("semafor")).toBe("weeks.lesson-draft.v1.semafor");
    window.localStorage.setItem(
      "weeks.lesson-draft.v1.semafor",
      JSON.stringify({ code: semafor.starterCode, circuit }),
    );

    expect(loadAnonDraft("semafor")?.circuit).toEqual(circuit);

    const model = anonLobbyModel(
      outline,
      session(["rozsvit-ledku", "blikani", "tlacitko"]),
      loadAnonDraft,
    );
    expect(model?.state.kind).toBe("draft");
    expect(model?.circuit).toEqual(circuit);
  });

  it("výchozí obvod i kód není rozdělaná práce", () => {
    const semafor = lessonBySlug("semafor")!;
    window.localStorage.setItem(
      "weeks.lesson-draft.v1.semafor",
      JSON.stringify({ code: semafor.starterCode, circuit: lessonSeedCircuit(semafor) }),
    );
    expect(
      anonLobbyModel(outline, session(["rozsvit-ledku", "blikani", "tlacitko"]), loadAnonDraft)
        ?.state.kind,
    ).toBe("next");
  });
});

describe("CourseOutlineList — mergeAnon", () => {
  const seed = () => {
    window.localStorage.setItem(ANON_STORAGE_KEY, JSON.stringify(session(["blikani"])));
    /* Skutečná relace, ne mock: tenhle test hlídá slévání z localStoragu. */
    readAnonSession.mockImplementation(() => session(["blikani"]));
  };

  it("mergeAnon={false}: hotové lekce z anonymní relace se nepřipočtou", () => {
    seed();
    render(
      <CourseOutlineList
        courseSlug="iot"
        lessons={lessons}
        serverCompleted={[]}
        mergeAnon={false}
      />,
    );
    expect(readAnonSession).not.toHaveBeenCalled();
    expect(screen.queryByText(/Hotovo 1 ze/)).toBeNull();
    expect(screen.queryAllByText("Znovu")).toHaveLength(0);
  });

  it("výchozí (anonym): relace se slije", () => {
    seed();
    render(<CourseOutlineList courseSlug="iot" lessons={lessons} serverCompleted={[]} />);
    expect(screen.getByText(/Hotovo 1 ze 7/)).toBeTruthy();
    expect(screen.getAllByText("Znovu")).toHaveLength(1);
  });
});
