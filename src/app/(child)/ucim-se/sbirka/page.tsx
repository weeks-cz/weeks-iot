import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { BuildCard } from "@/features/collection/components/BuildCard";
import { collectionItems } from "@/features/collection/queries";
import { CertificateTile } from "@/features/lobby/components/CertificateTile";
import { certificateCourse } from "@/features/lobby/components/LobbyHeroView";
import { loadCollection } from "./loader";

export const metadata: Metadata = {
  title: "Sbírka",
  robots: { index: false, follow: false },
};

export default async function CollectionPage() {
  const { child, data } = await loadCollection("/ucim-se/sbirka");
  const items = collectionItems(data.path, data.builds);
  const remaining = data.path.filter((l) => !l.done).length;
  const next = data.path.find((l) => !l.done);

  return (
    <main className="flex-1 bg-paper">
      <div className="section-container py-8">
        <h1 className="heading-2 mb-6">Tvoje sbírka</h1>

        <div className="mb-8 max-w-md">
          <CertificateTile
            certificate={data.certificate}
            pdfHref={`/ucet/certifikat/${child.id}/${data.course.slug}/`}
            nick={child.nick}
            course={certificateCourse(data.course, data.path)}
            lessons={data.path.length}
            remaining={remaining}
          />
        </div>

        <h2 className="mono-label mb-4">Co jsi postavil</h2>
        {items.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <BuildCard key={item.slug} item={item} />
            ))}
          </ul>
        ) : (
          <div className="card-maker max-w-xl p-6">
            <p className="mb-4 text-ink-500">
              Zatím tu nic není. Dokonči první lekci a tvůj obvod se tu objeví.
            </p>
            {next && (
              <ButtonLink variant="primary" href={`/kurz/${data.course.slug}/${next.slug}`}>
                Začít lekci {next.title} →
              </ButtonLink>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
