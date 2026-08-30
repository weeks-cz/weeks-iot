import { silentProgramReason, type SilentReason } from "@/features/arduino/silent-program";
import { runProgram, type SimulationFrame } from "@/features/circuit/simulate";
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
  /** Prošly všechny body? */
  passed: boolean;
  /** Snímky prvního běhu — do animace obvodu. */
  preview: SimulationFrame[];
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
): LessonRunResult {
  /* Role se rozdělí jednou. Kontrola zapojení je umí přiřadit i tehdy, když
     zapojení není hotové — a to je záměr: dítě má vidět, jak se jeho obvod
     chová, i než ho dodělá. */
  const wiring = checkWiring(circuit, lesson.wiring);
  const ctx: CheckContext = { comp: (role) => wiring.roles?.[role] ?? null };

  const outcomes: CheckOutcome[] = [];
  let error: LessonRunResult["error"] = null;

  /* Náhled je samostatný běh: ukazuje, co obvod dělá TEĎ — s tlačítky,
     která dítě drží, a bez umělých vstupů kontrol.

     Dřív se bral z první kontroly, takže v lekci o tlačítku svítila LED
     i s puštěným tlačítkem: první kontrola si stisk nastavuje sama.
     Dítě pak vidělo něco jiného, než co jeho obvod dělá. */
  const previewRun = runProgram(source, circuit, {
    iterations: 20,
    inputs: { pressed: held },
  });
  const preview = previewRun.frames;

  for (const check of lesson.checks) {
    const run = runProgram(source, circuit, {
      iterations: check.iterations,
      pinInputs: toPinInputs(check),
      inputs: { pressed: new Set([...toPressed(check, ctx), ...held]) },
    });

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
      frames: run.frames,
    });
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
    passed,
    preview,
  };
}

function toPinInputs(check: LessonCheck): Map<number, number> {
  return new Map(
    Object.entries(check.pinInputs ?? {}).map(([pin, value]) => [Number(pin), value]),
  );
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
