import { describe, expect, it } from "vitest";
import { lesson1, lesson6 } from "@/features/lessons/content";
import { referenceCircuit } from "@/features/lessons/reference-circuit";
import { runProgram, type SimulationFrame } from "../simulate";
import type { Circuit, CircuitComponent, Wire } from "../types";

/* Výstupy jako na skutečné desce: LED za tlačítkem se rozsvítí jen při stisku,
   PWM jen na pinech s vlnovkou, bzučák jen když má druhý pól na zemi,
   a tone(pin, f, délka) zní jen tu dobu. */

let seq = 0;
function wire(a: [string, string], b: [string, string]): Wire {
  return {
    id: `o${++seq}`,
    from: { compId: a[0], pinName: a[1] },
    to: { compId: b[0], pinName: b[1] },
  };
}

function withExtra(base: Circuit, comps: CircuitComponent[], wires: Wire[]): Circuit {
  return { comps: [...base.comps, ...comps], wires: [...base.wires, ...wires] };
}

const LED_ON = (f: SimulationFrame) => (f.leds[0]?.brightness ?? 0) > 0;

describe("tlačítko přerušuje zem i pro LED", () => {
  /* LED → tlačítko → GND. Pustíš-li tlačítko, obvod je rozpojený. */
  const base = referenceCircuit(lesson1.wiring);
  const uno = base.comps.find((c) => c.type === "arduino-uno")!;
  const led = base.comps.find((c) => c.type === "led-red")!;
  const btn: CircuitComponent = { id: "btn", type: "pushbutton", x: 900, y: 0, rotation: 0 };
  /* Z lekce 1 vyhodíme drátek LED → GND; zem jde jen přes tlačítko. */
  const circuit = withExtra(
    {
      comps: base.comps,
      wires: base.wires.filter((w) => w.to.pinName !== "GND-1" && w.from.pinName !== "GND-1"),
    },
    [btn],
    [wire([led.id, "cathode"], ["btn", "1a"]), wire(["btn", "2a"], [uno.id, "GND-1"])],
  );
  const src = lesson1.solution;

  it("nestisknuté tlačítko LED nerozsvítí", () => {
    const run = runProgram(src, circuit, { iterations: 2, inputs: { pressed: new Set() } });
    expect(run.frames.some(LED_ON)).toBe(false);
  });

  it("stisknuté tlačítko LED rozsvítí", () => {
    const run = runProgram(src, circuit, { iterations: 2, inputs: { pressed: new Set(["btn"]) } });
    expect(run.frames.some(LED_ON)).toBe(true);
  });
});

describe("PWM jen na pinech s vlnovkou", () => {
  const circuit = referenceCircuit(lesson1.wiring);

  it("na pinu 9 je jas plynulý", () => {
    const src = `void setup() {} void loop() { analogWrite(9, 100); delay(10); }`;
    const run = runProgram(src, withPin(circuit, 9), { iterations: 2 });
    const levels = new Set(run.frames.map((f) => f.leds[0]?.brightness ?? 0));
    expect(levels.has(100)).toBe(true);
  });

  it("na pinu 8 se analogWrite chová jako vypínač: od 128 výš zapne, jinak vypne", () => {
    const low = runProgram(
      `void setup() {} void loop() { analogWrite(8, 100); delay(10); }`,
      circuit,
      { iterations: 2 },
    );
    expect(low.frames.some(LED_ON)).toBe(false);

    const high = runProgram(
      `void setup() {} void loop() { analogWrite(8, 200); delay(10); }`,
      circuit,
      { iterations: 2 },
    );
    const lit = high.frames.map((f) => f.leds[0]?.brightness ?? 0);
    expect(lit.every((b) => b === 0 || b === 255)).toBe(true);
    expect(lit).toContain(255);
  });

  it("analogWrite na pinu bez PWM se pojmenuje v diagnostice", () => {
    const run = runProgram(
      `void setup() {} void loop() { analogWrite(8, 200); delay(10); }`,
      circuit,
      { iterations: 2 },
    );
    expect(run.diagnostics).toContainEqual({ kind: "no-pwm", pin: 8 });
  });
});

/* Pomocná součástka: LED na libovolný pin přes stejný rezistor a zem jako
   v lekci 1 — pin 9 je v té lekci právě ten s vlnovkou. */
function withPin(base: Circuit, pin: number): Circuit {
  const uno = base.comps.find((c) => c.type === "arduino-uno")!;
  const wires = base.wires.map((w) =>
    w.from.compId === uno.id && w.from.pinName === "D8"
      ? { ...w, from: { compId: uno.id, pinName: `D${pin}` } }
      : w,
  );
  return { comps: base.comps, wires };
}

describe("bzučák potřebuje zem na druhém pólu", () => {
  it("bez spojení s GND nezní", () => {
    const base = referenceCircuit(lesson6.wiring);
    const broken: Circuit = {
      comps: base.comps,
      wires: base.wires.filter((w) => !(w.from.pinName === "-" || w.to.pinName === "-")),
    };
    const run = runProgram(lesson6.solution, broken, { iterations: 2 });
    expect(run.frames.some((f) => f.buzzers.some((b) => b.frequency > 0))).toBe(false);
  });
});

describe("tone s délkou", () => {
  it("zní jen tak dlouho, jak je zadaná délka", () => {
    const circuit = referenceCircuit(lesson6.wiring);
    const src = `
void setup() { pinMode(8, OUTPUT); }
void loop() {
  tone(8, 440, 200);
  delay(1000);
}`;
    const run = runProgram(src, circuit, { iterations: 2 });
    const sounding = run.frames.filter((f) => f.buzzers.some((b) => b.frequency > 0));
    expect(sounding.length).toBeGreaterThan(0);
    /* Po 200 ms je ticho, dokud se nezahraje další tón. */
    const silentLater = run.frames.filter(
      (f) => f.elapsedMs >= 200 && f.elapsedMs < 1000 && f.buzzers.some((b) => b.frequency > 0),
    );
    expect(silentLater).toEqual([]);
  });
});
