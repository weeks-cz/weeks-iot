import { pinKey, resolveNets, type NetMap } from "./nets";
import { findPath } from "./paths";
import type { Circuit, ComponentType } from "./types";

/**
 * Kontrola zapojení podle zadání lekce.
 *
 * ── Co tím opravujeme ──────────────────────────────────────────────────────
 * Do teď byla jediná kontrola „je obvod prázdný". Krok s drátky byl proto
 * dekorativní — dítě mohlo zapojit cokoli a projít. Audit to vede jako
 * nález: „nesmíme tvrdit, že to systém kontroluje".
 *
 * ── Jak se píše zadání ─────────────────────────────────────────────────────
 * Lekce popisuje ROLE, ne konkrétní součástky. „led-vystup" je LED, kterou
 * má řídit program; kterou z palety dítě vezme a kam ji položí, je jeho věc.
 * Kontrola pak ověřuje spoje mezi rolemi, ne polohy na mřížce.
 *
 * ── Proč hlášky nejsou „špatně" ────────────────────────────────────────────
 * Existující kontrola kódu už tenhle tón má: ne „špatně", ale „Chybí blok,
 * který nastaví tlačítko jako vstup." Kontrola zapojení mluví stejně —
 * řekne, co chybí, ne že se to nepovedlo.
 */

/** Role součástky v zadání lekce. */
export interface PartSpec {
  role: string;
  type: ComponentType;
  /** Jak se o ní mluví v hláškách: „červená LED", „tlačítko". */
  label: string;
}

export interface ConnectionSpec {
  from: { role: string; pin: string };
  to: { role: string; pin: string };
  /** Cesta musí vést přes tyhle součástky. Prázdné = přímé spojení. */
  through?: ComponentType[];
  /** Co dítě uvidí, když spoj chybí. Věta, ne kód. */
  hint: string;
}

export interface WiringSpec {
  parts: PartSpec[];
  connections: ConnectionSpec[];
}

export interface WiringIssue {
  hint: string;
  /** Role, kterých se to týká — builder je může zvýraznit. */
  roles: string[];
  kind: "missing-part" | "missing-connection" | "missing-component-on-path";
}

export interface WiringResult {
  ok: boolean;
  issues: WiringIssue[];
  /** Kolik spojů ze zadání sedí. Pro ukazatel postupu v kroku. */
  satisfied: number;
  total: number;
}

/**
 * Přiřazení rolí ke skutečným součástkám v obvodu.
 *
 * Když je v obvodu víc LED, zkusí se všechna rozumná přiřazení, dokud
 * jedno nesedí. Dítě nemá vědět, že „ta první LED je ta výstupní" —
 * má je zapojit tak, aby obvod fungoval, a kontrola si pořadí dohledá.
 */
function assignRoles(circuit: Circuit, parts: PartSpec[]): Map<string, string>[] {
  const byType = new Map<ComponentType, string[]>();
  for (const c of circuit.comps) {
    const list = byType.get(c.type) ?? [];
    list.push(c.id);
    byType.set(c.type, list);
  }

  let assignments: Map<string, string>[] = [new Map()];

  for (const part of parts) {
    const candidates = byType.get(part.type) ?? [];
    const next: Map<string, string>[] = [];

    for (const assignment of assignments) {
      const taken = new Set(assignment.values());
      for (const id of candidates) {
        if (taken.has(id)) continue;
        const copy = new Map(assignment);
        copy.set(part.role, id);
        next.push(copy);
      }
    }

    if (next.length === 0) return [];
    /* Strop proti kombinatorickému výbuchu u obvodu s mnoha stejnými
       součástkami. Sto variant bohatě stačí na lekci se sedmi díly. */
    assignments = next.slice(0, 100);
  }

  return assignments;
}

function checkAssignment(
  circuit: Circuit,
  spec: WiringSpec,
  roles: Map<string, string>,
  nets: NetMap,
): WiringIssue[] {
  const issues: WiringIssue[] = [];

  for (const conn of spec.connections) {
    const fromId = roles.get(conn.from.role);
    const toId = roles.get(conn.to.role);
    if (!fromId || !toId) continue;

    const result = findPath(
      circuit,
      pinKey(fromId, conn.from.pin),
      pinKey(toId, conn.to.pin),
      { through: conn.through, maxHops: (conn.through?.length ?? 0) + 1, nets },
    );

    if (!result.found) {
      issues.push({
        hint: conn.hint,
        roles: [conn.from.role, conn.to.role],
        kind: "missing-connection",
      });
      continue;
    }

    /* Spoj existuje, ale bez požadované součástky — typicky LED bez
       rezistoru. To je jiná chyba než „nic tam není" a zaslouží si
       vlastní hlášku. */
    if (conn.through?.length) {
      const missing = conn.through.filter((t) => !result.through.includes(t));
      if (missing.length > 0) {
        issues.push({
          hint: conn.hint,
          roles: [conn.from.role, conn.to.role],
          kind: "missing-component-on-path",
        });
      }
    }
  }

  return issues;
}

export function checkWiring(circuit: Circuit, spec: WiringSpec): WiringResult {
  const total = spec.connections.length;

  /* Nejdřív součástky. Chybějící díl je jiná zpráva než chybějící drátek
     a dítě má nejdřív slyšet, že mu něco chybí na desce. */
  const present = new Set(circuit.comps.map((c) => c.type));
  const missingParts = spec.parts.filter((p) => !present.has(p.type));

  if (missingParts.length > 0) {
    /* Duplicitní typy hlásíme jednou — „chybí LED" stačí říct jedenkrát,
       i když jich zadání chce tři. */
    const seen = new Set<ComponentType>();
    const issues: WiringIssue[] = [];
    for (const part of missingParts) {
      if (seen.has(part.type)) continue;
      seen.add(part.type);
      issues.push({
        hint: `Na desce chybí ${part.label}. Přetáhni ji z palety vlevo.`,
        roles: [part.role],
        kind: "missing-part",
      });
    }
    return { ok: false, issues, satisfied: 0, total };
  }

  const assignments = assignRoles(circuit, spec.parts);
  if (assignments.length === 0) {
    return {
      ok: false,
      issues: [
        {
          hint: "Na desce nejsou všechny součástky, které zadání potřebuje.",
          roles: spec.parts.map((p) => p.role),
          kind: "missing-part",
        },
      ],
      satisfied: 0,
      total,
    };
  }

  /* Vybírá se to přiřazení rolí, které dopadlo nejlíp. Dítě má dostat
     hlášku k tomu, co mu opravdu chybí, ne k náhodné permutaci. */
  /* Sítě se spočítají jednou pro všechny permutace. Rozklad na obvodu
     nezávisí na tom, které součástce zrovna říkáme „ta výstupní". */
  const nets = resolveNets(circuit);

  let best: WiringIssue[] | null = null;
  for (const roles of assignments) {
    const issues = checkAssignment(circuit, spec, roles, nets);
    if (issues.length === 0) return { ok: true, issues: [], satisfied: total, total };
    if (best === null || issues.length < best.length) best = issues;
  }

  const issues = best ?? [];
  return { ok: false, issues, satisfied: total - issues.length, total };
}
