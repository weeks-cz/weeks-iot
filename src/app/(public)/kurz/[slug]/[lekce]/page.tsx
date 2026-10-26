import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/components/ui/Surface";
import { Avatar } from "@/features/children/avatars";
import { createClient } from "@/lib/supabase/server";
import { SITE } from "@/lib/site";
import { LessonRunner } from "@/features/progress/components/LessonRunner";
import { completedLessonSlugs } from "@/features/progress/queries";
import { activeChildEditorMode } from "@/features/children/editor-mode";
import { getActiveChild } from "@/features/children/queries";
import { homeHref, toViewer } from "@/features/shell/home-href";
import { campOfferFor } from "@/features/camp/offer";
import { parentCampOffer } from "@/features/camp/parent-offer";
import { CERTIFICATES } from "@/features/certificates/content";
import type { Circuit } from "@/features/circuit/types";
import { childBuilds } from "@/features/collection/queries";

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

  /* Závěrečný projekt na certifikátu — stejná lekce jako v PDF
     (`CERTIFICATES`); kurz bez záznamu dostane poslední lekci. */
  const projectSlug = CERTIFICATES[course.slug]?.projectLessonSlug;
  const project = published.find((l) => l.slug === projectSlug) ?? published.at(-1);

  return {
    course,
    lesson,
    projectTitle: project?.title ?? lesson.title,
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
  const [completedSlugs, childEditorMode, activeChild] = auth.user
    ? await Promise.all([
        completedLessonSlugs(auth.user.id, data.publishedIds),
        activeChildEditorMode(auth.user.id),
        getActiveChild(auth.user.id).then((r) => r.active),
      ])
    : [[], undefined, null];
  /* Přihlášený rodič bez vybraného profilu: postup by se nikam nezapsal.
     Dřív se to tvářilo jako přihlášené dítě a zápis tiše selhával. */
  const needsChildProfile = Boolean(auth.user) && !activeChild;

  /* Finále kurzu potřebuje tábor a výtvory ze sbírky. Načítají se jen
     tehdy, když tahle lekce kurz opravdu může dokončit (všechny ostatní
     jsou v účtu hotové) — jinak by každá lekce platila dotazy navíc.
     Anonym dostane obecnou nabídku bez dotazu. */
  const mayFinishCourse = data.publishedSlugs.every(
    (s) => s === lekce || completedSlugs.includes(s),
  );
  const [campOffer, savedCircuits] = !auth.user
    ? [campOfferFor({ regionCode: null, catchment: [], anonymous: true }), {}]
    : mayFinishCourse
      ? await Promise.all([
          parentCampOffer(auth.user.id).catch((error: unknown) => {
            console.error("[lekce] nabídka tábora se nenačetla", error);
            return null;
          }),
          activeChild
            ? childBuilds(activeChild.id, slug)
                .then(circuitsBySlug)
                .catch((error: unknown) => {
                  console.error("[lekce] výtvory se nenačetly", error);
                  return {};
                })
            : {},
        ])
      : [null, {}];

  /* Přihlášený se vrací domů (lobby nebo výběr profilu), ne na přehled
     kurzu — ten je pro něj jen mezikrok. Anonym zůstává u kurzu. */
  const viewer = toViewer(auth.user, activeChild);
  const back =
    viewer.kind === "anon"
      ? { href: `/kurz/${slug}`, label: data.course.title }
      : { href: homeHref(viewer), label: "Domů" };

  return (
    <main className="section-container py-6 sm:py-8">
      {/* Cesta zpět a metadata na jednom řádku. Dřív to byly dva bloky nad
          sebou a hlavička odsunula práci o kus níž — na telefonu tak lekce
          začínala až za ohybem. */}
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link
          href={back.href}
          className="rounded-sm font-mono text-xs uppercase tracking-[0.2em] text-ink-500 hover:text-ink"
        >
          ← {back.label}
        </Link>
        <MonoLabel>
          Lekce {data.lesson.order_index} z {data.total}
          {data.lesson.estimated_minutes ? ` · ${data.lesson.estimated_minutes} min` : ""}
        </MonoLabel>
      </div>

      {/* Kdo se právě učí. Dítě i rodič v lekci vědí, čí postup se zapisuje,
          a jedním kliknutím se dá přepnout. Přepnutí je výběr profilu, ne
          změna oprávnění — proto odkaz, ne tlačítko s akcí. */}
      {activeChild && (
        <div className="mb-4 flex max-w-3xl flex-wrap items-center gap-3 rounded-md border border-ink/15 bg-white px-3 py-2">
          <Avatar id={activeChild.avatar} className="block size-8 shrink-0 text-ink" />
          <div className="min-w-0 flex-1">
            <MonoLabel>Učí se</MonoLabel>
            <p className="truncate font-semibold text-ink">{activeChild.nick}</p>
          </div>
          <Link
            href="/ucim-se/prepnout"
            className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-semibold text-primary-600 underline underline-offset-4 hover:text-primary-700"
          >
            Přepnout
          </Link>
        </div>
      )}

      <header className="mb-6 max-w-3xl">
        <h1 className="heading-2 mb-2">{data.lesson.title}</h1>

        {data.lesson.summary && (
          <p className="lesson-body text-ink-500">{data.lesson.summary}</p>
        )}
      </header>

      {/* Práce dostane celou šířku. Texty uvnitř si drží čitelnou šířku
          přes max-w-prose; zaškrtit CELOU lekci na 768 px znamenalo malou
          plochu na skládání a půl obrazovky bílého místa. */}
      <div className="max-w-6xl">
        <LessonRunner
          courseSlug={slug}
          courseTitle={data.course.title}
          projectTitle={data.projectTitle}
          lessonSlug={lekce}
          lessonOrder={data.lesson.order_index}
          isAuthenticated={Boolean(auth.user)}
          needsChildProfile={needsChildProfile}
          publishedSlugs={data.publishedSlugs}
          completedSlugs={completedSlugs}
          childEditorMode={childEditorMode}
          profileId={activeChild?.id ?? null}
          nick={activeChild?.nick ?? null}
          campOffer={campOffer}
          savedCircuits={savedCircuits}
        />
      </div>
    </main>
  );
}

/** Do klienta jde jen obvod — kód a bloky finále nepotřebuje. */
function circuitsBySlug(builds: Map<string, { data: { circuit: Circuit } }>): Record<string, Circuit> {
  return Object.fromEntries([...builds].map(([lessonSlug, b]) => [lessonSlug, b.data.circuit]));
}
