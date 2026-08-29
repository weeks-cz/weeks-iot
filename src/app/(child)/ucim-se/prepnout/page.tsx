import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { MonoLabel } from "@/components/ui/Surface";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_CHILD_COOKIE } from "@/features/children/constants";
import { ProfileSwitcher } from "@/features/children/components/ProfileSwitcher";
import { getChildren } from "@/features/children/queries";

export const metadata: Metadata = {
  title: "Přepnutí profilu",
  robots: { index: false, follow: false },
};

/**
 * Přepnutí profilu.
 *
 * Zapomene aktuální volbu a nechá vybrat znovu. Odkaz z rodičovské zóny
 * sem může přijít s `?dite=<id>` — to je jen předvýběr, ne autorizace:
 * profil s PINem si o něj stejně řekne a cizí id se nikde nenajde.
 */
export default async function SwitchProfilePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/prihlaseni?next=%2Fucim-se");

  const children = await getChildren(auth.user.id);
  if (children.length === 0) redirect("/ucet/deti");

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_CHILD_COOKIE);

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
