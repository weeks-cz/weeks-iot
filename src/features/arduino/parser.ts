import type {
  Block,
  Expr,
  FunctionDecl,
  Identifier,
  Program,
  Stmt,
  VarDecl,
} from "./ast";
import { tokenize, type Token } from "./lexer";

/**
 * Parser podmnožiny Arduino C++.
 *
 * ── Na čem tu záleží nejvíc ────────────────────────────────────────────────
 * Na hláškách. Dítě, které zapomene středník, nesmí dostat „Unexpected
 * token" — musí dostat větu, ze které pozná, co dopsat, a číslo řádku,
 * kam se podívat. Proto je skoro u každého `expect()` vlastní text.
 *
 * Typy se parsují, ale běh na nich nestojí: `int` a `float` se chovají
 * stejně, protože v těchhle lekcích na rozdílu nezáleží a předstírat
 * přetečení `int`u by dítě jen mátlo.
 */

export class ParseError extends Error {
  constructor(
    message: string,
    readonly line: number,
    readonly col: number,
  ) {
    super(message);
    this.name = "ParseError";
  }
}

const TYPE_KEYWORDS = new Set([
  "void", "int", "long", "float", "double", "bool", "boolean", "char", "byte", "unsigned",
]);

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)]!;
  }

  private at(value: string): boolean {
    return this.peek().value === value;
  }

  private atType(type: Token["type"]): boolean {
    return this.peek().type === type;
  }

  private next(): Token {
    return this.tokens[this.pos++]!;
  }

  private eat(value: string): boolean {
    if (this.at(value)) {
      this.pos += 1;
      return true;
    }
    return false;
  }

  private expect(value: string, message: string): Token {
    if (!this.at(value)) {
      const t = this.peek();
      throw new ParseError(message, t.line, t.col);
    }
    return this.next();
  }

  /* ── Program ──────────────────────────────────────────────────────────── */

  parseProgram(): Program {
    const globals: VarDecl[] = [];
    const functions: FunctionDecl[] = [];

    while (!this.atType("eof")) {
      const start = this.pos;
      const type = this.tryParseType();

      if (type && this.peek().type === "identifier") {
        const nameTok = this.peek();

        /* Funkce od proměnné pozná závorka za jménem. */
        if (this.peek(1).value === "(") {
          functions.push(this.parseFunction(type, nameTok.value));
          continue;
        }

        this.pos = start;
        globals.push(this.parseVarDecl());
        continue;
      }

      const t = this.peek();
      throw new ParseError(
        `Tady jsem čekal začátek funkce nebo proměnné, ale našel jsem "${t.value}".`,
        t.line,
        t.col,
      );
    }

    return { globals, functions };
  }

  private tryParseType(): string | null {
    const parts: string[] = [];
    while (this.peek().type === "keyword" && TYPE_KEYWORDS.has(this.peek().value)) {
      parts.push(this.next().value);
    }
    if (this.at("const")) this.next();
    return parts.length > 0 ? parts.join(" ") : null;
  }

  private parseFunction(type: string, name: string): FunctionDecl {
    const line = this.peek().line;
    this.next(); // jméno
    this.expect("(", `Za názvem funkce ${name} chybí závorka (.`);

    const params: Array<{ type: string; name: string }> = [];
    while (!this.at(")") && !this.atType("eof")) {
      const paramType = this.tryParseType() ?? "int";
      const paramName = this.next().value;
      params.push({ type: paramType, name: paramName });
      if (!this.eat(",")) break;
    }
    this.expect(")", `U funkce ${name} chybí uzavírací závorka ).`);

    const body = this.parseBlock(`Tělo funkce ${name} musí začínat složenou závorkou {.`);
    return { kind: "function", name, params, body, line };
  }

  /* ── Příkazy ──────────────────────────────────────────────────────────── */

  private parseBlock(openMessage: string): Block {
    const line = this.peek().line;
    this.expect("{", openMessage);

    const body: Stmt[] = [];
    while (!this.at("}") && !this.atType("eof")) {
      body.push(this.parseStatement());
    }

    if (this.atType("eof")) {
      throw new ParseError(
        "Otevřel jsi složenou závorku { a nezavřel ji pomocí }.",
        line,
        1,
      );
    }
    this.next();
    return { kind: "block", body, line };
  }

  private parseStatement(): Stmt {
    const t = this.peek();
    const line = t.line;

    if (this.at("{")) return this.parseBlock("");

    if (this.at("if")) {
      this.next();
      this.expect("(", "Za if musí být podmínka v závorce.");
      const test = this.parseExpression();
      this.expect(")", "Podmínka za if není uzavřená závorkou ).");
      const then = this.parseStatement();
      let otherwise: Stmt | null = null;
      if (this.eat("else")) otherwise = this.parseStatement();
      return { kind: "if", test, then, otherwise, line };
    }

    if (this.at("while")) {
      this.next();
      this.expect("(", "Za while musí být podmínka v závorce.");
      const test = this.parseExpression();
      this.expect(")", "Podmínka za while není uzavřená závorkou ).");
      return { kind: "while", test, body: this.parseStatement(), line };
    }

    if (this.at("do")) {
      this.next();
      const body = this.parseStatement();
      this.expect("while", "Po do musí následovat while s podmínkou.");
      this.expect("(", "Za while musí být podmínka v závorce.");
      const test = this.parseExpression();
      this.expect(")", "Podmínka za while není uzavřená závorkou ).");
      this.expect(";", "Za do-while musí být středník.");
      return { kind: "doWhile", test, body, line };
    }

    if (this.at("for")) {
      this.next();
      this.expect("(", "Za for musí být závorka.");
      const init = this.at(";") ? null : this.parseSimpleStatement();
      /* Středník se spotřebuje vždycky, i když je první část prázdná.
         `for (int i = 0; ...)` jinak zůstane stát na středníku a další
         krok ho vyhodnotí jako chybějící. */
      this.expect(";", "V for chybí středník za první částí závorky.");
      const test = this.at(";") ? null : this.parseExpression();
      this.expect(";", "V for chybí středník za podmínkou.");
      const update = this.at(")") ? null : this.parseExpression();
      this.expect(")", "Závorka u for není uzavřená.");
      return { kind: "for", init, test, update, body: this.parseStatement(), line };
    }

    if (this.at("return")) {
      this.next();
      const value = this.at(";") ? null : this.parseExpression();
      this.expect(";", "Za return musí být středník.");
      return { kind: "return", value, line };
    }

    if (this.at("break")) {
      this.next();
      this.expect(";", "Za break musí být středník.");
      return { kind: "break", line };
    }

    if (this.at("continue")) {
      this.next();
      this.expect(";", "Za continue musí být středník.");
      return { kind: "continue", line };
    }

    const stmt = this.parseSimpleStatement();

    /* Hláška musí ukázat na řádek PŘÍKAZU, ne na řádek tokenu, o který se
       parser zarazil. Ten je typicky o řádek dál — u zavírací závorky —
       a dítě by hledalo chybu na špatném místě. */
    if (!this.at(";")) {
      throw new ParseError(
        `Na konci řádku chybí středník. V C++ musí každý příkaz končit ; — tenhle na řádku ${stmt.line} ho nemá.`,
        stmt.line,
        1,
      );
    }
    this.next();
    return stmt;
  }

  /** Deklarace proměnné nebo samostatný výraz. Bez koncového středníku. */
  private parseSimpleStatement(): Stmt {
    const start = this.pos;
    const type = this.tryParseType();

    if (type && this.peek().type === "identifier") {
      this.pos = start;
      return this.parseVarDecl(false);
    }
    this.pos = start;

    const line = this.peek().line;
    return { kind: "exprStmt", expr: this.parseExpression(), line };
  }

  private parseVarDecl(requireSemicolon = true): VarDecl {
    const line = this.peek().line;
    const type = this.tryParseType() ?? "int";
    const nameTok = this.next();

    if (nameTok.type !== "identifier") {
      throw new ParseError(
        `Za typem ${type} jsem čekal název proměnné.`,
        nameTok.line,
        nameTok.col,
      );
    }

    let init: Expr | null = null;
    if (this.eat("=")) init = this.parseExpression();

    if (requireSemicolon) {
      this.expect(";", `Za deklarací proměnné ${nameTok.value} chybí středník.`);
    }
    return { kind: "varDecl", type, name: nameTok.value, init, line };
  }

  /* ── Výrazy ───────────────────────────────────────────────────────────── */

  parseExpression(): Expr {
    return this.parseAssignment();
  }

  private parseAssignment(): Expr {
    const left = this.parseLogicalOr();
    const t = this.peek();

    if (
      t.type === "operator" &&
      ["=", "+=", "-=", "*=", "/=", "%="].includes(t.value)
    ) {
      if (left.kind !== "identifier") {
        throw new ParseError("Přiřazovat jde jen do proměnné.", t.line, t.col);
      }
      this.next();
      return {
        kind: "assign",
        op: t.value,
        target: left,
        value: this.parseAssignment(),
        line: t.line,
      };
    }

    return left;
  }

  /* Priorita operátorů odspodu nahoru — každá úroveň volá tu vyšší. */
  private parseLogicalOr(): Expr {
    let left = this.parseLogicalAnd();
    while (this.at("||")) {
      const t = this.next();
      left = { kind: "binary", op: t.value, left, right: this.parseLogicalAnd(), line: t.line };
    }
    return left;
  }

  private parseLogicalAnd(): Expr {
    let left = this.parseEquality();
    while (this.at("&&")) {
      const t = this.next();
      left = { kind: "binary", op: t.value, left, right: this.parseEquality(), line: t.line };
    }
    return left;
  }

  private parseEquality(): Expr {
    let left = this.parseComparison();
    while (this.at("==") || this.at("!=")) {
      const t = this.next();
      left = { kind: "binary", op: t.value, left, right: this.parseComparison(), line: t.line };
    }
    return left;
  }

  private parseComparison(): Expr {
    let left = this.parseAdditive();
    while (this.at("<") || this.at(">") || this.at("<=") || this.at(">=")) {
      const t = this.next();
      left = { kind: "binary", op: t.value, left, right: this.parseAdditive(), line: t.line };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (this.at("+") || this.at("-")) {
      const t = this.next();
      left = { kind: "binary", op: t.value, left, right: this.parseMultiplicative(), line: t.line };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.at("*") || this.at("/") || this.at("%")) {
      const t = this.next();
      left = { kind: "binary", op: t.value, left, right: this.parseUnary(), line: t.line };
    }
    return left;
  }

  private parseUnary(): Expr {
    const t = this.peek();

    if (t.value === "!" || t.value === "-" || t.value === "+") {
      this.next();
      return { kind: "unary", op: t.value, operand: this.parseUnary(), line: t.line };
    }

    if (t.value === "++" || t.value === "--") {
      this.next();
      const operand = this.parseUnary();
      if (operand.kind !== "identifier") {
        throw new ParseError(`${t.value} jde použít jen u proměnné.`, t.line, t.col);
      }
      return { kind: "update", op: t.value as "++" | "--", prefix: true, target: operand, line: t.line };
    }

    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let expr = this.parsePrimary();

    for (;;) {
      const t = this.peek();

      if (t.value === "++" || t.value === "--") {
        this.next();
        if (expr.kind !== "identifier") {
          throw new ParseError(`${t.value} jde použít jen u proměnné.`, t.line, t.col);
        }
        expr = {
          kind: "update",
          op: t.value as "++" | "--",
          prefix: false,
          target: expr,
          line: t.line,
        };
        continue;
      }

      if (t.value === ".") {
        this.next();
        const prop = this.next();
        if (expr.kind !== "identifier") {
          throw new ParseError("Tečku umím jen za názvem, třeba Serial.", t.line, t.col);
        }
        expr = { kind: "member", object: expr.name, property: prop.value, line: t.line };
        continue;
      }

      if (t.value === "(") {
        if (expr.kind !== "identifier" && expr.kind !== "member") {
          throw new ParseError("Volat jde jen funkci.", t.line, t.col);
        }
        this.next();
        const args: Expr[] = [];
        while (!this.at(")") && !this.atType("eof")) {
          args.push(this.parseExpression());
          if (!this.eat(",")) break;
        }
        this.expect(")", "U volání funkce chybí uzavírací závorka ).");
        expr = { kind: "call", callee: expr, args, line: t.line };
        continue;
      }

      return expr;
    }
  }

  private parsePrimary(): Expr {
    const t = this.next();

    if (t.type === "number") {
      return { kind: "number", value: Number(t.value), line: t.line };
    }
    if (t.type === "string") {
      return { kind: "string", value: t.value, line: t.line };
    }
    if (t.value === "true" || t.value === "false") {
      return { kind: "bool", value: t.value === "true", line: t.line };
    }

    /* HIGH, LOW, INPUT… jsou v C++ konstanty; tady je stačí předat dál
       jako jméno a vyhodnotit až v interpretu. */
    if (t.type === "identifier" || t.type === "keyword") {
      return { kind: "identifier", name: t.value, line: t.line } satisfies Identifier;
    }

    if (t.value === "(") {
      const expr = this.parseExpression();
      this.expect(")", "Závorka není uzavřená.");
      return expr;
    }

    throw new ParseError(
      t.value === ";"
        ? "Tady chybí to, co má středník ukončit."
        : `Tomuhle nerozumím: "${t.value}".`,
      t.line,
      t.col,
    );
  }
}

export function parse(source: string): Program {
  return new Parser(tokenize(source)).parseProgram();
}
