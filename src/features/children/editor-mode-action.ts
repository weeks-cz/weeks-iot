"use server";

import { createClient } from "@/lib/supabase/server";
import { isEditorMode } from "@/features/blocks/mode";
import { getActiveChild } from "./queries";
import { setChildEditorMode } from "./editor-mode";

/**
 * Uloží režim editoru aktivnímu profilu.
 *
 * Id profilu z prohlížeče nechodí — server ho odvodí z účtu a cookie,
 * stejně jako u zápisu postupu. Nic nevyhazuje: neuložená volba jen
 * nepřežije přechod na jiný počítač, lekci nerozbije.
 */
export async function saveEditorModeAction(mode: unknown): Promise<{ ok: boolean }> {
  if (!isEditorMode(mode)) return { ok: false };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };

  const { active } = await getActiveChild(auth.user.id);
  if (!active) return { ok: false };

  return { ok: await setChildEditorMode(active.id, mode) };
}
