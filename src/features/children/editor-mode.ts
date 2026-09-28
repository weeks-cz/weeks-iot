import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { isEditorMode, type EditorMode } from "@/features/blocks/mode";
import { getActiveChild } from "./queries";

/**
 * Režim editoru uložený u profilu.
 *
 * Sloupec `children.editor_mode` je mimo klientský grant (migrace 012),
 * proto servisní klient. Volající ručí za to, že `childId` patří
 * přihlášenému účtu — bere se z `getActiveChild`, nikdy z prohlížeče.
 *
 * @returns režim, `null` když profil ještě nevybral, `undefined` když se
 *   dotaz nepovedl. Lekce pak jede jako u anonyma (podle prohlížeče) —
 *   nepřečtená volba nesmí dítěti zablokovat práci.
 */
export async function getChildEditorMode(
  childId: string,
): Promise<EditorMode | null | undefined> {
  const { data, error } = await createServiceClient()
    .from("children")
    .select("editor_mode")
    .eq("id", childId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[editor-mode] Čtení selhalo:", error.message);
    return undefined;
  }
  return isEditorMode(data.editor_mode) ? data.editor_mode : null;
}

export async function setChildEditorMode(childId: string, mode: EditorMode): Promise<boolean> {
  const { error } = await createServiceClient()
    .from("children")
    .update({ editor_mode: mode })
    .eq("id", childId);

  if (error) console.error("[editor-mode] Zápis selhal:", error.message);
  return !error;
}

/** Režim aktivního profilu; `undefined`, když není jasné, kdo se učí. */
export async function activeChildEditorMode(
  parentId: string,
): Promise<EditorMode | null | undefined> {
  const { active } = await getActiveChild(parentId);
  return active ? getChildEditorMode(active.id) : undefined;
}
