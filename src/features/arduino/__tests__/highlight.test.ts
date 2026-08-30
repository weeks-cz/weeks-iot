import { describe, expect, it } from "vitest";
import { highlight } from "../highlight";
import { lesson1 } from "@/features/lessons/content/01-rozsvit-ledku";

/**
 * Zvýrazňovač běží nad kódem, který dítě právě píše — tedy nad kódem
 * rozepsaným v půlce slova. Nesmí nikdy spadnout a nesmí nikdy ztratit
 * ani jeden znak: text pod kurzorem musí sedět přesně na text v barevné
 * vrstvě pod ním, jinak se rozjede celý editor.
 */

/** Znovusložený zdroj — invariant, na kterém stojí celé překrytí. */
function joined(source: string): string {
  return highlight(source)
    .map((t) => t.value)
    .join("");
}

function kinds(source: string): Array<[string, string]> {
  return highlight(source).map((t) => [t.kind, t.value]);
}

describe("highlight", () => {
  it("nikdy neztratí znak", () => {
    const sources = [
      lesson1.starterCode,
      lesson1.solution,
      "",
      "\n\n\n",
      "   ",
      'Serial.print("ahoj");',
      "int x = 5; // pozn\námka",
      "/* nedokončený komentář",
      '"nedokončený řetězec',
      "'",
      "delay(1000);\n\n",
      "žluťoučký kůň // úpěl ďábelské ódy",
    ];

    for (const source of sources) {
      expect(joined(source), JSON.stringify(source)).toBe(source);
    }
  });

  it("pozná řádkový komentář včetně lomítek", () => {
    const list = kinds("// nic\nint x;");
    expect(list[0]).toEqual(["comment", "// nic"]);
    expect(list).toContainEqual(["keyword", "int"]);
  });

  it("komentář končí na konci řádku, ne dřív", () => {
    const tokens = highlight("int a; // sem\nint b;");
    expect(tokens.find((t) => t.kind === "comment")?.value).toBe("// sem");
  });

  it("blokový komentář drží přes řádky", () => {
    expect(highlight("/* dva\nřádky */ int x;").find((t) => t.kind === "comment")?.value).toBe(
      "/* dva\nřádky */",
    );
  });

  it("nedokončený blokový komentář obarví zbytek souboru a nespadne", () => {
    expect(highlight("int x;\n/* pak už nic").at(-1)).toEqual({
      kind: "comment",
      value: "/* pak už nic",
    });
  });

  it("dvě lomítka uvnitř řetězce nejsou komentář", () => {
    expect(kinds('Serial.print("a // b");')).toContainEqual(["string", '"a // b"']);
  });

  it("nedokončený řetězec končí na konci řádku, ne na konci souboru", () => {
    const tokens = highlight('Serial.print("ahoj\nint x;');
    expect(tokens.find((t) => t.kind === "string")?.value).toBe('"ahoj');
    expect(tokens.some((t) => t.kind === "keyword" && t.value === "int")).toBe(true);
  });

  it("zná klíčová slova i konstanty desky", () => {
    const list = kinds("void setup() { pinMode(led, OUTPUT); }");
    expect(list).toContainEqual(["keyword", "void"]);
    expect(list).toContainEqual(["keyword", "OUTPUT"]);
  });

  it("jméno před závorkou je volání funkce", () => {
    expect(kinds("digitalWrite(led, HIGH);")).toContainEqual(["call", "digitalWrite"]);
  });

  it("proměnná není volání", () => {
    expect(highlight("led = 8;").some((t) => t.kind === "call")).toBe(false);
  });

  it("čísla jsou čísla", () => {
    expect(kinds("delay(1000);")).toContainEqual(["number", "1000"]);
  });

  it("mezera mezi jménem a závorkou volání nevadí", () => {
    expect(kinds("delay (10);")).toContainEqual(["call", "delay"]);
  });

  it("startovní kód lekce 1 má úkoly obarvené jako komentář", () => {
    const comments = highlight(lesson1.starterCode).filter((t) => t.kind === "comment");
    expect(comments.some((t) => t.value.includes("ÚKOL 1"))).toBe(true);
    expect(comments.some((t) => t.value.includes("ÚKOL 2"))).toBe(true);
  });

  it("zakomentovaný příkaz je celý komentář — přesně ta past z lekce 1", () => {
    const tokens = highlight("  // pinMode(led,OUTPUT);");
    expect(tokens.filter((t) => t.kind !== "text")).toEqual([
      { kind: "comment", value: "// pinMode(led,OUTPUT);" },
    ]);
  });
});
