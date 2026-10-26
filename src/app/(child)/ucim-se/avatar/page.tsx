import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MonoLabel } from "@/components/ui/Surface";
import { AvatarPicker } from "@/features/children/components/AvatarPicker";
import { getActiveChild } from "@/features/children/queries";

export const metadata: Metadata = {
  title: "Změna avataru",
  robots: { index: false, follow: false },
};

export default async function AvatarPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/prihlaseni?next=%2Fucim-se%2Favatar");

  /* Bez vybraného profilu není koho měnit — lobby nabídne výběr profilu. */
  const { active } = await getActiveChild(auth.user.id);
  if (!active) redirect("/ucim-se");

  return (
    <main className="flex-1 bg-paper blueprint-grid">
      <div className="section-container py-10">
        <MonoLabel className="mb-2">Profil</MonoLabel>
        <h1 className="heading-2 mb-6">Vyber si avatar</h1>
        <AvatarPicker current={active.avatar} />
        <Link
          href="/ucim-se"
          className="mt-8 inline-block text-sm font-medium text-primary-700 underline underline-offset-4"
        >
          Zpět do lobby
        </Link>
      </div>
    </main>
  );
}
