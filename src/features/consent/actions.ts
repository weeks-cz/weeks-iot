"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { EVENT } from "@/features/analytics/events";
import type { ActionState } from "@/features/actions";
import { consentTextFor } from "./texts";

/**
 * Změna souhlasu.
 *
 * Odvolání musí být stejně snadné jako udělení — jedno tlačítko. Zapisuje
 * se jako nový řádek ledgeru, nikdy jako úprava starého: ledger, který jde
 * přepsat, není důkaz.
 */

const consentChangeSchema = z.object({
  kind: z.enum(["terms", "parental", "marketing"]),
  granted: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export async function changeConsentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/prihlaseni");

  const parsed = consentChangeSchema.safeParse({
    kind: formData.get("kind"),
    granted: formData.get("granted"),
  });

  if (!parsed.success) return { error: "Neplatný požadavek." };

  const { kind, granted } = parsed.data;

  const limit = await rateLimit("consent", auth.user.id);
  if (!limit.allowed) {
    return { error: "Příliš mnoho změn za sebou. Zkuste to prosím za hodinu." };
  }

  /* Odvolání souhlasu zákonného zástupce má následek, který se nedá udělat
     potichu: bez něj nemá zpracování údajů dítěte právní základ. Vede proto
     na samostatnou obrazovku s potvrzením, ne na jedno tlačítko. */
  if (kind === "parental" && !granted) {
    redirect("/ucet/smazat?duvod=souhlas");
  }

  /* Podmínky užití odvolat nejde — je to plnění smlouvy, ne souhlas.
     Kdo je nechce, ruší účet. */
  if (kind === "terms" && !granted) {
    redirect("/ucet/smazat?duvod=podminky");
  }

  const requestHeaders = await headers();
  const text = consentTextFor(kind);

  const { error } = await supabase.rpc("record_consent", {
    p_kind: kind,
    p_version: text.version,
    p_text_snapshot: text.full,
    p_granted: granted,
    p_ip: clientIp(requestHeaders),
    p_user_agent: requestHeaders.get("user-agent")?.slice(0, 500) ?? null,
  } as never);

  if (error) {
    console.error("[consent] Zápis selhal:", error.message);
    return { error: "Změnu se nepodařilo uložit. Zkuste to prosím znovu." };
  }

  await supabase.from("learning_events").insert({
    type: granted ? EVENT.CONSENT_GRANTED : EVENT.CONSENT_REVOKED,
    parent_id: auth.user.id,
    props: { kind, version: text.version },
  });

  revalidatePath("/ucet/souhlasy");
  return {
    success: granted
      ? "Souhlas udělen."
      : "Souhlas odvolán. Obchodní sdělení už vám posílat nebudeme.",
  };
}

/* ── Smazání účtu ──────────────────────────────────────────────────────── */

export async function deleteAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/prihlaseni");

  /* Opsání slova místo pouhého zaškrtnutí. Smazání je nevratné a stojí za
     to, aby si ho člověk musel chvíli rozmyslet. */
  if (String(formData.get("potvrzeni") ?? "").trim().toUpperCase() !== "SMAZAT") {
    return { fieldErrors: { potvrzeni: 'Pro potvrzení opište slovo "SMAZAT".' } };
  }

  const userId = auth.user.id;
  const requestHeaders = await headers();

  /* Odvolání souhlasu se zapisuje i tak, přestože ho kaskáda za chvíli
     smaže. Má to smysl: kdyby smazání níž selhalo, zůstane účet naživu
     a odvolaný souhlas v něm platí — tedy stav, který rodič chtěl. */
  const parentalText = consentTextFor("parental");
  await supabase.rpc("record_consent", {
    p_kind: "parental",
    p_version: parentalText.version,
    p_text_snapshot: parentalText.full,
    p_granted: false,
    p_ip: clientIp(requestHeaders),
    p_user_agent: requestHeaders.get("user-agent")?.slice(0, 500) ?? null,
  } as never);

  /* Anonymizovaná stopa. learning_events má na parent_id `on delete set
     null`, takže tenhle řádek smazání přežije — ale bez vazby na osobu.
     Zůstane z něj jen "někdy toho dne byl na žádost smazán účet", což je
     přesně tolik, kolik je potřeba, a ani o údaj víc. */
  await supabase.from("learning_events").insert({
    type: EVENT.ACCOUNT_DELETED,
    parent_id: userId,
    props: { requested: true },
  });

  const service = createServiceClient();

  /* Smazání uživatele v auth.users strhne kaskádou parents a odtud
     children, progress, projects i ledger souhlasů.

     Ledger tedy odchází s rodičem, a je to tak správně: držet záznamy
     o souhlasu navázané na člověka, jehož ostatní údaje jsme na žádost
     smazali, by znamenalo uchovávat osobní údaje bez právního základu.
     Prokazovat souhlas ke zpracování, které už neexistuje, po nás nikdo
     chtít nemůže. */
  const { error } = await service.auth.admin.deleteUser(userId);

  if (error) {
    console.error("[account] Smazání selhalo:", error.message);
    return { error: "Účet se nepodařilo smazat. Napište nám prosím na info@weeks.cz." };
  }

  await supabase.auth.signOut();
  redirect("/?ucet=smazan");
}
