import type { Lesson } from "../types";
import { lesson1 } from "./01-rozsvit-ledku";
import { lesson2 } from "./02-blikani";
import { lesson3 } from "./03-tlacitko";
import { lesson4 } from "./04-semafor";
import { lesson5 } from "./05-plynuly-jas";
import { lesson6 } from "./06-zvuk";
import { lesson7 } from "./07-nocni-svetlo";

/**
 * Kurz 1 — Elektronika a IoT.
 *
 * Sedm lekcí, každá jedna nová myšlenka. Pořadí není podle obtížnosti
 * součástek, ale podle toho, na čem staví další:
 *
 *   1. výstup      — program něco ovládá
 *   2. čas         — loop se opakuje, delay je pauza
 *   3. vstup       — program se ptá a rozhoduje
 *   4. pořadí      — na posloupnosti kroků záleží
 *   5. rozsah      — mezi zapnuto a vypnuto je 256 stupňů, a smyčka je projede
 *   6. jiný smysl  — výstup, který je slyšet
 *   7. projekt     — všechno dohromady, a jde to ukázat
 *
 * Noční světlo je poslední schválně. Původní osnova končila logickými
 * operátory „A / NEBO" — správně nejtěžší, ale nedá se tím chlubit.
 * Závěrečný projekt má být věc, kterou dítě přinese ukázat: zakryješ
 * senzor rukou a ono se rozsvítí.
 */
export const COURSE_LESSONS: Lesson[] = [
  lesson1,
  lesson2,
  lesson3,
  lesson4,
  lesson5,
  lesson6,
  lesson7,
];

export function lessonBySlug(slug: string): Lesson | null {
  return COURSE_LESSONS.find((l) => l.slug === slug) ?? null;
}

export function lessonByOrder(order: number): Lesson | null {
  return COURSE_LESSONS.find((l) => l.order === order) ?? null;
}

export { lesson1, lesson2, lesson3, lesson4, lesson5, lesson6, lesson7 };
