import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { DEVICE_LINK_MARKETING_TEXT } from "@/features/consent/texts";
import { requestTokenSecret, verifyRequestToken } from "./token";

/**
 * Odhlášení z e-mailů odkazem bez účtu. Odvolání je nový řádek ledgeru
 * (`granted = false`), nikdy update; příznak na žádosti se mění teprve po
 * zapsaném dokladu.
 */

export type UnsubscribeResult = "done" | "already" | "invalid" | "error";

export type UnsubscribeRow = {
  marketing_consent: boolean;
  unsubscribed_at: string | null;
  anonymized_at: string | null;
};

export type WithdrawalInsert = {
  parent_id: null;
  child_id: null;
  kind: "marketing";
  version: string;
  text_snapshot: string;
  granted: false;
  ip: string | null;
  user_agent: string | null;
  device_link_request_id: string;
};

export interface UnsubscribeStore {
  /** null = řádek neexistuje. Chyba databáze se HAZÍ, nesmí vypadat jako null. */
  find(id: string): Promise<UnsubscribeRow | null>;
  /** true = doklad je v ledgeru. */
  insertConsent(row: WithdrawalInsert): Promise<boolean>;
  /** `marketing_consent = false`, `unsubscribed_at = at`. true = příznak je shozený. */
  markUnsubscribed(id: string, at: Date): Promise<boolean>;
}

export interface UnsubscribeDeps {
  service: UnsubscribeStore;
  secret: () => string;
  now?: Date;
}

export interface UnsubscribeContext {
  ip: string | null;
  userAgent: string | null;
}

export function supabaseUnsubscribeStore(): UnsubscribeStore {
  const db = createServiceClient();
  return {
    async find(id) {
      const { data, error } = await db
        .from("device_link_requests")
        .select("marketing_consent, unsubscribed_at, anonymized_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
    },
    async insertConsent(row) {
      const { error } = await db.from("consents").insert(row);
      if (error) console.error("[odkaz-na-pc] Zápis odvolání selhal:", error.message);
      return !error;
    },
    async markUnsubscribed(id, at) {
      /* Podmíněný update: souběžné odhlášení nepřepíše první čas. */
      const { error } = await db
        .from("device_link_requests")
        .update({ marketing_consent: false, unsubscribed_at: at.toISOString() })
        .eq("id", id)
        .is("unsubscribed_at", null);
      if (error) console.error("[odkaz-na-pc] Zápis odhlášení selhal:", error.message);
      return !error;
    },
  };
}

export async function unsubscribe(
  token: string,
  ctx: UnsubscribeContext,
  deps: Partial<UnsubscribeDeps> = {},
): Promise<UnsubscribeResult> {
  let id: string | null;
  try {
    id = verifyRequestToken(token, (deps.secret ?? requestTokenSecret)(), "unsub");
  } catch (err) {
    console.error("[odkaz-na-pc] Chybí secret:", err instanceof Error ? err.message : err);
    return "invalid";
  }
  if (!id) return "invalid";

  const service = deps.service ?? supabaseUnsubscribeStore();
  const now = deps.now ?? new Date();

  let row: UnsubscribeRow | null;
  try {
    row = await service.find(id);
  } catch (err) {
    /* Chyba databáze není „nenalezeno": nesmíme říct, že je hotovo. */
    console.error("[odkaz-na-pc] Čtení žádosti selhalo:", err instanceof Error ? err.message : err);
    return "error";
  }
  /* Smazaná, anonymizovaná, bez souhlasu nebo už odhlášená žádost: není co
     odvolávat. Uživateli to říkáme stejně jako úspěch (další e-maily
     nechodí), jen se do ledgeru nic nepíše. */
  if (!row || row.anonymized_at || !row.marketing_consent || row.unsubscribed_at) {
    return "already";
  }

  const recorded = await service.insertConsent({
    parent_id: null,
    child_id: null,
    kind: "marketing",
    version: DEVICE_LINK_MARKETING_TEXT.version,
    text_snapshot: DEVICE_LINK_MARKETING_TEXT.full,
    granted: false,
    ip: ctx.ip,
    user_agent: ctx.userAgent,
    device_link_request_id: id,
  });
  /* Bez dokladu se příznak nemění: kdo to zkusí znovu, nenarazí na „už je
     odhlášeno", které by nebyla pravda. */
  if (!recorded) return "error";

  /* Doklad je v ledgeru, ale příznak se nepodařilo shodit: e-maily by dál
     chodily, tak „hotovo" neříkáme. Opakování je bezpečné (další doklad
     jen zopakuje odvolání). */
  return (await service.markUnsubscribed(id, now)) ? "done" : "error";
}
