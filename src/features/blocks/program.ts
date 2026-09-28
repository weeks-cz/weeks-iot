/**
 * Blokové programy — tvar, stavebnice a překlad do Arduino C.
 *
 * ── Proč tu není Blockly ───────────────────────────────────────────────────
 * Blockly je jen editor. Program, který dítě poskládá, je JSON, jaký
 * Blockly ukládá (`serialization.workspaces.save`), a z něj se tady
 * vyrábí obyčejný Arduino kód. Ten pak jde do STEJNÉ kontroly chování
 * jako kód psaný rukou — bloky nemají vlastní kontrolu, vlastní simulátor
 * ani vlastní pravdu.
 *
 * Díky tomu je překlad čistá funkce: dá se otestovat v Node bez
 * prohlížeče a test lekcí může pustit i řešení poskládané z bloků.
 *
 * ── Proč žádné proměnné ────────────────────────────────────────────────────
 * Děti, pro které bloky jsou, píšou názvy s překlepy a s háčky. Každá
 * taková proměnná by skončila chybou překladu, kterou v blocích nemají
 * jak najít. Piny se proto zadávají číslem přímo v bloku, hodnota ze
 * smyčky má vlastní blok („hodnota z opakování") a senzor se čte tam,
 * kde je potřeba.
 */

/* ── Tvar stavu (podmnožina formátu Blockly) ─────────────────────────────── */

export interface BlockState {
  type: BlockType;
  id?: string;
  x?: number;
  y?: number;
  deletable?: boolean;
  fields?: Record<string, string | number>;
  inputs?: Record<string, { block?: BlockState; shadow?: BlockState }>;
  next?: { block?: BlockState };
}

export interface WorkspaceState {
  blocks?: { languageVersion: 0; blocks: BlockState[] };
}

export const BLOCK_TYPES = [
  "arduino_program",
  "pin_mode",
  "digital_write",
  "delay_ms",
  "analog_write",
  "tone_play",
  "tone_stop",
  "serial_begin",
  "serial_println",
  "if_else",
  "if_only",
  "repeat_range",
  "number",
  "level",
  "digital_read",
  "analog_read",
  "compare",
  "loop_value",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

/* ── Stavebnice pro psaní lekcí ──────────────────────────────────────────── */

type Value = BlockState;
type Statement = BlockState;

/** Pospojuje příkazy pod sebe (`next`). */
function stack(statements: Statement[]): { block: BlockState } | undefined {
  const [first, ...rest] = statements;
  if (!first) return undefined;
  const head: BlockState = { ...first };
  const tail = stack(rest);
  if (tail) head.next = tail;
  return { block: head };
}

export function program({
  setup = [],
  loop = [],
}: {
  setup?: Statement[];
  loop?: Statement[];
}): WorkspaceState {
  const inputs: BlockState["inputs"] = {};
  const s = stack(setup);
  const l = stack(loop);
  if (s) inputs.SETUP = s;
  if (l) inputs.LOOP = l;

  return {
    blocks: {
      languageVersion: 0,
      blocks: [
        { type: "arduino_program", x: 24, y: 24, deletable: false, inputs },
      ],
    },
  };
}

export const pinMode = (pin: number, mode: "OUTPUT" | "INPUT_PULLUP"): Statement => ({
  type: "pin_mode",
  fields: { PIN: pin, MODE: mode },
});

export const digitalWrite = (pin: number, level: "HIGH" | "LOW"): Statement => ({
  type: "digital_write",
  fields: { PIN: pin, LEVEL: level },
});

export const wait = (ms: number): Statement => ({ type: "delay_ms", fields: { MS: ms } });

export const analogWrite = (pin: number, value: Value): Statement => ({
  type: "analog_write",
  fields: { PIN: pin },
  inputs: { VALUE: { block: value } },
});

export const tone = (pin: number, hz: number): Statement => ({
  type: "tone_play",
  fields: { PIN: pin, HZ: hz },
});

export const noTone = (pin: number): Statement => ({ type: "tone_stop", fields: { PIN: pin } });

export const serialBegin = (): Statement => ({ type: "serial_begin" });

export const serialPrintln = (value: Value): Statement => ({
  type: "serial_println",
  inputs: { VALUE: { block: value } },
});

export const ifElse = (cond: Value, then: Statement[], otherwise: Statement[]): Statement => {
  const inputs: BlockState["inputs"] = { COND: { block: cond } };
  const t = stack(then);
  const e = stack(otherwise);
  if (t) inputs.DO = t;
  if (e) inputs.ELSE = e;
  return { type: "if_else", inputs };
};

export const ifOnly = (cond: Value, then: Statement[]): Statement => {
  const inputs: BlockState["inputs"] = { COND: { block: cond } };
  const t = stack(then);
  if (t) inputs.DO = t;
  return { type: "if_only", inputs };
};

export const repeat = (
  from: number,
  to: number,
  body: Statement[],
): Statement => {
  const inputs: BlockState["inputs"] = {};
  const b = stack(body);
  if (b) inputs.DO = b;
  return {
    type: "repeat_range",
    fields: { FROM: from, TO: to, DIR: to >= from ? "UP" : "DOWN" },
    inputs,
  };
};

export const num = (value: number): Value => ({ type: "number", fields: { NUM: value } });
export const level = (value: "HIGH" | "LOW"): Value => ({ type: "level", fields: { LEVEL: value } });
export const digitalRead = (pin: number): Value => ({ type: "digital_read", fields: { PIN: pin } });
export const analogRead = (pin: "A0" | "A1" | "A2" | "A3" | "A4" | "A5"): Value => ({
  type: "analog_read",
  fields: { PIN: pin },
});
export const loopValue = (): Value => ({ type: "loop_value" });

const OPS = { "==": "EQ", "!=": "NEQ", "<": "LT", "<=": "LTE", ">": "GT", ">=": "GTE" } as const;

export const compare = (a: Value, op: keyof typeof OPS, b: Value): Value => ({
  type: "compare",
  fields: { OP: OPS[op] },
  inputs: { A: { block: a }, B: { block: b } },
});

/* ── Překlad do Arduino C ────────────────────────────────────────────────── */

export interface Generated {
  code: string;
  /** Bloky položené na ploše, ale nepřipojené k programu. Nic nedělají. */
  loose: number;
}

const OP_SYMBOL: Record<string, string> = {
  EQ: "==",
  NEQ: "!=",
  LT: "<",
  LTE: "<=",
  GT: ">",
  GTE: ">=",
};

/** Proměnné smyček podle hloubky vnoření. */
const LOOP_VARS = ["i", "j", "k", "m", "n"];

const INDENT = "  ";

function field(block: BlockState, name: string, fallback: string | number): string {
  const value = block.fields?.[name];
  return String(value ?? fallback);
}

/** Číslo z pole bloku. Blockly ho může vrátit jako řetězec. */
function numField(block: BlockState, name: string, fallback: number): string {
  const n = Number(block.fields?.[name]);
  return String(Number.isFinite(n) ? n : fallback);
}

/* Piny se berou jen jako celé nezáporné číslo, cokoli jiného by skončilo
   chybou překladu, kterou dítě v blocích nenajde. */
function pinField(block: BlockState): string {
  const n = Math.trunc(Number(block.fields?.PIN));
  return String(Number.isFinite(n) && n >= 0 ? n : 0);
}

const ANALOG_PINS = new Set(["A0", "A1", "A2", "A3", "A4", "A5"]);

function inputBlock(block: BlockState, name: string): BlockState | undefined {
  const input = block.inputs?.[name];
  return input?.block ?? input?.shadow;
}

function value(block: BlockState | undefined, loops: string[]): string {
  if (!block) return "0";

  switch (block.type) {
    case "number":
      return numField(block, "NUM", 0);
    case "level":
      return field(block, "LEVEL", "LOW") === "HIGH" ? "HIGH" : "LOW";
    case "digital_read":
      return `digitalRead(${pinField(block)})`;
    case "analog_read": {
      const pin = field(block, "PIN", "A0");
      return `analogRead(${ANALOG_PINS.has(pin) ? pin : "A0"})`;
    }
    case "compare": {
      const op = OP_SYMBOL[field(block, "OP", "EQ")] ?? "==";
      return `${value(inputBlock(block, "A"), loops)} ${op} ${value(inputBlock(block, "B"), loops)}`;
    }
    case "loop_value":
      /* Mimo opakování žádná hodnota není. Nula je nejmenší překvapení. */
      return loops.at(-1) ?? "0";
    default:
      return "0";
  }
}

function statements(first: BlockState | undefined, depth: number, loops: string[]): string[] {
  const lines: string[] = [];
  const pad = INDENT.repeat(depth);

  for (let block = first; block; block = block.next?.block) {
    switch (block.type) {
      case "pin_mode":
        lines.push(
          `${pad}pinMode(${pinField(block)}, ${field(block, "MODE", "OUTPUT") === "INPUT_PULLUP" ? "INPUT_PULLUP" : "OUTPUT"});`,
        );
        break;
      case "digital_write":
        lines.push(
          `${pad}digitalWrite(${pinField(block)}, ${field(block, "LEVEL", "LOW") === "HIGH" ? "HIGH" : "LOW"});`,
        );
        break;
      case "delay_ms":
        lines.push(`${pad}delay(${numField(block, "MS", 0)});`);
        break;
      case "analog_write":
        lines.push(`${pad}analogWrite(${pinField(block)}, ${value(inputBlock(block, "VALUE"), loops)});`);
        break;
      case "tone_play":
        lines.push(`${pad}tone(${pinField(block)}, ${numField(block, "HZ", 440)});`);
        break;
      case "tone_stop":
        lines.push(`${pad}noTone(${pinField(block)});`);
        break;
      case "serial_begin":
        lines.push(`${pad}Serial.begin(9600);`);
        break;
      case "serial_println":
        lines.push(`${pad}Serial.println(${value(inputBlock(block, "VALUE"), loops)});`);
        break;
      case "if_only":
      case "if_else": {
        const cond = inputBlock(block, "COND");
        lines.push(`${pad}if (${cond ? value(cond, loops) : "false"}) {`);
        lines.push(...statements(block.inputs?.DO?.block, depth + 1, loops));
        if (block.type === "if_else") {
          lines.push(`${pad}} else {`);
          lines.push(...statements(block.inputs?.ELSE?.block, depth + 1, loops));
        }
        lines.push(`${pad}}`);
        break;
      }
      case "repeat_range": {
        const v = LOOP_VARS[loops.length] ?? `v${loops.length}`;
        const from = numField(block, "FROM", 0);
        const to = numField(block, "TO", 0);
        const down = field(block, "DIR", "UP") === "DOWN";
        lines.push(
          `${pad}for (int ${v} = ${from}; ${v} ${down ? ">=" : "<="} ${to}; ${v}${down ? "--" : "++"}) {`,
        );
        lines.push(...statements(block.inputs?.DO?.block, depth + 1, [...loops, v]));
        lines.push(`${pad}}`);
        break;
      }
      default:
        /* Hodnotový blok samostatně nic nedělá. */
        break;
    }
  }

  return lines;
}

export function blocksToArduino(state: WorkspaceState | null | undefined): Generated {
  const top = state?.blocks?.blocks ?? [];
  const main = top.find((b) => b.type === "arduino_program");
  const loose = top.filter((b) => b !== main).length;

  const setup = main ? statements(main.inputs?.SETUP?.block, 1, []) : [];
  const loop = main ? statements(main.inputs?.LOOP?.block, 1, []) : [];

  const code = [
    "void setup() {",
    ...setup,
    "}",
    "",
    "void loop() {",
    ...loop,
    "}",
    "",
  ].join("\n");

  return { code, loose };
}

/* ── Paleta lekce ───────────────────────────────────────────────────────── */

/**
 * Bloky, které lekce nabídne.
 *
 * Odvozuje se ze vzorového řešení, ne z ručního seznamu: nabídka pak
 * nemůže chybět ani přebývat. Každý druh bloku jednou, s poli z prvního
 * výskytu (piny, čísla lekce) a bez obsahu — příkazy uvnitř a hodnoty
 * v okénkách si dítě poskládá samo. Čísla a HIGH/LOW v okénkách zůstanou
 * jako „stín", tedy předvyplněná hodnota, kterou jde přepsat.
 */
export function paletteFor(solution: WorkspaceState): BlockState[] {
  const seen = new Map<BlockType, BlockState>();

  const visit = (block: BlockState | undefined) => {
    for (let b = block; b; b = b.next?.block) {
      if (b.type !== "arduino_program" && !seen.has(b.type)) seen.set(b.type, template(b));
      for (const input of Object.values(b.inputs ?? {})) visit(input.block ?? input.shadow);
    }
  };
  for (const top of solution.blocks?.blocks ?? []) visit(top);

  return BLOCK_TYPES.filter((t) => seen.has(t)).map((t) => seen.get(t)!);
}

const SHADOWABLE = new Set<BlockType>(["number", "level"]);

function template(block: BlockState): BlockState {
  const out: BlockState = { type: block.type };
  if (block.fields) out.fields = { ...block.fields };

  const inputs: NonNullable<BlockState["inputs"]> = {};
  for (const [name, input] of Object.entries(block.inputs ?? {})) {
    const child = input.block ?? input.shadow;
    if (child && SHADOWABLE.has(child.type)) inputs[name] = { shadow: { ...child } };
  }
  if (Object.keys(inputs).length > 0) out.inputs = inputs;
  return out;
}
