import "server-only";
import { redirect } from "next/navigation";
import { getActiveChild } from "@/features/children/queries";
import { getLobbyData } from "@/features/lobby/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * Přihlášený rodič + aktivní profil + data kurzu pro sbírku.
 * Bez přihlášení na přihlášení, bez aktivního profilu zpět na výběr
 * v lobby (`/ucim-se`).
 */
export async function loadCollection(next: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/prihlaseni?next=${encodeURIComponent(next)}`);

  const { active } = await getActiveChild(auth.user.id);
  if (!active) redirect("/ucim-se");

  const data = await getLobbyData(active, auth.user.id);
  return { child: active, data };
}
