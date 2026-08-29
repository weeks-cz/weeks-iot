import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_CHILD_COOKIE } from "@/features/children/constants";

/**
 * Co má aktivní profil hotové.
 *
 * Cookie s profilem je jen volba, ne oprávnění — RLS pustí jen postup dětí
 * přihlášeného účtu, takže podvržené id nic nevrátí.
 */
export async function completedLessonSlugs(lessonIds: string[]): Promise<string[]> {
  if (lessonIds.length === 0) return [];

  const cookieStore = await cookies();
  const childId = cookieStore.get(ACTIVE_CHILD_COOKIE)?.value;
  if (!childId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("progress")
    .select("lesson_id, lessons(slug)")
    .eq("child_id", childId)
    .eq("status", "completed")
    .in("lesson_id", lessonIds);

  return (data ?? [])
    .map((row) => (row as unknown as { lessons?: { slug?: string } }).lessons?.slug)
    .filter((slug): slug is string => Boolean(slug));
}
