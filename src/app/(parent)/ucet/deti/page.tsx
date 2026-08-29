import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MonoLabel } from "@/components/ui/Surface";
import { createClient } from "@/lib/supabase/server";
import { ChildManager } from "@/features/children/components/ChildManager";
import { getChildren } from "@/features/children/queries";

export const metadata: Metadata = { title: "Profily dětí" };

export default async function ChildrenPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/prihlaseni");

  const children = await getChildren(auth.user.id);

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <MonoLabel className="mb-2">Rodina</MonoLabel>
        <h1 className="heading-2 mb-3">Profily dětí</h1>
        <p className="max-w-prose leading-relaxed text-ink-500">
          Každé dítě má svůj postup a své projekty. PIN je nepovinný — hodí se,
          když sourozenci sdílejí jeden počítač.
        </p>
      </header>

      <ChildManager profiles={children} />
    </div>
  );
}
