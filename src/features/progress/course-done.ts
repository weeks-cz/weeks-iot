/**
 * Co je po vyřešení lekce hotové a jaká oslava z toho plyne.
 *
 * Čistá logika bez Reactu. `LessonRunner` podle ní rozhoduje mezi finále
 * kurzu a malou oslavou a posílá `course_complete` — obojí ze stejné
 * množiny, ať stav a měření neříkají každý něco jiného.
 *
 * ── Proč se relace prohlížeče u dítěte nepočítá ────────────────────────────
 * Anonymní relace (localStorage) patří PROHLÍŽEČI, ne dítěti: zapisuje se
 * do ní každé dokončení, přihlášený nebo ne. Na rodinném notebooku v ní
 * jsou lekce sourozence nebo lekce z doby, kdy rodič neměl vybraný profil.
 * Kdyby se přimíchaly k postupu dítěte z účtu, dostalo by finále za cizí
 * lekce a „Stáhnout certifikát" by vedl na 404 — certifikát se počítá jen
 * z postupu na serveru. U anonyma a u rodiče bez profilu je relace naopak
 * jediný zdroj, takže se počítá.
 */

import { isCourseDone } from "@/features/lobby/model";

export interface DoneAfterInput {
  /** Lekce hotové na serveru u aktivního profilu; u anonyma prázdné. */
  completedSlugs: readonly string[];
  /** Hotové lekce kurzu z anonymní relace prohlížeče. */
  sessionDoneSlugs: readonly string[];
  /** Právě vyřešená lekce. */
  lessonSlug: string;
  /** Přihlášený s aktivním profilem dítěte — postup drží server. */
  profileBacked: boolean;
}

/** Hotové lekce kurzu po vyřešení téhle. */
export function lessonsDoneAfter({
  completedSlugs,
  sessionDoneSlugs,
  lessonSlug,
  profileBacked,
}: DoneAfterInput): Set<string> {
  return new Set([
    ...completedSlugs,
    ...(profileBacked ? [] : sessionDoneSlugs),
    lessonSlug,
  ]);
}

/**
 * Finále jen když je po téhle lekci hotový CELÝ kurz (stejné pravidlo jako
 * certifikát), ne „nemám kam dál": kdo skočil rovnou na poslední lekci,
 * dostane malou oslavu s tím, kolik mu chybí.
 */
export function celebrationAfter(
  publishedSlugs: readonly string[],
  done: ReadonlySet<string>,
): "finale" | "lesson" {
  return isCourseDone(publishedSlugs, done) ? "finale" : "lesson";
}
