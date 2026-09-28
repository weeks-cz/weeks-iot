import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Baby, Braces, Cable, Gift, Play, Puzzle, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Alert, MonoLabel } from "@/components/ui/Surface";
import { HeroCircuit } from "@/components/landing/HeroCircuit";
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

/**
 * Jak lekce probíhá. Tři kroky, protože lekce má tři kroky — a stejná
 * slova dítě pak uvidí v lekci samotné, takže úvodní stránka zároveň
 * učí, co ho čeká.
 */
const KROKY = [
  {
    icon: Cable,
    title: "Zapoj obvod",
    body:
      "Přetáhneš Arduino, LED a rezistor na desku a natáhneš drátky. " +
      "Když něco nesedí, učebna ukáže kde.",
  },
  {
    icon: Puzzle,
    title: "Poskládej program",
    body:
      "Z barevných bloků, nebo rovnou v kódu — jak ti to jde líp. " +
      "Přepnout se dá kdykoli.",
  },
  {
    icon: Play,
    title: "Spusť a koukej",
    body:
      "Arduino v prohlížeči tvůj program opravdu provede. LED se rozsvítí, " +
      "bzučák zapípá — nebo zjistíš, co opravit.",
  },
] as const;

/**
 * Pro rodiče. Jen to, co učebna opravdu dělá a co se dá ukázat —
 * stejné pravidlo jako pás „Co máte jisté" na weeks.cz.
 */
const JISTOTY = [
  {
    icon: Baby,
    title: "Do 15 let zakládá účet rodič",
    body:
      "Vyžaduje to zákon a je to zároveň způsob, jak vidíte, co dítě dokázalo. " +
      "Od 15 let si účet spravuje samo.",
  },
  {
    icon: Gift,
    title: "Lekce jsou zdarma",
    body: "Celý kurz, bez platební zdi mezi dítětem a obsahem. První lekce nechce ani účet.",
  },
  {
    icon: ShieldCheck,
    title: "Minimum údajů",
    body: "Přezdívka a datum narození dítěte. Žádné jméno, adresa ani fotografie.",
  },
] as const;

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
  const startHref = firstLesson ? `/kurz/iot/${firstLesson.slug}` : "/kurz/iot";

  /* Pás pod herem se skládá z názvů lekcí — co v něm běží, to v kurzu
     opravdu je. Natvrdo napsaný seznam by dřív nebo později sliboval
     lekci, která neexistuje. */
  const ticker = [...lessons.filter((l) => l.isPublished).map((l) => l.title), "Bloky i kód", "Běží v prohlížeči"];

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
      <section className="blueprint-grid-dark relative overflow-hidden border-b border-ink bg-ink text-paper">
        {/* Velké W jako na weeks.cz — podpis značky, ne dekorace k čtení. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 select-none font-display text-[26rem] font-bold leading-none text-paper/[0.04]"
        >
          W
        </span>

        <div className="section-container relative grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-12 lg:py-24">
          <div className="lg:col-span-7">
            <p className="mb-5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-400">
              Online učebna Weeks · pro děti 10–15 let
            </p>

            <h1 className="heading-1 mb-6 text-balance text-paper">
              Postav si vlastní{" "}
              <span className="relative inline-block text-accent-400">
                techniku
                <svg
                  aria-hidden="true"
                  viewBox="0 0 200 12"
                  preserveAspectRatio="none"
                  className="absolute -bottom-2 left-0 h-3 w-full"
                >
                  <path
                    d="M3 7 C 45 3.5, 95 9, 197 4.5"
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="mb-8 max-w-xl text-lg leading-relaxed text-paper/75 text-pretty">
              Zapojíš skutečné součástky, poskládáš program z bloků nebo ho napíšeš v kódu
              a hned uvidíš, jestli funguje. Všechno v prohlížeči, nic se neinstaluje.{" "}
              <strong className="font-semibold text-paper">
                První lekci si zkusíš hned, bez účtu.
              </strong>
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink href={startHref} size="lg">
                Zkusit první lekci
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </ButtonLink>
              <a
                href="#jak"
                className="inline-flex min-h-14 items-center rounded-md border border-paper/30 px-6 text-lg font-semibold text-paper transition-colors hover:bg-paper hover:text-ink"
              >
                Jak to funguje
              </a>
            </div>

            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-paper/15 pt-6">
              <div>
                <dt className="mono-label-dark mb-1">Kurz</dt>
                <dd className="font-display text-lg font-semibold">
                  {outline?.title ?? "Elektronika a IoT"}
                </dd>
              </div>
              {lessons.length > 0 && (
                <div>
                  <dt className="mono-label-dark mb-1">Lekcí</dt>
                  <dd className="font-display text-lg font-semibold tabular-nums">
                    {lessons.length}
                  </dd>
                </div>
              )}
              <div>
                <dt className="mono-label-dark mb-1">Cena</dt>
                <dd className="font-display text-lg font-semibold">zdarma</dd>
              </div>
            </dl>
          </div>

          {/* Místo fotky obvod z první lekce, který opravdu bliká —
              přesně to, co dítě za dvacet minut postaví. Neinteraktivní:
              kdo na něj klikne, má skončit v lekci, ne v ukázce. */}
          <div className="lg:col-span-5">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              <div
                aria-hidden="true"
                className="absolute inset-0 translate-x-4 translate-y-4 rounded-md bg-cta-400"
              />
              <Link
                href={startHref}
                aria-label="Obvod z první lekce — zkusit si ho postavit"
                className="relative block overflow-hidden rounded-md border border-paper/20 bg-paper"
              >
                <div className="pointer-events-none">
                  <HeroCircuit />
                </div>
                <p className="border-t border-ink/10 bg-paper-soft px-4 py-2.5 font-mono text-xs text-ink-500">
                  Lekce 1 · takhle to bude vypadat
                </p>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pás ──────────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="overflow-hidden border-b border-ink bg-cta-400 py-2.5 text-ink"
      >
        <div className="ticker-track flex whitespace-nowrap font-mono text-xs font-semibold uppercase tracking-[0.25em]">
          {[0, 1].map((copy) => (
            <span key={copy} className="flex shrink-0 items-center">
              {ticker.map((item) => (
                <span key={item} className="flex items-center">
                  <span className="px-5">{item}</span>
                  <span className="text-ink/40">·</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ── Jak to funguje ───────────────────────────────────────────── */}
      <section id="jak" className="scroll-mt-20 bg-paper">
        <div className="section-container py-16 sm:py-24">
          <MonoLabel className="mb-3">Jak to funguje</MonoLabel>
          <h2 className="heading-2 mb-12 max-w-2xl text-balance">
            Každá lekce má tři kroky. Vždycky víš, který je na řadě.
          </h2>

          <ol className="grid gap-10 md:grid-cols-3 md:gap-6">
            {KROKY.map((krok, i) => (
              <li key={krok.title} className="relative">
                {/* Spojnice mezi kroky — na úzké obrazovce jdou pod sebou
                    a čára by vedla nikam. */}
                {i < KROKY.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-16 right-0 top-7 hidden border-t-2 border-dashed border-ink/20 md:block"
                  />
                )}
                <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-md border border-ink bg-white text-accent-600 shadow-hard-sm">
                  <krok.icon className="h-7 w-7" aria-hidden="true" />
                </div>
                <p className="mb-1 font-mono text-xs font-semibold text-ink-300">
                  Krok {i + 1}
                </p>
                <h3 className="mb-2 font-display text-xl font-semibold text-ink">
                  {krok.title}
                </h3>
                <p className="max-w-sm leading-relaxed text-ink-500">{krok.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-12 flex items-start gap-3 rounded-md border border-ink/15 bg-paper-soft p-4 sm:items-center">
            <Braces className="mt-0.5 h-5 w-5 shrink-0 text-accent-600 sm:mt-0" aria-hidden="true" />
            <p className="text-ink-500">
              <strong className="font-semibold text-ink">Bloky, nebo kód?</strong> Mladší
              začínají s bloky, starší často rovnou píšou. Z bloků se dá kdykoli přejít
              na kód, který z nich vznikl — je to pořád stejné Arduino.
            </p>
          </div>
        </div>
      </section>

      {/* ── Kurz ─────────────────────────────────────────────────────── */}
      <section className="border-y border-ink bg-paper-soft">
        <div className="section-container grid gap-10 py-16 sm:py-24 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <MonoLabel className="mb-3">Kurz 1</MonoLabel>
              <h2 className="heading-2 mb-4 text-balance">
                {outline?.title ?? "Elektronika a IoT"}
              </h2>
              {outline?.summary && (
                <p className="leading-relaxed text-ink-500">{outline.summary}</p>
              )}
            </div>
          </div>

          {/* Publikovaná lekce je celá odkaz. Řádek s hover efektem, na
              který se nedá kliknout, působí rozbitě. */}
          <ol className="divide-y divide-ink/10 overflow-hidden rounded-md border border-ink bg-white shadow-hard lg:col-span-8">
            {lessons.map((lesson) => {
              const isStart = lesson.id === firstLesson?.id;
              const body = (
                <div className="flex items-start gap-5 p-5 sm:p-6">
                  <span className="w-10 shrink-0 font-mono text-2xl font-semibold tabular-nums text-ink-300">
                    {String(lesson.orderIndex).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 className="font-display text-lg font-semibold text-ink">
                        {lesson.title}
                      </h3>
                      {isStart && (
                        <span className="rounded-sm border border-cta-600 bg-cta-50 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-cta-800">
                          Začni tady · bez účtu
                        </span>
                      )}
                      {!lesson.isPublished && (
                        <span className="font-mono text-xs text-ink-300">připravujeme</span>
                      )}
                    </div>
                    {lesson.summary && (
                      <p className="leading-relaxed text-ink-500">{lesson.summary}</p>
                    )}
                  </div>
                  {lesson.estimatedMinutes && (
                    <span className="hidden shrink-0 font-mono text-xs text-ink-300 sm:block">
                      {lesson.estimatedMinutes} min
                    </span>
                  )}
                </div>
              );

              return (
                <li key={lesson.id}>
                  {lesson.isPublished ? (
                    <Link
                      href={`/kurz/iot/${lesson.slug}`}
                      className="group block transition-colors hover:bg-accent-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="opacity-60">{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ── Pro rodiče ───────────────────────────────────────────────── */}
      <section className="border-b border-trust-200 bg-trust-50">
        <div className="section-container py-16 sm:py-24">
          <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-trust-700">
            Pro rodiče
          </p>
          <h2 className="heading-2 mb-12 text-balance">Co máte jisté</h2>

          <div className="grid gap-10 md:grid-cols-3 md:gap-8">
            {JISTOTY.map((item) => (
              <div key={item.title}>
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-md border border-trust-600 bg-white text-trust-600">
                  <item.icon className="h-8 w-8" aria-hidden="true" />
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold text-ink">
                  {item.title}
                </h3>
                <p className="leading-relaxed text-ink-500">{item.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-12 max-w-2xl border-t border-trust-200 pt-6 leading-relaxed text-ink-500">
            Za učebnou stojí Weeks — stejný tým, který pořádá příměstské tábory chytrých
            technologií v Praze a Karlových Varech.{" "}
            <a
              href="https://weeks.cz/tabory"
              className="font-semibold text-ink underline decoration-trust-600 decoration-2 underline-offset-4 hover:decoration-ink"
            >
              Tábory na weeks.cz
            </a>
          </p>
        </div>
      </section>

      {/* ── Závěr ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-cta-400">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-16 select-none font-display text-[22rem] font-bold leading-none text-ink/[0.06]"
        >
          W
        </span>
        <div className="section-container relative flex flex-col items-start gap-8 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="heading-2 mb-3 max-w-xl text-balance text-ink">
              Za dvacet minut ti bude blikat první LEDka
            </h2>
            <p className="text-lg text-ink/75">Bez účtu, bez instalace. Stačí prohlížeč.</p>
          </div>
          <ButtonLink href={startHref} variant="secondary" size="lg" className="shrink-0">
            Zkusit první lekci
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
