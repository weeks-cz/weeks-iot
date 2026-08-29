/**
 * Strom podmnožiny Arduino C++.
 *
 * Držené záměrně minimální — jen uzly, které sedm lekcí prvního kurzu
 * potřebuje. Každý nese `line`, aby chybová hláška uměla ukázat na řádek;
 * bez toho je „něco je špatně" pro dvanáctileté dítě k ničemu.
 */

export interface Node {
  line: number;
}

/* ── Výrazy ─────────────────────────────────────────────────────────────── */

export type Expr =
  | NumberLit
  | StringLit
  | BoolLit
  | Identifier
  | Unary
  | Binary
  | Assign
  | Call
  | Member
  | Update;

export interface NumberLit extends Node {
  kind: "number";
  value: number;
}

export interface StringLit extends Node {
  kind: "string";
  value: string;
}

export interface BoolLit extends Node {
  kind: "bool";
  value: boolean;
}

export interface Identifier extends Node {
  kind: "identifier";
  name: string;
}

export interface Unary extends Node {
  kind: "unary";
  op: string;
  operand: Expr;
}

export interface Binary extends Node {
  kind: "binary";
  op: string;
  left: Expr;
  right: Expr;
}

export interface Assign extends Node {
  kind: "assign";
  op: string;
  target: Identifier;
  value: Expr;
}

/** `i++` a `++i`. Rozlišené, protože se liší vrácenou hodnotou. */
export interface Update extends Node {
  kind: "update";
  op: "++" | "--";
  prefix: boolean;
  target: Identifier;
}

export interface Call extends Node {
  kind: "call";
  callee: Identifier | Member;
  args: Expr[];
}

/** `Serial.println` — jediné, k čemu je tečka v téhle podmnožině potřeba. */
export interface Member extends Node {
  kind: "member";
  object: string;
  property: string;
}

/* ── Příkazy ────────────────────────────────────────────────────────────── */

export type Stmt =
  | VarDecl
  | ExprStmt
  | Block
  | If
  | While
  | DoWhile
  | For
  | Return
  | Break
  | Continue;

export interface VarDecl extends Node {
  kind: "varDecl";
  /** Typ se sice parsuje, ale běh na něm nestojí — čísla jsou čísla. */
  type: string;
  name: string;
  init: Expr | null;
}

export interface ExprStmt extends Node {
  kind: "exprStmt";
  expr: Expr;
}

export interface Block extends Node {
  kind: "block";
  body: Stmt[];
}

export interface If extends Node {
  kind: "if";
  test: Expr;
  then: Stmt;
  otherwise: Stmt | null;
}

export interface While extends Node {
  kind: "while";
  test: Expr;
  body: Stmt;
}

export interface DoWhile extends Node {
  kind: "doWhile";
  test: Expr;
  body: Stmt;
}

export interface For extends Node {
  kind: "for";
  init: Stmt | null;
  test: Expr | null;
  update: Expr | null;
  body: Stmt;
}

export interface Return extends Node {
  kind: "return";
  value: Expr | null;
}

export interface Break extends Node {
  kind: "break";
}

export interface Continue extends Node {
  kind: "continue";
}

/* ── Program ────────────────────────────────────────────────────────────── */

export interface FunctionDecl extends Node {
  kind: "function";
  name: string;
  params: Array<{ type: string; name: string }>;
  body: Block;
}

export interface Program {
  /** Proměnné mimo funkce. */
  globals: VarDecl[];
  functions: FunctionDecl[];
}
