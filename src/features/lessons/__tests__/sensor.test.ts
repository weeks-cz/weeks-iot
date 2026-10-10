import { describe, expect, it } from "vitest";
import { runProgram } from "@/features/circuit/simulate";
import { referenceCircuit } from "../reference-circuit";
import { lesson7 } from "../content";

/* Fotorezistor je analogový senzor: hodnota přichází z obvodu (AO na A0),
   ne z kontroly. Ve tmě je hodnota malá, na světle velká — a LED v lekci
   má svítit jen ve tmě. */

const circuit = referenceCircuit(lesson7.wiring);
const sensorId = "senzor";

function ledOnAt(light: number): boolean {
  const run = runProgram(lesson7.solution, circuit, {
    iterations: 3,
    inputs: { analog: new Map([[sensorId, light]]) },
  });
  return run.frames.some((f) => f.leds.some((l) => l.brightness > 0));
}

describe("analogový vstup z fotorezistoru", () => {
  it("ve tmě (malá hodnota) řešení rozsvítí LED", () => {
    expect(ledOnAt(100)).toBe(true);
  });

  it("na světle (velká hodnota) LED zhasne", () => {
    expect(ledOnAt(900)).toBe(false);
  });

  it("nenapájený senzor nečte nic — obvod ho nezapíná", () => {
    const unpowered = {
      comps: circuit.comps,
      wires: circuit.wires.filter(
        (w) =>
          !(w.from.compId === sensorId && w.from.pinName === "vcc") &&
          !(w.to.compId === sensorId && w.to.pinName === "vcc"),
      ),
    };
    const run = runProgram(lesson7.solution, unpowered, {
      iterations: 3,
      inputs: { analog: new Map([[sensorId, 900]]) },
    });
    /* Bez napájení výstup nic neříká: hodnota je nula, tedy „tma". */
    expect(run.frames.some((f) => f.leds.some((l) => l.brightness > 0))).toBe(true);
  });

  it("bez zadané hodnoty bere střed rozsahu", () => {
    const run = runProgram(lesson7.solution, circuit, { iterations: 2 });
    expect(run.ok).toBe(true);
  });
});
