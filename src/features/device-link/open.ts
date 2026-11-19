import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { EVENT } from "@/features/analytics/events";
import { requestTokenSecret, verifyRequestToken } from "./token";

/**
 * Otevření odkazu z e-mailu. Mimo `"use server"`, aby šla logika testovat
 * s podstrčenými závislostmi.
 *
 * Dvě různá tvrzení:
 *  - `verified_at`: odkaz se otevřel NA JAKÉMKOLI zařízení, tedy majitel
 *    schránky e-mail dostal.
 *  - `opened_at`: odkaz se otevřel NA POČÍTAČI. Jen ten zruší připomínku;
 *    telefon ji nezruší, protože rodič se na počítač teprve chystá.
 */

export type OpenDevice = "computer" | "phone";
export type OpenResult = "opened" | "already" | "phone" | "invalid";

/** Úzké rozhraní nad databází; produkčně servisní klient, v testech fake. */
export interface OpenStore {
  /** Nastaví `verified_at`, jen kde je prázdné. */
  setVerified(id: string, at: Date): Promise<void>;
  /** Nastaví `opened_at`, jen kde je prázdné. true = tentokrát se nastavilo. */
  setOpened(id: string, at: Date): Promise<boolean>;
  insertEvent(type: string, props: Record<string, unknown>): Promise<void>;
}

export interface OpenDeps {
  service: OpenStore;
  /** Vyhodí chybu, když secret chybí. */
  secret: () => string;
  now?: Date;
}

export function supabaseOpenStore(): OpenStore {
  const db = createServiceClient();
  return {
    async setVerified(id, at) {
      const { error } = await db
        .from("device_link_requests")
        .update({ verified_at: at.toISOString() })
        .eq("id", id)
        .is("verified_at", null);
      if (error) console.error("[odkaz-na-pc] Zápis verified_at selhal:", error.message);
    },
    async setOpened(id, at) {
      /* Podmíněný update je atomický: dvě souběžná otevření nastaví
         `opened_at` jen jednou a jen jedno z nich uvidí řádek ve výsledku. */
      const { data, error } = await db
        .from("device_link_requests")
        .update({ opened_at: at.toISOString() })
        .eq("id", id)
        .is("opened_at", null)
        .select("id");
      if (error) {
        console.error("[odkaz-na-pc] Zápis opened_at selhal:", error.message);
        return false;
      }
      return (data?.length ?? 0) > 0;
    },
    async insertEvent(type, props) {
      const { error } = await db
        .from("learning_events")
        .insert({ type, anon_id: null, parent_id: null, props });
      if (error) console.error("[odkaz-na-pc] Zápis události selhal:", error.message);
    },
  };
}

export async function markOpened(
  token: string,
  device: OpenDevice,
  env: string,
  deps: Partial<OpenDeps> = {},
): Promise<OpenResult> {
  /* Fail-closed: bez secretu nebo s cizím podpisem se nesáhne na databázi. */
  let id: string | null;
  try {
    id = verifyRequestToken(token, (deps.secret ?? requestTokenSecret)(), "open");
  } catch (err) {
    console.error("[odkaz-na-pc] Chybí secret:", err instanceof Error ? err.message : err);
    return "invalid";
  }
  if (!id) return "invalid";

  const service = deps.service ?? supabaseOpenStore();
  const now = deps.now ?? new Date();

  await service.setVerified(id, now);

  let result: OpenResult = "phone";
  if (device === "computer") {
    result = (await service.setOpened(id, now)) ? "opened" : "already";
  }

  /* Bez anon_id, bez id žádosti a bez e-mailu: jen kde a v čem se odkaz otevřel. */
  await service.insertEvent(EVENT.DEVICE_LINK_OPEN, { device, env });
  return result;
}
