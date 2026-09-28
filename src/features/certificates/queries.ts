import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { CERTIFICATES } from "./content";
import type { CertificateData } from "./document";
import { earnedCertificate } from "./eligibility";

export interface EarnedCertificate {
  courseSlug: string;
  data: CertificateData;
}

/**
 * Certifikáty, na které má profil nárok — jeden za každý dokončený kurz.
 *
 * Servisní klient: volá se z cesty, která vlastnictví profilu už ověřila
 * (stažení v účtu), a ze zápisu postupu, kde id profilu odvodil server.
 * Id z prohlížeče sem nikdy nesmí dojít přímo.
 *
 * Nic se neukládá. Nárok se pokaždé spočítá z postupu, takže certifikát
 * nemůže ukazovat něco jiného než to, co dítě opravdu udělalo.
 */
export async function earnedCertificates(
  childId: string,
  nick: string,
): Promise<EarnedCertificate[]> {
  const slugs = Object.keys(CERTIFICATES);
  if (slugs.length === 0) return [];

  const service = createServiceClient();

  const { data: courses } = await service
    .from("courses")
    .select("id, slug, title")
    .in("slug", slugs)
    .eq("is_published", true);
  if (!courses?.length) return [];

  const [{ data: lessons }, { data: progress }] = await Promise.all([
    service
      .from("lessons")
      .select("id, slug, title, course_id")
      .in(
        "course_id",
        courses.map((c) => c.id),
      )
      .eq("is_published", true),
    service
      .from("progress")
      .select("lesson_id, completed_at")
      .eq("child_id", childId)
      .eq("status", "completed"),
  ]);

  const completions = (progress ?? [])
    .filter((p): p is { lesson_id: string; completed_at: string } => Boolean(p.completed_at))
    .map((p) => ({ lessonId: p.lesson_id, completedAt: p.completed_at }));

  const out: EarnedCertificate[] = [];

  for (const course of courses) {
    const content = CERTIFICATES[course.slug];
    if (!content) continue;

    const courseLessons = (lessons ?? []).filter((l) => l.course_id === course.id);
    const earned = earnedCertificate(courseLessons, completions);
    if (!earned) continue;

    /* Projekt se jmenuje podle lekce v databázi, ať certifikát nese
       stejný název, jaký dítě vidělo v kurzu. */
    const project = courseLessons.find((l) => l.slug === content.projectLessonSlug);
    if (!project) continue;

    out.push({
      courseSlug: course.slug,
      data: {
        name: nick,
        courseTitle: course.title,
        projectTitle: project.title,
        skills: content.skills,
        completedAt: earned.completedAt,
      },
    });
  }

  return out;
}
