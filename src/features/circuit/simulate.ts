import { createBoard, emptyBoardState, type BoardState } from "@/features/arduino/board";
import { Interpreter, RuntimeError, compile } from "@/features/arduino/interpreter";
import { getComponentSpec } from "./components";
import { pinKey, resolveNets, type NetMap } from "./nets";
import type { Circuit, CircuitComponent, ComponentType } from "./types";

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
  /** Kdy stav začal, v ms virtuálního času. */
  elapsedMs: number;
  /**
   * Jak dlouho stav trvá, než přijde další snímek. Nastaví `runProgram`; u
   * snímků z jiného zdroje (testy) může chybět — přehrávač pak bere rozdíl
   * k dalšímu snímku.
   */
  durationMs?: number;
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
      /* Pin řídí obvod jen jako výstup. Zapsaná hodnota bez pinMode
         OUTPUT zůstane v paměti, ale do drátu nejde — stejně jako na
         skutečné desce, kde se to projeví jen jako zhasnutá LED. */
      if (board.modes.get(number) !== "output") continue;
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

/**
 * Sítě, ze kterých se dá dostat na zem — se započtením stisku.
 *
 * Šíří se jen dvojicemi pinů, které opravdu vedou proud. Nezmáčknuté
 * tlačítko svoje dvě poloviny nespojuje, takže se přes ně zem nedostane.
 */
function groundedNets(
  circuit: Circuit,
  nets: NetMap,
  pressed: Set<string>,
): Set<string> {
  const uno = circuit.comps.find((c) => c.type === "arduino-uno");
  const found = new Set<string>();
  if (!uno) return found;

  const spec = getComponentSpec("arduino-uno");
  const queue: string[] = [];

  for (const g of GROUND_PINS) {
    if (!spec.pins.some((p) => p.name === g)) continue;
    const net = nets.netOf(pinKey(uno.id, g));
    if (found.has(net)) continue;
    found.add(net);
    queue.push(net);
  }

  while (queue.length > 0) {
    const net = queue.shift()!;

    for (const comp of circuit.comps) {
      for (const [a, b] of conductivePairs(comp, pressed.has(comp.id))) {
        const netA = nets.netOf(pinKey(comp.id, a));
        const netB = nets.netOf(pinKey(comp.id, b));

        const other = netA === net ? netB : netB === net ? netA : null;
        if (other === null || found.has(other)) continue;

        found.add(other);
        queue.push(other);
      }
    }
  }

  return found;
}

/**
 * Co přečtou vstupní piny z OBVODU.
 *
 * ── Co tím opravujeme ──────────────────────────────────────────────────────
 * Vstupy se dosud braly jen z konfigurace — kontrola lekce si nastavila
 * „na pinu 7 je nula" a hotovo. Jenže pak tlačítko v obvodu nedělalo nic:
 * dítě si ho v lekci o tlačítku nemohlo zmáčknout a zjistit, co se stane.
 * Program musí číst tentýž obvod, který dítě postavilo, jinak je zapojení
 * tlačítka dekorace.
 *
 * Pin je LOW, když ho něco stahuje k zemi — typicky zmáčknuté tlačítko.
 * HIGH, když na něm sedí napětí. Jinak platí, co drží pinMode: INPUT_PULLUP
 * si pin sám drží nahoře, holý INPUT visí na nule.
 */
function readInputsFromCircuit(
  circuit: Circuit,
  board: BoardState,
  inputs: SimulationInputs,
): Map<number, number> {
  const values = new Map<number, number>();

  const uno = circuit.comps.find((c) => c.type === "arduino-uno");
  if (!uno) return values;

  const nets = resolveNets(circuit);
  const voltage = new NetVoltage(nets, circuit);
  const pressed = inputs.pressed ?? new Set<string>();

  const spec = getComponentSpec("arduino-uno");
  for (const p of POWER_PINS) {
    if (spec.pins.some((x) => x.name === p)) voltage.drive(uno.id, p, 255);
  }

  /* Napětí projde vodivými součástkami — stejná úvaha jako u snímku. */
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

  /* Zem se počítá znovu a POCTIVĚ: `NetVoltage.isGround` pouští proud
     tlačítkem bez ohledu na stisk, protože jinde je to tak správně (obvod
     s tlačítkem v cestě nemá vypadat rozpojený, dokud ho někdo nedrží).
     Tady je to ale přesně naopak — nezmáčknuté tlačítko nesmí pin stáhnout
     dolů, jinak program čte stisk, který se nestal. */
  const grounded = groundedNets(circuit, nets, pressed);

  for (const pin of spec.pins) {
    const number = arduinoPinNumber(pin.name);
    if (number === null) continue;

    /* Analogový pin se čte bez ohledu na pinMode. Hodnotu dá senzor, který
       je napájený a jeho výstup sedí na tomhle pinu; bez senzoru jde o
       napětí z drátu, jako u digitálního čtení. */
    if (number >= 14) {
      const reading = sensorReading(circuit, uno.id, pin.name, nets, grounded, inputs);
      if (reading !== null) values.set(number, reading);
      else if (voltage.level(uno.id, pin.name) > 0) values.set(number, 1023);
      else values.set(number, 0);
      continue;
    }

    const mode = board.modes.get(number);
    if (mode !== "input" && mode !== "input_pullup") continue;

    if (grounded.has(nets.netOf(pinKey(uno.id, pin.name)))) {
      values.set(number, 0);
    } else if (voltage.level(uno.id, pin.name) > 0) {
      values.set(number, 1023);
    } else if (mode === "input_pullup") {
      values.set(number, 1023);
    }
  }

  return values;
}

/** Co program udělal jinak, než by udělala skutečná deska. */
export interface PinDiagnostic {
  kind: "not-output";
  pin: number;
}

const POWER_MESSAGE = (where: string) =>
  `Zkrat! ${where} je spojené přímo se zemí — ve skutečnosti by se deska mohla poškodit.`;

/** Statický zkrat: napájecí pin je drátem spojený přímo se zemí. */
export function shortCircuitInCircuit(circuit: Circuit): string | null {
  const uno = circuit.comps.find((c) => c.type === "arduino-uno");
  if (!uno) return null;

  const nets = resolveNets(circuit);
  const grounds = new Set(
    GROUND_PINS.map((g) => nets.netOf(pinKey(uno.id, g))),
  );
  const power = POWER_PINS.find((p) => grounds.has(nets.netOf(pinKey(uno.id, p))));
  return power ? POWER_MESSAGE(power) : null;
}

/**
 * Běhový zkrat: výstup v HIGH přímo na zemi, nebo v LOW přímo na 5 V.
 *
 * Počítá se jen z drátů (sítě), ne přes součástky — LED s rezistorem mezi
 * pinem a zemí zkrat není. Vstupní piny se nepočítají: INPUT_PULLUP stažený
 * tlačítkem k zemi je správné zapojení.
 */
function runtimeShortCircuit(
  circuit: Circuit,
  board: BoardState,
  nets: NetMap,
): string | null {
  const uno = circuit.comps.find((c) => c.type === "arduino-uno");
  if (!uno) return null;

  const grounds = new Set(GROUND_PINS.map((g) => nets.netOf(pinKey(uno.id, g))));
  const powers = new Set(POWER_PINS.map((p) => nets.netOf(pinKey(uno.id, p))));

  for (const pin of getComponentSpec("arduino-uno").pins) {
    const number = arduinoPinNumber(pin.name);
    if (number === null || board.modes.get(number) !== "output") continue;

    const net = nets.netOf(pinKey(uno.id, pin.name));
    const high = (board.outputs.get(number) ?? 0) > 0;

    if (high && grounds.has(net)) {
      return `Zkrat! Pin ${number} je nastavený jako výstup a je spojený přímo se zemí — ve skutečnosti by se deska mohla poškodit. Mezi pin a zem patří vždycky součástka, třeba LED s rezistorem.`;
    }
    if (!high && powers.has(net)) {
      return `Zkrat! Pin ${number} je nastavený jako výstup a je spojený přímo s napájením 5 V — ve skutečnosti by se deska mohla poškodit.`;
    }
  }

  return null;
}

/** Vyhodí se z `snapshot`, aby zkrat zastavil běh uprostřed `delay`. */
class ShortCircuitSignal extends Error {}

/** Senzory, které dávají analogový signál: součástka → (signální pin, napájení, zem). */
const SENSOR_PINS: Partial<Record<ComponentType, { signal: string; vcc: string; gnd: string }>> = {
  photoresistor: { signal: "aout", vcc: "vcc", gnd: "gnd" },
  potentiometer: { signal: "signal", vcc: "terminal-a", gnd: "terminal-b" },
};

/**
 * Hodnota senzoru, který je na analogový pin připojený.
 *
 * Senzor čte, jen když je napájený z 5 V a má zem — jinak jeho výstup nic
 * neříká. Hodnota přichází z `inputs.analog` podle id součástky (slider
 * v lekci); když chybí, bere se střed rozsahu.
 */
function sensorReading(
  circuit: Circuit,
  unoId: string,
  analogPin: string,
  nets: NetMap,
  grounded: Set<string>,
  inputs: SimulationInputs,
): number | null {
  const net = nets.netOf(pinKey(unoId, analogPin));
  const fiveVolts = nets.netOf(pinKey(unoId, "5V"));

  for (const comp of circuit.comps) {
    const pins = SENSOR_PINS[comp.type];
    if (!pins) continue;
    if (nets.netOf(pinKey(comp.id, pins.signal)) !== net) continue;

    const powered = nets.netOf(pinKey(comp.id, pins.vcc)) === fiveVolts;
    const earthed = grounded.has(nets.netOf(pinKey(comp.id, pins.gnd)));
    if (!powered || !earthed) return 0;

    const value = inputs.analog?.get(comp.id) ?? 512;
    return Math.max(0, Math.min(1023, Math.round(value)));
  }

  return null;
}

/* ── Celý běh ───────────────────────────────────────────────────────────── */

/**
 * Strop na počet snímků.
 *
 * Přechod jasu 0→255→0 s delay(5) jich vyrobí přes pět set za jeden průchod.
 * Strop je tu proti programu, který by jich chtěl statisíce. Když ho běh
 * překročí, končí se v čase posledního uloženého snímku — přehrávání se
 * zkrátí, ale nezkreslí.
 */
const MAX_FRAMES = 4000;

/**
 * Kolik virtuálního času nejvýš simulovat kvůli smyčce.
 *
 * Smyčka se pouští v reálném čase, takže delší cyklus je delší čekání na
 * opakování. Dvě iterace jsou minimum, aby se opakování vidělo; po minutě
 * virtuálního času další iterace nepřidáváme.
 */
const MAX_CYCLE_MS = 60_000;

/**
 * Otisk vizuálního stavu snímku.
 *
 * Čas ani sériový výpis do něj nepatří: dva snímky se stejným obvodem jsou
 * pro diváka tentýž obrázek. Sériový výpis se k poslednímu snímku připojí
 * zvlášť, aby prostý výpis nezplodil nový snímek.
 */
function visualSignature(frame: SimulationFrame): string {
  const leds = frame.leds.map((l) => `${l.compId}:${l.brightness}`).join(",");
  const buzzers = frame.buzzers.map((b) => `${b.compId}:${b.frequency}`).join(",");
  return `${leds}|${buzzers}`;
}

/**
 * Interní signál: dosáhl se limitu času nebo snímků. Běh se ukončí, nikoli
 * selže — přehrává se to, co už se stihlo.
 */
class RunLimitSignal extends Error {}

export interface RunResult {
  ok: boolean;
  error?: { message: string; line: number };
  /** Zkrat zastavil běh. Věta pro dítě, pojmenuje pin. */
  shortCircuit?: string;
  frames: SimulationFrame[];
  diagnostics: PinDiagnostic[];
}

export interface RunConfig {
  /**
   * Nejvíc průchodů `loop()`. Běh se ale zastaví dřív, jakmile je cyklus
   * dost dlouhý (viz `MAX_CYCLE_MS`), a vždy spočítá aspoň dva průchody.
   */
  iterations?: number;
  inputs?: SimulationInputs;
  /** Hodnoty, které mají číst vstupní piny — z tlačítek a senzorů. */
  pinInputs?: Map<number, number>;
}

/**
 * Přeloží a spustí program nad obvodem.
 *
 * Vrací snímky, ne jeden konečný stav — z nich se poskládá animace a jde
 * z nich poznat, že LED bliká, ne jen že na konci svítí. Každý snímek nese
 * `durationMs`: jak dlouho stav trvá, než přijde další. Poslední snímek
 * drží až do konce simulovaného běhu.
 */
export function runProgram(
  source: string,
  circuit: Circuit,
  config: RunConfig = {},
): RunResult {
  /* Zkrat na napájení se pozná bez programu. Běh se nezačne vůbec — na
     skutečné desce by se do takového obvodu nikdo nepustil. */
  const staticShort = shortCircuitInCircuit(circuit);
  if (staticShort) {
    return { ok: false, shortCircuit: staticShort, frames: [], diagnostics: [] };
  }

  const compiled = compile(source);
  if (!compiled.ok) {
    return { ok: false, error: compiled.error, frames: [], diagnostics: [] };
  }

  const state = emptyBoardState();

  /* Ručně zadané hodnoty mají přednost — kontrola lekce musí umět říct
     „senzor teď hlásí tmu" bez ohledu na to, co je v obvodu. Zbytek se
     dopočítá z obvodu, aby tlačítko doopravdy fungovalo. */
  const forced = config.pinInputs ?? new Map<number, number>();

  const refreshInputs = () => {
    const fromCircuit = readInputsFromCircuit(circuit, state, config.inputs ?? {});
    state.inputs.clear();
    for (const [pin, value] of fromCircuit) state.inputs.set(pin, value);
    for (const [pin, value] of forced) state.inputs.set(pin, value);
  };

  refreshInputs();

  const nets = resolveNets(circuit);
  const frames: SimulationFrame[] = [];

  /* Snímek se pořídí, kdykoli začne pauza, a ještě po každém průchodu
     smyčky — aby nezmizel program, který žádný delay nemá. Stejný vizuální
     stav jako předchozí snímek se nepřidá; jen se k němu připojí aktuální
     sériový výpis. */
  const snapshot = (): void => {
    const short = runtimeShortCircuit(circuit, state, nets);
    if (short) throw new ShortCircuitSignal(short);

    /* Limit času platí i uvnitř jednoho průchodu: `while (true)` s delay
       nikdy neskončí, na skutečném Arduinu taky ne. Simulace se zastaví,
       až je cyklus dost dlouhý, a přehrává se ten úsek. */
    if (state.elapsedMs >= MAX_CYCLE_MS) throw new RunLimitSignal();

    const frame = readFrame(circuit, state, config.inputs, nets);
    const last = frames.at(-1);
    if (last && visualSignature(last) === visualSignature(frame)) {
      last.serial = frame.serial;
      return;
    }

    if (frames.length >= MAX_FRAMES) throw new RunLimitSignal();
    frames.push(frame);
  };

  const board = createBoard(state, snapshot);
  const interp = new Interpreter(compiled.program!, board);

  /* Délka každého snímku se dopočítá až na konci: je to čas do dalšího
     snímku, u posledního čas do konce běhu. */
  const finish = (ok: boolean, extra: Partial<RunResult> = {}): RunResult => {
    const end = state.elapsedMs;
    frames.forEach((frame, i) => {
      frame.durationMs = (frames[i + 1]?.elapsedMs ?? end) - frame.elapsedMs;
    });
    return { ok, frames, diagnostics: diagnostics(), ...extra };
  };

  /* Piny, do kterých se zapisovalo bez pinMode OUTPUT. Hlásí se až na
     konci — dítě se má dozvědět, co udělalo, ne každé jednotlivé zapsání. */
  function diagnostics(): PinDiagnostic[] {
    return [...state.unsetWrites]
      .filter((pin) => state.modes.get(pin) !== "output")
      .sort((a, b) => a - b)
      .map((pin) => ({ kind: "not-output" as const, pin }));
  }

  try {
    interp.runSetup();
    snapshot();

    /* Po setupu se ví, které piny jsou vstupy — teprve teď se dá jejich
       stav z obvodu přečíst. */
    refreshInputs();

    const maxIterations = config.iterations ?? 20;
    const minIterations = Math.min(2, maxIterations);
    let count = 0;
    while (
      count < maxIterations &&
      (count < minIterations || state.elapsedMs < MAX_CYCLE_MS)
    ) {
      if (!interp.runLoopOnce()) break;
      count += 1;
      snapshot();
    }
  } catch (e) {
    if (e instanceof RunLimitSignal) {
      /* Limit: běh končí tady. Stav na pinech se od posledního snímku
         změnil, takže ten poslední drží až do teď. */
      return finish(true);
    }
    if (e instanceof ShortCircuitSignal) {
      return finish(false, { shortCircuit: e.message });
    }
    if (e instanceof RuntimeError) {
      return finish(false, { error: { message: e.message, line: e.line } });
    }
    return finish(false, {
      error: { message: "Program se zasekl. Zkontroluj smyčky a delay.", line: 1 },
    });
  }

  return finish(true);
}
