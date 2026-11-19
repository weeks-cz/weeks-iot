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
  email: string | null;
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
  /**
   * Id ostatních žádostí na stejnou adresu (citext, bez ohledu na velikost
   * písmen), které mají platný souhlas a nejsou odhlášené. Chyba se HAZÍ:
   * prázdný seznam by vypadal jako „nic dalšího není“.
   */
  findSiblings(email: string, exceptId: string): Promise<string[]>;
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
        .select("email, marketing_consent, unsubscribed_at, anonymized_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
    },
    async findSiblings(email, exceptId) {
      const { data, error } = await db
        .from("device_link_requests")
        .select("id")
        .eq("email", email)
        .neq("id", exceptId)
        .eq("marketing_consent", true)
        .is("unsubscribed_at", null);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => r.id);
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
  /* Smazaná nebo anonymizovaná žádost: není co odvolávat a bez adresy ani
     koho dalšího hledat. Uživateli to říkáme stejně jako úspěch (další
     e-maily nechodí), jen se do ledgeru nic nepíše. */
  if (!row || row.anonymized_at || !row.email) return "already";

  /* „Nechci další e-maily“ platí pro adresu, ne pro jednu žádost: rodič,
     který si odkaz nechal poslat dvakrát, by jinak dál dostával e-maily
     z té druhé. Proto se odvolávají i ostatní žádosti se souhlasem. */
  let siblings: string[];
  try {
    siblings = await service.findSiblings(row.email, id);
  } catch (err) {
    console.error(
      "[odkaz-na-pc] Čtení dalších žádostí selhalo:",
      err instanceof Error ? err.message : err,
    );
    return "error";
  }

  const clickedActive = row.marketing_consent && !row.unsubscribed_at;
  const affected = [...(clickedActive ? [id] : []), ...siblings];
  /* Bez souhlasu nebo už odhlášená a nic dalšího: už je hotovo. */
  if (affected.length === 0) return "already";

  /* Doklad pro každou žádost PŘED změnou jakéhokoli příznaku. Bez dokladu se
     příznak nemění: kdo to zkusí znovu, nenarazí na „už je odhlášeno“, které
     by nebyla pravda. */
  for (const requestId of affected) {
    const recorded = await service.insertConsent({
      parent_id: null,
      child_id: null,
      kind: "marketing",
      version: DEVICE_LINK_MARKETING_TEXT.version,
      text_snapshot: DEVICE_LINK_MARKETING_TEXT.full,
      granted: false,
      ip: ctx.ip,
      user_agent: ctx.userAgent,
      device_link_request_id: requestId,
    });
    if (!recorded) return "error";
  }

  /* Kliknutý řádek se shazuje až nakonec. Kdyby selhal příznak u jiné
     žádosti, opakování kliknutí projde celou cestou znovu, místo aby
     narazilo na „už je odhlášeno“ a ostatní žádosti nechalo být.
     Doklad je v ledgeru, ale příznak se nepodařilo shodit: e-maily by dál
     chodily, tak „hotovo“ neříkáme. Opakování je bezpečné (další doklad
     jen zopakuje odvolání). */
  const flagOrder = [...siblings, ...(clickedActive ? [id] : [])];
  for (const requestId of flagOrder) {
    if (!(await service.markUnsubscribed(requestId, now))) return "error";
  }
  return "done";
}
