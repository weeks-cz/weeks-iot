import "server-only";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Osnova kurzu pro veřejné stránky.
 *
 * ── Proč tohle není obyčejný dotaz ─────────────────────────────────────────
 * RLS pouští klientovi jen publikované lekce, a je to tak správně: kdo lekci
 * nemá otevřít, nemá jí ani vidět obsah. Jenže osnova kurzu je marketingový
 * text — návštěvník má vidět, že kurz má sedm lekcí a jak se jmenují, i když
 * je zatím hotová jedna. Bez toho vypadá kurz jako jedna osamocená lekce.
 *
 * Řeší se to tím, že osnovu čte server servisním klientem a **vybírá jen
 * bezpečné sloupce**. `body` se sem záměrně nedostane, takže rozepsaný obsah
 * neuniká ani omylem. Samotné otevření lekce dál hlídá `is_published`
 * v `loadLesson` na stránce lekce.
 */

export interface OutlineLesson {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  orderIndex: number;
  estimatedMinutes: number | null;
  isPublished: boolean;
}

export interface CourseOutline {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  lessons: OutlineLesson[];
  publishedCount: number;
}

export async function getCourseOutline(slug: string): Promise<CourseOutline | null> {
  /* Kurz sám se čte běžným klientem — nepublikovaný kurz nemá mít
     veřejnou stránku vůbec. */
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, title, summary")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!course) return null;

  const service = createServiceClient();
  const { data: lessons } = await service
    .from("lessons")
    /* Výčet sloupců, ne "*". `body` a `video_url` tu nemají co dělat. */
    .select("id, slug, title, summary, order_index, estimated_minutes, is_published")
    .eq("course_id", course.id)
    .order("order_index");

  const mapped: OutlineLesson[] = (lessons ?? []).map((l) => ({
    id: l.id,
    slug: l.slug,
    title: l.title,
    summary: l.summary,
    orderIndex: l.order_index,
    estimatedMinutes: l.estimated_minutes,
    isPublished: l.is_published,
  }));

  return {
    ...course,
    lessons: mapped,
    publishedCount: mapped.filter((l) => l.isPublished).length,
  };
}

/** První lekce, kterou jde otevřít. Cíl tlačítka „Zkusit zdarma". */
export function firstPlayableLesson(outline: CourseOutline | null): OutlineLesson | null {
  return outline?.lessons.find((l) => l.isPublished) ?? null;
}
