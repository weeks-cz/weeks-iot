import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/components/ui/Surface";
import { createClient } from "@/lib/supabase/server";
import { SITE } from "@/lib/site";
import { LessonRunner } from "@/features/progress/components/LessonRunner";
import { completedLessonSlugs } from "@/features/progress/queries";

interface Params {
  slug: string;
  lekce: string;
}

async function loadLesson(courseSlug: string, lessonSlug: string) {
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, title")
    .eq("slug", courseSlug)
    .eq("is_published", true)
    .maybeSingle();

  if (!course) return null;

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, slug, title, summary, order_index, estimated_minutes, is_published")
    .eq("course_id", course.id)
    .order("order_index");

  const lesson = lessons?.find((l) => l.slug === lessonSlug && l.is_published);
  if (!lesson) return null;

  const published = (lessons ?? []).filter((l) => l.is_published);
  const index = published.findIndex((l) => l.id === lesson.id);

  return {
    course,
    lesson,
    nextLessonSlug: published[index + 1]?.slug ?? null,
    total: published.length,
    publishedSlugs: published.map((l) => l.slug),
    publishedIds: published.map((l) => l.id),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug, lekce } = await params;
  const data = await loadLesson(slug, lekce);

  if (!data) return { title: "Lekce nenalezena", robots: { index: false } };

  const url = `${SITE.url}/kurz/${slug}/${lekce}`;

  return {
    title: `${data.lesson.title} — ${data.course.title}`,
    description: data.lesson.summary ?? undefined,
    alternates: { canonical: url },
    /* Indexuje se jen první lekce. Ta je vstupní branou z reklamy
       a z článků; ostatní by v hledání jen ředily její pozici. */
    robots:
      data.lesson.order_index === 1
        ? { index: true, follow: true }
        : { index: false, follow: true },
    openGraph: {
      title: data.lesson.title,
      description: data.lesson.summary ?? undefined,
      url,
      type: "article",
    },
  };
}

export default async function LessonPage({ params }: { params: Promise<Params> }) {
  const { slug, lekce } = await params;
  const data = await loadLesson(slug, lekce);
  if (!data) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  /* Co má aktivní profil dokončené. Potřebuje to `course_complete` —
     bez toho by se odvozovalo z „nemám kam dál", což by kurz označilo
     za dokončený i tomu, kdo skočil rovnou na poslední lekci. */
  const completedSlugs = auth.user ? await completedLessonSlugs(data.publishedIds) : [];

  return (
    <main className="section-container py-10">
      {/* Cesta zpět a metadata na jednom řádku. Dřív to byly dva bloky nad
          sebou a hlavička odsunula práci o kus níž — na telefonu tak lekce
          začínala až za ohybem. */}
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link
          href={`/kurz/${slug}`}
          className="rounded-sm font-mono text-xs uppercase tracking-[0.2em] text-ink-500 hover:text-ink"
        >
          ← {data.course.title}
        </Link>
        <MonoLabel>
          Lekce {data.lesson.order_index} z {data.total}
          {data.lesson.estimated_minutes ? ` · ${data.lesson.estimated_minutes} min` : ""}
        </MonoLabel>
      </div>

      <header className="mb-6 max-w-3xl">
        <h1 className="heading-2 mb-2">{data.lesson.title}</h1>

        {data.lesson.summary && (
          <p className="lesson-body text-ink-500">{data.lesson.summary}</p>
        )}
      </header>

      <div className="max-w-3xl">
        <LessonRunner
          courseSlug={slug}
          lessonSlug={lekce}
          lessonTitle={data.lesson.title}
          lessonOrder={data.lesson.order_index}
          isAuthenticated={Boolean(auth.user)}
          nextLessonSlug={data.nextLessonSlug}
          publishedSlugs={data.publishedSlugs}
          completedSlugs={completedSlugs}
        />
      </div>
    </main>
  );
}
