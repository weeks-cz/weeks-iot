import { getComponentSpec, pinLabel } from "@/features/circuit/components";
import { pinKey, resolveNets } from "@/features/circuit/nets";
import { findPath } from "@/features/circuit/paths";
import { checkWiring, type ConnectionSpec, type WiringSpec } from "@/features/circuit/wiring-check";
import type { Circuit, ComponentType, PinRef } from "@/features/circuit/types";

/**
 * Zapojení rozložené na kroky.
 *
 * ── Co tím opravujeme ──────────────────────────────────────────────────────
 * Krok „zapoj obvod" ukazoval prázdnou plochu, paletu a větu „spoj součástky
 * drátky". Dospělý to zvládne, desetileté dítě ne — je to vhození do vody.
 * Zadání lekce přitom už teď popisuje spoje po jednom; stačí je nepředložit
 * všechny naráz, ale jeden po druhém, a u každého říct, kam se má kliknout.
 *
 * Kroky jsou dvojího druhu:
 *   1. „polož součástku" — dokud není na desce, nemá smysl mluvit o drátku
 *   2. „spoj tohle s tímhle" — jeden spoj ze zadání
 *
 * Pořadí je pořadí ze zadání lekce. Autor lekce ho píše tak, jak by obvod
 * stavěl člověk, a to je zároveň nejlepší pořadí pro učení.
 */

export type StepKind = "place" | "connect";

export interface WiringStep {
  kind: StepKind;
  /** Krátká věta v rozkazovacím způsobu: „Polož LED na desku." */
  instruction: string;
  /** Proč to tak je. Ukáže se pod instrukcí. */
  detail?: string;
  /** Součástka, kterou má dítě vzít z palety. Jen u `place`. */
  place?: ComponentType;
  /** Piny, které má krok spojit — plocha je zvýrazní. Jen u `connect`. */
  pins: PinRef[];
  /** Je krok hotový? */
  done: boolean;
  /**
   * Co je konkrétně špatně, když už dítě něco zapojilo, ale nesedí to.
   *
   * Prázdné „zbývá" je u obvodu, který vypadá hotově, k ničemu — dítě vidí
   * dva drátky a nemá jak poznat, proč se krok neodškrtl.
   */
  warning?: string;
}

/** Kolik kusů dané součástky zadání chce. */
function requiredCounts(spec: WiringSpec): Map<ComponentType, number> {
  const counts = new Map<ComponentType, number>();
  for (const part of spec.parts) {
    counts.set(part.type, (counts.get(part.type) ?? 0) + 1);
  }
  return counts;
}

/** Splňuje obvod tenhle jeden spoj? */
function connectionSatisfied(
  circuit: Circuit,
  conn: ConnectionSpec,
  roles: Record<string, string> | null,
  nets: ReturnType<typeof resolveNets>,
): boolean {
  const fromId = roles?.[conn.from.role];
  const toId = roles?.[conn.to.role];
  if (!fromId || !toId) return false;

  const result = findPath(circuit, pinKey(fromId, conn.from.pin), pinKey(toId, conn.to.pin), {
    through: conn.through,
    maxHops: (conn.through?.length ?? 0) + 1,
    nets,
  });

  if (!result.found) return false;
  /* `through` je seznam POVOLENÝCH typů, ne vyžadovaných — na to, že tam
     rezistor opravdu je, se musí doptat zvlášť. */
  return (conn.through ?? []).every((type) => result.through.includes(type));
}

/**
 * Kroky zapojení pro daný obvod.
 *
 * Počítá se z aktuálního stavu, takže se kroky samy odškrtávají, jak dítě
 * zapojuje — a to i tehdy, když je udělá v jiném pořadí, než navrhujeme.
 * Návod nemá být klec.
 */
export function wiringSteps(circuit: Circuit, spec: WiringSpec): WiringStep[] {
  const steps: WiringStep[] = [];

  /* 1. Součástky, které ještě nejsou na desce. Arduino a breadboard se
        nepočítají — ty tam leží od začátku. */
  const present = new Map<ComponentType, number>();
  for (const comp of circuit.comps) {
    present.set(comp.type, (present.get(comp.type) ?? 0) + 1);
  }

  for (const [type, needed] of requiredCounts(spec)) {
    if (type === "arduino-uno" || type === "breadboard-half") continue;

    const have = present.get(type) ?? 0;
    const label = getComponentSpec(type).label;

    for (let i = 0; i < needed; i++) {
      steps.push({
        kind: "place",
        instruction:
          needed > 1
            ? `Polož na desku ${label} (${i + 1}. z ${needed})`
            : `Polož na desku: ${label}`,
        detail: getComponentSpec(type).intro?.what,
        place: type,
        pins: [],
        done: i < have,
      });
    }
  }

  /* 2. Spoje. Role se přiřadí jednou — kontrola je umí dohledat i u obvodu,
        který ještě není hotový. */
  const wiring = checkWiring(circuit, spec);
  const nets = resolveNets(circuit);

  for (const conn of spec.connections) {
    const fromId = wiring.roles?.[conn.from.role];
    const toId = wiring.roles?.[conn.to.role];

    const fromPart = spec.parts.find((p) => p.role === conn.from.role);
    const toPart = spec.parts.find((p) => p.role === conn.to.role);
    if (!fromPart || !toPart) continue;

    const fromWhat = `${fromPart.label} — ${pinLabel(fromPart.type, conn.from.pin)}`;
    const toWhat = `${toPart.label} — ${pinLabel(toPart.type, conn.to.pin)}`;

    const fromPin: PinRef | null = fromId ? { compId: fromId, pinName: conn.from.pin } : null;
    const toPin: PinRef | null = toId ? { compId: toId, pinName: conn.to.pin } : null;

    const satisfied = connectionSatisfied(circuit, conn, wiring.roles, nets);
    const via = conn.through ?? [];

    /* Spoj bez mezičlánku je jeden drátek a jeden krok. */
    if (via.length === 0) {
      steps.push({
        kind: "connect",
        instruction: `Spoj ${fromWhat} → ${toWhat}`,
        detail: conn.hint,
        pins: [fromPin, toPin].filter((p): p is PinRef => p !== null),
        done: satisfied,
      });
      continue;
    }

    /* Spoj přes rezistor jsou DVA drátky. Jako jeden krok se choval
       špatně: dítě natáhlo první drátek, v seznamu se nic nestalo a
       nemělo jak poznat, že je na dobré cestě. Tak se to rozpadne na
       dva kroky, každý za jeden drátek. */
    const viaType = via[0]!;
    const viaLabel = getComponentSpec(viaType).label;
    const viaComp = fromPin ? pickBridge(circuit, viaType, fromPin, nets) : null;
    const viaPins = viaComp
      ? getComponentSpec(viaType).pins.map((pin) => ({ compId: viaComp, pinName: pin.name }))
      : [];

    /* První půlka je hotová, jakmile mezičlánek visí na výchozím pinu. */
    const firstDone =
      satisfied ||
      Boolean(
        viaComp &&
          fromPin &&
          getComponentSpec(viaType).pins.some((pin) =>
            nets.connected(pinKey(viaComp, pin.name), pinKey(fromPin.compId, fromPin.pinName)),
          ),
      );

    steps.push({
      kind: "connect",
      instruction: `Spoj ${fromWhat} → ${viaLabel}, jednu jeho nožičku`,
      detail: "Je jedno kterou z nich — na tom, kterou stranou je otočený, nezáleží.",
      pins: [...(fromPin ? [fromPin] : []), ...viaPins],
      done: firstDone,
    });

    /* Nejčastější chyba, kterou obvod nedá najevo: oba drátky skončí na
       TÉŽE nožičce. Vypadá to zapojeně, ale proud mezičlánek obejde —
       u rezistoru to znamená, že LED nechrání vůbec. */
    const shorted =
      !satisfied &&
      Boolean(fromPin && toPin && nets.connected(
        pinKey(fromPin.compId, fromPin.pinName),
        pinKey(toPin.compId, toPin.pinName),
      ));

    steps.push({
      kind: "connect",
      instruction: `Spoj druhou nožičku (${viaLabel}) → ${toWhat}`,
      detail: conn.hint,
      pins: [...viaPins, ...(toPin ? [toPin] : [])],
      done: satisfied,
      warning: shorted
        ? "Oba drátky ti vedou na tutéž nožičku — proud tak součástku obejde, jako by " +
          "tam nebyla. Přendej jeden z nich na druhou stranu."
        : undefined,
    });
  }

  return steps;
}

/**
 * Který mezičlánek dítě právě používá.
 *
 * Přednost má ten, který už na výchozím pinu visí — na tom dítě pracuje.
 * Jinak první nezapojený, protože k tomu nejspíš sáhne. Když jsou všechny
 * zapojené, vrátí první; kroky jsou pak stejně hotové.
 */
function pickBridge(
  circuit: Circuit,
  type: ComponentType,
  from: PinRef,
  nets: ReturnType<typeof resolveNets>,
): string | null {
  const candidates = circuit.comps.filter((c) => c.type === type);
  if (candidates.length === 0) return null;

  const pins = getComponentSpec(type).pins;
  const touchesFrom = (id: string) =>
    pins.some((pin) => nets.connected(pinKey(id, pin.name), pinKey(from.compId, from.pinName)));
  const isFree = (id: string) =>
    !circuit.wires.some((w) => w.from.compId === id || w.to.compId === id);

  return (
    candidates.find((c) => touchesFrom(c.id))?.id ??
    candidates.find((c) => isFree(c.id))?.id ??
    candidates[0]!.id
  );
}

/** První nesplněný krok. Null, když je hotovo. */
export function currentStep(steps: WiringStep[]): WiringStep | null {
  return steps.find((s) => !s.done) ?? null;
}
