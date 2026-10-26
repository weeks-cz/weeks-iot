import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, MonoLabel } from "@/components/ui/Surface";
import { createClient } from "@/lib/supabase/server";
import { ProfileSwitcher } from "@/features/children/components/ProfileSwitcher";
import { getActiveChild } from "@/features/children/queries";
import { ZapsatLekci } from "@/features/progress/components/ZapsatLekci";
import { parseLessonKey } from "@/features/progress/lesson-key";
import { CoursePath } from "@/features/lobby/components/CoursePath";
import { LobbyBottom } from "@/features/lobby/components/LobbyBottom";
import { LobbyHero } from "@/features/lobby/components/LobbyHero";
import { getLobbyData } from "@/features/lobby/queries";

export const metadata: Metadata = {
  title: "Učím se",
  robots: { index: false, follow: false },
};

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ zapsat?: string }>;
}) {
  /* Hotová lekce z obrazovky „Postup se zatím neukládá" — viz ZapsatLekci. */
  const zapsat = parseLessonKey((await searchParams).zapsat);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/prihlaseni?next=%2Fucim-se");

  /* Cookie je jen volba, ne oprávnění — profil se vždycky dohledává
     v seznamu profilů TOHOTO účtu. Jediný profil bez PINu se vybírat
     nemusí; pravidlo je v `pickActiveChild` a sdílí ho i zápis postupu. */
  const { active, children } = await getActiveChild(auth.user.id);
  if (children.length === 0) redirect("/ucet/deti");

  if (!active) {
    return (
      <main className="flex-1 bg-paper blueprint-grid">
        <div className="section-container py-10">
          <MonoLabel className="mb-2">Výběr profilu</MonoLabel>
          <h1 className="heading-2 mb-6">Kdo se dneska učí?</h1>
          <ProfileSwitcher profiles={children} zapsat={zapsat} />
        </div>
      </main>
    );
  }

  const data = await getLobbyData(active, auth.user.id);

  /* Kurz v databázi chybí nebo nemá publikovanou lekci — lobby nemá co
     ukázat a „hotovo" by lhalo. */
  if (data.path.length === 0) {
    return (
      <main className="flex-1 bg-paper">
        <div className="section-container py-10">
          {zapsat && <ZapsatLekci lessonKey={zapsat} />}
          <Card className="max-w-2xl p-6">
            <h1 className="heading-3 mb-2">Lekce právě chystáme</h1>
            <p className="text-ink-500">Brzy se vrať — první lekce tu bude co nevidět.</p>
          </Card>
        </div>
      </main>
    );
  }

  /* Jedna cesta a jedno „Pokračovat", ne mřížka úkolů. Nic se nezamyká
     (nález N8) — mapa cesty pořadí jen doporučuje. */
  return (
    <main className="flex-1 bg-paper">
      {zapsat && (
        <div className="section-container pt-6">
          <ZapsatLekci lessonKey={zapsat} />
        </div>
      )}
      <LobbyHero data={data} childId={active.id} nick={active.nick} avatar={active.avatar} />
      <CoursePath course={data.course} path={data.path} />
      <LobbyBottom
        course={data.course}
        path={data.path}
        builds={data.builds}
        certificate={data.certificate}
        camp={data.camp}
        nick={active.nick}
        childId={active.id}
      />
    </main>
  );
}
