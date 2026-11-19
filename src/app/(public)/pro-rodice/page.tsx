import type { Metadata } from "next";
import { ArrowRight, Award, Clock, Gift, Globe, Play, Puzzle, UserRound } from "lucide-react";
import { MonoLabel } from "@/components/ui/Surface";
import { SITE } from "@/lib/site";
import { firstPlayableLesson, getCourseOutline } from "@/features/courses/queries";
import { DeviceOrder } from "@/features/device-link/components/DeviceOrder";

/**
 * Stránka pro rodiče z reklamy.
 *
 * Reklama oslovuje rodiče, kteří ji většinou vidí na telefonu. Učebna je
 * ale stavěná pro dítě u počítače. Na telefonu je proto hlavní akcí
 * formulář „pošleme vám odkaz na počítač“, na počítači rovnou lekce
 * (rozhoduje `DeviceOrder`). Návrh: docs/superpowers/specs/2026-11-19-…
 *
 * Texty vykají a tvrdí JEN to, co je ověřené: zdarma, nic se neinstaluje,
 * v prohlížeči, 7 lekcí po 20–30 minutách, certifikát, první lekce bez
 * účtu, pro děti od 9 let. Nic dalšího – žádné počty, žádné „uvidíte
 * postup dítěte“. Čísla s jednotkou drží pohromadě nezlomitelnou mezerou.
 */

const NBSP = "\u00a0";

export const metadata: Metadata = {
  title: "Arduino pro vaše dítě",
  description:
    `Online učebna pro děti od 9${NBSP}let. Zdarma, v prohlížeči, nic se neinstaluje. ` +
    `První lekce bez účtu.`,
  /* Vstupní stránka pro reklamu. V Googlu nemá soutěžit s `/`. */
  robots: { index: false, follow: true },
  alternates: { canonical: `${SITE.url}/pro-rodice` },
};

/* Jako `/`: osnova se mění zřídka, změna se má projevit bez nasazení. */
export const revalidate = 300;

const CO_CEKA = [
  {
    icon: Clock,
    title: `7${NBSP}lekcí po 20–30${NBSP}minutách`,
    body: `V${NBSP}každé lekci dítě zapojí obvod a${NBSP}naprogramuje ho.`,
  },
  {
    icon: Puzzle,
    title: "Bloky i kód",
    body: `Program poskládá z${NBSP}barevných bloků, nebo ho napíše v${NBSP}kódu.`,
  },
  {
    icon: Award,
    title: "Certifikát na konci",
    body: "Za dokončený kurz dostane dítě certifikát.",
  },
] as const;

const PRO_RODICE = [
  { icon: Gift, title: "Zdarma", body: "Lekce nic nestojí." },
  {
    icon: Globe,
    title: "Nic se neinstaluje",
    body: `Učebna běží v${NBSP}prohlížeči, stačí počítač nebo notebook.`,
  },
  {
    icon: Play,
    title: "První lekce bez účtu",
    body: "Dítě může začít hned, bez registrace.",
  },
  {
    icon: UserRound,
    title: "Účet zakládá rodič",
    body: "Pro uložení postupu a certifikát založíte účet vy, ne dítě.",
  },
] as const;

export default async function ProRodicePage() {
  const outline = await getCourseOutline("iot");
  const firstLesson = firstPlayableLesson(outline);
  const lessonHref = firstLesson ? `/kurz/iot/${firstLesson.slug}` : "/kurz/iot";

  return (
    <main>
      {/* ── Hero: nadpis, formulář / lekce, video ──────────────────────── */}
      <section className="blueprint-grid-dark relative overflow-hidden border-b border-ink bg-ink text-paper">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 select-none font-display text-[26rem] font-bold leading-none text-paper/[0.04]"
        >
          W
        </span>

        <div className="section-container relative grid items-start gap-12 py-7 sm:py-16 lg:grid-cols-12 lg:py-20">
          <div className="lg:col-span-7">
            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-400">
              {`Online učebna · děti od 9${NBSP}let`}
            </p>

            <h1 className="heading-1 mb-4 text-balance text-paper">
              Arduino pro vaše dítě.{" "}
              <span className="text-cta-400">Zdarma, v{NBSP}prohlížeči.</span>
            </h1>

            <p className="mb-6 max-w-xl text-base leading-relaxed text-paper/75 text-pretty sm:mb-8 sm:text-lg">
              Dítě si zapojí obvod, naprogramuje ho a{NBSP}uvidí LEDku svítit.
            </p>

            <div className="max-w-xl">
              <DeviceOrder lessonHref={lessonHref} />
            </div>
          </div>

          <div className="lg:col-span-5">
            <figure className="relative mx-auto w-full max-w-[18rem] lg:max-w-[20rem]">
              <div
                aria-hidden="true"
                className="absolute inset-0 translate-x-3 translate-y-3 rounded-md bg-cta-400"
              />
              <video
                className="relative block aspect-[9/16] w-full rounded-md border border-paper/20 bg-ink"
                width={540}
                height={960}
                muted
                playsInline
                loop
                controls
                preload="none"
                poster="/video/ucebna-v6-poster.jpg"
                aria-label="Ukázka učebny: zapojení obvodu a program pro Arduino"
              >
                <source src="/video/ucebna-v6-9x16.mp4" type="video/mp4" />
              </video>
              <figcaption className="sr-only">Krátká ukázka, jak učebna vypadá.</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ── Co dítě čeká ─────────────────────────────────────────────── */}
      <section className="bg-paper">
        <div className="section-container py-14 sm:py-20">
          <MonoLabel className="mb-3">Kurz Arduina</MonoLabel>
          <h2 className="heading-2 mb-10 text-balance">Co dítě čeká</h2>

          <ul className="grid gap-8 md:grid-cols-3 md:gap-6">
            {CO_CEKA.map((item) => (
              <li key={item.title}>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md border border-ink bg-white text-accent-600 shadow-hard-sm">
                  <item.icon className="h-7 w-7" aria-hidden="true" />
                </div>
                <h3 className="mb-2 font-display text-xl font-semibold text-ink">{item.title}</h3>
                <p className="max-w-sm leading-relaxed text-ink-500">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Pro rodiče ───────────────────────────────────────────────── */}
      <section className="border-y border-trust-200 bg-trust-50">
        <div className="section-container py-14 sm:py-20">
          <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-trust-700">
            Pro rodiče
          </p>
          <h2 className="heading-2 mb-10 text-balance">Co máte jisté</h2>

          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {PRO_RODICE.map((item) => (
              <li key={item.title}>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md border border-trust-600 bg-white text-trust-600">
                  <item.icon className="h-7 w-7" aria-hidden="true" />
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold text-ink">{item.title}</h3>
                <p className="leading-relaxed text-ink-500">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Kdo za tím stojí ─────────────────────────────────────────── */}
      <section className="bg-paper-soft">
        <div className="section-container py-14 sm:py-16">
          <MonoLabel className="mb-3">Kdo za tím stojí</MonoLabel>
          <p className="max-w-2xl text-lg leading-relaxed text-ink-700 text-pretty">
            Učebnu provozuje Weeks – tým, který v{NBSP}létě pořádá příměstské tábory pro děti.
          </p>
          <a
            href="https://weeks.cz/tabory"
            className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-ink underline decoration-trust-600 decoration-2 underline-offset-4 hover:decoration-ink"
          >
            Letní tábory na weeks.cz
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>
    </main>
  );
}
