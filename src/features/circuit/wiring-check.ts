import { equivalentPins, getComponentSpec } from "./components";
import { pinKey, resolveNets, type NetMap } from "./nets";
import { findPath } from "./paths";
import type { Circuit, ComponentType } from "./types";

function typeOf(circuit: Circuit, compId: string): ComponentType {
  return circuit.comps.find((c) => c.id === compId)?.type ?? "led-red";
}

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

/**
 * LED v sérii s rezistorem: pin Arduina → rezistor → LED → zem.
 *
 * Rezistor smí být na KTERÉKOLIV straně LED — mezi pinem a anodou, nebo mezi
 * katodou a zemí. Elektricky je to totéž a dítě si smí vybrat. Zadání proto
 * neříká „přes rezistor do anody", ale „v řadě je jeden rezistor". Kontrola
 * vyzkouší obě varianty a vezme tu, která sedí (viz `seriesConnections`).
 */
export interface SeriesSpec {
  /** Pin Arduina, odkud proud přichází. */
  from: { role: string; pin: string };
  /** Pin, kam proud odchází (typicky GND). */
  to: { role: string; pin: string };
  /** Součástka v řadě — LED — a její dvě nožičky. */
  led: { role: string; anode: string; cathode: string };
  /** Typ ochranného rezistoru. */
  resistor: ComponentType;
  /** Co dítě uvidí, když řada neplatí. Věta, ne kód. */
  hint: string;
}

export interface WiringSpec {
  parts: PartSpec[];
  connections: ConnectionSpec[];
  /** Řady LED s rezistorem, viz `SeriesSpec`. Volitelné. */
  series?: SeriesSpec[];
}

/** Která strana LED nese rezistor. */
export type SeriesSide = "anode" | "cathode";

/**
 * Dvě varianty jedné řady jako obyčejné spoje.
 *
 * Rezistor na straně anody: pin → R → anoda, katoda → zem.
 * Rezistor na straně katody: pin → anoda, katoda → R → zem.
 * Kontrola a kroky průvodce pak pracují se stejnými typy spojů jako dřív.
 */
export function seriesConnections(s: SeriesSpec, side: SeriesSide): ConnectionSpec[] {
  const anode = { role: s.led.role, pin: s.led.anode };
  const cathode = { role: s.led.role, pin: s.led.cathode };

  if (side === "anode") {
    return [
      { from: s.from, to: anode, through: [s.resistor], hint: s.hint },
      { from: cathode, to: s.to, hint: s.hint },
    ];
  }
  return [
    { from: s.from, to: anode, hint: s.hint },
    { from: cathode, to: s.to, through: [s.resistor], hint: s.hint },
  ];
}

/** Spoje zadání bez volby strany: řady jsou v základu na straně anody. */
export function defaultConnections(spec: WiringSpec): ConnectionSpec[] {
  return [
    ...spec.connections,
    ...(spec.series ?? []).flatMap((s) => seriesConnections(s, "anode")),
  ];
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
  /**
   * Která součástka v obvodu hraje kterou roli — z toho přiřazení, které
   * dopadlo nejlíp.
   *
   * Potřebují to kontroly chování. „Bliká červená?" se nedá ptát podle
   * pořadí LED v obvodu: to je pořadí, v jakém je dítě položilo. Musí se
   * ptát na tu LED, která hraje roli „cervena", a to ví jedině tohle.
   */
  roles: Record<string, string> | null;
  /**
   * Spoje, proti kterým se kontrolovalo — řady rozbalené do zvolené strany.
   * Průvodce podle nich kreslí kroky, takže ukazuje tu variantu, kterou dítě
   * skutečně staví.
   */
  connections: ConnectionSpec[];
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

/** Jeden spoj proti přiřazení rolí. Null = sedí. */
function connectionIssue(
  circuit: Circuit,
  conn: ConnectionSpec,
  roles: Map<string, string>,
  nets: NetMap,
): WiringIssue | null {
  const fromId = roles.get(conn.from.role);
  const toId = roles.get(conn.to.role);
  if (!fromId || !toId) return null;

  /* Tlačítko: kterákoli nožička téže strany je pro spoj stejná (strany
     jsou uvnitř spojené). Zkouší se všechny kombinace a první, která
     sedí, rozhoduje. */
  const fromPins = equivalentPins(typeOf(circuit, fromId), conn.from.pin);
  const toPins = equivalentPins(typeOf(circuit, toId), conn.to.pin);
  let result: ReturnType<typeof findPath> = { found: false, through: [], componentIds: [] };
  search: for (const fp of fromPins) {
    for (const tp of toPins) {
      const r = findPath(circuit, pinKey(fromId, fp), pinKey(toId, tp), {
        through: conn.through,
        maxHops: conn.through?.length ?? 0,
        nets,
      });
      if (r.found) {
        result = r;
        break search;
      }
    }
  }

  if (!result.found) {
    return {
      hint: conn.hint,
      roles: [conn.from.role, conn.to.role],
      kind: "missing-connection",
    };
  }

  /* Spoj existuje, ale bez požadované součástky — typicky LED bez
     rezistoru. To je jiná chyba než „nic tam není" a zaslouží si
     vlastní hlášku. */
  if (conn.through?.length) {
    const missing = conn.through.filter((t) => !result.through.includes(t));
    if (missing.length > 0) {
      return {
        hint: conn.hint,
        roles: [conn.from.role, conn.to.role],
        kind: "missing-component-on-path",
      };
    }
  }

  return null;
}

/**
 * Spoje zadání rozbalené pro dané přiřazení rolí.
 *
 * Strana řady se volí podle toho, kde dítě rezistor už má: stojí-li některý
 * rezistor v síti anody, počítá se anoda, stojí-li v síti katody, katoda.
 * Tak se nejen uznají obě správné varianty, ale i zkrat přes rezistor
 * (oba drátky na téže nožičce) se nepřepne na jinou stranu, kde by průvodce
 * mlčel. Když rezistor nestojí nikde, zkusí se obě strany a vyhraje ta, která
 * sedí víc; při shodě zůstane anoda — tu návody kreslí nejčastěji.
 */
function resolveConnections(
  circuit: Circuit,
  spec: WiringSpec,
  roles: Map<string, string>,
  nets: NetMap,
): ConnectionSpec[] {
  const out: ConnectionSpec[] = [...spec.connections];

  for (const s of spec.series ?? []) {
    const anodeConns = seriesConnections(s, "anode");
    const cathodeConns = seriesConnections(s, "cathode");
    const ledId = roles.get(s.led.role);

    const touching = (pin: string): number => {
      if (!ledId) return 0;
      const net = nets.netOf(pinKey(ledId, pin));
      return circuit.comps.filter(
        (c) =>
          c.type === s.resistor &&
          getComponentSpec(c.type).pins.some((p) => nets.netOf(pinKey(c.id, p.name)) === net),
      ).length;
    };
    const anodeTouch = touching(s.led.anode);
    const cathodeTouch = touching(s.led.cathode);

    if (cathodeTouch > anodeTouch) {
      out.push(...cathodeConns);
      continue;
    }
    if (anodeTouch > cathodeTouch) {
      out.push(...anodeConns);
      continue;
    }

    const score = (conns: ConnectionSpec[]) =>
      conns.filter((c) => connectionIssue(circuit, c, roles, nets) === null).length;
    out.push(...(score(cathodeConns) > score(anodeConns) ? cathodeConns : anodeConns));
  }

  return out;
}

function checkAssignment(
  circuit: Circuit,
  connections: ConnectionSpec[],
  roles: Map<string, string>,
  nets: NetMap,
): WiringIssue[] {
  const issues: WiringIssue[] = [];
  for (const conn of connections) {
    const issue = connectionIssue(circuit, conn, roles, nets);
    if (issue) issues.push(issue);
  }
  return issues;
}

export function checkWiring(circuit: Circuit, spec: WiringSpec): WiringResult {
  const total = spec.connections.length + 2 * (spec.series?.length ?? 0);

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
    return {
      ok: false,
      issues,
      satisfied: 0,
      total,
      roles: null,
      connections: defaultConnections(spec),
    };
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
      roles: null,
      connections: defaultConnections(spec),
    };
  }

  /* Vybírá se to přiřazení rolí, které dopadlo nejlíp. Dítě má dostat
     hlášku k tomu, co mu opravdu chybí, ne k náhodné permutaci. */
  /* Sítě se spočítají jednou pro všechny permutace. Rozklad na obvodu
     nezávisí na tom, které součástce zrovna říkáme „ta výstupní". */
  const nets = resolveNets(circuit);

  let best: { issues: WiringIssue[]; roles: Map<string, string>; connections: ConnectionSpec[] } | null = null;

  for (const roles of assignments) {
    const connections = resolveConnections(circuit, spec, roles, nets);
    const issues = checkAssignment(circuit, connections, roles, nets);

    if (issues.length === 0) {
      return {
        ok: true,
        issues: [],
        satisfied: total,
        total,
        roles: Object.fromEntries(roles),
        connections,
      };
    }

    if (best === null || issues.length < best.issues.length) {
      best = { issues, roles, connections };
    }
  }

  const issues = best?.issues ?? [];
  return {
    ok: false,
    issues,
    satisfied: total - issues.length,
    total,
    /* I nedokončené zapojení má nejlepší odhad, kdo je kdo. Kontrole
       chování to stačí — a dítě díky tomu vidí zvýrazněnou tu součástku,
       o které je řeč. */
    roles: best ? Object.fromEntries(best.roles) : null,
    connections: best?.connections ?? defaultConnections(spec),
  };
}
