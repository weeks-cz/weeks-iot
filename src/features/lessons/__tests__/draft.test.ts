// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { lesson1 } from "../content";
import { lessonSeedCircuit } from "../seed-circuit";
import { clearDraft, draftKey, loadDraft, saveDraft, type LessonDraft } from "../draft";

const slug = lesson1.slug;
const draft: LessonDraft = { code: "// moje", circuit: lessonSeedCircuit(lesson1) };

describe("koncept podle profilu", () => {
  beforeEach(() => window.localStorage.clear());

  it("klíče: anonym v1, profil v2", () => {
    expect(draftKey(slug)).toBe(`weeks.lesson-draft.v1.${slug}`);
    expect(draftKey(slug, null)).toBe(`weeks.lesson-draft.v1.${slug}`);
    expect(draftKey(slug, "A")).toBe(`weeks.lesson-draft.v2.A.${slug}`);
  });

  it("koncept profilu A druhý profil B nevidí", () => {
    saveDraft(slug, draft, "A");
    expect(loadDraft(slug, "A")?.code).toBe("// moje");
    expect(loadDraft(slug, "B")).toBeNull();
  });

  it("v1 koncept se přesune k prvnímu profilu, druhý ho nenajde", () => {
    saveDraft(slug, draft);
    expect(loadDraft(slug, "A")?.code).toBe("// moje");
    expect(window.localStorage.getItem(draftKey(slug))).toBeNull();
    expect(loadDraft(slug, "B")).toBeNull();
    expect(loadDraft(slug, "A")?.code).toBe("// moje");
  });

  it("anonym čte i píše v1 klíč", () => {
    saveDraft(slug, draft);
    expect(window.localStorage.getItem(`weeks.lesson-draft.v1.${slug}`)).not.toBeNull();
    expect(loadDraft(slug)?.code).toBe("// moje");
    clearDraft(slug);
    expect(loadDraft(slug)).toBeNull();
  });

  it("clearDraft maže jen koncept daného profilu", () => {
    saveDraft(slug, draft, "A");
    saveDraft(slug, draft, "B");
    clearDraft(slug, "A");
    expect(loadDraft(slug, "A")).toBeNull();
    expect(loadDraft(slug, "B")).not.toBeNull();
  });
});
