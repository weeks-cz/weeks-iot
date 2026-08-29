import { describe, expect, it } from "vitest";
import { LexError, tokenize } from "../lexer";
import { ParseError, parse } from "../parser";

const LESSON_1 = `
// Lekce 1 — rozsviť LEDku
int tlacitko = 7;
int led = 8;

void setup() {
  pinMode(tlacitko, INPUT);
  pinMode(led, OUTPUT);
}

void loop() {
  if (digitalRead(tlacitko) == HIGH) {
    digitalWrite(led, HIGH);
  } else {
    digitalWrite(led, LOW);
  }
}
`;

describe("lexer", () => {
  it("rozpozná čísla, jména a operátory", () => {
    const t = tokenize("int x = 12;");
    expect(t.map((x) => x.type)).toEqual([
      "keyword", "identifier", "operator", "number", "punct", "eof",
    ]);
  });

  it("přeskočí řádkový i blokový komentář", () => {
    const t = tokenize("// nic\n/* taky nic */ int x;");
    expect(t[0]!.value).toBe("int");
  });

  it("přeskočí #include", () => {
    // Dítě si ho může opsat odjinud; hlásit chybu by bylo horší než mlčet.
    const t = tokenize("#include <Servo.h>\nint x;");
    expect(t[0]!.value).toBe("int");
  });

  it("hlásí neuzavřený komentář s řádkem", () => {
    try {
      tokenize("int x;\n/* zapomněl jsem zavřít");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(LexError);
      expect((e as LexError).line).toBe(2);
      expect((e as LexError).message).toMatch(/nezavřel/i);
    }
  });

  it("hlásí neuzavřené uvozovky", () => {
    expect(() => tokenize('Serial.println("ahoj);')).toThrow(/uvozovky/i);
  });

  it("delší operátor má přednost před kratším", () => {
    // Bez toho by se <= rozpadlo na < a = a podmínka by se chovala jinak.
    const t = tokenize("a <= b");
    expect(t[1]!.value).toBe("<=");
  });

  it("hlídá řádky napříč celým zdrojem", () => {
    const t = tokenize("int a;\nint b;\nint c;");
    expect(t.filter((x) => x.value === "int").map((x) => x.line)).toEqual([1, 2, 3]);
  });
});

describe("parser — co má projít", () => {
  it("rozparsuje celou lekci 1", () => {
    const p = parse(LESSON_1);
    expect(p.globals.map((g) => g.name)).toEqual(["tlacitko", "led"]);
    expect(p.functions.map((f) => f.name)).toEqual(["setup", "loop"]);
  });

  it("zvládne for, while i do-while", () => {
    const p = parse(`
      void loop() {
        for (int i = 0; i < 3; i++) { digitalWrite(i, HIGH); }
        while (true) { break; }
        do { break; } while (false);
      }
    `);
    expect(p.functions).toHaveLength(1);
  });

  it("zvládne Serial.println", () => {
    const p = parse('void setup() { Serial.begin(9600); Serial.println("ahoj"); }');
    expect(p.functions[0]!.body.body).toHaveLength(2);
  });

  it("respektuje prioritu operátorů", () => {
    // 2 + 3 * 4 musí být 2 + (3*4), ne (2+3)*4.
    const p = parse("void loop() { int x = 2 + 3 * 4; }");
    const decl = p.functions[0]!.body.body[0]!;
    expect(decl.kind).toBe("varDecl");
    if (decl.kind === "varDecl" && decl.init?.kind === "binary") {
      expect(decl.init.op).toBe("+");
      expect(decl.init.right.kind).toBe("binary");
    }
  });

  it("zvládne && i || ve správném pořadí", () => {
    // a || b && c znamená a || (b && c).
    const p = parse("void loop() { bool x = a || b && c; }");
    const decl = p.functions[0]!.body.body[0]!;
    if (decl.kind === "varDecl" && decl.init?.kind === "binary") {
      expect(decl.init.op).toBe("||");
    }
  });

  it("zvládne i++ i ++i", () => {
    const p = parse("void loop() { i++; ++j; }");
    expect(p.functions[0]!.body.body).toHaveLength(2);
  });
});

describe("parser — hlášky mluví k dítěti", () => {
  it("chybějící středník řekne, kde a co", () => {
    try {
      parse("void setup() {\n  pinMode(8, OUTPUT)\n}");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      const err = e as ParseError;
      expect(err.message).toMatch(/středník/i);
      /* Číslo řádku je to hlavní — bez něj se hláška nedá použít. */
      expect(err.line).toBe(2);
    }
  });

  it("neuzavřená složená závorka řekne, že chybí }", () => {
    try {
      parse("void setup() {\n  pinMode(8, OUTPUT);");
      expect.unreachable();
    } catch (e) {
      expect((e as ParseError).message).toMatch(/nezavřel|\}/);
    }
  });

  it("neuzavřená kulatá závorka u volání", () => {
    expect(() => parse("void setup() { pinMode(8, OUTPUT; }")).toThrow(/závorka/i);
  });

  it("chybějící podmínka u if", () => {
    expect(() => parse("void loop() { if digitalRead(7) {} }")).toThrow(/if.*závorce/i);
  });

  it("hlášky nejsou anglicky", () => {
    // "Unexpected token" je pro dvanáctileté dítě k ničemu.
    const cases = [
      "void setup() { pinMode(8, OUTPUT) }",
      "void loop() { if (x {} }",
      "void loop() { int = 5; }",
    ];
    for (const src of cases) {
      try {
        parse(src);
      } catch (e) {
        expect((e as Error).message).not.toMatch(/unexpected|token|syntax error/i);
      }
    }
  });

  it("prázdný program projde", () => {
    expect(parse("").functions).toEqual([]);
  });
});
