import type { ComponentType } from "@/features/circuit/types";
import type { SimulationFrame } from "@/features/circuit/simulate";
import type { WiringSpec } from "@/features/circuit/wiring-check";

/**
 * Tvar lekce.
 *
 * ── Proč se kontroluje chování, a ne text kódu ─────────────────────────────
 * Původní kontrola porovnávala kód dítěte se vzory — u nočního světla
 * dokonce vyžadovala proměnnou pojmenovanou přesně `svetlo` a hranici
 * `< 400`. To znamená, že projde jediné řešení: to naše. Kdo napsal
 * `if (hodnota < 350)`, dostal „chybí porovnání", přestože jeho program
 * funguje líp.
 *
 * S emulátorem to není potřeba. Program se pustí a zkontroluje se, CO DĚLÁ:
 * když senzor hlásí tmu, svítí LED? Když světlo, zhasne? Projde každé
 * řešení, které funguje — a to je rozdíl mezi učením a opisováním.
 *
 * Vzory z `strict-rules.ts` zůstávají, ale jen jako zdroj NÁPOVĚDY, když
 * se dítě zasekne. Verdikt dávají chování.
 */

export interface LessonCheck {
  /** Co se zkouší. Dítě to uvidí jako řádek v seznamu. */
  label: string;
  /** Co mají číst vstupní piny během běhu. */
  pinInputs?: Record<number, number>;
  /** Které tlačítko je při běhu stisknuté. Role z `wiring.parts`. */
  pressed?: string[];
  /** Kolik průchodů `loop()` spočítat, než se výsledek posoudí. */
  iterations?: number;
  /**
   * Posouzení snímků.
   *
   * Dostane všechny snímky běhu, ne jen poslední — u blikání je otázka
   * „změnilo se to někdy?", ne „jak to skončilo?".
   */
  verify: (frames: SimulationFrame[]) => boolean;
  /** Co dítě uvidí, když tenhle bod neprojde. */
  hint: string;
}

export interface Lesson {
  slug: string;
  /** Pořadí v kurzu, od 1. */
  order: number;
  title: string;
  /** Jedna věta, co se dítě naučí. Ne co udělá — co se naučí. */
  goal: string;
  /** Odhad v minutách. */
  minutes: number;

  /** Zadání. Krátké odstavce, žádná zeď textu. */
  brief: string[];
  /** Nová věc, kterou lekce zavádí. Vysvětlená jednou a pořádně. */
  concept: { title: string; body: string } | null;

  /** Součástky, které se v téhle lekci nabízejí v paletě. */
  palette: ComponentType[];
  wiring: WiringSpec;
  /** Nápověda ke kroku se zapojováním, když si dítě neví rady. */
  wiringHints: string[];

  /** Kód, se kterým lekce začíná. Nikdy prázdný — prázdno je paralyzující. */
  starterCode: string;
  /** Nápovědy ke kódu, odkrývané po jedné. */
  codeHints: string[];
  /** Referenční řešení. Ukáže se až po dokončení, nebo na vyžádání. */
  solution: string;

  checks: LessonCheck[];

  /** Reference na obrázek v /public/task-images, když existuje. */
  imageKey?: string;
  /** Původní id úlohy v legacy tasks.ts — pro dohledání souvislostí. */
  legacyTaskId: string;
}

/* ── Pomocníci pro psaní kontrol ────────────────────────────────────────── */

/** Svítila LED s danou rolí aspoň v jednom snímku? */
export function ledEverOn(frames: SimulationFrame[], index = 0): boolean {
  return frames.some((f) => (f.leds[index]?.brightness ?? 0) > 0);
}

/** Zůstala LED zhasnutá po celou dobu? */
export function ledNeverOn(frames: SimulationFrame[], index = 0): boolean {
  return frames.every((f) => (f.leds[index]?.brightness ?? 0) === 0);
}

/** Změnil se stav LED v průběhu — tedy bliká? */
export function ledBlinked(frames: SimulationFrame[], index = 0): boolean {
  const states = frames.map((f) => (f.leds[index]?.brightness ?? 0) > 0);
  return states.some((s) => s) && states.some((s) => !s);
}

/** Nabyl jas víc než dvou různých hodnot? Poznávací znamení PWM. */
export function ledFaded(frames: SimulationFrame[], index = 0): boolean {
  const levels = new Set(frames.map((f) => f.leds[index]?.brightness ?? 0));
  levels.delete(0);
  return levels.size >= 3;
}

/** Rozezněl se bzučák? */
export function buzzerSounded(frames: SimulationFrame[]): boolean {
  return frames.some((f) => f.buzzers.some((b) => b.frequency > 0));
}

/** Objevilo se v sériovém monitoru něco? */
export function serialHasOutput(frames: SimulationFrame[]): boolean {
  return frames.some((f) => f.serial.join("").trim().length > 0);
}

/** Vypsal program hodnotu, která se v průběhu měnila? */
export function serialChanged(frames: SimulationFrame[]): boolean {
  const lines = frames.at(-1)?.serial ?? [];
  const values = lines.map((l) => l.trim()).filter(Boolean);
  return new Set(values).size >= 2;
}
