import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { buildDate } from "@/features/collection/components/BuildCard";
import { CircuitThumb } from "@/features/collection/components/CircuitThumb";
import { collectionItems } from "@/features/collection/queries";
import { CodeView } from "@/features/lessons/components/CodeEditor";
import { loadCollection } from "../loader";

export const metadata: Metadata = {
  title: "Výtvor ze sbírky",
  robots: { index: false, follow: false },
};

export default async function BuildDetailPage({
  params,
}: {
  params: Promise<{ lekce: string }>;
}) {
  const { lekce } = await params;
  const { data } = await loadCollection(`/ucim-se/sbirka/${lekce}`);

  /* Jen hotové publikované lekce: nehotová i neexistující je 404. */
  const item = collectionItems(data.path, data.builds).find((i) => i.slug === lekce);
  if (!item) notFound();
  const build = data.builds.get(lekce);

  return (
    <main className="flex-1 bg-paper">
      <div className="section-container max-w-4xl py-8">
        <Link
          href="/ucim-se/sbirka"
          className="inline-flex min-h-11 items-center gap-2 rounded-sm font-semibold text-primary-700 underline-offset-4 hover:underline"
        >
          <span aria-hidden="true">←</span> Zpět do sbírky
        </Link>

        <h1 className="heading-2 mt-2">{item.title}</h1>
        <p className="mb-5 text-ink-500">
          {item.updatedAt ? `Uloženo ${buildDate(item.updatedAt)}` : "hotová lekce"}
        </p>

        <div className="relative">
          <CircuitThumb circuit={item.circuit} label={`Obvod z lekce ${item.title}`} height={360} />
          {item.reference && (
            <span className="absolute left-3 top-3 rounded-sm bg-paper/90 px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider text-ink-500">
              vzorové zapojení
            </span>
          )}
        </div>

        <section className="mt-6">
          <h2 className="mono-label mb-3">Program</h2>
          {build ? (
            <>
              {build.data.mode === "blocks" && (
                <p className="mb-2 text-sm text-ink-500">
                  Skládal jsi z bloků, tady je program z nich vygenerovaný.
                </p>
              )}
              <CodeView code={build.data.code} />
            </>
          ) : (
            <p className="card-maker p-4 text-ink-500">
              Tuhle lekci jsi dokončil dřív, než jsme začali ukládat výtvory. Otevři ji znovu a
              tvoje verze se sem uloží.
            </p>
          )}
        </section>

        <div className="mt-8">
          <ButtonLink variant="primary" href={`/kurz/${data.course.slug}/${item.slug}`}>
            Otevřít lekci znovu
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
