// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { lesson7 } from "@/features/lessons/content";
import { referenceCircuit } from "@/features/lessons/reference-circuit";
import { ANON_BUILDS_KEY, clearAnonBuilds, readAnonBuilds, saveAnonBuild } from "../anon-builds";
import { MAX_ANON_BUILDS, MAX_ANON_BUILDS_CHARS, parseAnonBuilds } from "../parse-builds";
import type { LessonBuild } from "../schema";

const build = (lessonSlug: string, code = lesson7.solution): LessonBuild => ({
  courseSlug: "elektronika-a-iot",
  lessonSlug,
  circuit: referenceCircuit(lesson7.wiring),
  code,
  mode: "code",
});

beforeEach(() => window.localStorage.clear());

describe("anon-builds", () => {
  it("dvakrát uložená lekce je jedna položka, platí poslední", () => {
    expect(saveAnonBuild(build("a", "první"))).toBe(true);
    saveAnonBuild(build("a", "druhý"));
    const all = readAnonBuilds();
    expect(all).toHaveLength(1);
    expect(all[0]?.code).toBe("druhý");
  });

  it("poškozený JSON v klíči vrátí [] a nespadne", () => {
    window.localStorage.setItem(ANON_BUILDS_KEY, "{nejde to");
    expect(readAnonBuilds()).toEqual([]);
    expect(saveAnonBuild(build("a"))).toBe(true);
    expect(readAnonBuilds()).toHaveLength(1);
  });

  it("neplatnou položku vynechá, platná zůstane", () => {
    window.localStorage.setItem(
      ANON_BUILDS_KEY,
      JSON.stringify([{ courseSlug: "x", nesmysl: true }, build("ok")]),
    );
    expect(readAnonBuilds().map((b) => b.lessonSlug)).toEqual(["ok"]);
  });

  it("clearAnonBuilds klíč smaže", () => {
    saveAnonBuild(build("a"));
    clearAnonBuilds();
    expect(readAnonBuilds()).toEqual([]);
  });
});

describe("parseAnonBuilds", () => {
  it("zahodí neplatné, nechá platné", () => {
    expect(parseAnonBuilds(JSON.stringify([{}, build("ok")])).map((b) => b.lessonSlug)).toEqual([
      "ok",
    ]);
  });

  it("vezme nejvýš 8 položek", () => {
    const many = Array.from({ length: 12 }, (_, i) => build(`l${i}`));
    expect(parseAnonBuilds(JSON.stringify(many))).toHaveLength(MAX_ANON_BUILDS);
  });

  it("odmítne přerostlý řetězec bez parsování a ošetří nesmysly", () => {
    expect(parseAnonBuilds("x".repeat(MAX_ANON_BUILDS_CHARS + 1))).toEqual([]);
    expect(parseAnonBuilds("{nejde")).toEqual([]);
    expect(parseAnonBuilds('{"a":1}')).toEqual([]);
    expect(parseAnonBuilds(null)).toEqual([]);
    expect(parseAnonBuilds("")).toEqual([]);
  });
});
