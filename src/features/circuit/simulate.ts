import { createBoard, emptyBoardState, type BoardState } from "@/features/arduino/board";
import { Interpreter, RuntimeError, compile } from "@/features/arduino/interpreter";
import { getComponentSpec } from "./components";
import { pinKey, resolveNets, type NetMap } from "./nets";
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

/**
 * Které dvojice pinů uvnitř součástky vedou proud.
 *
 * Záměrně po dvojicích, ne „všechny piny součástky se srovnají": u
 * fotorezistorového modulu by vyrovnání znamenalo, že se 5 V z jeho VCC
 * rozlije až do země. Modul má vlastní elektroniku a jeho výstup se čte
 * přes analogRead — obvodem nic nevede, proto tu není vůbec.
 *
 * Tlačítko má dvě poloviny spojené už z výroby (1a–1b, 2a–2b). Teprve
 * stisk spojí obě poloviny mezi sebou, a to je celý jeho smysl.
 */
function conductivePairs(
  comp: CircuitComponent,
  isPressed: boolean,
): ReadonlyArray<readonly [string, string]> {
  switch (comp.type) {
    case "resistor-220":
      return [["a", "b"]];

    case "potentiometer":
      /* Běžec dělí dráhu na dvě části; proud teče oběma i celou dráhou. */
      return [
        ["terminal-a", "signal"],
        ["signal", "terminal-b"],
        ["terminal-a", "terminal-b"],
      ];

    case "pushbutton":
      return isPressed
        ? [
            ["1a", "1b"],
            ["2a", "2b"],
            ["1a", "2a"],
          ]
        : [
            ["1a", "1b"],
            ["2a", "2b"],
          ];

    default:
      return [];
  }
}

/** Napětí sítě: co do ní tlačí Arduino, tlačítka nebo napájecí piny. */
class NetVoltage {
  private levels = new Map<string, number>();
  private grounded: Set<string> | null = null;

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

  /**
   * Je pin spojený se zemí?
   *
   * Nejen drátem. Rezistor patří do smyčky stejně dobře na straně katody
   * jako na straně anody a spousta návodů ho kreslí právě dolů — kdyby se
   * zem hledala jen po drátech, tohle úplně správné zapojení by nesvítilo.
   *
   * Přes LED se ale nechodí: zpáteční cesta vede pasivními součástkami,
   * ne druhou diodou.
   */
  isGround(compId: string, pinName: string): boolean {
    return this.groundNets().has(this.nets.netOf(pinKey(compId, pinName)));
  }

  /** Sítě, ze kterých se dá dostat na zem. Počítá se jednou za snímek. */
  private groundNets(): Set<string> {
    if (this.grounded) return this.grounded;

    const found = new Set<string>();
    this.grounded = found;

    const uno = this.circuit.comps.find((c) => c.type === "arduino-uno");
    if (!uno) return found;

    const spec = getComponentSpec("arduino-uno");
    const queue: string[] = [];
    for (const g of GROUND_PINS) {
      if (!spec.pins.some((p) => p.name === g)) continue;
      const net = this.nets.netOf(pinKey(uno.id, g));
      if (found.has(net)) continue;
      found.add(net);
      queue.push(net);
    }

    /* Zem se šíří pasivními součástkami — rezistorem, sepnutým tlačítkem,
       dráhou potenciometru. Stisk se tu záměrně neřeší: tlačítko v cestě
       k zemi je pro tuhle otázku vodič, protože jinak by se obvod dítěte
       tvářil rozpojeně, dokud ho někdo nedrží. */
    const passive = new Set(["resistor-220", "pushbutton", "potentiometer"]);

    while (queue.length > 0) {
      const net = queue.shift()!;

      for (const comp of this.circuit.comps) {
        if (!passive.has(comp.type)) continue;

        const pins = getComponentSpec(comp.type).pins;
        const touches = pins.some((p) => this.nets.netOf(pinKey(comp.id, p.name)) === net);
        if (!touches) continue;

        for (const p of pins) {
          const other = this.nets.netOf(pinKey(comp.id, p.name));
          if (found.has(other)) continue;
          found.add(other);
          queue.push(other);
        }
      }
    }

    return found;
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
  precomputed?: NetMap,
): SimulationFrame {
  /* Rozklad do sítí závisí jen na obvodu, a ten se během běhu nemění.
     U přechodu jasu se snímků pořizují stovky — počítat sítě u každého
     zvlášť je ta nejdražší věc, kterou by simulace mohla dělat. */
  const nets = precomputed ?? resolveNets(circuit);
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
      for (const [a, b] of conductivePairs(comp, pressed.has(comp.id))) {
        const best = Math.max(voltage.level(comp.id, a), voltage.level(comp.id, b));
        if (best <= 0) continue;

        for (const pin of [a, b]) {
          if (voltage.level(comp.id, pin) < best) {
            voltage.drive(comp.id, pin, best);
            changed = true;
          }
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
      leds.push({ compId: comp.id, brightness: ledBrightness(circuit, comp, voltage, nets) });
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
 * Má LED v sérii rezistor?
 *
 * Fyzikálně je otázka „je rezistor v proudové smyčce", a ta se dá položit
 * mnohem levněji než hledáním cesty: rezistor je v sérii, když jednou
 * nožičkou sedí ve stejné síti jako anoda nebo katoda LED. Buď je mezi
 * pinem a anodou, nebo mezi katodou a zemí — obojí LED ochrání.
 *
 * Rezistor, který si dítě jen položilo na desku a nezapojilo, je ve
 * vlastní síti a nezapočítá se. To je záměr: kontrola má poznat rozdíl
 * mezi „mám ho" a „použil jsem ho".
 */
function hasSeriesResistor(
  circuit: Circuit,
  led: CircuitComponent,
  anodePin: string,
  nets: NetMap,
): boolean {
  const anodeNet = nets.netOf(pinKey(led.id, anodePin));
  const cathodeNet = nets.netOf(pinKey(led.id, "cathode"));

  for (const comp of circuit.comps) {
    if (comp.type !== "resistor-220") continue;
    for (const pin of getComponentSpec(comp.type).pins) {
      const net = nets.netOf(pinKey(comp.id, pin.name));
      if (net === anodeNet || net === cathodeNet) return true;
    }
  }

  return false;
}

/**
 * Jas LED.
 *
 * Svítí, jen když je na anodě napětí, katoda je na zemi a v sérii je
 * rezistor. Obrácená polarita nesvítí, protože LED je dioda — a to je
 * lekce sama o sobě.
 */
function ledBrightness(
  circuit: Circuit,
  led: CircuitComponent,
  voltage: NetVoltage,
  nets: NetMap,
): number {
  const anodePin = led.type === "led-rgb" ? "r" : "anode";
  const cathodePin = "cathode";

  const level = voltage.level(led.id, anodePin);
  if (level <= 0) return 0;

  if (!voltage.isGround(led.id, cathodePin)) return 0;

  /* Bez rezistoru LED „svítí" jen chvíli a pak je po ní. Místo
     předstírání, že to jde, ji necháme zhasnutou — krok s kontrolou
     zapojení na to dítě upozorní konkrétně.

     Dřív se tu ptalo přes findPath s `through: ["resistor-220", led.type]`.
     Jenže `through` je seznam POVOLENÝCH typů, ne vyžadovaných, takže
     cesta vedoucí rovnou přes samotnou LED prošla — a LED bez rezistoru
     svítila. Přesně ta chyba, kvůli které rezistor v lekci 1 vysvětlujeme. */
  if (!hasSeriesResistor(circuit, led, anodePin, nets)) return 0;

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

/**
 * Strop na počet snímků.
 *
 * Přechod jasu 0→255→0 s delay(5) jich vyrobí přes pět set za jediný
 * průchod. To je v pořádku a chceme to — animace je pak plynulá. Strop
 * je tu proti programu, který by jich chtěl statisíce.
 */
const MAX_FRAMES = 2000;

/**
 * Otisk snímku pro porovnání se sousedem.
 *
 * Čas do něj schválně nepatří: dva snímky se stejným obvodem a jiným
 * časem jsou pro diváka tentýž obrázek.
 */
function frameSignature(frame: SimulationFrame): string {
  const leds = frame.leds.map((l) => `${l.compId}:${l.brightness}`).join(",");
  const buzzers = frame.buzzers.map((b) => `${b.compId}:${b.frequency}`).join(",");
  return `${leds}|${buzzers}|${frame.serial.length}`;
}

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

  const nets = resolveNets(circuit);
  const frames: SimulationFrame[] = [];
  let lastSignature: string | null = null;

  /* Snímek se pořídí, kdykoli uplyne čas — a ještě po každém průchodu
     smyčky, aby nezmizel program, který žádný delay nemá.

     Dva po sobě jdoucí stejné snímky se zahodí: konec smyčky, která končí
     delayem, by jinak pokaždé přidal kopii. Přechody se tím neztratí,
     protože zahazujeme jen to, co se ničím neliší. */
  const snapshot = (): void => {
    if (frames.length >= MAX_FRAMES) return;

    const frame = readFrame(circuit, state, config.inputs, nets);
    const signature = frameSignature(frame);
    if (signature === lastSignature) return;

    lastSignature = signature;
    frames.push(frame);
  };

  const board = createBoard(state, snapshot);
  const interp = new Interpreter(compiled.program!, board);

  try {
    interp.runSetup();
    snapshot();

    const iterations = config.iterations ?? 20;
    for (let i = 0; i < iterations; i++) {
      if (!interp.runLoopOnce()) break;
      snapshot();
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
