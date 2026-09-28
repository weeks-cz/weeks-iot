/**
 * Kdy má dítě nárok na certifikát.
 *
 * Když má hotovou KAŽDOU publikovanou lekci kurzu — ne když dojde na
 * poslední. Kdo přeskočí rovnou na noční světlo, kurz nedokončil (stejné
 * pravidlo jako u události `course_complete`).
 *
 * Datum na certifikátu je poslední dokončení, ne den vystavení: certifikát
 * vystavený při registraci dítěti, které kurz prošlo před týdnem, má nést
 * den, kdy to zvládlo.
 */

export interface CourseLessonRef {
  id: string;
  slug: string;
}

export interface Completion {
  lessonId: string;
  completedAt: string;
}

export function earnedCertificate(
  lessons: readonly CourseLessonRef[],
  completions: readonly Completion[],
): { completedAt: string } | null {
  if (lessons.length === 0) return null;

  const doneAt = new Map(completions.map((c) => [c.lessonId, c.completedAt]));
  let last: string | null = null;

  for (const lesson of lessons) {
    const at = doneAt.get(lesson.id);
    if (!at) return null;
    if (!last || Date.parse(at) > Date.parse(last)) last = at;
  }

  return last ? { completedAt: last } : null;
}

/**
 * Klíč v `email_log`. Unikátní (parent_id, step) z migrace 008 tak hlídá,
 * že certifikát odejde jednou — i kdyby se dokončení zapsalo dvakrát.
 */
export function certificateStep(courseSlug: string, childId: string): string {
  return `certificate:${courseSlug}:${childId}`;
}
