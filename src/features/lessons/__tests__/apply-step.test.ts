import { describe, expect, it } from "vitest";
import { getComponentSpec } from "@/features/circuit/components";
import { PITCH } from "@/features/circuit/constants";
import { PLUGGABLE, pinKey, resolveNets } from "@/features/circuit/nets";
import { checkWiring } from "@/features/circuit/wiring-check";
import type { Circuit } from "@/features/circuit/types";
import { applyStep } from "../apply-step";
import { COURSE_LESSONS } from "../content";
import { runLessonChecks } from "../run-check";
import { lessonSeedCircuit } from "../seed-circuit";
import { currentStep, wiringSteps } from "../wiring-steps";

/**
 * Úniková cesta ze zapojování.
 *
 * Nejpřísnější zkouška, jaká jde: obvod se postaví VÝHRADNĚ tímhle
 * tlačítkem, krok po kroku, a pak se na něm pustí vzorové řešení lekce.
 * Když projde, ví se, že dítě, které to za sebe nechá udělat celé,
 * neskončí v obvodu, který nefunguje.
 */

/** Zapojí celou lekci po krocích. Vrátí obvod a počet kroků. */
function buildByHatch(lesson: (typeof COURSE_LESSONS)[number]): {
  circuit: Circuit;
  taken: number;
} {
  let circuit = lessonSeedCircuit(lesson);
  let taken = 0;

  /* Strop je pojistka proti kroku, který se sám neodškrtne: bez něj by
     se test místo spadnutí zacyklil a nikdo by nevěděl proč. */
  while (taken < 40) {
    const step = currentStep(wiringSteps(circuit, lesson.wiring));
    if (!step) break;
    circuit = applyStep(circuit, step);
    taken += 1;
  }

  return { circuit, taken };
}

describe.each(COURSE_LESSONS.map((l) => [l.slug, l] as const))("applyStep — %s", (slug, lesson) => {
  const { circuit, taken } = buildByHatch(lesson);

  it("dojde na konec, každý krok posune obvod dál", () => {
    expect(taken, `${slug}: kroky se přestaly odškrtávat`).toBeLessThan(40);
    expect(currentStep(wiringSteps(circuit, lesson.wiring))).toBeNull();
  });

  it("výsledek projde kontrolou zapojení", () => {
    const wiring = checkWiring(circuit, lesson.wiring);
    expect(wiring.issues[0]?.hint ?? null, slug).toBeNull();
    expect(wiring.ok).toBe(true);
  });

  it("na výsledku projde vzorové řešení", () => {
    const run = runLessonChecks(lesson, circuit, lesson.solution);
    expect(run.error, slug).toBeNull();
    expect(run.passed, slug).toBe(true);
  });
});

/* ── Zapojení do breadboardu ─────────────────────────────────────────────
   Dřív „zapoj za mě" kladlo součástky vedle desky a drátky tahalo šikmo
   přes ni přímo na nožičky. Na táboře nic takového nikdo nestaví — dítě
   pak vidělo obvod, který nevypadá jako ten v ruce. Tyhle testy drží, že
   se staví jako na skutečné desce, a hlavně že se tím nic nespojí navíc. */

/** Kolik „nožiček" je v každé dírce desky: vývody součástek i konce drátků. */
function legsPerHole(circuit: Circuit): Map<string, number> {
  const board = circuit.comps.find((c) => c.type === "breadboard-half");
  const legs = new Map<string, number>();
  if (!board) return legs;

  const holes = new Set(
    getComponentSpec(board.type).pins.map(
      (p) => `${board.x + p.dx * PITCH},${board.y + p.dy * PITCH}`,
    ),
  );
  const add = (key: string) => {
    if (holes.has(key)) legs.set(key, (legs.get(key) ?? 0) + 1);
  };

  for (const comp of circuit.comps) {
    if (!PLUGGABLE.has(comp.type)) continue;
    for (const pin of getComponentSpec(comp.type).pins) {
      add(`${comp.x + pin.dx * PITCH},${comp.y + pin.dy * PITCH}`);
    }
  }
  for (const wire of circuit.wires) {
    for (const end of [wire.from, wire.to]) {
      if (end.compId !== board.id) continue;
      const pin = getComponentSpec(board.type).pins.find((p) => p.name === end.pinName)!;
      add(`${board.x + pin.dx * PITCH},${board.y + pin.dy * PITCH}`);
    }
  }
  return legs;
}

/**
 * Sítě, které v obvodu smějí vzniknout.
 *
 * Každý spoj ze zadání spojí své dva konce; spoj přes rezistor spojí pin
 * s jednou nožičkou a druhou nožičku s cílem. Zem je jedna. Tlačítko má
 * obě půlky spojené z výroby. Cokoli, co skutečné sítě spojí NAVÍC, je
 * nechtěný spoj — to, čeho se „zapoj za mě" nesmí nikdy dopustit.
 */
function unexpectedMerges(circuit: Circuit, lesson: (typeof COURSE_LESSONS)[number]): string[] {
  const roles = checkWiring(circuit, lesson.wiring).roles ?? {};
  const nets = resolveNets(circuit);
  const allowed = new Map<string, string>();
  const find = (k: string): string => {
    const p = allowed.get(k);
    if (!p || p === k) return k;
    const r = find(p);
    allowed.set(k, r);
    return r;
  };
  const union = (a: string, b: string) => allowed.set(find(a), find(b));

  const arduino = circuit.comps.find((c) => c.type === "arduino-uno")!;
  const gnds = getComponentSpec("arduino-uno").pins.filter((p) => p.name.startsWith("GND"));
  for (const g of gnds) union(pinKey(arduino.id, g.name), pinKey(arduino.id, "GND-1"));

  for (const comp of circuit.comps) {
    if (comp.type !== "pushbutton") continue;
    union(pinKey(comp.id, "1a"), pinKey(comp.id, "1b"));
    union(pinKey(comp.id, "2a"), pinKey(comp.id, "2b"));
  }

  for (const conn of lesson.wiring.connections) {
    const from = pinKey(roles[conn.from.role]!, conn.from.pin);
    const to = pinKey(roles[conn.to.role]!, conn.to.pin);
    if (!conn.through?.length) {
      union(from, to);
      continue;
    }
    const bridge = circuit.comps.find(
      (c) =>
        conn.through!.includes(c.type) &&
        getComponentSpec(c.type).pins.some((p) => nets.connected(pinKey(c.id, p.name), from)),
    )!;
    const [a, b] = getComponentSpec(bridge.type).pins.map((p) => pinKey(bridge.id, p.name));
    const near = nets.connected(a!, from) ? a! : b!;
    const far = near === a ? b! : a!;
    union(from, near);
    union(far, to);
  }

  const significant = circuit.comps
    .filter((c) => c.type !== "breadboard-half")
    .flatMap((c) => getComponentSpec(c.type).pins.map((p) => pinKey(c.id, p.name)));

  const problems: string[] = [];
  const firstInNet = new Map<string, string>();
  for (const key of significant) {
    const net = nets.netOf(key);
    const other = firstInNet.get(net);
    if (!other) {
      firstInNet.set(net, key);
    } else if (find(other) !== find(key)) {
      problems.push(`${other} ↔ ${key}`);
    }
  }
  return problems;
}

describe.each(COURSE_LESSONS.map((l) => [l.slug, l] as const))(
  "applyStep na breadboardu — %s",
  (slug, lesson) => {
    const snapshots: Circuit[] = [];
    let circuit = lessonSeedCircuit(lesson);
    for (let i = 0; i < 40; i++) {
      const step = currentStep(wiringSteps(circuit, lesson.wiring));
      if (!step) break;
      circuit = applyStep(circuit, step);
      snapshots.push(circuit);
    }
    const board = circuit.comps.find((c) => c.type === "breadboard-half")!;
    const holeAt = new Set(
      getComponentSpec("breadboard-half").pins.map(
        (p) => `${board.x + p.dx * PITCH},${board.y + p.dy * PITCH}`,
      ),
    );

    it("součástky, které se do desky zapichují, jsou zapíchnuté", () => {
      for (const comp of circuit.comps.filter((c) => PLUGGABLE.has(c.type))) {
        for (const pin of getComponentSpec(comp.type).pins) {
          const key = `${comp.x + pin.dx * PITCH},${comp.y + pin.dy * PITCH}`;
          expect(holeAt.has(key), `${slug}: ${comp.type}.${pin.name} mimo dírku`).toBe(true);
        }
      }
    });

    it("po žádném kroku nejsou v jedné dírce dvě nožičky", () => {
      snapshots.forEach((snap, i) => {
        const crowded = [...legsPerHole(snap)].filter(([, n]) => n > 1);
        expect(crowded, `${slug}, krok ${i + 1}`).toEqual([]);
      });
    });

    it("nevznikne žádný nechtěný spoj", () => {
      expect(unexpectedMerges(circuit, lesson), slug).toEqual([]);
    });

    it("různé piny Arduina zůstanou v různých sítích", () => {
      /* Pojistka nezávislá na přiřazení rolí: když se dva signální piny
         potkají v jedné síti, je to zkrat bez ohledu na to, jak by se
         dal „vysvětlit". Semafor na to jednou narazil — D2 a D3 skončily
         v jednom sloupci, protože oba dostaly tentýž rezistor. */
      const arduino = circuit.comps.find((c) => c.type === "arduino-uno")!;
      const nets = resolveNets(circuit);
      const used = new Set(
        lesson.wiring.connections.flatMap((c) =>
          [c.from, c.to]
            .filter((e) => e.role === "arduino" && !e.pin.startsWith("GND"))
            .map((e) => e.pin),
        ),
      );
      const pins = [...used];
      for (let i = 0; i < pins.length; i++) {
        for (let j = i + 1; j < pins.length; j++) {
          const a = pinKey(arduino.id, pins[i]!);
          const b = pinKey(arduino.id, pins[j]!);
          expect(nets.connected(a, b), `${slug}: ${pins[i]} ↔ ${pins[j]}`).toBe(false);
        }
      }
    });

    it("drátek nekončí na nožičce zapíchnuté součástky, ale v dírce vedle ní", () => {
      const plugged = new Set(circuit.comps.filter((c) => PLUGGABLE.has(c.type)).map((c) => c.id));
      for (const wire of circuit.wires) {
        expect(plugged.has(wire.from.compId), `${slug}: ${wire.from.pinName}`).toBe(false);
        expect(plugged.has(wire.to.compId), `${slug}: ${wire.to.pinName}`).toBe(false);
      }
    });

    it("zem vede z Arduina na lištu −", () => {
      const arduino = circuit.comps.find((c) => c.type === "arduino-uno")!;
      const groundWires = circuit.wires.filter((w) =>
        [w.from, w.to].some((e) => e.compId === arduino.id && e.pinName.startsWith("GND")),
      );
      expect(groundWires.length, slug).toBeGreaterThan(0);
      /* Fotorezistor do desky nejde (viz PLUGGABLE), jeho zem smí vést
         rovnou. Všechno ostatní přes lištu. */
      const direct = groundWires.filter((w) => {
        const other = w.from.compId === arduino.id ? w.to : w.from;
        return other.compId !== board.id || !other.pinName.includes("−");
      });
      const allowed = direct.every((w) => {
        const other = w.from.compId === arduino.id ? w.to : w.from;
        return circuit.comps.find((c) => c.id === other.compId)?.type === "photoresistor";
      });
      expect(allowed, slug).toBe(true);
    });
  },
);

describe("applyStep", () => {
  const lesson = COURSE_LESSONS[0]!;

  it("položí právě jednu součástku", () => {
    const seed = lessonSeedCircuit(lesson);
    const step = currentStep(wiringSteps(seed, lesson.wiring))!;
    expect(step.kind).toBe("place");

    const next = applyStep(seed, step);
    expect(next.comps.length).toBe(seed.comps.length + 1);
    expect(next.comps.at(-1)?.type).toBe(step.place);
  });

  it("nepokládá součástku na jinou", () => {
    /* Dvě součástky na stejném místě vypadají jako jedna a piny na téže
       souřadnici se navíc přes desku spojí. */
    const { circuit } = buildByHatch(lesson);
    const places = circuit.comps.map((c) => `${c.x}:${c.y}`);
    expect(new Set(places).size).toBe(places.length);
  });

  it("nesahá na původní obvod", () => {
    const seed = lessonSeedCircuit(lesson);
    const step = currentStep(wiringSteps(seed, lesson.wiring))!;
    const before = JSON.stringify(seed);

    applyStep(seed, step);
    expect(JSON.stringify(seed)).toBe(before);
  });

  it("krok bez konců spoje obvod nezmění", () => {
    const seed = lessonSeedCircuit(lesson);
    const next = applyStep(seed, {
      kind: "connect",
      instruction: "nikam",
      pins: [],
      from: [],
      to: [],
      done: false,
    });
    expect(next).toBe(seed);
  });
});
