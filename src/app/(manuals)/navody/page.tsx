import Link from "next/link";
import { programmingGuides } from "@/features/programming-guides/guides";

export const metadata = {
  title: "Programovací návody | Weeks IoT",
  description: "Přehled samostatných URL stránek s návody pro konkrétní zadání.",
};

export default function ProgrammingGuidesIndexPage() {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-[2rem] border border-white/10 bg-black/20 p-8 backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--theme-muted)]">
            Návody
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-white">Samostatné stránky pro zadání</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200/85">
            Tady jsou veřejné návody určené pro přímé otevření přes URL. Jsou oddělené od
            interních dokumentů v repozitáři a připravené na další rozšiřování.
          </p>
        </header>

        <section className="grid gap-4">
          {programmingGuides.map((guide) => (
            <Link
              key={guide.slug}
              href={`/navody/${guide.slug}`}
              className="group rounded-[1.5rem] border border-white/10 bg-black/20 p-6 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/8"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--theme-muted)]">
                /navody/{guide.slug}
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">{guide.title}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200/85">{guide.summary}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
