import { silentProgramReason, type SilentReason } from "@/features/arduino/silent-program";
import {
  runProgram,
  shortCircuitInCircuit,
  type PinDiagnostic,
  type SimulationFrame,
} from "@/features/circuit/simulate";
import { checkWiring } from "@/features/circuit/wiring-check";
import type { Circuit } from "@/features/circuit/types";
import type { CheckContext, Lesson, LessonCheck } from "./types";

/**
 * Spuštění kontrol lekce nad obvodem, který dítě postavilo.
 *
 * Jediné místo, kde se to dělá. Testy obsahu i běžící lekce volají tuhle
 * funkci — kdyby měly každá svou, prošla by lekce v testu a v prohlížeči
 * ne, což je ten nejhorší druh chyby.
 */

export interface CheckOutcome {
  label: string;
  passed: boolean;
  /** Nápověda, když bod neprošel. */
  hint: string;
  /** Totéž pro režim bloků, když nápověda diktuje kód. */
  blockHint?: string;
  /** Snímky běhu — z prvního neprošlého bodu se dá ukázat, co se dělo. */
  frames: SimulationFrame[];
}

export interface LessonRunResult {
  /** Chyba překladu nebo běhu. Když je, kontroly se neposuzují. */
  error: { message: string; line: number } | null;
  outcomes: CheckOutcome[];
  /**
   * Proč program mlčí, když neudělal vůbec nic.
   *
   * Ptáme se jen tehdy, když neprošla ani JEDNA kontrola. U programu,
   * kterému něco funguje, by to ukazovalo na komentář, co si dítě schovalo
   * stranou schválně.
   */
  silent: SilentReason | null;
  /**
   * Zkrat v obvodu. Když je, program se vůbec nepouští a kontroly se
   * neposuzují — dítě nemá dostat „splněno" na obvodu, který by se spálil.
   */
  shortCircuit: string | null;
  /**
   * Co program zapsal na pin, aniž byl výstup. Hlášky jsou dvě: režim kódu
   * (ukáže pinMode) a režim bloků (jen jmenuje blok — nediktuje kód).
   */
  diagnostics: PinDiagnosticMessage[];
  /** Prošly všechny body? */
  passed: boolean;
  /** Snímky prvního běhu — do animace obvodu. */
  preview: SimulationFrame[];
}

export interface PinDiagnosticMessage {
  pin: number;
  message: string;
  blockMessage: string;
}

/** Hlášky k diagnostice pinů. Pin je číslo, jak ho dítě vidí v kódu i v blocích. */
export function pinDiagnosticMessage(d: PinDiagnostic): PinDiagnosticMessage {
  if (d.kind === "no-pwm") {
    return {
      pin: d.pin,
      message: `Pin ${d.pin} nemá PWM (vlnovku ~), takže analogWrite na něm umí jen zapnout, nebo vypnout. Plynulý jas dá pin s vlnovkou.`,
      blockMessage: `Pin ${d.pin} nemá PWM (vlnovku ~), takže plynulý jas na něm nepůjde — jen zapnutí a vypnutí.`,
    };
  }
  return {
    pin: d.pin,
    message: `Pin ${d.pin} není nastavený jako výstup — přidej do setup() pinMode(${d.pin}, OUTPUT).`,
    blockMessage: `Pin ${d.pin} není nastavený jako výstup — přidej do „na začátku jednou“ blok „nastav pin ${d.pin} jako výstup“.`,
  };
}

export function runLessonChecks(
  lesson: Lesson,
  circuit: Circuit,
  source: string,
  /**
   * Tlačítka, která dítě právě drží prstem.
   *
   * Kontroly si stisk řídí samy (`check.pressed`), ale náhled běhu se
   * musí chovat podle toho, co dítě dělá — jinak by zmáčknutí tlačítka
   * na desce nemělo žádný viditelný následek.
   */
  held: Set<string> = new Set(),
  /** Hodnoty senzorů podle id součástky — hýbe jimi slider v lekci. */
  sensors: Map<string, number> = new Map(),
): LessonRunResult {
  /* Role se rozdělí jednou. Kontrola zapojení je umí přiřadit i tehdy, když
     zapojení není hotové — a to je záměr: dítě má vidět, jak se jeho obvod
     chová, i než ho dodělá. */
  const wiring = checkWiring(circuit, lesson.wiring);
  const ctx: CheckContext = { comp: (role) => wiring.roles?.[role] ?? null };

  const outcomes: CheckOutcome[] = [];
  let error: LessonRunResult["error"] = null;

  /* Zkrat na napájení se pozná před během — program se nepustí vůbec. */
  const staticShort = shortCircuitInCircuit(circuit);
  if (staticShort) {
    return {
      error: null,
      outcomes: [],
      silent: null,
      shortCircuit: staticShort,
      diagnostics: [],
      passed: false,
      preview: [],
    };
  }

  const diagnostics = new Map<string, PinDiagnosticMessage>();
  const collect = (run: { diagnostics: PinDiagnostic[] }) => {
    for (const d of run.diagnostics) {
      const key = `${d.kind}:${d.pin}`;
      if (!diagnostics.has(key)) diagnostics.set(key, pinDiagnosticMessage(d));
    }
  };

  /* Náhled je samostatný běh: ukazuje, co obvod dělá TEĎ — s tlačítky,
     která dítě drží, a bez umělých vstupů kontrol.

     Dřív se bral z první kontroly, takže v lekci o tlačítku svítila LED
     i s puštěným tlačítkem: první kontrola si stisk nastavuje sama.
     Dítě pak vidělo něco jiného, než co jeho obvod dělá. */
  const previewRun = runProgram(source, circuit, {
    iterations: 20,
    inputs: { pressed: held, analog: sensors },
  });
  const preview = previewRun.frames;
  collect(previewRun);

  let shortCircuit: string | null = previewRun.shortCircuit ?? null;

  /* Kontroly drženou rukou dítěte NEdostávají. Dřív se jim přimíchala,
     a v lekci o bzučáku pak bod „s puštěným tlačítkem je ticho" zhasl
     pokaždé, když dítě tlačítko zmáčklo — kontrola puštěného tlačítka
     běžela se zmáčknutým. Splněno má záviset na programu, ne na tom, co
     zrovna dělá prst. */
  for (const check of lesson.checks) {
    if (shortCircuit) break;
    const run = runProgram(source, circuit, {
      iterations: check.iterations,
      pinInputs: toPinInputs(check),
      inputs: {
        pressed: toPressed(check, ctx),
        analog: toSensors(check, ctx),
      },
    });
    collect(run);

    if (run.shortCircuit) {
      shortCircuit = run.shortCircuit;
      break;
    }

    if (!run.ok) {
      /* Chyba v kódu není „neprošla kontrola". Dítě má slyšet, co je
         špatně na řádku, ne seznam nesplněných bodů. */
      error = run.error ?? { message: "Program se nepodařilo spustit.", line: 1 };
      break;
    }

    outcomes.push({
      label: check.label,
      passed: check.verify(run.frames, ctx),
      hint: check.hint,
      blockHint: check.blockHint,
      frames: run.frames,
    });
  }

  if (shortCircuit) {
    return {
      error: null,
      outcomes: [],
      silent: null,
      shortCircuit,
      diagnostics: [...diagnostics.values()],
      passed: false,
      preview,
    };
  }

  const passed = error === null && outcomes.length > 0 && outcomes.every((o) => o.passed);

  /* Program, který se přeložil a přitom neudělal vůbec nic, byl doteď
     neviditelný třetí stav: dítě dostalo nápovědu „napiš digitalWrite(led,
     HIGH)" ve chvíli, kdy tu větu mělo zakomentovanou na obrazovce před
     sebou. */
  const nothingWorks = error === null && outcomes.length > 0 && outcomes.every((o) => !o.passed);

  return {
    error,
    outcomes,
    silent: nothingWorks ? silentProgramReason(source, lesson.starterCode) : null,
    shortCircuit: null,
    diagnostics: [...diagnostics.values()],
    passed,
    preview,
  };
}

function toPinInputs(check: LessonCheck): Map<number, number> {
  return new Map(
    Object.entries(check.pinInputs ?? {}).map(([pin, value]) => [Number(pin), value]),
  );
}

/** Hodnoty senzorů z kontroly, přeložené z rolí na id součástek. */
function toSensors(check: LessonCheck, ctx: CheckContext): Map<string, number> {
  const out = new Map<string, number>();
  for (const [role, value] of Object.entries(check.sensors ?? {})) {
    const id = ctx.comp(role);
    if (id) out.set(id, value);
  }
  return out;
}

/** Role stisknutých tlačítek na id skutečných součástek. */
function toPressed(check: LessonCheck, ctx: CheckContext): Set<string> {
  const ids = new Set<string>();
  for (const role of check.pressed ?? []) {
    const id = ctx.comp(role);
    if (id) ids.add(id);
  }
  return ids;
}
