import { describe, expect, it } from "vitest";
import { compile } from "@/features/arduino/interpreter";
import { COURSE_LESSONS } from "@/features/lessons/content";
import { referenceCircuit } from "@/features/lessons/reference-circuit";
import { runLessonChecks } from "@/features/lessons/run-check";
import {
  analogWrite,
  blocksToArduino,
  compare,
  digitalRead,
  digitalWrite,
  ifElse,
  level,
  loopValue,
  paletteFor,
  pinMode,
  program,
  repeat,
  wait,
  type WorkspaceState,
} from "../program";

/**
 * Bloky nemají vlastní kontrolu — překládají se do Arduino C a jdou do
 * stejné kontroly chování jako kód psaný rukou. Tyhle testy hlídají, že
 * ten překlad je opravdu kód, který se přeloží a dělá, co bloky říkají.
 */

describe("překlad bloků do Arduino C", () => {
  it("rozsvícení LED", () => {
    const { code, loose } = blocksToArduino(
      program({ setup: [pinMode(8, "OUTPUT")], loop: [digitalWrite(8, "HIGH")] }),
    );
    expect(code).toBe(
      "void setup() {\n  pinMode(8, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(8, HIGH);\n}\n",
    );
    expect(loose).toBe(0);
  });

  it("podmínka s porovnáním a větví jinak", () => {
    const { code } = blocksToArduino(
      program({
        loop: [
          ifElse(compare(digitalRead(7), "==", level("LOW")), [wait(1)], [wait(2)]),
        ],
      }),
    );
    expect(code).toContain("if (digitalRead(7) == LOW) {\n    delay(1);\n  } else {\n    delay(2);\n  }");
  });

  it("opakování dolů a hodnota z opakování", () => {
    const { code } = blocksToArduino(
      program({ loop: [repeat(255, 0, [analogWrite(9, loopValue())])] }),
    );
    expect(code).toContain("for (int i = 255; i >= 0; i--) {\n    analogWrite(9, i);\n  }");
  });

  it("vnořené opakování dostane vlastní proměnnou", () => {
    const { code } = blocksToArduino(
      program({ loop: [repeat(0, 2, [repeat(0, 3, [analogWrite(9, loopValue())])])] }),
    );
    expect(code).toContain("for (int j = 0; j <= 3; j++)");
    expect(code).toContain("analogWrite(9, j);");
  });

  it("hodnota z opakování mimo opakování je nula, ne chyba překladu", () => {
    const { code } = blocksToArduino(program({ loop: [analogWrite(9, loopValue())] }));
    expect(code).toContain("analogWrite(9, 0);");
    expect(() => compile(code)).not.toThrow();
  });

  it("prázdné okénko nerozbije překlad", () => {
    const state = program({ loop: [{ type: "analog_write", fields: { PIN: 9 } }] });
    const { code } = blocksToArduino(state);
    expect(code).toContain("analogWrite(9, 0);");
  });

  it("nepřipojené bloky se počítají, ale do kódu nejdou", () => {
    const state = program({ loop: [wait(10)] });
    state.blocks!.blocks.push({ type: "delay_ms", fields: { MS: 99 }, x: 400, y: 400 });
    const { code, loose } = blocksToArduino(state);
    expect(loose).toBe(1);
    expect(code).not.toContain("99");
  });

  it("nesmyslný pin se nepropíše do kódu", () => {
    const { code } = blocksToArduino(
      program({ loop: [{ type: "digital_write", fields: { PIN: "abc", LEVEL: "HIGH" } }] }),
    );
    expect(code).toContain("digitalWrite(0, HIGH);");
  });

  it("prázdná plocha dá prázdný, ale přeložitelný program", () => {
    const { code } = blocksToArduino({} as WorkspaceState);
    expect(() => compile(code)).not.toThrow();
  });
});

describe("paleta lekce", () => {
  it("nabízí každý druh bloku z řešení jednou a bez obsahu", () => {
    const palette = paletteFor(
      program({
        setup: [pinMode(8, "OUTPUT")],
        loop: [
          ifElse(compare(digitalRead(7), "==", level("LOW")), [digitalWrite(8, "HIGH")], [
            digitalWrite(8, "LOW"),
          ]),
        ],
      }),
    );

    expect(palette.map((b) => b.type)).toEqual([
      "pin_mode",
      "digital_write",
      "if_else",
      "level",
      "digital_read",
      "compare",
    ]);

    const ifBlock = palette.find((b) => b.type === "if_else")!;
    expect(ifBlock.inputs).toBeUndefined();
    /* LOW v porovnání zůstane jako předvyplněný stín. */
    const cmp = palette.find((b) => b.type === "compare")!;
    expect(cmp.inputs?.B?.shadow?.type).toBe("level");
    expect(cmp.inputs?.A).toBeUndefined();
  });
});

describe.each(COURSE_LESSONS.map((l) => [l.slug, l] as const))("bloky lekce %s", (_s, lesson) => {
  const circuit = referenceCircuit(lesson.wiring);

  it("řešení v blocích projde stejnými kontrolami jako kód", () => {
    const { code, loose } = blocksToArduino(lesson.blocks.solution);
    expect(loose).toBe(0);

    const result = runLessonChecks(lesson, circuit, code);
    expect(result.error, code).toBeNull();
    expect(
      result.outcomes.filter((o) => !o.passed).map((o) => o.label),
      code,
    ).toEqual([]);
  });

  it("výchozí bloky se přeloží a samy úlohu nesplní", () => {
    const { code } = blocksToArduino(lesson.blocks.starter);
    expect(() => compile(code)).not.toThrow();
    expect(runLessonChecks(lesson, circuit, code).passed).toBe(false);
  });

  it("má nápovědy v řeči bloků a paletu", () => {
    expect(lesson.blocks.hints.length).toBeGreaterThan(0);
    expect(paletteFor(lesson.blocks.solution).length).toBeGreaterThan(0);
  });

  it("žádná nápověda v blocích nediktuje kód", () => {
    /* Dítě v blocích nevidí digitalWrite ani středníky. Nápověda, která
       je jmenuje, ho pošle hledat něco, co na obrazovce není. */
    const code = /\b(digitalWrite|pinMode|analogWrite|delay|tone|noTone|Serial|for|loop|setup)\s*\(|;|\belse\b/;
    const texts = [
      ...lesson.blocks.hints,
      ...lesson.checks.map((c) => c.blockHint ?? c.hint),
    ];
    for (const text of texts) expect(text).not.toMatch(code);
  });
});
