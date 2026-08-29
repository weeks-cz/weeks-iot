import type { Block, Expr, FunctionDecl, Program, Stmt } from "./ast";
import { HIGH, LOW, resolvePinNumber, type Board } from "./board";
import { parse } from "./parser";
import { LexError } from "./lexer";
import { ParseError } from "./parser";

/**
 * Interpret podmnožiny Arduino C++.
 *
 * ── Proč interpret, a ne přehrání očekávaného výsledku ─────────────────────
 * Kdyby lekce jen přehrála připravenou animaci, dítě, které napsalo
 * fungující kód jinak, než jsme čekali, by neuvidělo nic. A dítě, které
 * napsalo nefungující kód procházející našimi vzory, by vidělo úspěch.
 * Obojí učí špatně. Když kód doopravdy běží, platí jediné pravidlo:
 * co jsi napsal, to se stane.
 *
 * ── Proti čemu se to musí bránit ───────────────────────────────────────────
 * `while (true) {}` bez `delay` je v Arduinu normální a v prohlížeči by
 * zamrzl tab. Proto rozpočet kroků a virtuální čas: `delay` neusíná,
 * jen posouvá hodiny. Deset sekund běhu se spočítá okamžitě.
 */

export class RuntimeError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
    this.name = "RuntimeError";
  }
}

/** Řízení toku — vyhazuje se, nechytá se ven z běhu. */
class BreakSignal {}
class ContinueSignal {}
class ReturnSignal {
  constructor(readonly value: unknown) {}
}

type Value = number | string | boolean;

class Scope {
  private vars = new Map<string, Value>();

  constructor(private readonly parent: Scope | null = null) {}

  get(name: string): Value | undefined {
    const own = this.vars.get(name);
    if (own !== undefined) return own;
    return this.parent?.get(name);
  }

  has(name: string): boolean {
    return this.vars.has(name) || (this.parent?.has(name) ?? false);
  }

  declare(name: string, value: Value): void {
    this.vars.set(name, value);
  }

  /** Přiřazení míří do scope, kde proměnná vznikla. */
  set(name: string, value: Value): boolean {
    if (this.vars.has(name)) {
      this.vars.set(name, value);
      return true;
    }
    return this.parent?.set(name, value) ?? false;
  }
}

/** Konstanty, které Arduino definuje samo. */
const BUILTIN_CONSTANTS: Record<string, Value> = {
  HIGH,
  LOW,
  INPUT: 0,
  OUTPUT: 1,
  INPUT_PULLUP: 2,
  true: true,
  false: false,
  LED_BUILTIN: 13,
  A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19,
};

export interface RunOptions {
  /** Nejvíc průchodů `loop()`. */
  maxIterations?: number;
  /** Strop na počet vyhodnocených uzlů — pojistka proti nekonečné smyčce. */
  maxSteps?: number;
  /** Zastavit po tolika milisekundách virtuálního času. */
  maxVirtualMs?: number;
  /** Volá se po každém průchodu `loop()`. Vrátí false = zastavit. */
  onLoopEnd?: (iteration: number) => boolean | void;
}

export class Interpreter {
  private globals = new Scope();
  private functions = new Map<string, FunctionDecl>();
  private steps = 0;
  private maxSteps = 2_000_000;

  constructor(
    private readonly program: Program,
    private readonly board: Board,
  ) {}

  /** Deklarace globálních proměnných a rejstřík funkcí. */
  private prepare(): void {
    for (const [name, value] of Object.entries(BUILTIN_CONSTANTS)) {
      this.globals.declare(name, value);
    }
    for (const fn of this.program.functions) {
      this.functions.set(fn.name, fn);
    }
    for (const decl of this.program.globals) {
      this.globals.declare(decl.name, decl.init ? this.evaluate(decl.init, this.globals) : 0);
    }
  }

  runSetup(): void {
    this.prepare();
    const setup = this.functions.get("setup");
    if (setup) this.execBlock(setup.body, new Scope(this.globals));
  }

  /** Jeden průchod `loop()`. Vrací false, když `loop()` neexistuje. */
  runLoopOnce(): boolean {
    const loop = this.functions.get("loop");
    if (!loop) return false;
    try {
      this.execBlock(loop.body, new Scope(this.globals));
    } catch (e) {
      if (e instanceof ReturnSignal) return true;
      throw e;
    }
    return true;
  }

  private tick(line: number): void {
    this.steps += 1;
    if (this.steps > this.maxSteps) {
      throw new RuntimeError(
        "Program běží moc dlouho. Nemáš někde smyčku, ze které se nedá dostat ven? " +
          "Do while nebo for patří delay(), aby měl Arduino čas dýchat.",
        line,
      );
    }
  }

  setStepBudget(steps: number): void {
    this.maxSteps = steps;
  }

  /* ── Příkazy ──────────────────────────────────────────────────────────── */

  private execBlock(block: Block, scope: Scope): void {
    const inner = new Scope(scope);
    for (const stmt of block.body) this.exec(stmt, inner);
  }

  private exec(stmt: Stmt, scope: Scope): void {
    this.tick(stmt.line);

    switch (stmt.kind) {
      case "block":
        this.execBlock(stmt, scope);
        return;

      case "varDecl":
        scope.declare(stmt.name, stmt.init ? this.evaluate(stmt.init, scope) : 0);
        return;

      case "exprStmt":
        this.evaluate(stmt.expr, scope);
        return;

      case "if":
        if (truthy(this.evaluate(stmt.test, scope))) this.exec(stmt.then, scope);
        else if (stmt.otherwise) this.exec(stmt.otherwise, scope);
        return;

      case "while":
        while (truthy(this.evaluate(stmt.test, scope))) {
          this.tick(stmt.line);
          try {
            this.exec(stmt.body, scope);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
        return;

      case "doWhile":
        do {
          this.tick(stmt.line);
          try {
            this.exec(stmt.body, scope);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        } while (truthy(this.evaluate(stmt.test, scope)));
        return;

      case "for": {
        /* Vlastní scope, aby `int i` z hlavičky nepřetekl ven. */
        const forScope = new Scope(scope);
        if (stmt.init) this.exec(stmt.init, forScope);

        while (stmt.test === null || truthy(this.evaluate(stmt.test, forScope))) {
          this.tick(stmt.line);
          try {
            this.exec(stmt.body, forScope);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (!(e instanceof ContinueSignal)) throw e;
          }
          if (stmt.update) this.evaluate(stmt.update, forScope);
        }
        return;
      }

      case "return":
        throw new ReturnSignal(stmt.value ? this.evaluate(stmt.value, scope) : 0);

      case "break":
        throw new BreakSignal();

      case "continue":
        throw new ContinueSignal();
    }
  }

  /* ── Výrazy ───────────────────────────────────────────────────────────── */

  private evaluate(expr: Expr, scope: Scope): Value {
    this.tick(expr.line);

    switch (expr.kind) {
      case "number":
        return expr.value;
      case "string":
        return expr.value;
      case "bool":
        return expr.value;

      case "identifier": {
        const value = scope.get(expr.name);
        if (value === undefined) {
          throw new RuntimeError(
            `Proměnnou "${expr.name}" jsem nikde nenašel. Nezapomněl jsi ji nahoře vytvořit? ` +
              `Třeba: int ${expr.name} = 8;`,
            expr.line,
          );
        }
        return value;
      }

      case "unary": {
        const v = this.evaluate(expr.operand, scope);
        if (expr.op === "!") return !truthy(v);
        if (expr.op === "-") return -num(v);
        return num(v);
      }

      case "binary":
        return this.binary(expr.op, expr.left, expr.right, scope, expr.line);

      case "assign": {
        const current = scope.get(expr.target.name);
        const rhs = this.evaluate(expr.value, scope);

        let next: Value;
        if (expr.op === "=") next = rhs;
        else {
          if (current === undefined) {
            throw new RuntimeError(
              `Proměnná "${expr.target.name}" ještě neexistuje, takže do ní nejde takhle přičítat.`,
              expr.line,
            );
          }
          const a = num(current);
          const b = num(rhs);
          next =
            expr.op === "+=" ? a + b
            : expr.op === "-=" ? a - b
            : expr.op === "*=" ? a * b
            : expr.op === "/=" ? (b === 0 ? 0 : a / b)
            : a % b;
        }

        if (!scope.set(expr.target.name, next)) scope.declare(expr.target.name, next);
        return next;
      }

      case "update": {
        const current = num(scope.get(expr.target.name) ?? 0);
        const next = expr.op === "++" ? current + 1 : current - 1;
        if (!scope.set(expr.target.name, next)) scope.declare(expr.target.name, next);
        return expr.prefix ? next : current;
      }

      case "member":
        throw new RuntimeError(
          `${expr.object}.${expr.property} se používá jako funkce — chybí za tím závorky.`,
          expr.line,
        );

      case "call":
        return this.call(expr.callee, expr.args, scope, expr.line);
    }
  }

  private binary(op: string, leftExpr: Expr, rightExpr: Expr, scope: Scope, line: number): Value {
    /* && a || musí vyhodnocovat zkráceně — v C++ to tak je a dítě na tom
       staví, když píše `if (a != 0 && 10 / a > 2)`. */
    if (op === "&&") {
      return truthy(this.evaluate(leftExpr, scope)) ? truthy(this.evaluate(rightExpr, scope)) : false;
    }
    if (op === "||") {
      return truthy(this.evaluate(leftExpr, scope)) ? true : truthy(this.evaluate(rightExpr, scope));
    }

    const l = this.evaluate(leftExpr, scope);
    const r = this.evaluate(rightExpr, scope);

    switch (op) {
      case "+":
        if (typeof l === "string" || typeof r === "string") return `${str(l)}${str(r)}`;
        return num(l) + num(r);
      case "-": return num(l) - num(r);
      case "*": return num(l) * num(r);
      case "/":
        if (num(r) === 0) {
          throw new RuntimeError("Dělíš nulou — to Arduino neumí a nikdo jiný taky ne.", line);
        }
        /* Celočíselné dělení, jak to dělá C++ u int. */
        return Number.isInteger(num(l)) && Number.isInteger(num(r))
          ? Math.trunc(num(l) / num(r))
          : num(l) / num(r);
      case "%":
        if (num(r) === 0) throw new RuntimeError("Zbytek po dělení nulou neexistuje.", line);
        return num(l) % num(r);
      case "==": return looseEq(l, r);
      case "!=": return !looseEq(l, r);
      case "<": return num(l) < num(r);
      case ">": return num(l) > num(r);
      case "<=": return num(l) <= num(r);
      case ">=": return num(l) >= num(r);
      default:
        throw new RuntimeError(`Operátor ${op} tady neumím.`, line);
    }
  }

  private call(callee: Expr, args: Expr[], scope: Scope, line: number): Value {
    const values = args.map((a) => this.evaluate(a, scope));

    if (callee.kind === "member") {
      return this.serialCall(callee.object, callee.property, values, line);
    }
    if (callee.kind !== "identifier") {
      throw new RuntimeError("Volat jde jen funkci.", line);
    }

    const name = callee.name;
    const pin = () => {
      const p = resolvePinNumber(values[0]);
      if (p === null) {
        throw new RuntimeError(`Funkce ${name} chce jako první číslo pinu.`, line);
      }
      return p;
    };

    switch (name) {
      case "pinMode": {
        const mode = num(values[1]);
        this.board.pinMode(pin(), mode === 1 ? "output" : mode === 2 ? "input_pullup" : "input");
        return 0;
      }
      case "digitalWrite":
        this.board.digitalWrite(pin(), truthy(values[1]) ? HIGH : LOW);
        return 0;
      case "digitalRead":
        return this.board.digitalRead(pin());
      case "analogWrite":
        this.board.analogWrite(pin(), num(values[1]));
        return 0;
      case "analogRead":
        return this.board.analogRead(pin());
      case "delay":
        this.board.delay(num(values[0]));
        return 0;
      case "delayMicroseconds":
        this.board.delay(num(values[0]) / 1000);
        return 0;
      case "millis":
        return this.board.millis();
      case "tone":
        this.board.tone(pin(), num(values[1]));
        return 0;
      case "noTone":
        this.board.noTone(pin());
        return 0;
      case "map": {
        const [v, inMin, inMax, outMin, outMax] = values.map(num);
        const span = (inMax ?? 0) - (inMin ?? 0);
        if (span === 0) return outMin ?? 0;
        return Math.trunc(
          ((v ?? 0) - (inMin ?? 0)) * ((outMax ?? 0) - (outMin ?? 0)) / span + (outMin ?? 0),
        );
      }
      case "constrain": {
        const [v, lo, hi] = values.map(num);
        return Math.min(Math.max(v ?? 0, lo ?? 0), hi ?? 0);
      }
      case "min": return Math.min(...values.map(num));
      case "max": return Math.max(...values.map(num));
      case "abs": return Math.abs(num(values[0]));
      case "random": {
        const [a, b] = values.map(num);
        /* Pseudonáhoda odvozená od virtuálního času, aby byl běh
           opakovatelný — jinak by se test choval pokaždé jinak. */
        const seed = (this.board.millis() * 9301 + 49297) % 233280;
        const r = seed / 233280;
        if (values.length >= 2) return Math.floor((a ?? 0) + r * ((b ?? 0) - (a ?? 0)));
        return Math.floor(r * (a ?? 1));
      }
    }

    const fn = this.functions.get(name);
    if (!fn) {
      throw new RuntimeError(
        `Funkci "${name}" neznám. Zkontroluj překlep — a jestli sis ji psal sám, ` +
          `musí být napsaná mimo setup() a loop().`,
        line,
      );
    }

    const fnScope = new Scope(this.globals);
    fn.params.forEach((p, i) => fnScope.declare(p.name, values[i] ?? 0));

    try {
      this.execBlock(fn.body, fnScope);
    } catch (e) {
      if (e instanceof ReturnSignal) return (e.value as Value) ?? 0;
      throw e;
    }
    return 0;
  }

  private serialCall(object: string, method: string, values: Value[], line: number): Value {
    if (object !== "Serial") {
      throw new RuntimeError(`${object} tady neznám. Umím jen Serial.`, line);
    }

    switch (method) {
      case "begin":
        this.board.serialBegin(num(values[0]));
        return 0;
      case "print":
        this.board.serialPrint(str(values[0] ?? ""));
        return 0;
      case "println":
        this.board.serialPrintln(str(values[0] ?? ""));
        return 0;
      default:
        throw new RuntimeError(
          `Serial.${method} neumím. Používej Serial.begin, Serial.print nebo Serial.println.`,
          line,
        );
    }
  }
}

/* ── Pomocné převody ────────────────────────────────────────────────────── */

function truthy(v: Value | undefined): boolean {
  if (v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return v.length > 0;
}

function num(v: Value | undefined): number {
  if (v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: Value): string {
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") {
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }
  return v;
}

function looseEq(a: Value, b: Value): boolean {
  if (typeof a === "string" || typeof b === "string") return str(a) === str(b);
  return num(a) === num(b);
}

/* ── Veřejné rozhraní ───────────────────────────────────────────────────── */

export interface CompileResult {
  ok: boolean;
  program?: Program;
  error?: { message: string; line: number };
}

/** Přeloží kód a chyby překlopí do tvaru, který jde ukázat dítěti. */
export function compile(source: string): CompileResult {
  try {
    return { ok: true, program: parse(source) };
  } catch (e) {
    if (e instanceof ParseError || e instanceof LexError) {
      return { ok: false, error: { message: e.message, line: e.line } };
    }
    return {
      ok: false,
      error: { message: "Kódu nerozumím. Zkontroluj závorky a středníky.", line: 1 },
    };
  }
}
