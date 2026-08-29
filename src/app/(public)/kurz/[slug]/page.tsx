import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card, MonoLabel } from "@/components/ui/Surface";
import { createClient } from "@/lib/supabase/server";
import { SITE } from "@/lib/site";

interface Params {
  slug: string;
}

async function loadCourse(slug: string) {
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, title, summary")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!course) return null;

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, slug, title, summary, order_index, estimated_minutes, is_published")
    .eq("course_id", course.id)
    .order("order_index");

  return { course, lessons: lessons ?? [] };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadCourse(slug);

  if (!data) return { title: "Kurz nenalezen", robots: { index: false } };

  return {
    title: data.course.title,
    description: data.course.summary ?? undefined,
    alternates: { canonical: `${SITE.url}/kurz/${slug}` },
    robots: { index: true, follow: true },
  };
}

export default async function CoursePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const data = await loadCourse(slug);
  if (!data) notFound();

  const first = data.lessons.find((l) => l.is_published);

  return (
    <main>
      <section className="blueprint-grid border-b border-ink/15">
        <div className="section-container py-12 sm:py-16">
          <div className="max-w-3xl">
            <MonoLabel className="mb-3">Kurz · {data.lessons.length} lekcí</MonoLabel>
            <h1 className="heading-1 mb-4">{data.course.title}</h1>

            {data.course.summary && (
              <p className="mb-8 max-w-prose text-lg leading-relaxed text-ink-500">
                {data.course.summary}
              </p>
            )}

            {first && (
              <div className="flex flex-wrap items-center gap-4">
                <ButtonLink href={`/kurz/${slug}/${first.slug}`} size="lg">
                  Začít první lekcí
                </ButtonLink>
                <p className="font-mono text-xs text-ink-500">
                  zdarma · bez registrace
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section-container py-12">
        <h2 className="heading-3 mb-6">Co tě čeká</h2>

        <ol className="flex flex-col gap-3">
          {data.lessons.map((lesson) => (
            <li key={lesson.id}>
              <Card
                interactive={lesson.is_published}
                className={`flex flex-wrap items-center gap-4 p-4 ${
                  lesson.is_published ? "" : "opacity-60"
                }`}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-ink/20 font-mono text-sm">
                  {lesson.order_index}
                </span>

                <div className="min-w-0 flex-1">
                  <h3 className="font-display font-semibold text-ink">{lesson.title}</h3>
                  {lesson.summary && (
                    <p className="text-sm leading-relaxed text-ink-500">{lesson.summary}</p>
                  )}
                </div>

                {lesson.is_published ? (
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
