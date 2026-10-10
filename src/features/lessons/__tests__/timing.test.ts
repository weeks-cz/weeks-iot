import { describe, expect, it } from "vitest";
import { runProgram, type SimulationFrame } from "@/features/circuit/simulate";
import { referenceCircuit } from "../reference-circuit";
import { playbackSchedule, stateAtPlayback } from "../components/useFramePlayer";
import { lesson1, lesson2 } from "../content";
import { runDurationMs } from "../types";

/* Časování: co dítě vidí, musí odpovídat tomu, co program dělá. Stav, který
   trvá 500 ms, se ukáže na 500 ms; ten, co trvá 10 ms, se ukáže aspoň na
   jeden snímek a nesmí se prohodit s předchozím. */

const LED_LOOP = (on: number, off: number) => `
void setup() { pinMode(8, OUTPUT); }
void loop() {
  digitalWrite(8, HIGH);
  delay(${on});
  digitalWrite(8, LOW);
  delay(${off});
}`;

function ledAt(frames: SimulationFrame[], t: number): number {
  const frame = stateAtPlayback(frames, t);
  return frame?.leds[0]?.brightness ?? 0;
}

const circuit = referenceCircuit(lesson2.wiring);

describe("stav se ukazuje na dobu, po kterou trvá", () => {
  it("HIGH na 500 ms a LOW na 10 ms: svítí nejdřív, pak krátce zhasne", () => {
    const run = runProgram(LED_LOOP(500, 10), circuit, { iterations: 2 });
    expect(ledAt(run.frames, 0)).toBeGreaterThan(0);
    expect(ledAt(run.frames, 499)).toBeGreaterThan(0);
    expect(ledAt(run.frames, 500)).toBe(0);
    expect(ledAt(run.frames, 509)).toBe(0);
    /* Zhasnutí na 10 ms se natáhne na jeden tick (~16,7 ms), aby bylo vidět,
       takže další rozsvícení přijde o chvilku později, ne v 510 ms. */
    expect(ledAt(run.frames, 510)).toBe(0);
    expect(ledAt(run.frames, 520)).toBeGreaterThan(0);
  });

  it("rozdělí cyklus přesně podle delay()", () => {
    const run = runProgram(LED_LOOP(2000, 50), circuit, { iterations: 2 });
    const schedule = playbackSchedule(run.frames);
    expect(schedule.total).toBe(2 * 2050);
    expect(ledAt(run.frames, 1999)).toBeGreaterThan(0);
    expect(ledAt(run.frames, 2000)).toBe(0);
  });

  it("delay(50) a delay(2000) se neshodují — poměr zůstává reálný", () => {
    const fast = playbackSchedule(runProgram(LED_LOOP(50, 50), circuit, { iterations: 2 }).frames);
    const slow = playbackSchedule(runProgram(LED_LOOP(2000, 2000), circuit, { iterations: 2 }).frames);
    expect(slow.total).toBe(40 * fast.total);
  });

  it("poslední stav cyklu se taky ukáže", () => {
    const run = runProgram(LED_LOOP(300, 200), circuit, { iterations: 2 });
    const schedule = playbackSchedule(run.frames);
    const last = run.frames.at(-1)!;
    expect(last.elapsedMs).toBeLessThan(schedule.total);
    expect(stateAtPlayback(run.frames, schedule.total - 1)).toBe(last);
  });

  it("velmi krátký stav mezi dlouhými se ukáže aspoň na jeden snímek", () => {
    const run = runProgram(LED_LOOP(500, 10), circuit, { iterations: 2 });
    const schedule = playbackSchedule(run.frames);
    const offStart = 500;
    /* Zhasnutí trvá 10 ms, což je pod jeden snímek animace — přesto musí
       být na obrazovce v některém snímku. */
    const seen = new Set<number>();
    for (let t = offStart; t < offStart + 40; t += 1) {
      if (t < schedule.total) seen.add(ledAt(run.frames, t));
    }
    expect(seen.has(0)).toBe(true);
  });
});

describe("běh a smyčka", () => {
  it("přehrávání se nezastaví na jednom průchodu — dvě iterace dávají dvojnásobný cyklus", () => {
    const one = playbackSchedule(runProgram(LED_LOOP(100, 100), circuit, { iterations: 1 }).frames);
    const two = playbackSchedule(runProgram(LED_LOOP(100, 100), circuit, { iterations: 2 }).frames);
    expect(two.total).toBe(2 * one.total);
  });

  it("while(true) s delay není chyba — rozpočet kroků se počítá na průchod", () => {
    const src = `
void setup() { pinMode(8, OUTPUT); }
void loop() {
  while (true) {
    digitalWrite(8, HIGH);
    delay(100);
    digitalWrite(8, LOW);
    delay(100);
  }
}`;
    const run = runProgram(src, circuit, { iterations: 2 });
    expect(run.ok).toBe(true);
    /* Arduino by v téhle smyčce běžel pořád. Simulace se zastaví na
       limitu virtuálního času, ne na náhodném stropu snímků. */
    const total = runDurationMs(run.frames);
    expect(total).toBeGreaterThan(50_000);
    expect(total).toBeLessThanOrEqual(62_000);
  });

  it("while(true) bez delay se pořád zastaví s chybou", () => {
    const src = `
void setup() { pinMode(8, OUTPUT); }
void loop() { while (true) { } }`;
    const run = runProgram(src, circuit, { iterations: 2 });
    expect(run.ok).toBe(false);
  });

  it("sériový výpis nevyrábí nové snímky", () => {
    const src = `
void setup() { Serial.begin(9600); }
void loop() {
  for (int i = 0; i < 500; i++) { Serial.println(i); }
  delay(100);
}`;
    const run = runProgram(src, referenceCircuit(lesson1.wiring), { iterations: 2 });
    expect(run.frames.length).toBeLessThanOrEqual(4);
    expect(run.frames.at(-1)?.serial.length).toBe(1000);
  });
});
