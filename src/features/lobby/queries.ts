import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ChildSummary } from "@/features/children/queries";
import { getCourseOutline } from "@/features/courses/queries";
import { childBuilds, type SavedBuild } from "@/features/collection/queries";
import { earnedCertificates, type EarnedCertificate } from "@/features/certificates/queries";
import type { CampOffer } from "@/features/camp/offer";
import { parentCampOffer } from "@/features/camp/parent-offer";
import { coursePath, type PathLesson } from "./model";

/** Lobby čte jediný kurz, dokud je jediný (návrh §5.2). */
const LOBBY_COURSE = "iot";

export interface LobbyStats {
  lessons: number;
  /** Postavené obvody = hotové lekce, ne řádky v `projects` (návrh §9.3). */
  builds: number;
  certificates: number;
}

export interface LobbyData {
  course: { slug: string; title: string };
  /** Publikované lekce kurzu. Prázdné, když kurz v databázi chybí. */
  path: PathLesson[];
  builds: Map<string, SavedBuild>;
  certificate: EarnedCertificate | null;
  camp: CampOffer;
  stats: LobbyStats;
}

/**
 * Všechno, co lobby dítěte potřebuje, jedním průchodem a paralelně.
 *
 * Hero a mapa cesty stojí jen na osnově a postupu. Sbírka, certifikát
 * a tábor jsou doplňky: když jejich dotaz selže, lobby se vykreslí bez
 * nich (prázdná sbírka se vzory, zamčený certifikát, žádný tábor) —
 * dítě musí vždycky vidět „Pokračovat".
 *
 * `child` dodává `getActiveChild`, který profil dohledal v profilech
 * přihlášeného rodiče, takže `child.id` je ověřené.
 */
export async function getLobbyData(child: ChildSummary, parentId: string): Promise<LobbyData> {
  const supabase = await createClient();

  const [outline, progress, builds, certificates, camp] = await Promise.all([
    getCourseOutline(LOBBY_COURSE),
    supabase
      .from("progress")
      .select("lesson_id, status")
      .eq("child_id", child.id)
      .eq("status", "completed"),
    childBuilds(child.id, LOBBY_COURSE).catch((error: unknown) => {
      console.error("[lobby] výtvory se nenačetly", error);
      return new Map<string, SavedBuild>();
    }),
    earnedCertificates(child.id, child.nick).catch((error: unknown) => {
      console.error("[lobby] certifikáty se nenačetly", error);
      return [] as EarnedCertificate[];
    }),
    parentCampOffer(parentId).catch((error: unknown) => {
      console.error("[lobby] nabídka tábora se nenačetla", error);
      return null;
    }),
  ]);

  /* Bez postupu by hero lhal („Postavíme první obvod?" dítěti, které má
     půl kurzu) — tady je lepší chybová stránka než doplněk bez dat. */
  if (progress.error) throw progress.error;

  const published = (outline?.lessons ?? []).filter((l) => l.isPublished);
  const doneIds = new Set((progress.data ?? []).map((p) => p.lesson_id));
  const completed = new Set(published.filter((l) => doneIds.has(l.id)).map((l) => l.slug));
  const path = coursePath(published, completed);

  return {
    course: { slug: outline?.slug ?? LOBBY_COURSE, title: outline?.title ?? "Kurz" },
    path,
    builds,
    certificate: certificates.find((c) => c.courseSlug === LOBBY_COURSE) ?? null,
    camp,
    stats: {
      lessons: completed.size,
      builds: completed.size,
      certificates: certificates.length,
    },
  };
}
