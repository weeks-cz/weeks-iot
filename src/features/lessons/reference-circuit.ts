import { getComponentSpec } from "@/features/circuit/components";
import type { Circuit, CircuitComponent, ComponentType, Wire } from "@/features/circuit/types";
import type { WiringSpec } from "@/features/circuit/wiring-check";

/**
 * Vzorový obvod ze zadání lekce.
 *
 * Zadání popisuje spoje mezi rolemi. Tohle z něj poskládá skutečný obvod —
 * jeden, který zadání splňuje.
 *
 * ── Proč to existuje ───────────────────────────────────────────────────────
 * Hlavně kvůli testům. Lekce je datová struktura a v ní se dá napsat pin,
 * který na součástce vůbec není („1.l" u tlačítka, které má ve skutečnosti
 * 1a/2a). TypeScript to nechytí, protože jméno pinu je string. Chytí to
 * teprve běh: postav z toho obvod, pusť na něm vzorové řešení a zkontroluj,
 * že projdou všechny kontroly lekce. Když se v zadání překlepnu, spadne test,
 * ne dítě.
 *
 * ── Není to „správné řešení" ───────────────────────────────────────────────
 * Je to JEDNO z mnoha. Dítě smí zapojit součástky jinak, přes breadboard,
 * na jiné sloupce. Kontrola se ptá na elektrickou souvislost, ne na tenhle
 * konkrétní obvod.
 */

/** První a poslední pin součástky — tudy se skrz ni řetězí spoj. */
function throughPins(type: ComponentType): [string, string] {
  const pins = getComponentSpec(type).pins;
  const first = pins[0];
  const last = pins[pins.length - 1];
  if (!first || !last) throw new Error(`Součástka ${type} nemá piny.`);
  return [first.name, last.name];
}

export function referenceCircuit(spec: WiringSpec): Circuit {
  const comps: CircuitComponent[] = [];
  const wires: Wire[] = [];

  let x = 0;
  for (const part of spec.parts) {
    comps.push({ id: part.role, type: part.type, x, y: 0, rotation: 0 });
    x += getComponentSpec(part.type).spanX + 2;
  }

  /* Součástky, které zadání zmiňuje jen jako „přes co" — typicky rezistory.
     Nemají vlastní spoj, ale musí se do cesty vložit, a to právě ty, které
     zadání vyjmenovalo. Až když dojdou, doplní se nová. */
  const endpoints = new Set<string>();
  for (const conn of spec.connections) {
    endpoints.add(conn.from.role);
    endpoints.add(conn.to.role);
  }

  const spare = new Map<ComponentType, string[]>();
  for (const part of spec.parts) {
    if (endpoints.has(part.role)) continue;
    const list = spare.get(part.type) ?? [];
    list.push(part.role);
    spare.set(part.type, list);
  }

  let extra = 0;
  let wireId = 0;
  const wire = (from: [string, string], to: [string, string]): void => {
    wires.push({
      id: `ref-w${++wireId}`,
      from: { compId: from[0], pinName: from[1] },
      to: { compId: to[0], pinName: to[1] },
    });
  };

  for (const conn of spec.connections) {
    let cursor: [string, string] = [conn.from.role, conn.from.pin];

    for (const type of conn.through ?? []) {
      let id = spare.get(type)?.shift();
      if (!id) {
        id = `ref-${type}-${++extra}`;
        comps.push({ id, type, x, y: 0, rotation: 0 });
        x += getComponentSpec(type).spanX + 2;
      }

      const [inPin, outPin] = throughPins(type);
      wire(cursor, [id, inPin]);
      cursor = [id, outPin];
    }

    wire(cursor, [conn.to.role, conn.to.pin]);
  }

  return { comps, wires };
}
