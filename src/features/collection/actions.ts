"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveChild } from "@/features/children/queries";
import { lessonBuildSchema } from "./schema";
import { writeLessonBuild } from "./write";

/**
 * Uložení výtvoru přihlášeného dítěte do sbírky.
 *
 * Stejná pravidla jako `saveLessonProgressAction`: vstup z prohlížeče se
 * validuje, id profilu odvodí server z účtu a cookie (nikdy z klienta)
 * a nic nevyhazuje — neuložený výtvor nesmí rozbít obrazovku s hotovou
 * lekcí.
 */
export async function saveLessonBuildAction(input: unknown): Promise<{ ok: boolean }> {
  const parsed = lessonBuildSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };

  const { active } = await getActiveChild(auth.user.id);
  if (!active) return { ok: false };

  try {
    return { ok: await writeLessonBuild(active.id, parsed.data) };
  } catch (err) {
    console.error("[sbírka] Zápis výtvoru selhal:", err);
    return { ok: false };
  }
}
