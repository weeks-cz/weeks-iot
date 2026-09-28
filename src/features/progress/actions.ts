"use server";

import { createClient } from "@/lib/supabase/server";
import { anonLessonSchema } from "@/features/anon-session/schema";
import { getActiveChild } from "@/features/children/queries";
import { writeLessonProgress } from "./write";

/**
 * Zápis dokončené lekce přihlášeného dítěte.
 *
 * Záznam lekce posílá prohlížeč — tentýž, který si drží v localStorage —
 * takže se validuje stejným schématem jako anonymní relace při registraci
 * a projde stejným sloučením (`writeLessonProgress`). Id profilu z klienta
 * nechodí vůbec: server ho odvodí sám z účtu a cookie, jinak by si kdokoli
 * mohl připsat postup cizímu dítěti.
 *
 * Nic nevyhazuje. Neuložený postup nesmí dítěti rozbít obrazovku s hotovou
 * lekcí; v prohlížeči zůstává a zapíše se při dalším dokončení.
 */
export async function saveLessonProgressAction(
  input: unknown,
): Promise<{ ok: boolean }> {
  const parsed = anonLessonSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };

  const { active } = await getActiveChild(auth.user.id);
  if (!active) return { ok: false };

  try {
    return { ok: await writeLessonProgress(active.id, [parsed.data]) };
  } catch (err) {
    console.error("[progress] Zápis lekce selhal:", err);
    return { ok: false };
  }
}
