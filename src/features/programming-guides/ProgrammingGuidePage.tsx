import Link from "next/link";
import { ArrowUpRight, ChevronLeft, X } from "lucide-react";
import type { ProgrammingGuide } from "@/features/programming-guides/guides";

type ProgrammingGuidePageProps = {
  guide: ProgrammingGuide;
};

export function ProgrammingGuidePage({ guide }: ProgrammingGuidePageProps) {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Link
        href="/"
        className="absolute inset-0 block"
        aria-label="Prejit na hlavni stranku Weeks"
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[3px] transition duration-300 hover:bg-black/60" />
        <div className="absolute inset-x-0 bottom-4 flex justify-center px-4 sm:bottom-6">
          <div className="rounded-full border border-white/12 bg-white/10 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/78 backdrop-blur-md sm:text-xs sm:tracking-[0.22em]">
            Klik na pozadi otevre hlavni stranku
          </div>
        </div>
      </Link>

      <div className="relative z-10 flex min-h-screen items-end justify-center px-2 pt-16 pb-0 sm:items-center sm:px-6 sm:py-6 lg:px-10">
        <section className="relative flex h-[88vh] min-h-[680px] w-full max-w-6xl flex-col overflow-hidden rounded-t-[2rem] border border-white/14 bg-[linear-gradient(180deg,rgba(23,31,49,0.96)_0%,rgba(17,23,38,0.98)_100%)] shadow-[0_40px_140px_rgba(0,0,0,0.48)] sm:h-auto sm:max-h-[92vh] sm:min-h-0 sm:rounded-[2rem]">
          <div className="absolute inset-x-0 top-0 h-px bg-white/18" />
          <div className="absolute left-4 top-2 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl sm:left-10 sm:top-0 sm:h-44 sm:w-44" />
          <div className="absolute right-4 top-6 h-24 w-24 rounded-full bg-amber-300/10 blur-3xl sm:right-8 sm:top-8 sm:h-36 sm:w-36" />

          <header className="relative flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:items-center sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/navody"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/80 transition hover:bg-white/10 hover:text-white"
                aria-label="Zpet na prehled navodu"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>

              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/72 sm:text-[11px] sm:tracking-[0.28em]">
                  Specialni okno
                </p>
                <h1 className="truncate text-base font-semibold text-white sm:text-xl">
                  {guide.title}
                </h1>
              </div>
            </div>

            <Link
              href="/"
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 text-sm font-medium text-white/82 transition hover:bg-white/10 hover:text-white"
            >
              <span className="hidden sm:inline">Zavrit</span>
              <X className="h-4 w-4" />
            </Link>
          </header>

          <div className="relative grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1.2fr)_340px]">
            <section className="flex min-h-0 flex-col overflow-y-auto px-4 py-5 sm:px-8 sm:py-8">
              <div className="space-y-5 sm:space-y-6">
                <div className="inline-flex w-fit rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/86 sm:px-4 sm:text-xs sm:tracking-[0.24em]">
                  /navody/{guide.slug}
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                    Velke popup okno pro samostatny navod
                  </h2>
                  <p className="max-w-3xl text-sm leading-7 text-slate-200/82 sm:text-lg sm:leading-8">
                    Tohle je cista kostra noveho okna. Na pozadi zustava viditelna hlavni
                    stranka, ale je ztmavena filtrem, aby vizualne nerusila. Klik mimo obsah
                    uzivatele vrati zpet na hlavni web.
                  </p>
                </div>

                <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
                  <div className="rounded-[1.25rem] border border-white/10 bg-white/6 p-4 sm:rounded-[1.4rem] sm:p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300/72">
                      Chovani
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-100/86">
                      Klik do pozadi otevre hlavni stranku. Samotne okno zustava vzdy v
                      popredi.
                    </p>
                  </div>

                  <div className="rounded-[1.25rem] border border-white/10 bg-white/6 p-4 sm:rounded-[1.4rem] sm:p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300/72">
                      Vzhled
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-100/86">
                      Okno je velke, ciste a pripravene pro dalsi obsah bez michani s internimi
                      dokumenty.
                    </p>
                  </div>

                  <div className="rounded-[1.25rem] border border-white/10 bg-white/6 p-4 sm:rounded-[1.4rem] sm:p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300/72">
                      Rozsireni
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-100/86">
                      V dalsim kroku sem doplnime konkretni navod, kroky, obrazky nebo kod.
                    </p>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 mt-6 border-t border-white/10 bg-[linear-gradient(180deg,rgba(17,23,38,0),rgba(17,23,38,0.94)_22%,rgba(17,23,38,1)_100%)] pt-4 pb-2 sm:static sm:mt-8 sm:border-t-0 sm:bg-none sm:pt-0 sm:pb-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <Link
                    href="/"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-50"
                  >
                    Prejit na hlavni stranku
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>

                  <Link
                    href="/navody"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/6 px-5 py-3 text-sm font-semibold text-white/86 transition hover:bg-white/10 hover:text-white"
                  >
                    Zpet na prehled
                  </Link>
                </div>
              </div>
            </section>

            <aside className="border-t border-white/10 bg-black/18 px-4 py-5 sm:px-7 sm:py-7 lg:border-t-0 lg:border-l">
              <div className="space-y-4 sm:space-y-5">
                <div className="rounded-[1.25rem] border border-white/10 bg-white/6 p-4 sm:rounded-[1.5rem] sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300/72">
                    Stav
                  </p>
                  <p className="mt-3 text-sm leading-7 text-white/84">
                    Zatim je pripraveny jen vizualni shell okna podle zadani.
                  </p>
                </div>

                <div className="rounded-[1.25rem] border border-cyan-300/14 bg-cyan-300/8 p-4 sm:rounded-[1.5rem] sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/76">
                    Co bude dal
                  </p>
                  <ul className="mt-3 space-y-3 text-sm leading-7 text-cyan-50/90">
                    <li>Doplnime konkretni obsah navodu.</li>
                    <li>Pridame proklikatelne sekce nebo kroky.</li>
                    <li>Vyladime zavirani, animace a detailni rozlozeni.</li>
                  </ul>
                </div>

                <div className="rounded-[1.25rem] border border-white/10 bg-white/6 p-4 sm:rounded-[1.5rem] sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300/72">
                    Poznamka
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-100/84">
                    Pokud tenhle route pobezi na domene `weeks.cz`, odkaz na pozadi i tlacitko
                    zavreni povedou na normalni uvodni stranku webu.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
