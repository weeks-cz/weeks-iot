/**
 * Lexer podmnožiny Arduino C++.
 *
 * Rozsah je záměrně malý: co potřebuje sedm lekcí prvního kurzu a nic
 * navíc. Žádné třídy, ukazatele, pole ani knihovny. Kdo je zkusí použít,
 * dostane srozumitelnou hlášku místo záhadné chyby — což je pro dítě
 * mnohem lepší než tichý pád.
 *
 * Pozice se hlídá po řádcích a sloupcích, protože hlášky musí ukázat
 * PŘESNĚ na místo. „Chyba v kódu" bez řádku je pro dvanáctileté dítě
 * k ničemu.
 */

export type TokenType =
  | "number"
  | "string"
  | "identifier"
  | "keyword"
  | "operator"
  | "punct"
  | "eof";

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

export const KEYWORDS = new Set([
  "void", "int", "long", "float", "double", "bool", "boolean", "char", "byte",
  "unsigned", "const", "true", "false",
  "if", "else", "for", "while", "do", "return", "break", "continue",
  "HIGH", "LOW", "INPUT", "OUTPUT", "INPUT_PULLUP",
]);

/* Delší operátory musí být první — jinak by se `<=` rozpadlo na `<` a `=`. */
const OPERATORS = [
  "<<=", ">>=",
  "==", "!=", "<=", ">=", "&&", "||", "++", "--",
  "+=", "-=", "*=", "/=", "%=", "<<", ">>",
  "+", "-", "*", "/", "%", "=", "<", ">", "!", "&", "|", "^", "~",
];

const PUNCT = new Set(["(", ")", "{", "}", "[", "]", ";", ",", "."]);

export class LexError extends Error {
  constructor(
    message: string,
    readonly line: number,
    readonly col: number,
  ) {
    super(message);
    this.name = "LexError";
  }
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  const push = (type: TokenType, value: string, l = line, c = col) => {
    tokens.push({ type, value, line: l, col: c });
  };

  const advance = (n = 1) => {
    for (let k = 0; k < n; k++) {
      if (source[i] === "\n") {
        line += 1;
        col = 1;
      } else {
        col += 1;
      }
      i += 1;
    }
  };

  while (i < source.length) {
    const ch = source[i]!;

    /* Bílé znaky */
    if (/\s/.test(ch)) {
      advance();
      continue;
    }

    /* Komentáře — dítě je psát bude a nesmí ho rozhodit. */
    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") advance();
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      const startLine = line;
      advance(2);
      let closed = false;
      while (i < source.length) {
        if (source[i] === "*" && source[i + 1] === "/") {
          advance(2);
          closed = true;
          break;
        }
        advance();
      }
      if (!closed) {
        throw new LexError("Začal jsi komentář /* a nezavřel ho pomocí */.", startLine, 1);
      }
      continue;
    }

    /* Preprocesor — #include a spol. přeskakujeme celý řádek. Lekce
       knihovny nepotřebují a mlčky ignorovat je lepší než hlásit chybu
       u řádku, který dítě jen opsalo odjinud. */
    if (ch === "#") {
      while (i < source.length && source[i] !== "\n") advance();
      continue;
    }

    /* Čísla */
    if (/[0-9]/.test(ch)) {
      const l = line;
      const c = col;
      let value = "";
      while (i < source.length && /[0-9.]/.test(source[i]!)) {
        value += source[i];
        advance();
      }
      push("number", value, l, c);
      continue;
    }

    /* Řetězce */
    if (ch === '"') {
      const l = line;
      const c = col;
      advance();
      let value = "";
      while (i < source.length && source[i] !== '"') {
        if (source[i] === "\\" && i + 1 < source.length) {
          const next = source[i + 1];
          value += next === "n" ? "\n" : next === "t" ? "\t" : next;
          advance(2);
          continue;
        }
        if (source[i] === "\n") {
          throw new LexError("Text v uvozovkách nesmí přeskočit na další řádek.", l, c);
        }
        value += source[i];
        advance();
      }
      if (i >= source.length) {
        throw new LexError("Otevřel jsi uvozovky a nezavřel je.", l, c);
      }
      advance();
      push("string", value, l, c);
      continue;
    }

    /* Znak v apostrofech — Serial.print('A') */
    if (ch === "'") {
      const l = line;
      const c = col;
      advance();
      let value = "";
      while (i < source.length && source[i] !== "'") {
        value += source[i];
        advance();
      }
      if (i >= source.length) {
        throw new LexError("Otevřel jsi apostrof a nezavřel ho.", l, c);
      }
      advance();
      push("string", value, l, c);
      continue;
    }

    /* Identifikátory a klíčová slova */
    if (/[A-Za-z_]/.test(ch)) {
      const l = line;
      const c = col;
      let value = "";
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i]!)) {
        value += source[i];
        advance();
      }
      push(KEYWORDS.has(value) ? "keyword" : "identifier", value, l, c);
      continue;
    }

    /* Operátory */
    const op = OPERATORS.find((o) => source.startsWith(o, i));
    if (op) {
      const l = line;
      const c = col;
      advance(op.length);
      push("operator", op, l, c);
      continue;
    }

    /* Interpunkce */
    if (PUNCT.has(ch)) {
      const l = line;
      const c = col;
      advance();
      push("punct", ch, l, c);
      continue;
    }

    throw new LexError(`Tomuhle znaku nerozumím: ${ch}`, line, col);
  }

  push("eof", "", line, col);
  return tokens;
}
