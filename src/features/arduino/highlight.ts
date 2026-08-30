import { KEYWORDS } from "./lexer";

/**
 * Obarvení kódu pro editor.
 *
 * ── Proč to není lexer ─────────────────────────────────────────────────────
 * `tokenize()` je přísný: nad neuzavřenými uvozovkami nebo nezavřeným
 * blokovým komentářem vyhodí `LexError`. To je u překladu správně — dítě má
 * dostat hlášku. Tady ne. Tohle běží po KAŽDÉM stisku klávesy, a kód
 * rozepsaný v půlce slova je normální stav, ne chyba. Zvýrazňovač, který
 * u `"aho` spadne, by nechal editor zčernat přesně ve chvíli, kdy se píše.
 *
 * Proto je scanner vlastní a odpouštějící: každý znak někam patří,
 * nic nevyhazuje.
 *
 * ── Invariant, na kterém stojí celé překrytí ───────────────────────────────
 * Spojení hodnot všech tokenů se MUSÍ rovnat vstupu, znak po znaku.
 * Barevná vrstva leží přesně pod průhledným textovým polem a jediný
 * ztracený znak posune všechno za ním o kus vedle. Hlídá to test.
 */

export type HighlightKind =
  | "comment"
  | "keyword"
  /** Jméno funkce, za kterým následuje závorka: `pinMode(`. */
  | "call"
  | "number"
  | "string"
  | "text";

export interface HighlightToken {
  kind: HighlightKind;
  value: string;
}

const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_]/;

export function highlight(source: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let plain = "";

  /* Obyčejný text se sbírá do jednoho tokenu, dokud nepřijde něco
     barevného. Jeden `<span>` na znak by z třiceti řádků kódu udělal
     tisíce uzlů a editor by při psaní znatelně zadrhával. */
  const flush = () => {
    if (plain === "") return;
    tokens.push({ kind: "text", value: plain });
    plain = "";
  };

  const push = (kind: HighlightKind, value: string) => {
    flush();
    tokens.push({ kind, value });
  };

  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];

    /* Řádkový komentář — jde až na konec řádku, konec souboru včetně. */
    if (ch === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      const stop = end === -1 ? source.length : end;
      push("comment", source.slice(i, stop));
      i = stop;
      continue;
    }

    /* Blokový komentář. Nezavřený obarví zbytek souboru — a je to tak
       správně: přesně to s kódem udělá i překladač. */
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      push("comment", source.slice(i, stop));
      i = stop;
      continue;
    }

    /* Řetězec i znak v apostrofech. Nedokončený se utne na konci řádku,
       ne na konci souboru — jinak by po napsání jedné uvozovky zčervenal
       celý zbytek programu. */
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < source.length && source[j] !== ch && source[j] !== "\n") {
        j += source[j] === "\\" ? 2 : 1;
      }
      const closed = source[j] === ch;
      const stop = Math.min(closed ? j + 1 : j, source.length);
      push("string", source.slice(i, stop));
      i = stop;
      continue;
    }

    /* Čísla */
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < source.length && /[0-9.]/.test(source[j]!)) j += 1;
      push("number", source.slice(i, j));
      i = j;
      continue;
    }

    /* Jména: klíčové slovo, volání funkce, nebo obyčejná proměnná. */
    if (IDENT_START.test(ch)) {
      let j = i;
      while (j < source.length && IDENT_PART.test(source[j]!)) j += 1;
      const word = source.slice(i, j);

      if (KEYWORDS.has(word)) {
        push("keyword", word);
      } else if (nextNonSpaceIs(source, j, "(")) {
        /* `delay (10)` s mezerou je pořád volání. Kdo píše kód poprvé,
           mezery sype všude. */
        push("call", word);
      } else {
        plain += word;
      }
      i = j;
      continue;
    }

    plain += ch;
    i += 1;
  }

  flush();
  return tokens;
}

function nextNonSpaceIs(source: string, from: number, char: string): boolean {
  let i = from;
  while (i < source.length && (source[i] === " " || source[i] === "\t")) i += 1;
  return source[i] === char;
}
