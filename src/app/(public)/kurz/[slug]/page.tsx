import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card, MonoLabel } from "@/components/ui/Surface";
import { SITE } from "@/lib/site";
import { firstPlayableLesson, getCourseOutline } from "@/features/courses/queries";

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

        <ol className="flex flex-col gap-3">
          {outline.lessons.map((lesson) => (
            <li key={lesson.id}>
              <Card
                interactive={lesson.isPublished}
                className={`flex flex-wrap items-center gap-4 p-4 ${
                  lesson.isPublished ? "" : "opacity-60"
                }`}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-ink/20 font-mono text-sm">
                  {lesson.orderIndex}
                </span>

                <div className="min-w-0 flex-1">
                  <h3 className="font-display font-semibold text-ink">{lesson.title}</h3>
                  {lesson.summary && (
                    <p className="text-sm leading-relaxed text-ink-500">{lesson.summary}</p>
                  )}
                </div>

                {lesson.estimatedMinutes && (
                  <span className="font-mono text-xs text-ink-300">
                    {lesson.estimatedMinutes} min
                  </span>
                )}

                {lesson.isPublished ? (
                  <ButtonLink href={`/kurz/${slug}/${lesson.slug}`} size="sm" variant="outline">
                    Otevřít
                  </ButtonLink>
                ) : (
                  <span className="font-mono text-xs text-ink-300">připravujeme</span>
                )}
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
