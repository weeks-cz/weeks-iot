import { createBoard, emptyBoardState, type BoardState } from "@/features/arduino/board";
import { Interpreter, RuntimeError, compile } from "@/features/arduino/interpreter";
import { getComponentSpec } from "./components";
import { pinKey, resolveNets, type NetMap } from "./nets";
import { findPath } from "./paths";
import type { Circuit, CircuitComponent } from "./types";

/**
 * Most mezi programem a obvodem.
 *
 * Tohle je místo, kde emulátor přestává být „přehrávač očekávaného
 * výsledku" a stává se skutečným: stav pinů teče přes SÍTĚ do součástek.
 * LED nesvítí proto, že jsme čekali, že bude svítit — svítí proto, že jí
 * z pinu přes rezistor teče proud a druhou nožičkou se vrací na zem.
 *
 * Díky tomu obvod zapojený špatně nesvítí, i když je kód správně. A to
 * je přesně ta věc, kterou má dítě pochopit.
 *
 * ── Zjednodušení, ke kterým se hlásíme ─────────────────────────────────────
 * Neřeší se napětí, proud ani odpor v Ohmech. Rezistor je „součástka, která
 * tam musí být", ne 220 Ω. Pro první kurz to stačí a předstírat víc by
 * znamenalo vysvětlovat dítěti Ohmův zákon dřív, než rozsvítí LED.
 */

/** Piny Arduina, které vedou zem. */
const GROUND_PINS = ["GND-1", "GND-2", "GND-3", "GND"];
/** Piny Arduina, které vedou napětí. */
const POWER_PINS = ["5V", "3V3", "VIN"];

export interface LedState {
  compId: string;
  /** 0–255. Nula je zhasnuto, 255 plný jas. */
  brightness: number;
}

export interface BuzzerState {
  compId: string;
  /** Frekvence v Hz, nebo 0 když mlčí. */
  frequency: number;
}

export interface SimulationFrame {
  leds: LedState[];
  buzzers: BuzzerState[];
  /** Co program vypsal do sériového monitoru. */
  serial: string[];
  elapsedMs: number;
}

export interface SimulationInputs {
  /** Stisknutá tlačítka podle id součástky. */
  pressed?: Set<string>;
  /** Hodnoty táhel a senzorů 0–1023 podle id součástky. */
  analog?: Map<string, number>;
}

/**
 * Které číslo pinu Arduina odpovídá jménu pinu na desce.
 *
 * `D8` → 8, `A3` → 17. Uno má analogové piny číslované od 14.
 */
function arduinoPinNumber(pinName: string): number | null {
  const digital = /^D(\d{1,2})$/.exec(pinName);
  if (digital) return Number(digital[1]);

  const analog = /^A([0-5])$/.exec(pinName);
  if (analog) return 14 + Number(analog[1]);

  return null;
}

/** Napětí sítě: co do ní tlačí Arduino, tlačítka nebo napájecí piny. */
class NetVoltage {
  private levels = new Map<string, number>();

  constructor(
    private readonly nets: NetMap,
    private readonly circuit: Circuit,
  ) {}

  /** Nastaví úroveň sítě, do které patří daný pin. */
  drive(compId: string, pinName: string, level: number): void {
    const net = this.nets.netOf(pinKey(compId, pinName));
    /* Vyšší úroveň vyhrává. Když do sítě tlačí 5 V i zem, chová se to
       jako zkrat — ale u lekcí tohohle rozsahu je to nad rámec a
       zavádějící chování je lepší než chybějící. */
    this.levels.set(net, Math.max(this.levels.get(net) ?? 0, level));
  }

  level(compId: string, pinName: string): number {
    return this.levels.get(this.nets.netOf(pinKey(compId, pinName))) ?? 0;
  }

  /** Je pin spojený se zemí? */
  isGround(compId: string, pinName: string): boolean {
    const uno = this.circuit.comps.find((c) => c.type === "arduino-uno");
    if (!uno) return false;

    return GROUND_PINS.some((g) => {
      const spec = getComponentSpec("arduino-uno");
      if (!spec.pins.some((p) => p.name === g)) return false;
      return this.nets.connected(pinKey(compId, pinName), pinKey(uno.id, g));
    });
  }
}

/**
 * Jeden snímek obvodu podle aktuálního stavu desky.
 *
 * Volá se po každém průchodu `loop()`, takže z posloupnosti snímků
 * vznikne animace blikání.
 */
export function readFrame(
  circuit: Circuit,
  board: BoardState,
  inputs: SimulationInputs = {},
): SimulationFrame {
  const nets = resolveNets(circuit);
  const voltage = new NetVoltage(nets, circuit);

  const uno = circuit.comps.find((c) => c.type === "arduino-uno");

  /* 1. Co do obvodu tlačí Arduino. */
  if (uno) {
    const spec = getComponentSpec("arduino-uno");
    for (const pin of spec.pins) {
      const number = arduinoPinNumber(pin.name);
      if (number === null) continue;
      const out = board.outputs.get(number);
      if (out !== undefined && out > 0) voltage.drive(uno.id, pin.name, out);
    }
    for (const p of POWER_PINS) {
      if (spec.pins.some((x) => x.name === p)) voltage.drive(uno.id, p, 255);
    }
  }

  /* 2. Napětí se šíří skrz vodivé součástky.
     Sítě je záměrně nespojují — jinak by zmizel rozdíl mezi „přes
     rezistor" a „zkratováno". Jenže proud jimi teče, takže se úroveň
     musí propagovat zvlášť.

     Opakuje se, dokud se něco mění: napětí může vést přes dva rezistory
     za sebou a jeden průchod by se k druhému nedostal. Strop na počet
     kol brání zacyklení u obvodu zapojeného do kruhu. */
  const pressed = inputs.pressed ?? new Set<string>();

  for (let round = 0; round < 8; round++) {
    let changed = false;

    for (const comp of circuit.comps) {
      const conducts =
        comp.type === "resistor-220" ||
        comp.type === "potentiometer" ||
        comp.type === "photoresistor" ||
        (comp.type === "pushbutton" && pressed.has(comp.id));

      if (!conducts) continue;

      const pins = getComponentSpec(comp.type).pins;
      let best = 0;
      for (const pin of pins) best = Math.max(best, voltage.level(comp.id, pin.name));
      if (best <= 0) continue;

      for (const pin of pins) {
        if (voltage.level(comp.id, pin.name) < best) {
          voltage.drive(comp.id, pin.name, best);
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  /* 3. Co z obvodu vidí LED a bzučáky. */
  const leds: LedState[] = [];
  const buzzers: BuzzerState[] = [];

  for (const comp of circuit.comps) {
    if (comp.type.startsWith("led-")) {
      leds.push({ compId: comp.id, brightness: ledBrightness(circuit, comp, voltage) });
      continue;
    }

    if (comp.type === "piezo-buzzer") {
      buzzers.push({ compId: comp.id, frequency: buzzerFrequency(circuit, comp, board, nets) });
    }
  }

  return {
    leds,
    buzzers,
    serial: board.serial.map((l) => l.text),
    elapsedMs: board.elapsedMs,
  };
}

/**
 * Jas LED.
 *
 * Svítí, jen když je na anodě napětí, katoda je na zemi a v cestě je
 * rezistor. Obrácená polarita nesvítí, protože LED je dioda — a to je
 * lekce sama o sobě.
 */
function ledBrightness(circuit: Circuit, led: CircuitComponent, voltage: NetVoltage): number {
  const anodePin = led.type === "led-rgb" ? "r" : "anode";
  const cathodePin = "cathode";

  const level = voltage.level(led.id, anodePin);
  if (level <= 0) return 0;

  if (!voltage.isGround(led.id, cathodePin)) return 0;

  /* Bez rezistoru v cestě LED „svítí" jen chvíli a pak je po ní. Místo
     předstírání, že to jde, ji necháme zhasnutou — krok s kontrolou
     zapojení na to dítě upozorní konkrétně. */
  const uno = circuit.comps.find((c) => c.type === "arduino-uno");
  if (uno) {
    const path = findPath(circuit, pinKey(led.id, anodePin), pinKey(uno.id, "GND-1"), {
      maxHops: 3,
    });
    if (path.found && !path.through.includes("resistor-220")) {
      /* Cesta na zem existuje, ale bez rezistoru — nesvítí. */
      const withResistor = findPath(circuit, pinKey(led.id, anodePin), pinKey(uno.id, "GND-1"), {
        through: ["resistor-220", led.type],
        maxHops: 3,
      });
      if (!withResistor.found) return 0;
    }
  }

  return level;
}

function buzzerFrequency(
  circuit: Circuit,
  buzzer: CircuitComponent,
  board: BoardState,
  nets: NetMap,
): number {
  const uno = circuit.comps.find((c) => c.type === "arduino-uno");
  if (!uno) return 0;

  const spec = getComponentSpec("arduino-uno");

  for (const [pinNumber, frequency] of board.tones) {
    const pinName = spec.pins.find((p) => arduinoPinNumber(p.name) === pinNumber)?.name;
    if (!pinName) continue;

    const pins = getComponentSpec(buzzer.type).pins;
    const connected = pins.some((p) =>
      nets.connected(pinKey(buzzer.id, p.name), pinKey(uno.id, pinName)),
    );
    if (connected) return frequency;
  }

  /* Bzučák pípá i na digitalWrite — ne tónem, ale cvaknutím. */
  return 0;
}

/* ── Celý běh ───────────────────────────────────────────────────────────── */

export interface RunResult {
  ok: boolean;
  error?: { message: string; line: number };
  frames: SimulationFrame[];
}

export interface RunConfig {
  /** Kolik průchodů `loop()` spočítat. */
  iterations?: number;
  inputs?: SimulationInputs;
  /** Hodnoty, které mají číst vstupní piny — z tlačítek a senzorů. */
  pinInputs?: Map<number, number>;
}

/**
 * Přeloží a spustí program nad obvodem.
 *
 * Vrací snímky, ne jeden konečný stav — z nich se poskládá animace a jde
 * z nich poznat, že LED bliká, ne jen že na konci svítí.
 */
export function runProgram(
  source: string,
  circuit: Circuit,
  config: RunConfig = {},
): RunResult {
  const compiled = compile(source);
  if (!compiled.ok) {
    return { ok: false, error: compiled.error, frames: [] };
  }

  const state = emptyBoardState();
  for (const [pin, value] of config.pinInputs ?? []) state.inputs.set(pin, value);

  const board = createBoard(state);
  const interp = new Interpreter(compiled.program!, board);
  const frames: SimulationFrame[] = [];

  try {
    interp.runSetup();
    frames.push(readFrame(circuit, state, config.inputs));

    const iterations = config.iterations ?? 20;
    for (let i = 0; i < iterations; i++) {
      if (!interp.runLoopOnce()) break;
      frames.push(readFrame(circuit, state, config.inputs));
    }
  } catch (e) {
    if (e instanceof RuntimeError) {
      return { ok: false, error: { message: e.message, line: e.line }, frames };
    }
    return {
      ok: false,
      error: { message: "Program se zasekl. Zkontroluj smyčky a delay.", line: 1 },
      frames,
    };
  }

  return { ok: true, frames };
}
