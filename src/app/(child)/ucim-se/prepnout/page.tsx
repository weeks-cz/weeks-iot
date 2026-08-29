import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { MonoLabel } from "@/components/ui/Surface";
import { createClient } from "@/lib/supabase/server";
import { ProfileSwitcher } from "@/features/children/components/ProfileSwitcher";
import { getChildren } from "@/features/children/queries";

export const metadata: Metadata = {
  title: "Přepnutí profilu",
  robots: { index: false, follow: false },
};

/**
 * Výběr profilu.
 *
 * Cookie s aktivním profilem se tu ZÁMĚRNĚ nemaže. Next.js zakazuje měnit
 * cookies ze Server Componenty — smí to jen Server Action nebo route
 * handler — a volání `cookies().delete()` odsud stránku shodilo. Projevilo
 * se to jako chybová stránka po kliknutí na „Pokračovat" v účtu.
 *
 * Mazat ji ani není potřeba: tahle stránka výběr vždycky nabídne bez ohledu
 * na to, co je v cookie, a nová volba tu starou přepíše přes
 * `switchChildAction`, což Server Action je.
 *
 * `?dite=<id>` je předvýběr, ne oprávnění. Profil s PINem si o něj řekne
 * i tak a cizí id se v seznamu tohohle účtu nenajde.
 */
export default async function SwitchProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ dite?: string }>;
}) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/prihlaseni?next=%2Fucim-se");

  const children = await getChildren(auth.user.id);
  if (children.length === 0) redirect("/ucet/deti");

  const { dite } = await searchParams;
  const preselected = children.find((c) => c.id === dite) ?? null;

  return (
    <main className="min-h-dvh bg-paper blueprint-grid">
      <div className="section-container py-10">
        <Logo className="mb-8" />
        <MonoLabel className="mb-2">Výběr profilu</MonoLabel>
        <h1 className="heading-2 mb-6">
          {children.length === 1 ? "Pokračovat v učení" : "Kdo se dneska učí?"}
        </h1>
        <ProfileSwitcher profiles={children} preselectedId={preselected?.id ?? null} />
      </div>
    </main>
  );
}
