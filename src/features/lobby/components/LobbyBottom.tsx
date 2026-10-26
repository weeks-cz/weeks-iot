import { cn } from "@/lib/cn";
import type { CampOffer } from "@/features/camp/offer";
import { CampCard } from "@/features/camp/components/CampCard";
import type { EarnedCertificate } from "@/features/certificates/queries";
import type { SavedBuild } from "@/features/collection/queries";
import { lessonBySlug } from "@/features/lessons/content";
import { referenceCircuit } from "@/features/lessons/reference-circuit";
import { lobbyBuilds, type PathLesson } from "../model";
import { BuildsTile } from "./BuildsTile";
import { CertificateTile } from "./CertificateTile";
import { certificateCourse } from "./LobbyHeroView";

/** Vzorové zapojení lekce pro hotovou lekci bez uloženého výtvoru. */
function referenceFor(slug: string) {
  const lesson = lessonBySlug(slug);
  return lesson ? referenceCircuit(lesson.wiring) : null;
}

/**
 * Spodní řada lobby — čistě prezentační, data dostane hotová.
 *
 * Tři sekce stejné šířky i výšky (návrh R2: na náhledu nestejné, to byla
 * chyba náhledu): Co jsi postavil · Certifikát · Léto. Výšku drží mřížka
 * (`items-stretch`) a společné minimum, takže žádná sekce nepřeroste
 * ostatní. Když se tábor ukázat nemá, řada se zúží na dvě sekce — žádná
 * náhradní dlaždice, která by jen vyplňovala místo.
 */
export function LobbyBottom({
  course,
  path,
  builds,
  certificate,
  camp,
  nick,
  childId,
}: {
  course: { slug: string; title: string };
  path: PathLesson[];
  builds: ReadonlyMap<string, SavedBuild>;
  certificate: EarnedCertificate | null;
  camp: CampOffer;
  nick: string;
  childId: string;
}) {
  const next = path.find((l) => !l.done) ?? null;
  const remaining = path.filter((l) => !l.done).length;
  /* Společné minimum jen vedle sebe; pod sebou na telefonu by z karty
     tábora udělalo prázdnou plochu. */
  const cell = "h-full md:min-h-[22rem]";

  return (
    <section aria-label="Sbírka, certifikát a tábor" className="bg-paper">
      <div
        className={cn(
          "section-container grid items-stretch gap-5 py-8",
          camp ? "md:grid-cols-3" : "md:grid-cols-2",
        )}
      >
        <div className={cell}>
          <BuildsTile tiles={lobbyBuilds(path, builds, referenceFor)} next={next} />
        </div>
        <div className={cell}>
          <CertificateTile
            certificate={certificate}
            pdfHref={`/ucet/certifikat/${childId}/${course.slug}/`}
            nick={nick}
            course={certificateCourse(course, path)}
            lessons={path.length}
            remaining={remaining}
          />
        </div>
        {camp && (
          <div className={cell}>
            <CampCard offer={camp} placement="lobby" size="tile" className="h-full" />
          </div>
        )}
      </div>
    </section>
  );
}
