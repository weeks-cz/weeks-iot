import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { adoptSession, lessonKey, mergeWithExisting } from "@/features/anon-session/adopt";
import type { AnonLesson } from "@/features/anon-session/schema";

/**
 * Zápis postupu profilu do tabulky `progress`.
 *
 * Jedna cesta pro obě chvíle, kdy se postup ukládá: přenos anonymní relace
 * při registraci a průběžný zápis lekce, kterou dělá přihlášené dítě.
 * Dřív existovala jen ta první, takže všechno, co dítě dokončilo PO
 * registraci, zůstalo jen v prohlížeči — přehled v účtu se zastavil na
 * čísle z registrace a dokončení kurzu se nedalo zjistit.
 *
 * Servisní klient schválně: potřebuje číst tabulku `lessons` včetně
 * nepublikovaných řádků, aby se postup neztratil jen proto, že lekci
 * mezitím někdo skryl. Oprávnění k `childId` proto musí ověřit volající.
 *
 * Vrací, jestli zápis prošel. Volající rozhoduje, co se selháním.
 */
export async function writeLessonProgress(
  childId: string,
  lessons: AnonLesson[],
): Promise<boolean> {
  if (lessons.length === 0) return true;

  const service = createServiceClient();

  const courseSlugs = [...new Set(lessons.map((l) => l.courseSlug))];

  /* Dva dotazy místo jednoho s joinem. Vnořený select `courses!inner(slug)`
     se opírá o metadata vztahů, která ručně psané typy nenesou — a obcházet
     to přetypováním přes `unknown` by znamenalo vypnout kontrolu právě tam,
     kde se rozhoduje, komu se připíše postup. */
  const { data: courses } = await service
    .from("courses")
    .select("id, slug")
    .in("slug", courseSlugs);

  if (!courses?.length) return false;

  const courseSlugById = new Map(courses.map((c) => [c.id, c.slug] as const));

  const { data: lessonRows } = await service
    .from("lessons")
    .select("id, slug, course_id")
    .in("course_id", [...courseSlugById.keys()]);

  if (!lessonRows?.length) return false;

  const lessonIdBySlug = new Map<string, string>();
  for (const row of lessonRows) {
    const courseSlug = courseSlugById.get(row.course_id);
    if (courseSlug) lessonIdBySlug.set(lessonKey(courseSlug, row.slug), row.id);
  }

  const { rows, skipped } = adoptSession({ lessons }, { lessonIdBySlug });
  if (skipped.length > 0) {
    console.warn("[progress] Přeskočené lekce (neexistují):", skipped.join(", "));
  }
  if (rows.length === 0) return skipped.length === 0;

  /* Existující postup se načte kvůli sloučení. Samotný unique index
     duplicitu ošetří, ale nezabrání tomu, aby zastaralý zápis vrátil
     hotovou lekci zpět do stavu „rozdělaná". */
  const { data: existing } = await service
    .from("progress")
    .select("lesson_id, status, started_at, completed_at, duration_s, hints_used")
    .eq("child_id", childId)
    .in("lesson_id", rows.map((r) => r.lesson_id));

  const existingByLesson = new Map(
    (existing ?? []).map((row) => [row.lesson_id, row] as const),
  );

  const merged = rows.map((row) =>
    mergeWithExisting(row, existingByLesson.get(row.lesson_id) ?? null),
  );

  const { error } = await service
    .from("progress")
    .upsert(
      merged.map((row) => ({ ...row, child_id: childId })),
      { onConflict: "child_id,lesson_id" },
    );

  if (error) {
    console.error("[progress] Zápis postupu selhal:", error.message);
    return false;
  }

  return true;
}
