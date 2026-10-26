import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { LessonBuild } from "./schema";

export interface SavedBuild {
  lessonSlug: string;
  title: string;
  data: LessonBuild;
  updatedAt: string;
}

/**
 * Uložené výtvory dítěte v jednom kurzu, klíčované slugem lekce.
 *
 * `LessonBuild` se skládá zpět ze slugů, které se tu připojují z tabulek
 * `courses`/`lessons` — v `projects.data` nejsou. Servisní klient:
 * oprávnění k `childId` ověřuje volající. Při duplicitě vyhrává
 * nejnovější řádek.
 */
export async function childBuilds(
  childId: string,
  courseSlug: string,
): Promise<Map<string, SavedBuild>> {
  const result = new Map<string, SavedBuild>();
  const service = createServiceClient();

  const { data: course } = await service
    .from("courses")
    .select("id")
    .eq("slug", courseSlug)
    .maybeSingle();
  if (!course) return result;

  const { data: lessons } = await service
    .from("lessons")
    .select("id, slug")
    .eq("course_id", course.id);
  if (!lessons?.length) return result;

  const slugById = new Map(lessons.map((l) => [l.id, l.slug] as const));

  const { data: rows } = await service
    .from("projects")
    .select("lesson_id, title, data, updated_at")
    .eq("child_id", childId)
    .eq("kind", "circuit")
    .in("lesson_id", [...slugById.keys()])
    .order("updated_at", { ascending: false });

  for (const row of rows ?? []) {
    const lessonSlug = row.lesson_id ? slugById.get(row.lesson_id) : undefined;
    if (!lessonSlug || result.has(lessonSlug)) continue;

    const d = row.data as Partial<LessonBuild> & { v?: number };
    if (d.v !== 1 || !d.circuit || typeof d.code !== "string" || !d.mode) continue;

    result.set(lessonSlug, {
      lessonSlug,
      title: row.title ?? "",
      updatedAt: row.updated_at,
      data: {
        courseSlug,
        lessonSlug,
        circuit: d.circuit,
        code: d.code,
        blocks: d.blocks,
        mode: d.mode,
      },
    });
  }

  return result;
}
