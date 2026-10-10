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

/**
 * Piny Uno s PWM (vlnovka `~`). Na ostatních se analogWrite chová jako
 * vypínač: od 128 výš zapne, jinak vypne.
 */
export const PWM_PINS: ReadonlySet<number> = new Set([3, 5, 6, 9, 10, 11]);

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
  /**
   * Piny, do kterých program zapsal digitalWrite, aniž je nastavil jako
   * výstup. Skutečná deska na nich nic nezapne — kid dostane vysvětlení.
   */
  unsetWrites: Set<number>;
  /** Konec tónu (ms virtuálního času) u tónů s délkou. Bez konce tón zní pořád. */
  toneEnds: Map<number, number>;
  /** Piny bez PWM, na které program psal analogWrite. */
  noPwmWrites: Set<number>;
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
    unsetWrites: new Set(),
    toneEnds: new Map(),
    noPwmWrites: new Set(),
  };
}

/**
 * Deska, která si jen pamatuje stav.
 *
 * `delay` neusíná doopravdy — jen posune virtuální čas. Kdyby čekal
 * skutečně, blikání se sekundovou pauzou by v prohlížeči zamrzlo, a hlavně
 * by nešlo spočítat, co se stane za deset sekund, aniž bys deset sekund
 * čekal.
 *
 * `onTimePasses` se ozve pokaždé, když začne pauza — PŘED posunem času.
 * Tam si simulace bere snímek obvodu: stav, který v tu chvíli platí, drží
 * celou pauzu. „Být vidět" znamená „chvíli trvat".
 */
export function createBoard(state: BoardState, onTimePasses?: () => void): Board {
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
      if (state.modes.get(pin) !== "output") state.unsetWrites.add(pin);
      state.outputs.set(pin, value > 0 ? 255 : 0);
    },

    digitalRead(pin) {
      const v = readPin(pin);
      return v > 512 || v === HIGH ? HIGH : LOW;
    },

    analogWrite(pin, value) {
      /* Jako na skutečné desce: analogWrite přepne pin na výstup sám. */
      state.modes.set(pin, "output");
      const v = Math.max(0, Math.min(255, Math.round(value)));
      if (PWM_PINS.has(pin)) {
        state.outputs.set(pin, v);
      } else {
        /* Bez PWM je to jen vypínač. Dítě to má vědět — diagnostika to řekne. */
        state.noPwmWrites.add(pin);
        state.outputs.set(pin, v >= 128 ? 255 : 0);
      }
    },

    analogRead(pin) {
      const v = state.inputs.get(pin);
      return v === undefined ? 0 : Math.max(0, Math.min(1023, Math.round(v)));
    },

    delay(ms) {
      /* Snímek se pořizuje PŘED posunem času: stav, který stojí na pinech
         teď, drží právě tenhle delay. Kdyby se pořídil až po něm, každý
         stav by se ukázal o jednu pauzu později a blikání by se obrátilo. */
      onTimePasses?.();
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

    tone(pin, frequency, duration) {
      /* tone() také přepne pin na výstup. */
      state.modes.set(pin, "output");
      state.tones.set(pin, frequency);
      if (duration === undefined) state.toneEnds.delete(pin);
      else state.toneEnds.set(pin, state.elapsedMs + Math.max(0, duration));
    },

    noTone(pin) {
      state.tones.delete(pin);
      state.toneEnds.delete(pin);
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
