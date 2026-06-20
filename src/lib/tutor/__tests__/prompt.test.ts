import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../prompt";

const task = {
  title: "LED",
  description: "Rozsviť LED diodu připojenou na pin 13.",
  sectionId: "beginner",
};

describe("buildSystemPrompt", () => {
  it("always states the core guard rules (guide, never full solution, stay on topic)", () => {
    const p = buildSystemPrompt({});
    expect(p).toMatch(/NIKDY/);
    expect(p.toLowerCase()).toContain("řešení");
    expect(p).toMatch(/Arduino|elektronik|IoT/i);
  });

  it("is written in Czech and addresses a child mentor role", () => {
    const p = buildSystemPrompt({});
    expect(p.toLowerCase()).toMatch(/dít|žák|mentor|průvodce/);
  });

  it("includes the task title and description when a task is given", () => {
    const p = buildSystemPrompt({ task });
    expect(p).toContain("LED");
    expect(p).toContain("Rozsviť LED diodu");
  });

  it("includes the child's current code when provided", () => {
    const p = buildSystemPrompt({ task, code: "void setup(){}" });
    expect(p).toContain("void setup(){}");
  });

  it("does not crash and omits the code block when code is empty", () => {
    const p = buildSystemPrompt({ task, code: "" });
    expect(typeof p).toBe("string");
    expect(p.length).toBeGreaterThan(0);
  });

  it("never embeds a child's name (we pass none — sanity guard against accidental interpolation)", () => {
    // The function signature intentionally has no `name`/`nickname` parameter.
    const p = buildSystemPrompt({ task, code: "x" });
    expect(p).not.toMatch(/nickname|jméno dítěte/i);
  });
});
