import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MonoLabel } from "@/components/ui/Surface";
import { createClient } from "@/lib/supabase/server";
import { ChildManager } from "@/features/children/components/ChildManager";
import { getChildren } from "@/features/children/queries";
import { voiceFor } from "@/features/account/voice";

export const metadata: Metadata = { title: "Profily dětí" };

export default async function ChildrenPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/prihlaseni");

  const { data: parent } = await supabase
    .from("parents")
    .select("account_type")
    .eq("id", auth.user.id)
    .maybeSingle();

  const voice = voiceFor(parent?.account_type);
  const children = await getChildren(auth.user.id);

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <MonoLabel className="mb-2">{voice.canAddProfiles ? "Rodina" : "Profil"}</MonoLabel>
        <h1 className="heading-2 mb-3">{voice.profilesHeading}</h1>
        <p className="max-w-prose leading-relaxed text-ink-500">
          {voice.profilesLead}
        </p>
      </header>

      <ChildManager profiles={children} canAdd={voice.canAddProfiles} />
    </div>
  );
}
