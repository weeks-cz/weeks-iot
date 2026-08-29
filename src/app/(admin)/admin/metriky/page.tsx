import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { Card, MonoLabel } from "@/components/ui/Surface";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/server";
import { BarList, Funnel, StatTile, Timeline } from "@/features/metrics/components/Charts";
import { RANGES, getMetrics, type Range } from "@/features/metrics/queries";

export const metadata: Metadata = {
  title: "Metriky",
  robots: { index: false, follow: false },
};

/* Agregáty se počítají servisním klientem, tedy mimo RLS. Stránka se proto
   nesmí cachovat ani předgenerovat. */
export const dynamic = "force-dynamic";

/**
 * Kdo dashboard vidí.
 *
 * Role v databázi zatím nemáme a zavádět je kvůli jedné stránce by bylo
 * víc práce než užitku. Seznam adres v proměnné prostředí je hrubý, ale
 * poctivý: mimo ni se nikdo nedostane a přidání člověka je jedna změna
 * v nastavení, ne migrace.
 */
function isAdmin(email: string | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.METRICS_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ obdobi?: string }>;
}) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) redirect("/prihlaseni?next=%2Fadmin%2Fmetriky");

  /* 404 místo 403 schválně: kdo tam nemá co dělat, se nemá dozvědět,
     že stránka existuje. */
  if (!isAdmin(auth.user.email)) notFound();

  const params = await searchParams;
  const range = (RANGES.find((r) => r.id === params.obdobi)?.id ?? "30d") as Range;
  const m = await getMetrics(range);

  return (
    <main className="min-h-dvh bg-paper">
      <header className="border-b border-ink/15 bg-white">
        <div className="section-container flex h-16 items-center justify-between gap-4">
          <Logo href="/ucet" />
          <span className="mono-label">Metriky</span>
        </div>
      </header>

      <div className="section-container py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <MonoLabel className="mb-2">Brána 1 · 19. 10. 2026</MonoLabel>
            <h1 className="heading-2">Jak na tom jsme</h1>
          </div>

          {/* Jeden filtrovací řádek nad vším, co ovlivňuje. Filtr uvnitř
              karty by měnil jen ji a čísla by si přestala odpovídat. */}
          <nav aria-label="Období" className="flex gap-1 rounded-md border border-ink/15 bg-white p-1">
            {RANGES.map((r) => (
              <Link
                key={r.id}
                href={`/admin/metriky?obdobi=${r.id}`}
                aria-current={r.id === range ? "true" : undefined}
                className={cn(
                  "rounded-sm px-3 py-1.5 font-mono text-xs transition-colors",
                  r.id === range
                    ? "bg-ink text-paper"
                    : "text-ink-500 hover:bg-paper-soft hover:text-ink",
                )}
              >
                {r.label}
              </Link>
            ))}
          </nav>
        </div>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Registrovaní zvenčí"
            stat={m.registered}
            hint="Dokončený onboarding, ne otevřená stránka."
          />
          <StatTile
            label="Dokončení lekce 1"
            stat={m.lessonCompletion}
            unit="%"
            hint="Z těch, kdo ji začali — včetně anonymních. Tohle je metrika brány."
          />
          <StatTile
            label="V cílové skupině"
            stat={m.inTargetGroup}
            unit="%"
            hint="Účty s profilem ve věku 10–15 let."
          />
          <StatTile
            label="Návrat v dalším týdnu"
            stat={m.weeklyReturn}
            unit="%"
            hint="Aspoň jedna začatá lekce v týdnu po registraci."
          />
        </section>

        <section className="mb-8">
          <Card className="p-5">
            <h2 className="heading-3 mb-1">Vývoj</h2>
            <p className="mb-4 text-sm text-ink-500">
              Registrace a začaté lekce po dnech.
            </p>
            <Timeline points={m.timeline} />
          </Card>
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="heading-3 mb-1">Trychtýř</h2>
            <p className="mb-4 text-sm text-ink-500">
              Unikátní lidé v každém kroku. Největší propad ukazuje, co opravit první.
            </p>
            <Funnel stages={m.funnel} />
          </Card>

          <Card className="p-5">
            <h2 className="heading-3 mb-1">Odkud přišli</h2>
            <p className="mb-4 text-sm text-ink-500">
              Registrace podle zdroje. Útratu doplň z Google Ads a Meta —
              cena za registraci se počítá z toho.
            </p>
            <BarList items={m.bySource} caption="Registrace podle zdroje" />
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5">
            <h2 className="heading-3 mb-1">Kraje</h2>
            <p className="mb-4 text-sm text-ink-500">Kdo uvidí termín a kdo čekačku.</p>
            <BarList items={m.byRegion} caption="Registrace podle kraje" max={8} />
          </Card>

          <Card className="p-5">
            <h2 className="heading-3 mb-1">Čekačka měst</h2>
            <p className="mb-4 text-sm text-ink-500">
              Podklad pro expanzi 2028. Cíl: 2 města s deseti zájemci.
            </p>
            <BarList items={m.cityWaitlist} caption="Čekačka měst" max={8} />
          </Card>

          <Card className="p-5">
            <h2 className="heading-3 mb-1">Kliky na tábor</h2>
            <p className="mb-4 text-sm text-ink-500">
              Které místo v aplikaci prodává.
            </p>
            <BarList items={m.campClicks} caption="Kliky na tábor podle umístění" max={8} />
          </Card>
        </section>

        <p className="mt-8 font-mono text-xs text-ink-300">
          Spočítáno {new Date(m.generatedAt).toLocaleString("cs-CZ")} · stejné dotazy jako
          docs/metriky-brana-1.sql
        </p>
      </div>
    </main>
  );
}
