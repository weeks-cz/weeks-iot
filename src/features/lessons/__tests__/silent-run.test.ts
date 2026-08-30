import { describe, expect, it } from "vitest";
import { COURSE_LESSONS } from "../content";
import { referenceCircuit } from "../reference-circuit";
import { runLessonChecks } from "../run-check";

/**
 * Zakomentovaný program se přeloží čistě, LED nesvítí a kontrola pak dítěti
 * poradí napsat přesně tu větu, kterou má zakomentovanou na obrazovce před
 * sebou. Přesně tohle jedno dítě zaseklo na lekci 1 — té jediné, která
 * běží bez účtu a na které se měří aktivace.
 */

const lesson1 = COURSE_LESSONS[0]!;
const lesson2 = COURSE_LESSONS[1]!;

describe("mlčící program v běhu lekce", () => {
  it("ukáže na zakomentovaný příkaz místo nápovědy, kterou dítě splnilo", () => {
    const circuit = referenceCircuit(lesson1.wiring);
    const run = runLessonChecks(
      lesson1,
      circuit,
      `int led = 8;

void setup() {
  // ÚKOL 1: Řekni Arduinu, že pin s LED bude OVLÁDAT.
  // pinMode(led,OUTPUT);
}

void loop() {
  // ÚKOL 2: Rozsviť LED — pošli na pin HIGH.
  // digitalWrite(led,HIGH);
}
`,
    );

    expect(run.error).toBeNull();
    expect(run.passed).toBe(false);
    expect(run.silent?.line).toBe(5);
  });

  it("chytne to i tam, kde startovní kód nějaké příkazy má", () => {
    /* Lekce 2 začíná s pinMode v setup(). Program tedy „nějaké příkazy"
       má i tehdy, když si dítě zakomentuje celý svůj kus práce. */
    const run = runLessonChecks(
      lesson2,
      referenceCircuit(lesson2.wiring),
      `int led = 8;

void setup() {
  pinMode(led, OUTPUT);
}

void loop() {
  // digitalWrite(led, HIGH);
  // delay(500);
  // digitalWrite(led, LOW);
  // delay(500);
}
`,
    );

    expect(run.silent?.line).toBe(8);
  });

  it("vzorové řešení mlčící není", () => {
    for (const lesson of COURSE_LESSONS) {
      const run = runLessonChecks(lesson, referenceCircuit(lesson.wiring), lesson.solution);
      expect(run.silent, lesson.slug).toBeNull();
    }
  });

  it("programu, kterému aspoň jedna kontrola projde, se do komentářů nehrabe", () => {
    /* Kdo si schová řádek stranou a zbytek mu funguje, dělá to schválně. */
    const run = runLessonChecks(
      lesson1,
      referenceCircuit(lesson1.wiring),
      `int led = 8;

void setup() {
  pinMode(led, OUTPUT);
}

void loop() {
  // digitalWrite(led, LOW);
  digitalWrite(led, HIGH);
}
`,
    );

    expect(run.passed).toBe(true);
    expect(run.silent).toBeNull();
  });

  it("chyba překladu má přednost — dvě hlášky naráz jsou jako žádná", () => {
    const run = runLessonChecks(
      lesson1,
      referenceCircuit(lesson1.wiring),
      `void setup() { pinMode(led, OUTPUT) }`,
    );

    expect(run.error).not.toBeNull();
    expect(run.silent).toBeNull();
  });
});
