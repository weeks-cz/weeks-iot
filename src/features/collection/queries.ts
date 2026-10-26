import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { Circuit } from "@/features/circuit/types";
import { lessonBySlug } from "@/features/lessons/content";
import { referenceCircuit } from "@/features/lessons/reference-circuit";
import type { PathLesson } from "@/features/lobby/model";
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

/** Jedna položka sbírky: hotová lekce a obvod, který se u ní ukáže. */
export interface CollectionItem {
  slug: string;
  title: string;
  circuit: Circuit;
  /** Lekce je hotová, ale výtvor uložený nemá — kreslí se vzorové zapojení. */
  reference: boolean;
  /** Kdy se výtvor naposledy uložil; u vzoru není co ukázat. */
  updatedAt: string | null;
}

/** Vzorové zapojení lekce pro hotovou lekci bez uloženého výtvoru. */
function lessonReference(slug: string): Circuit | null {
  const lesson = lessonBySlug(slug);
  return lesson ? referenceCircuit(lesson.wiring) : null;
}

/**
 * Mřížka sbírky: jen hotové publikované lekce v pořadí kurzu (návrh §9.3).
 *
 * Lekce bez uloženého výtvoru dostane vzorové zapojení a `reference: true`;
 * bez výtvoru i bez vzoru se vynechá. Výtvor k lekci, která už není
 * v cestě (nepublikovaná), se nevrací.
 */
export function collectionItems(
  path: readonly PathLesson[],
  builds: ReadonlyMap<string, SavedBuild>,
  reference: (slug: string) => Circuit | null = lessonReference,
): CollectionItem[] {
  const items: CollectionItem[] = [];
  for (const lesson of path) {
    if (!lesson.done) continue;
    const own = builds.get(lesson.slug);
    const circuit = own?.data.circuit ?? reference(lesson.slug);
    if (!circuit) continue;
    items.push({
      slug: lesson.slug,
      title: lesson.title,
      circuit,
      reference: !own,
      updatedAt: own?.updatedAt ?? null,
    });
  }
  return items;
}
