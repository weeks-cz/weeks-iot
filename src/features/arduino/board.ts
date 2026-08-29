/**
 * Deska, na které program běží.
 *
 * Interpret sem sahá přes úzké rozhraní — `pinMode`, `digitalWrite`,
 * `digitalRead`… — a nic neví o obvodu. Díky tomu jde interpret otestovat
 * proti falešné desce a obvod proti falešnému programu; kdyby si sahaly
 * do sebe, nešlo by ani jedno.
 */

export type PinMode = "input" | "output" | "input_pullup" | "unset";

/** Digitální úroveň. Analogové čtení vrací 0–1023, zápis 0–255. */
export const HIGH = 1;
export const LOW = 0;

export interface SerialLine {
  text: string;
  /** Kolik milisekund běhu uplynulo, když se řádek vypsal. */
  atMs: number;
}

export interface Board {
  pinMode(pin: number, mode: PinMode): void;
  digitalWrite(pin: number, value: number): void;
  digitalRead(pin: number): number;
  analogWrite(pin: number, value: number): void;
  analogRead(pin: number): number;
  delay(ms: number): void;
  millis(): number;
  serialBegin(baud: number): void;
  serialPrint(text: string): void;
  serialPrintln(text: string): void;
  tone(pin: number, frequency: number, duration?: number): void;
  noTone(pin: number): void;
}

export interface BoardState {
  modes: Map<number, PinMode>;
  /** Co program zapsal. 0–255; digitalWrite(HIGH) je 255. */
  outputs: Map<number, number>;
  /** Co má program přečíst — plní ho obvod, ne interpret. */
  inputs: Map<number, number>;
  serial: SerialLine[];
  serialBaud: number | null;
  /** Piny, na kterých zní tón, a jejich frekvence. */
  tones: Map<number, number>;
  elapsedMs: number;
}

export function emptyBoardState(): BoardState {
  return {
    modes: new Map(),
    outputs: new Map(),
    inputs: new Map(),
    serial: [],
    serialBaud: null,
    tones: new Map(),
    elapsedMs: 0,
  };
}

/**
 * Deska, která si jen pamatuje stav.
 *
 * `delay` neusíná doopravdy — jen posune virtuální čas. Kdyby čekal
 * skutečně, blikání se sekundovou pauzou by v prohlížeči zamrzlo, a hlavně
 * by nešlo spočítat, co se stane za deset sekund, aniž bys deset sekund
 * čekal.
 */
export function createBoard(state: BoardState): Board {
  const readPin = (pin: number): number => {
    const mode = state.modes.get(pin) ?? "unset";
    const external = state.inputs.get(pin);

    if (external !== undefined) return external;

    /* INPUT_PULLUP drží pin nahoře, dokud ho něco nestáhne k zemi.
       Bez toho by tlačítko zapojené „na pullup" četlo náhodu. */
    if (mode === "input_pullup") return HIGH;
    return LOW;
  };

  return {
    pinMode(pin, mode) {
      state.modes.set(pin, mode);
    },

    digitalWrite(pin, value) {
      state.outputs.set(pin, value > 0 ? 255 : 0);
    },

    digitalRead(pin) {
      const v = readPin(pin);
      return v > 512 || v === HIGH ? HIGH : LOW;
    },

    analogWrite(pin, value) {
      state.outputs.set(pin, Math.max(0, Math.min(255, Math.round(value))));
    },

    analogRead(pin) {
      const v = state.inputs.get(pin);
      return v === undefined ? 0 : Math.max(0, Math.min(1023, Math.round(v)));
    },

    delay(ms) {
      state.elapsedMs += Math.max(0, ms);
    },

    millis() {
      return state.elapsedMs;
    },

    serialBegin(baud) {
      state.serialBaud = baud;
    },

    serialPrint(text) {
      const last = state.serial[state.serial.length - 1];
      /* print bez ln pokračuje na témže řádku — jinak by se výpis
         rozpadl na hromadu jednopísmenných řádků. */
      if (last && !last.text.endsWith("\n")) {
        last.text += text;
        return;
      }
      state.serial.push({ text, atMs: state.elapsedMs });
    },

    serialPrintln(text) {
      const last = state.serial[state.serial.length - 1];
      if (last && !last.text.endsWith("\n")) {
        last.text += `${text}\n`;
        return;
      }
      state.serial.push({ text: `${text}\n`, atMs: state.elapsedMs });
    },

    tone(pin, frequency) {
      state.tones.set(pin, frequency);
    },

    noTone(pin) {
      state.tones.delete(pin);
    },
  };
}

/** Číslo pinu z `A0`–`A5` nebo z čísla. Vrací `null`, když to pin není. */
export function resolvePinNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const m = /^A([0-5])$/i.exec(value.trim());
    /* Analogové piny jsou na Uno číslované od 14 výš — A0 = 14. */
    if (m) return 14 + Number(m[1]);
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }

  return null;
}
