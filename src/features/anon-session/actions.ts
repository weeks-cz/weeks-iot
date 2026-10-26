"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { issueEarnedCertificates } from "@/features/certificates/issue";
import { writeLessonProgress } from "@/features/progress/write";
import type { ActionState } from "@/features/actions";
import { parseAnonSession } from "./parse";
import { parseAnonBuilds } from "@/features/collection/parse-builds";
import { writeAnonBuilds } from "@/features/collection/write";

/**
 * Převzetí rozdělaného postupu z tohohle počítače do účtu přihlášeného rodiče.
 *
 * Používá stejný zápis jako onboarding (`writeLessonProgress`). Rozdíl je
 * jediný: účet už existuje a dítě, kterému se postup připisuje, se vybírá
 * v nabídce — a tady se ověřuje, že patří přihlášenému rodiči.
 *
 * Nic se neprovádí automaticky. Volá to jen obrazovka, kterou rodič sám
 * potvrdí tlačítkem „Převzít“.
 */
export async function adoptAnonProgressAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { error: "Přihlaste se prosím znovu a zkuste to ještě jednou." };
  }

  const childId = z.string().uuid().safeParse(formData.get("childId"));
  if (!childId.success) {
    return { error: "Vyberte, komu postup patří." };
  }

  const session = parseAnonSession(formData.get("anonSession"));
  if (!session || session.lessons.length === 0) {
    return { error: "Na tomhle počítači už nejsou žádné rozdělané lekce." };
  }

  /* Vlastnictví ručně: zápis jde servisním klientem, který obchází RLS.
     Stejná hláška pro cizí i neexistující profil — jinak by šlo zjistit,
     která id existují. */
  const { data: child } = await supabase
    .from("children")
    .select("id, nick")
    .eq("id", childId.data)
    .eq("parent_id", auth.user.id)
    .maybeSingle();

  if (!child) {
    return { error: "Profil nenalezen." };
  }

  let written = false;
  try {
    written = await writeLessonProgress(child.id, session.lessons);
  } catch (err) {
    console.error("[anon] Převzetí postupu selhalo:", err);
  }

  /* Při neúspěchu nic nemažeme na straně prohlížeče — o postup nesmí přijít. */
  if (!written) {
    return {
      error:
        "Postup se nepodařilo převzít. Zkuste to prosím znovu — lekce na tomhle počítači zůstávají.",
    };
  }

  /* Výtvory až po zapsaném postupu; jejich selhání převzetí neshodí. */
  const builds = parseAnonBuilds(formData.get("anonBuilds"));
  if (builds.length > 0) after(() => writeAnonBuilds(child.id, builds));

  after(() => issueEarnedCertificates(child.id));
  revalidatePath("/ucet");

  return { success: `Postup je v profilu ${child.nick}.` };
}
