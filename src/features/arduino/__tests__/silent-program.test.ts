import { describe, expect, it } from "vitest";
import { silentProgramReason } from "../silent-program";
import { COURSE_LESSONS } from "@/features/lessons/content";

/** Kód přesně tak, jak ho dítě mělo na obrazovce. */
const ZE_SNIMKU = `// Číslo pinu, na kterém máš LED.
int led = 8;

void setup() {
  // ÚKOL 1: Řekni Arduinu, že pin s LED bude OVLÁDAT.
  // pinMode(led,OUTPUT);
}

void loop() {
  // ÚKOL 2: Rozsviť LED — pošli na pin HIGH.
  // digitalWrite(led,HIGH);

}
`;

describe("silentProgramReason", () => {
  it("ukáže na řádek se zakomentovaným příkazem", () => {
    const reason = silentProgramReason(ZE_SNIMKU);
    expect(reason?.line).toBe(6);
    expect(reason?.message).toContain("//");
  });

  it("najde první zakomentovaný příkaz, ne poslední", () => {
    /* Dítě opravuje odshora dolů. Ukázat mu ten spodní by ho poslalo
       opravit půlku problému. */
    expect(silentProgramReason(ZE_SNIMKU)?.line).toBe(6);
  });

  it("vzorové řešení žádný důvod k mlčení nemá", () => {
    for (const lesson of COURSE_LESSONS) {
      expect(silentProgramReason(lesson.solution), lesson.slug).toBeNull();
    }
  });

  it("startovní kód neukazuje na komentáře se zadáním", () => {
    /* Zadání v komentářích není kód, který si dítě schovalo. Lekce
       o tlačítku má v zadání „1) přečti tlačítko: digitalRead(tlacitko)"
       — ukázat na ni „máš tu příkaz schovaný za //" by byla lež. */
    for (const lesson of COURSE_LESSONS) {
      const reason = silentProgramReason(lesson.starterCode, lesson.starterCode);
      expect(reason?.line ?? null, lesson.slug).toBeNull();
    }
  });

  it("zadání se závorkou neplete ani bez znalosti startovního kódu", () => {
    /* Druhá pojistka, nezávislá na té první: bez středníku to není
       dokončený příkaz. */
    expect(
      silentProgramReason(`void setup() {
  //   1) přečti tlačítko: digitalRead(tlacitko)
}
void loop() { }
`)?.line,
    ).toBeNull();
  });

  it("prázdný startovní kód řekne, že program nic neobsahuje", () => {
    const reason = silentProgramReason(COURSE_LESSONS[0]!.starterCode);
    expect(reason?.line).toBeNull();
    expect(reason?.message).toContain("jediný příkaz");
  });

  it("kód, který se nepřeloží, neřeší — od toho je chyba překladu", () => {
    expect(silentProgramReason("void setup() { pinMode(led, OUTPUT) }")).toBeNull();
  });

  it("program s příkazy a bez schovaných příkazů mlčet nemá proč", () => {
    expect(
      silentProgramReason(`int led = 8;
void setup() { pinMode(led, OUTPUT); }
void loop() { }
`),
    ).toBeNull();
  });

  it("blokový komentář schová příkaz stejně dobře jako řádkový", () => {
    expect(
      silentProgramReason(`int led = 8;
void setup() {
  /* pinMode(led, OUTPUT); */
}
void loop() { }
`)?.line,
    ).toBe(3);
  });

  it("česká věta v komentáři není příkaz", () => {
    const reason = silentProgramReason(`void setup() {
  // Tady bude něco, až na to přijdu. Fakt.
}
void loop() { }
`);
    expect(reason).not.toBeNull();
    expect(reason?.line).toBeNull();
  });

  it("schovaný příkaz najde i v programu, který jinak něco dělá", () => {
    /* Kdy se to dítěti ukáže, rozhoduje run-check podle toho, jestli
       neprošla ani jedna kontrola. Tahle funkce jen odpovídá na otázku. */
    expect(
      silentProgramReason(`int led = 8;
void setup() { pinMode(led, OUTPUT); }
void loop() {
  // digitalWrite(led, HIGH);
}
`)?.line,
    ).toBe(4);
  });
});
