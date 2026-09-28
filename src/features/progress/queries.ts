import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getActiveChild } from "@/features/children/queries";

/**
 * Co má aktivní profil hotové.
 *
 * Aktivní profil se vybírá stejným pravidlem jako na přehledu `/ucim-se`
 * (`pickActiveChild`) — dřív se tu četla jen cookie, takže jediné dítě bez
 * PINu, které cookie nikdy nenastaví, tu mělo vždycky prázdno.
 */
export async function completedLessonSlugs(
  parentId: string,
  lessonIds: string[],
): Promise<string[]> {
  if (lessonIds.length === 0) return [];

  const { active } = await getActiveChild(parentId);
  if (!active) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("progress")
    .select("lesson_id, lessons(slug)")
    .eq("child_id", active.id)
    .eq("status", "completed")
    .in("lesson_id", lessonIds);

  return (data ?? [])
    .map((row) => (row as unknown as { lessons?: { slug?: string } }).lessons?.slug)
    .filter((slug): slug is string => Boolean(slug));
}
