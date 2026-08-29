import { describe, expect, it } from "vitest";
import { adoptSession, lessonKey, mergeWithExisting } from "../adopt";
import { anonSessionSchema, type AnonLesson, type AnonSession } from "../schema";

const NOW = new Date("2026-08-29T20:00:00Z");

const LESSON_IDS = new Map([
  ["iot/rozsvit-ledku", "lesson-1"],
  ["iot/plynuly-jas", "lesson-2"],
]);

function session(lessons: AnonLesson[]): AnonSession {
  return {
    v: 1,
    anonId: "a".repeat(32),
    createdAt: "2026-08-29T19:00:00Z",
    attribution: {},
    lessons,
  };
}

function lesson(over: Partial<AnonLesson> = {}): AnonLesson {
  return {
    courseSlug: "iot",
    lessonSlug: "rozsvit-ledku",
    startedAt: "2026-08-29T19:10:00Z",
    ...over,
  };
}

describe("adoptSession — základ", () => {
  it("prázdná relace nevyrobí žádný řádek", () => {
    const result = adoptSession(session([]), { lessonIdBySlug: LESSON_IDS, now: NOW });
    expect(result.rows).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it("přeloží slug na lesson_id ze serveru", () => {
    const result = adoptSession(session([lesson()]), { lessonIdBySlug: LESSON_IDS, now: NOW });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.lesson_id).toBe("lesson-1");
  });

  it("dokončená lekce dostane status completed", () => {
    const result = adoptSession(
      session([lesson({ completedAt: "2026-08-29T19:30:00Z", durationS: 1200 })]),
      { lessonIdBySlug: LESSON_IDS, now: NOW },
    );
    expect(result.rows[0]?.status).toBe("completed");
    expect(result.rows[0]?.completed_at).toBe("2026-08-29T19:30:00.000Z");
    expect(result.rows[0]?.duration_s).toBe(1200);
  });

  it("rozdělaná lekce zůstane started bez času dokončení", () => {
    const result = adoptSession(session([lesson()]), { lessonIdBySlug: LESSON_IDS, now: NOW });
    expect(result.rows[0]?.status).toBe("started");
    expect(result.rows[0]?.completed_at).toBeNull();
  });
});

describe("adoptSession — nedůvěryhodný vstup", () => {
  it("lekci, která v databázi není, přeskočí a nahlásí", () => {
    // Klient si může vymyslet jakýkoli slug. Nesmí tím vyrobit řádek.
    const result = adoptSession(
      session([lesson({ lessonSlug: "vymyslena-lekce" }), lesson()]),
      { lessonIdBySlug: LESSON_IDS, now: NOW },
    );
    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toEqual(["iot/vymyslena-lekce"]);
  });

  it("čas v budoucnosti nahradí časem serveru", () => {
    // Přenastavené hodiny v prohlížeči by rozbily kohortní dotazy brány 1.
    const result = adoptSession(
      session([lesson({ completedAt: "2030-01-01T00:00:00Z" })]),
      { lessonIdBySlug: LESSON_IDS, now: NOW },
    );
    expect(result.rows[0]?.completed_at).toBe(NOW.toISOString());
  });

  it("začátek v budoucnosti nahradí časem serveru", () => {
    const result = adoptSession(session([lesson({ startedAt: "2030-01-01T00:00:00Z" })]), {
      lessonIdBySlug: LESSON_IDS,
      now: NOW,
    });
    expect(result.rows[0]?.started_at).toBe(NOW.toISOString());
  });

  it("nesmyslně starý čas zahodí a nahradí", () => {
    const result = adoptSession(session([lesson({ startedAt: "1970-01-01T00:00:00Z" })]), {
      lessonIdBySlug: LESSON_IDS,
      now: NOW,
    });
    expect(result.rows[0]?.started_at).toBe(NOW.toISOString());
  });

  it("dokončení před začátkem zahodí celé, nikoli posune", () => {
    // Radši lekce vedená jako rozdělaná než falešné dokončení v čitateli.
    const result = adoptSession(
      session([
        lesson({ startedAt: "2026-08-29T19:30:00Z", completedAt: "2026-08-29T19:10:00Z" }),
      ]),
      { lessonIdBySlug: LESSON_IDS, now: NOW },
    );
    expect(result.rows[0]?.completed_at).toBeNull();
    expect(result.rows[0]?.status).toBe("started");
  });

  it("ořízne nesmyslně dlouhé trvání", () => {
    const result = adoptSession(session([lesson({ durationS: 999_999 })]), {
      lessonIdBySlug: LESSON_IDS,
      now: NOW,
    });
    expect(result.rows[0]?.duration_s).toBe(86_400);
  });

  it("ořízne počet nápověd", () => {
    const result = adoptSession(session([lesson({ hintsUsed: 50_000 })]), {
      lessonIdBySlug: LESSON_IDS,
      now: NOW,
    });
    expect(result.rows[0]?.hints_used).toBe(1000);
  });
});

describe("adoptSession — duplicity", () => {
  it("z několika pokusů o tutéž lekci vezme ten dokončený", () => {
    const result = adoptSession(
      session([
        lesson({ startedAt: "2026-08-29T19:00:00Z" }),
        lesson({ startedAt: "2026-08-29T19:20:00Z", completedAt: "2026-08-29T19:40:00Z" }),
      ]),
      { lessonIdBySlug: LESSON_IDS, now: NOW },
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.status).toBe("completed");
  });

  it("ze dvou dokončení bere to dřívější", () => {
    const result = adoptSession(
      session([
        lesson({ completedAt: "2026-08-29T19:50:00Z" }),
        lesson({ completedAt: "2026-08-29T19:30:00Z" }),
      ]),
      { lessonIdBySlug: LESSON_IDS, now: NOW },
    );
    expect(result.rows[0]?.completed_at).toBe("2026-08-29T19:30:00.000Z");
  });

  it("výsledek nezávisí na pořadí položek v relaci", () => {
    const items = [
      lesson({ startedAt: "2026-08-29T19:00:00Z" }),
      lesson({ startedAt: "2026-08-29T19:20:00Z", completedAt: "2026-08-29T19:40:00Z" }),
    ];
    const forward = adoptSession(session(items), { lessonIdBySlug: LESSON_IDS, now: NOW });
    const backward = adoptSession(session([...items].reverse()), {
      lessonIdBySlug: LESSON_IDS,
      now: NOW,
    });
    expect(forward.rows).toEqual(backward.rows);
  });

  it("různé lekce zůstanou oddělené", () => {
    const result = adoptSession(
      session([lesson(), lesson({ lessonSlug: "plynuly-jas" })]),
      { lessonIdBySlug: LESSON_IDS, now: NOW },
    );
    expect(result.rows.map((r) => r.lesson_id).sort()).toEqual(["lesson-1", "lesson-2"]);
  });
});

describe("mergeWithExisting — idempotence", () => {
  const incoming = {
    lesson_id: "lesson-1",
    status: "completed" as const,
    started_at: "2026-08-29T19:10:00.000Z",
    completed_at: "2026-08-29T19:30:00.000Z",
    duration_s: 1200,
    hints_used: 0,
  };

  it("bez předchozího záznamu projde beze změny", () => {
    expect(mergeWithExisting(incoming, null)).toEqual(incoming);
  });

  it("dvojí odeslání téhož dá stejný výsledek", () => {
    const once = mergeWithExisting(incoming, null);
    const twice = mergeWithExisting(incoming, once);
    expect(twice).toEqual(once);
  });

  it("nevrátí hotovou lekci zpět do rozdělané", () => {
    // Tohle je ta chyba, kterou by přenos udělal nejsnáz: dítě lekci dokončí
    // v účtu, pak se otevře stará karta se zastaralou relací a přepíše ji.
    const existing = { status: "completed" as const, started_at: "2026-08-01T10:00:00Z", completed_at: "2026-08-01T10:20:00Z" };
    const stale = { ...incoming, status: "started" as const, completed_at: null };
    const merged = mergeWithExisting(stale, existing);
    expect(merged.status).toBe("completed");
    expect(merged.completed_at).toBe("2026-08-01T10:20:00Z");
  });

  it("drží nejdřívější začátek", () => {
    const existing = { status: "started" as const, started_at: "2026-08-01T10:00:00Z", completed_at: null };
    expect(mergeWithExisting(incoming, existing).started_at).toBe("2026-08-01T10:00:00Z");
  });

  it("drží nejdřívější dokončení", () => {
    const existing = { status: "completed" as const, started_at: "2026-08-01T10:00:00Z", completed_at: "2026-08-01T10:20:00Z" };
    expect(mergeWithExisting(incoming, existing).completed_at).toBe("2026-08-01T10:20:00Z");
  });
});

describe("anonSessionSchema", () => {
  const valid = {
    v: 1,
    anonId: "a".repeat(32),
    createdAt: "2026-08-29T19:00:00Z",
    attribution: {},
    lessons: [],
  };

  it("přijme platnou relaci", () => {
    expect(anonSessionSchema.safeParse(valid).success).toBe(true);
  });

  it("odmítne anonId, které není 32 hex znaků", () => {
    expect(anonSessionSchema.safeParse({ ...valid, anonId: "krátké" }).success).toBe(false);
    expect(anonSessionSchema.safeParse({ ...valid, anonId: "Z".repeat(32) }).success).toBe(false);
  });

  it("odmítne slug s podivnými znaky", () => {
    // Slug jde do URL i do klíče mapy — nesmí nést lomítka ani mezery.
    const withBadSlug = {
      ...valid,
      lessons: [{ courseSlug: "iot/../admin", lessonSlug: "x", startedAt: "2026-08-29T19:00:00Z" }],
    };
    expect(anonSessionSchema.safeParse(withBadSlug).success).toBe(false);
  });

  it("odmítne relaci nafouknutou přes strop", () => {
    const many = Array.from({ length: 51 }, (_, i) => ({
      courseSlug: "iot",
      lessonSlug: `lekce-${i}`,
      startedAt: "2026-08-29T19:00:00Z",
    }));
    expect(anonSessionSchema.safeParse({ ...valid, lessons: many }).success).toBe(false);
  });

  it("odmítne přehnaně dlouhý UTM parametr", () => {
    const long = { ...valid, attribution: { utmSource: "x".repeat(500) } };
    expect(anonSessionSchema.safeParse(long).success).toBe(false);
  });

  it("odmítne neplatné datum", () => {
    expect(anonSessionSchema.safeParse({ ...valid, createdAt: "včera" }).success).toBe(false);
  });

  it("odmítne jinou verzi relace", () => {
    expect(anonSessionSchema.safeParse({ ...valid, v: 2 }).success).toBe(false);
  });

  it("odmítne záporné trvání", () => {
    const negative = {
      ...valid,
      lessons: [{ courseSlug: "iot", lessonSlug: "x", startedAt: "2026-08-29T19:00:00Z", durationS: -5 }],
    };
    expect(anonSessionSchema.safeParse(negative).success).toBe(false);
  });
});

describe("lessonKey", () => {
  it("skládá klíč kurz/lekce", () => {
    expect(lessonKey("iot", "rozsvit-ledku")).toBe("iot/rozsvit-ledku");
  });
});
