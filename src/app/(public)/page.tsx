import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Alert, Card, DarkSection, MonoLabel } from "@/components/ui/Surface";
import { SITE } from "@/lib/site";
import { firstPlayableLesson, getCourseOutline } from "@/features/courses/queries";

export const metadata: Metadata = {
  /* `absolute` schválně: kořenový layout má šablonu "%s | Weeks Učebna",
     která by z tohohle udělala "Weeks Učebna — … | Weeks Učebna". */
  title: { absolute: `${SITE.name} — ${SITE.tagline}` },
  description: SITE.description,
  alternates: { canonical: SITE.url },
};

/* Statická stránka s krátkou revalidací: obsah kurzu se mění zřídka,
   ale změna se má projevit bez nasazení. */
export const revalidate = 300;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ucet?: string }>;
}) {
  const params = await searchParams;

  /* Osnova se čte serverově a jen s bezpečnými sloupci — RLS by jinak
     nepublikované lekce skryla a kurz by vypadal jako jediná lekce. */
  const outline = await getCourseOutline("iot");
  const lessons = outline?.lessons ?? [];
  const firstLesson = firstPlayableLesson(outline);

  return (
    <main>
      {params.ucet === "smazan" && (
        <div className="section-container pt-6">
          <Alert tone="success" title="Účet byl zrušen">
            Všechna data jsme smazali. Díky, že jste to s námi zkusili.
          </Alert>
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="blueprint-grid border-b border-ink/15">
        <div className="section-container py-14 sm:py-20">
          <div className="max-w-3xl">
            <MonoLabel className="mb-4">Pro děti 10–15 let</MonoLabel>

            <h1 className="heading-1 mb-5 text-ink">
              Postav si vlastní <span className="text-primary-600">techniku</span>
            </h1>

            <p className="mb-8 max-w-prose text-lg leading-relaxed text-ink-500">
              Semafor, noční světlo, vlastní 3D model. Skládáš obvod přímo v prohlížeči
              a hned vidíš, jak to funguje doopravdy.{" "}
              <strong className="font-semibold text-ink">
                První lekci si zkusíš hned — bez účtu a bez e-mailu.
              </strong>
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <ButtonLink
                href={firstLesson ? `/kurz/iot/${firstLesson.slug}` : "/kurz/iot"}
                size="lg"
              >
                Zkusit první lekci
              </ButtonLink>
              <p className="font-mono text-xs text-ink-500">
                zdarma · bez registrace · asi 20 minut
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Kurz ─────────────────────────────────────────────────────── */}
      <section className="section-container py-14 sm:py-20">
        <MonoLabel className="mb-3">Kurz 1</MonoLabel>
        <h2 className="heading-2 mb-3">{outline?.title ?? "Elektronika a IoT"}</h2>
        <p className="mb-8 max-w-prose text-lg leading-relaxed text-ink-500">
          {outline?.summary}
        </p>

        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <Card
                interactive={lesson.isPublished}
                className={`h-full p-5 ${lesson.isPublished ? "" : "opacity-60"}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <MonoLabel>Lekce {lesson.orderIndex}</MonoLabel>
                  {!lesson.isPublished && (
                    <span className="font-mono text-xs text-ink-300">připravujeme</span>
                  )}
                </div>

                <h3 className="mb-1 font-display text-lg font-semibold text-ink">
                  {lesson.title}
                </h3>
                {lesson.summary && (
                  <p className="text-sm leading-relaxed text-ink-500">{lesson.summary}</p>
                )}
                {lesson.estimatedMinutes && (
                  <p className="mt-3 font-mono text-xs text-ink-300">
                    {lesson.estimatedMinutes} min
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Pro rodiče ───────────────────────────────────────────────── */}
      <DarkSection>
        <div className="section-container py-14 sm:py-20">
          <MonoLabel dark className="mb-3">
            Pro rodiče
          </MonoLabel>

          <h2 className="heading-2 mb-4 text-paper">Za aplikací stojí lektor a léto</h2>

          <p className="mb-8 max-w-prose text-lg leading-relaxed text-paper/70">
            Weeks pořádá příměstské tábory chytrých technologií v Praze a Karlových Varech.
            Učebna je způsob, jak si to dítě může zkusit dřív — a jak v tom může pokračovat
            po zbytek roku.
          </p>

          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                title: "Účet zakládá rodič",
                body: "Dítě má pod ním svůj profil. Je to podmínka zákona i způsob, jak vidíte, co dítě dokázalo.",
              },
              {
                title: "Obsah je zdarma",
                body: "Všechny lekce, circuit builder i 3D studio. Platební zeď mezi dítětem a obsahem nestojí.",
              },
              {
                title: "Nesbíráme údaje dětí",
                body: "Přezdívka a rok narození. Žádné jméno, adresa ani fotografie.",
              },
            ].map((item) => (
              <div key={item.title}>
                <h3 className="mb-2 font-display text-lg font-semibold text-paper">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-paper/70">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </DarkSection>
    </main>
  );
}
