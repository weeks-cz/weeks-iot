import { describe, expect, it } from "vitest";
import { PITCH } from "@/features/circuit/constants";
import type { Circuit } from "@/features/circuit/types";
import { COURSE_LESSONS, lesson1 } from "../content";
import { referenceCircuit } from "../reference-circuit";
import { lessonSeedCircuit } from "../seed-circuit";
import { currentStep, wiringSteps } from "../wiring-steps";

/**
 * Průvodce je to jediné, co dítě v kroku zapojování drží nad vodou. Když
 * se rozejde se skutečností — řekne „hotovo" u nezapojeného obvodu, nebo
 * naopak nikdy neodškrtne hotový krok — je horší než žádný.
 */

describe("kroky zapojení", () => {
  it("na prázdné desce začíná pokládáním součástek", () => {
    const steps = wiringSteps(lessonSeedCircuit(lesson1), lesson1.wiring);
    const first = currentStep(steps);

    expect(first?.kind).toBe("place");
    expect(first?.place).toBeDefined();
  });

  it("na hotovém obvodu je všechno odškrtnuté", () => {
    const steps = wiringSteps(referenceCircuit(lesson1.wiring), lesson1.wiring);

    expect(steps.filter((s) => !s.done)).toEqual([]);
    expect(currentStep(steps)).toBeNull();
  });

  it("spoj přes rezistor je rozdělený na dva kroky, protože jsou to dva drátky", () => {
    /* Jako jeden krok se to chovalo špatně: dítě natáhlo první drátek,
       v seznamu se nic nestalo a nemělo jak poznat, že je na dobré cestě. */
    const steps = wiringSteps(lessonSeedCircuit(lesson1), lesson1.wiring);
    const viaResistor = steps.filter(
      (s) => s.kind === "connect" && s.instruction.includes("Rezistor"),
    );

    expect(viaResistor.length).toBe(2);
    expect(viaResistor[0]?.instruction).toContain("pin 8");
    expect(viaResistor[1]?.instruction).toContain("delší nožička");
  });

  it("první drátek k rezistoru odškrtne první půlku spoje", () => {
    const seed = lessonSeedCircuit(lesson1);
    const uno = seed.comps.find((c) => c.type === "arduino-uno")!;

    const halfway: Circuit = {
      comps: [
        ...seed.comps,
        { id: "led", type: "led-red", x: 400, y: 0, rotation: 0 },
        { id: "r", type: "resistor-220", x: 200, y: 0, rotation: 0 },
      ],
      wires: [
        {
          id: "w1",
          from: { compId: uno.id, pinName: "D8" },
          to: { compId: "r", pinName: "a" },
        },
      ],
    };

    const steps = wiringSteps(halfway, lesson1.wiring);
    const viaResistor = steps.filter(
      (s) => s.kind === "connect" && s.instruction.includes("Rezistor"),
    );

    expect(viaResistor[0]?.done).toBe(true);
    expect(viaResistor[1]?.done).toBe(false);
  });

  it("odškrtnutý spoj se počítá i bez zbytku obvodu", () => {
    /* Návod nesmí být klec: dítě smí zapojovat v jiném pořadí, než
       navrhujeme, a hotové kroky se mu mají odškrtnout tak jako tak. */
    const full = referenceCircuit(lesson1.wiring);
    const onlyGround: Circuit = {
      comps: full.comps,
      wires: full.wires.filter((w) => w.to.pinName === "GND-1" || w.from.pinName === "GND-1"),
    };

    const steps = wiringSteps(onlyGround, lesson1.wiring);
    const done = steps.filter((s) => s.kind === "connect" && s.done);

    expect(done.length).toBe(1);
  });

  it("položená součástka odškrtne svůj krok", () => {
    const seed = lessonSeedCircuit(lesson1);
    const withLed: Circuit = {
      comps: [...seed.comps, { id: "l", type: "led-red", x: 10 * PITCH, y: 0, rotation: 0 }],
      wires: [],
    };

    const before = wiringSteps(seed, lesson1.wiring).filter((s) => s.kind === "place" && s.done);
    const after = wiringSteps(withLed, lesson1.wiring).filter((s) => s.kind === "place" && s.done);

    expect(after.length).toBe(before.length + 1);
  });
});

describe("chyby, které obvod sám nedá najevo", () => {
  it("oba drátky na téže nožičce rezistoru se poznají a pojmenují", () => {
    /* Nejzrádnější chyba v celém kurzu: vypadá to zapojeně, ale proud
       rezistor obejde — LED tedy nechrání vůbec. Bez pojmenování má dítě
       jen „zbývá" u kroku, který podle obrázku udělalo. */
    const seed = lessonSeedCircuit(lesson1);
    const uno = seed.comps.find((c) => c.type === "arduino-uno")!;

    const shorted: Circuit = {
      comps: [
        ...seed.comps,
        { id: "led", type: "led-red", x: 400, y: 0, rotation: 0 },
        { id: "r", type: "resistor-220", x: 200, y: 0, rotation: 0 },
      ],
      wires: [
        { id: "w1", from: { compId: uno.id, pinName: "D8" }, to: { compId: "r", pinName: "b" } },
        { id: "w2", from: { compId: "led", pinName: "anode" }, to: { compId: "r", pinName: "b" } },
      ],
    };

    const step = wiringSteps(shorted, lesson1.wiring).find((s) => s.warning);

    expect(step?.warning).toContain("tutéž nožičku");
    expect(step?.done).toBe(false);
  });

  it("správně zapojený rezistor žádné varování nemá", () => {
    const steps = wiringSteps(referenceCircuit(lesson1.wiring), lesson1.wiring);
    expect(steps.filter((s) => s.warning)).toEqual([]);
  });
});

describe.each(COURSE_LESSONS.map((l) => [l.slug, l] as const))("lekce %s", (_slug, lesson) => {
  it("má průvodce, který na vzorovém obvodu doběhne do konce", () => {
    const steps = wiringSteps(referenceCircuit(lesson.wiring), lesson.wiring);

    expect(steps.length).toBeGreaterThan(0);
    expect(steps.filter((s) => !s.done).map((s) => s.instruction)).toEqual([]);
  });

  it("každý krok má srozumitelnou instrukci", () => {
    const steps = wiringSteps(lessonSeedCircuit(lesson), lesson.wiring);

    for (const step of steps) {
      expect(step.instruction.length).toBeGreaterThan(10);
      /* Interní jméno pinu se k dítěti nesmí dostat — „anode" nikomu
         v deseti letech nic neříká, „delší nožička" ano. */
      expect(step.instruction).not.toContain("anode");
      expect(step.instruction).not.toContain("cathode");
    }
  });
});
