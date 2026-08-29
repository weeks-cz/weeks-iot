import { PITCH } from "@/features/circuit/constants";
import type { Circuit } from "@/features/circuit/types";
import type { Lesson } from "./types";

/**
 * Obvod, se kterým lekce začíná.
 *
 * Arduino je tam vždycky — je to deska, ne součástka, a nutit dítě
 * přetáhnout ji z palety by byl zbytečný krok navíc. Breadboard přibude
 * jen tam, kde ho lekce nabízí; od čtvrté lekce se totiž bez něj zapojení
 * tří LED mění v klubko drátů.
 *
 * Nic dalšího. Kdyby se předpřipravilo víc, dítě by lekci „dokončilo" tím,
 * že nic neudělá.
 */
export function lessonSeedCircuit(lesson: Lesson): Circuit {
  const comps: Circuit["comps"] = [];

  if (lesson.palette.includes("breadboard-half")) {
    comps.push({
      id: crypto.randomUUID(),
      type: "breadboard-half",
      x: 2 * PITCH,
      y: 2 * PITCH,
      rotation: 0,
    });
  }

  comps.push({
    id: crypto.randomUUID(),
    type: "arduino-uno",
    /* Pod breadboardem, když tam je; jinak nahoře. */
    x: 2 * PITCH,
    y: comps.length > 0 ? 19 * PITCH : 2 * PITCH,
    rotation: 0,
  });

  return { comps, wires: [] };
}
