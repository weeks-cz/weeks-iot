import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card, MonoLabel } from "@/components/ui/Surface";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_CHILD_COOKIE } from "@/features/children/constants";
import { ProfileSwitcher } from "@/features/children/components/ProfileSwitcher";
import { avatarGlyph } from "@/features/children/avatars";
import { getChildren } from "@/features/children/queries";

export const metadata: Metadata = {
  title: "Učím se",
  robots: { index: false, follow: false },
};

export default async function LearnPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/prihlaseni?next=%2Fucim-se");

  const children = await getChildren(auth.user.id);
  if (children.length === 0) redirect("/ucet/deti");

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_CHILD_COOKIE)?.value;
  const active = children.find((c) => c.id === activeId);

  /* Cookie je jen volba, ne oprávnění — proto se profil vždycky dohledává
     v seznamu dětí TOHOTO rodiče. Podvržené id tak nikam nevede. */
  if (!active) {
    return (
      <main className="min-h-dvh bg-paper blueprint-grid">
        <div className="section-container py-10">
          <Logo className="mb-8" />
          <MonoLabel className="mb-2">Výběr profilu</MonoLabel>
          <h1 className="heading-2 mb-6">Kdo se dneska učí?</h1>
          <ProfileSwitcher children={children} />
        </div>
      </main>
    );
  }

  const { data: course } = await supabase
    .from("courses")
    .select("slug, title, summary")
    .eq("slug", "iot")
    .maybeSingle();

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, slug, title, summary, order_index, estimated_minutes")
    .eq("is_published", true)
    .order("order_index");

  const { data: progress } = await supabase
    .from("progress")
    .select("lesson_id, status")
    .eq("child_id", active.id);

  const doneIds = new Set(
    (progress ?? []).filter((p) => p.status === "completed").map((p) => p.lesson_id),
  );

  /* Jedna cesta a jedno tlačítko „pokračovat", ne mřížka úkolů. Odemykání
     za hvězdičky se ruší (nález N8) — je to překážka postavená přímo do
     metriky, kterou chceme maximalizovat. */
  const nextLesson = (lessons ?? []).find((l) => !doneIds.has(l.id)) ?? null;
  const total = lessons?.length ?? 0;
  const done = doneIds.size;

  return (
    <main className="min-h-dvh bg-paper">
      <header className="border-b border-ink/15 bg-white">
        <div className="section-container flex h-16 items-center justify-between gap-4">
          <Logo href="/ucim-se" />
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">
              {avatarGlyph(active.avatar)}
            </span>
            <span className="font-semibold text-ink">{active.nick}</span>
            <Link
              href="/ucim-se/prepnout"
              className="rounded-sm text-sm text-ink-500 underline underline-offset-4 hover:text-ink"
            >
              Přepnout
            </Link>
          </div>
        </div>
      </header>

      <div className="section-container py-8">
        <MonoLabel className="mb-2">{course?.title ?? "Kurz"}</MonoLabel>
        <h1 className="heading-2 mb-2">Ahoj {active.nick}!</h1>

        {total > 0 && (
          <div className="mb-8 max-w-md">
            <p className="mb-2 font-mono text-sm text-ink-500">
              lekce {Math.min(done + 1, total)} ze {total}
            </p>
            <div
              className="h-2 overflow-hidden rounded-full bg-ink/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
              aria-label={`Dokončeno ${done} z ${total} lekcí`}
            >
              <div
                className="h-full bg-trust-500 transition-all"
                style={{ width: `${total ? (done / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {nextLesson ? (
          <Card interactive className="max-w-2xl p-6">
            <MonoLabel className="mb-2">Lekce {nextLesson.order_index}</MonoLabel>
            <h2 className="heading-3 mb-2">{nextLesson.title}</h2>
            {nextLesson.summary && (
              <p className="mb-4 leading-relaxed text-ink-500">{nextLesson.summary}</p>
            )}
            {nextLesson.estimated_minutes && (
              <p className="mb-5 font-mono text-xs text-ink-300">
                asi {nextLesson.estimated_minutes} minut
              </p>
            )}
            <ButtonLink href={`/kurz/${course?.slug ?? "iot"}/${nextLesson.slug}`} size="lg">
              Pokračovat →
            </ButtonLink>
          </Card>
        ) : (
          <Card className="max-w-2xl p-6">
            <h2 className="heading-3 mb-2">Máš hotovo všechno, co je zatím připravené</h2>
            <p className="text-ink-500">Další lekce přidáváme průběžně. Brzy se vrať.</p>
          </Card>
        )}
      </div>
    </main>
  );
}
