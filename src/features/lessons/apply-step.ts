import { getComponentSpec } from "@/features/circuit/components";
import { PITCH } from "@/features/circuit/constants";
import type { Circuit } from "@/features/circuit/types";
import type { WiringStep } from "./wiring-steps";

/**
 * Provedení jednoho kroku zapojení za dítě.
 *
 * ── Proč po krocích, a ne celý obvod naráz ─────────────────────────────────
 * Zaseknout se na zapojování znamenalo konec lekce: tlačítko „Napsat
 * program" se objeví teprve, když zapojení sedí, a nápovědy jednou dojdou.
 * Kdo se nedostal přes drátky, nedostal se ke kódu vůbec.
 *
 * Nabízí se hotový obvod jedním kliknutím. Jenže tím by dítě přišlo o celý
 * krok — a hlavně by nevidělo, CO se stalo. Jeden krok znamená jednu
 * součástku nebo jeden drátek: na ploše je vidět, co přibylo, a další
 * krok už dítě většinou udělá samo.
 *
 * ── Proč se nepoužije referenceCircuit ─────────────────────────────────────
 * `referenceCircuit()` staví obvod od nuly a součástky skládá do řady.
 * Dítěti by přeskládal desku pod rukama a breadboard, na který zrovna
 * kouká, by úplně obešel. Tohle staví na tom, co už na ploše je.
 */
export function applyStep(circuit: Circuit, step: WiringStep): Circuit {
  if (step.kind === "place") {
    if (!step.place) return circuit;

    return {
      ...circuit,
      comps: [
        ...circuit.comps,
        {
          id: crypto.randomUUID(),
          type: step.place,
          ...freeSpot(circuit),
          rotation: 0,
        },
      ],
    };
  }

  const from = step.from[0];
  const to = step.to[0];
  if (!from || !to) return circuit;

  return {
    ...circuit,
    wires: [...circuit.wires, { id: crypto.randomUUID(), from, to }],
  };
}

/**
 * Volné místo napravo od všeho, co na ploše je.
 *
 * Vedle desky, ne na ni. Zapíchnutí do breadboardu spojuje podle POLOHY,
 * takže součástka položená „někam" by mohla tiše propojit dvě sítě —
 * a dítě by pak hledalo chybu v obvodu, který mu postavil program.
 * Spoje dělají až drátky v dalších krocích, kde je každý vidět.
 */
function freeSpot(circuit: Circuit): { x: number; y: number } {
  const right = circuit.comps.reduce(
    (max, comp) => Math.max(max, comp.x + getComponentSpec(comp.type).spanX * PITCH),
    0,
  );

  return { x: right + 2 * PITCH, y: 2 * PITCH };
}
