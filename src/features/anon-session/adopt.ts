import type { AnonLesson, AnonSession } from "./schema";

/**
 * Převod anonymního postupu na řádky tabulky `progress`.
 *
 * Krok 6 z M2: „Postup z kroku 3 se přenese do účtu. Nic se neztratí."
 *
 * Všechno, co sem přichází, napsal prohlížeč. Časy proto nejsou fakt, ale
 * tvrzení — přijímají se, ale ořezávají na to, co dává smysl. Slugy se
 * překládají na ID přes mapu ze serveru; kdyby ID posílal klient, mohl by
 * si připsat postup u cizí lekce.
 *
 * Funkce je čistá schválně: jde ji otestovat bez databáze, a právě tady
 * se rozhoduje o tom, jestli přenos něco ztratí nebo zdvojí.
 */

export interface ProgressUpsert {
  lesson_id: string;
  status: "started" | "completed";
  started_at: string;
  completed_at: string | null;
  duration_s: number | null;
  hints_used: number;
}

export interface AdoptOptions {
  /** `${courseSlug}/${lessonSlug}` → lesson_id. Sestavuje server z databáze. */
  lessonIdBySlug: ReadonlyMap<string, string>;
  now?: Date;
}

export interface AdoptResult {
  rows: ProgressUpsert[];
  /** Lekce, které v databázi neexistují nebo nejsou publikované. */
  skipped: string[];
}

/** Nejdřívější čas, který ještě bereme vážně. Starší = podvržený nebo rozbitý. */
const EARLIEST_PLAUSIBLE = Date.parse("2026-01-01T00:00:00Z");

export function lessonKey(courseSlug: string, lessonSlug: string): string {
  return `${courseSlug}/${lessonSlug}`;
}

/**
 * Ořezání času na rozumné okno.
 *
 * Hodiny v prohlížeči jsou často posunuté a dají se přenastavit schválně.
 * Čas v budoucnosti nebo v roce 1970 by rozbil kohortní dotazy, na kterých
 * stojí brána 1 — proto se nahrazuje časem serveru.
 */
function clampTimestamp(value: string | undefined, now: Date): string | null {
  if (!value) return null;

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < EARLIEST_PLAUSIBLE) return null;
  if (parsed > now.getTime()) return now.toISOString();

  return new Date(parsed).toISOString();
}

/**
 * Která ze dvou položek téže lekce je „úplnější".
 *
 * Relace může nést lekci vícekrát — dítě ji zkusilo, opustilo a vrátilo se.
 * Bere se dokončená před nedokončenou, u dvou dokončených ta dřívější
 * (první dokončení je to, co metrika brány měří).
 */
function isMoreComplete(candidate: AnonLesson, current: AnonLesson): boolean {
  const candidateDone = Boolean(candidate.completedAt);
  const currentDone = Boolean(current.completedAt);

  if (candidateDone !== currentDone) return candidateDone;

  if (candidateDone && currentDone) {
    return Date.parse(candidate.completedAt!) < Date.parse(current.completedAt!);
  }

  return Date.parse(candidate.startedAt) < Date.parse(current.startedAt);
}

export function adoptSession(session: AnonSession, options: AdoptOptions): AdoptResult {
  const now = options.now ?? new Date();

  /* Nejdřív sloučit duplicity, teprve pak převádět. Kdyby se převádělo
     rovnou, vznikly by dva řádky pro jednu lekci a upsert by si přepsal
     vlastní zápis — přenos by pak závisel na pořadí v poli. */
  const best = new Map<string, AnonLesson>();
  for (const lesson of session.lessons) {
    const key = lessonKey(lesson.courseSlug, lesson.lessonSlug);
    const current = best.get(key);
    if (!current || isMoreComplete(lesson, current)) {
      best.set(key, lesson);
    }
  }

  const rows: ProgressUpsert[] = [];
  const skipped: string[] = [];

  for (const [key, lesson] of best) {
    const lessonId = options.lessonIdBySlug.get(key);
    if (!lessonId) {
      skipped.push(key);
      continue;
    }

    const startedAt = clampTimestamp(lesson.startedAt, now) ?? now.toISOString();
    let completedAt = clampTimestamp(lesson.completedAt, now);

    /* Dokončení před začátkem nedává smysl — zahodí se celé, ne že se
       posune. Radši lekce vedená jako rozdělaná než falešné dokončení
       v čitateli metriky brány. */
    if (completedAt && Date.parse(completedAt) < Date.parse(startedAt)) {
      completedAt = null;
    }

    const duration =
      typeof lesson.durationS === "number" && lesson.durationS >= 0
        ? Math.min(lesson.durationS, 86_400)
        : null;

    rows.push({
      lesson_id: lessonId,
      status: completedAt ? "completed" : "started",
      started_at: startedAt,
      completed_at: completedAt,
      duration_s: duration,
      hints_used: Math.max(0, Math.min(lesson.hintsUsed ?? 0, 1000)),
    });
  }

  return { rows, skipped };
}

/**
 * Sloučení s tím, co už dítě v účtu má.
 *
 * Přenos musí být idempotentní: dvojí odeslání nesmí zdvojit postup ani
 * přepsat dřívější dokončení pozdějším. Unikátní dvojice (dítě, lekce)
 * v databázi zabrání duplicitě; tahle funkce hlídá tu druhou půlku —
 * že se hotová lekce nevrátí do stavu „rozdělaná".
 */
export function mergeWithExisting(
  incoming: ProgressUpsert,
  existing: Pick<ProgressUpsert, "status" | "started_at" | "completed_at"> | null,
): ProgressUpsert {
  if (!existing) return incoming;

  const startedAt =
    Date.parse(existing.started_at) <= Date.parse(incoming.started_at)
      ? existing.started_at
      : incoming.started_at;

  const completedCandidates = [existing.completed_at, incoming.completed_at].filter(
    (v): v is string => Boolean(v),
  );
  const completedAt =
    completedCandidates.length > 0
      ? completedCandidates.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b))
      : null;

  return {
    ...incoming,
    started_at: startedAt,
    completed_at: completedAt,
    status: completedAt ? "completed" : "started",
  };
}
