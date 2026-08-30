import { highlight } from "./highlight";
import { compile } from "./interpreter";

/**
 * Proč program mlčí.
 *
 * ── Kdy se na to ptát ──────────────────────────────────────────────────────
 * Jen u programu, který NEUDĚLAL VŮBEC NIC — tedy když neprošla ani jedna
 * kontrola. Tahle funkce sama neví, co program napáchal; hledá v kódu jen
 * nejpravděpodobnější důvod ticha. U programu, kterému něco funguje, by
 * ukazovala na komentář, co si dítě schovalo stranou schválně.
 *
 * ── Proč to vůbec je ───────────────────────────────────────────────────────
 * Doteď byly jen dva stavy: chyba překladu (ukáže na řádek) a nesplněná
 * kontrola (dá nápovědu). Zakomentovaný program se přeloží čistě, takže
 * spadl do té druhé škatulky — a nápověda dítěti diktovala napsat přesně
 * tu větu, kterou mělo zakomentovanou na obrazovce před sebou. Rada, kterou
 * jsi právě splnil, je horší než žádná: bere chuť hledat dál.
 */

export interface SilentReason {
  /** Řádek se zakomentovaným příkazem, když nějaký je. Číslováno od jedné. */
  line: number | null;
  message: string;
}

/**
 * Něco, co v komentáři vypadá jako příkaz: volání se závorkou a za ním
 * na témže řádku středník.
 *
 * Obojí je potřeba. Samotné jméno nestačí — startovní kód má v komentáři
 * větu „Tvar příkazu najdeš v taháku u „pinMode"". A samotná závorka taky
 * ne: lekce o tlačítku má v zadání „1) přečti tlačítko: digitalRead(tlacitko)".
 * Teprve středník znamená DOKONČENÝ příkaz, tedy kód, který někdo napsal
 * a pak schoval.
 */
const LOOKS_LIKE_STATEMENT = /[A-Za-z_][A-Za-z0-9_]*\s*\([^\n]*;/;

/**
 * @param starterCode Kód, se kterým lekce začíná. Komentáře, které v něm
 *   stály od začátku, jsou zadání — ne kód, který si dítě schovalo. Bez
 *   tohohle by lekce o tlačítku ukazovala na vlastní zadání.
 */
export function silentProgramReason(source: string, starterCode = ""): SilentReason | null {
  const compiled = compile(source);
  /* Nepřeložitelný kód má vlastní hlášku s řádkem. Dvě hlášky naráz jsou
     pro dítě totéž jako žádná. */
  if (!compiled.ok || !compiled.program) return null;

  const line = firstHiddenCommand(source, comments(starterCode));
  if (line !== null) {
    return {
      line,
      message:
        `Na řádku ${line} máš příkaz schovaný za //. Co je za dvěma lomítky, ` +
        "Arduino nečte — je to poznámka pro lidi. Smaž ta dvě lomítka a spusť to znovu.",
    };
  }

  const statements = compiled.program.functions.reduce(
    (sum, fn) => sum + fn.body.body.length,
    0,
  );
  if (statements > 0) return null;

  return {
    line: null,
    message:
      "Do setup() ani do loop() jsi zatím nenapsal jediný příkaz, " +
      "takže program po spuštění jen mlčí.",
  };
}

/** Řádek prvního komentáře, ve kterém se schovává příkaz. */
function firstHiddenCommand(source: string, fromStarter: Set<string>): number | null {
  let line = 1;

  for (const token of highlight(source)) {
    if (
      token.kind === "comment" &&
      LOOKS_LIKE_STATEMENT.test(token.value) &&
      !fromStarter.has(token.value.trim())
    ) {
      return line;
    }
    /* Řádky se počítají průběžně: token může být víceřádkový (blokový
       komentář) a číslo řádku musí sedět na jeho ZAČÁTEK. */
    for (const ch of token.value) if (ch === "\n") line += 1;
  }

  return null;
}

/** Komentáře v kódu, znění po znění. */
function comments(source: string): Set<string> {
  return new Set(
    highlight(source)
      .filter((t) => t.kind === "comment")
      .map((t) => t.value.trim()),
  );
}
