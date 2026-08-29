import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { MonoLabel } from "@/components/ui/Surface";
import { SITE } from "@/lib/site";
import { firstPlayableLesson, getCourseOutline } from "@/features/courses/queries";
import { CourseOutlineList } from "@/features/courses/components/CourseOutlineList";
import { completedLessonSlugs } from "@/features/progress/queries";
import { createClient } from "@/lib/supabase/server";

interface Params {
  slug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const outline = await getCourseOutline(slug);

  if (!outline) return { title: "Kurz nenalezen", robots: { index: false } };

  return {
    title: outline.title,
    description: outline.summary ?? undefined,
    alternates: { canonical: `${SITE.url}/kurz/${slug}` },
    robots: { index: true, follow: true },
  };
}

export default async function CoursePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;

  /* Celá osnova, včetně nepublikovaných lekcí — je to marketingový obsah.
     Čte se serverově a jen s bezpečnými sloupci, takže rozepsané zadání
     v `body` ven neuteče. Otevřít jde dál jen publikovaná lekce. */
  const outline = await getCourseOutline(slug);
  if (!outline) notFound();

  const first = firstPlayableLesson(outline);
  const remaining = outline.lessons.length - outline.publishedCount;

  /* Postup z účtu. Anonymní většina ho má v prohlížeči a doplní si ho
     seznam sám — tohle je jen ta půlka, kterou zná server. */
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const serverCompleted = auth.user
    ? await completedLessonSlugs(outline.lessons.filter((l) => l.isPublished).map((l) => l.id))
    : [];

  return (
    <main>
      <section className="blueprint-grid border-b border-ink/15">
        <div className="section-container py-12 sm:py-16">
          <div className="max-w-3xl">
            <MonoLabel className="mb-3">Kurz · {outline.lessons.length} lekcí</MonoLabel>
            <h1 className="heading-1 mb-4">{outline.title}</h1>

            {outline.summary && (
              <p className="mb-8 max-w-prose text-lg leading-relaxed text-ink-500">
                {outline.summary}
              </p>
            )}

            {first && (
              <div className="flex flex-wrap items-center gap-4">
                <ButtonLink href={`/kurz/${slug}/${first.slug}`} size="lg">
                  Začít první lekcí
                </ButtonLink>
                <p className="font-mono text-xs text-ink-500">zdarma · bez registrace</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section-container py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <h2 className="heading-3">Co tě čeká</h2>
          {remaining > 0 && (
            <p className="font-mono text-xs text-ink-500">
              hotovo {outline.publishedCount} z {outline.lessons.length} · zbytek průběžně
              doplňujeme
            </p>
          )}
        </div>

        <CourseOutlineList
          courseSlug={slug}
          lessons={outline.lessons}
          serverCompleted={serverCompleted}
        />
      </section>
    </main>
  );
}
