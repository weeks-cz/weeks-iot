import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { toStoredData, type LessonBuild } from "./schema";

/**
 * Uloží výtvor dítěte k lekci do `projects` (kind `circuit`).
 *
 * Jeden výtvor na dítě a lekci, ale tabulka na to nemá unikátní index
 * a migrace se kvůli tomu nepřidává. Proto nejdřív UPDATE (trigger
 * `projects_touch` sám obnoví `updated_at`) a teprve když nezasáhl nic,
 * INSERT. Souběh dvou prvních zápisů může teoreticky založit dva řádky;
 * čtení (`childBuilds`) bere nejnovější.
 *
 * Servisní klient, takže oprávnění k `childId` ověřuje volající.
 * Vrací, jestli zápis prošel; neexistující lekce je `false`, ne výjimka.
 */
export async function writeLessonBuild(childId: string, build: LessonBuild): Promise<boolean> {
  const service = createServiceClient();

  const { data: course } = await service
    .from("courses")
    .select("id")
    .eq("slug", build.courseSlug)
    .maybeSingle();
  if (!course) return false;

  const { data: lesson } = await service
    .from("lessons")
    .select("id, title")
    .eq("course_id", course.id)
    .eq("slug", build.lessonSlug)
    .maybeSingle();
  if (!lesson) return false;

  const data = toStoredData(build);

  const { data: updated, error: updateError } = await service
    .from("projects")
    .update({ title: lesson.title, data })
    .eq("child_id", childId)
    .eq("lesson_id", lesson.id)
    .eq("kind", "circuit")
    .select("id");

  if (updateError) {
    console.error("[sbírka] Aktualizace výtvoru selhala:", updateError.message);
    return false;
  }
  if (updated && updated.length > 0) return true;

  const { error: insertError } = await service.from("projects").insert({
    child_id: childId,
    lesson_id: lesson.id,
    kind: "circuit",
    title: lesson.title,
    data,
  });

  if (insertError) {
    console.error("[sbírka] Uložení výtvoru selhalo:", insertError.message);
    return false;
  }
  return true;
}
