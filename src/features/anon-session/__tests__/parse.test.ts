import { describe, expect, it } from "vitest";
import { MAX_ANON_SESSION_CHARS, countAnonLessons, parseAnonSession } from "../parse";

const session = {
  v: 1,
  anonId: "0123456789abcdef0123456789abcdef",
  createdAt: "2026-10-01T10:00:00.000Z",
  attribution: {},
  lessons: [
    { courseSlug: "arduino", lessonSlug: "rozsvit-ledku", startedAt: "2026-10-01T10:00:00.000Z" },
    {
      courseSlug: "arduino",
      lessonSlug: "rozsvit-ledku",
      startedAt: "2026-10-01T11:00:00.000Z",
      completedAt: "2026-10-01T11:05:00.000Z",
    },
    { courseSlug: "arduino", lessonSlug: "blikani", startedAt: "2026-10-01T12:00:00.000Z" },
  ],
};

describe("parseAnonSession", () => {
  it("přijme platnou relaci", () => {
    expect(parseAnonSession(JSON.stringify(session))?.anonId).toBe(session.anonId);
  });

  it("odmítne prázdný vstup, chybějící hodnotu a ne-řetězec", () => {
    expect(parseAnonSession(null)).toBeNull();
    expect(parseAnonSession(undefined)).toBeNull();
    expect(parseAnonSession("")).toBeNull();
    expect(parseAnonSession(new File(["x"], "x.json"))).toBeNull();
  });

  it("odmítne rozbitý JSON a cizí tvar", () => {
    expect(parseAnonSession("{nope")).toBeNull();
    expect(parseAnonSession(JSON.stringify({ ...session, v: 2 }))).toBeNull();
    expect(parseAnonSession(JSON.stringify({ ...session, anonId: "kratke" }))).toBeNull();
  });

  it("odmítne nafouknutou relaci dřív, než ji parsuje", () => {
    const huge = " ".repeat(MAX_ANON_SESSION_CHARS + 1);
    expect(parseAnonSession(huge + JSON.stringify(session))).toBeNull();
  });
});

describe("countAnonLessons", () => {
  it("počítá různé lekce, ne položky", () => {
    expect(countAnonLessons(parseAnonSession(JSON.stringify(session))!)).toBe(2);
  });
});
