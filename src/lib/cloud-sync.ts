import { createClient } from "@/lib/supabase/client";
import { sanitizeCloudState } from "@/lib/cloud-validate";
import type { GameState, LearningEvent, SyncableState } from "@/types";

export function extractSyncableState(state: GameState): SyncableState {
  return {
    account: state.account,
    tasks: state.tasks,
    sections: state.sections,
    circuits: state.circuits,
    codeDrafts: state.codeDrafts,
  };
}

/** Snapshot z cloudu i s verzí (`updated_at`) pro optimistický zámek. */
export interface CloudSnapshot {
  state: SyncableState;
  updatedAt: string;
  plan: string | null;
  planExpiresAt: string | null;
}

export async function fetchCloudState(userId: string): Promise<CloudSnapshot | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("learning_accounts")
    .select("state, updated_at, plan, plan_expires_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[cloud-sync] fetch failed:", error.message);
    return null;
  }
  if (!data) return null;
  const clean = sanitizeCloudState(data.state);
  if (!clean) {
    console.warn("[cloud-sync] cloud state failed validation — skipping hydrate");
    return null;
  }
  return {
    state: clean,
    updatedAt: data.updated_at as string,
    plan: (data.plan as string | null) ?? null,
    planExpiresAt: (data.plan_expires_at as string | null) ?? null,
  };
}

export interface SyncResult {
  ok: boolean;
  /** true = cloud se od našeho načtení posunul; náš zápis byl zastaralý a NEzapsal se. */
  conflict?: boolean;
  /** nové `updated_at` po úspěšném zápisu — ulož jako další očekávanou verzi. */
  updatedAt?: string;
  error?: string;
}

/**
 * Zápis stavu do cloudu s optimistickým zámkem.
 *
 * - `expectedUpdatedAt === null` → bezpodmínečný upsert (první zápis / propojení účtu).
 * - `expectedUpdatedAt` je řetězec → zapíše JEN když se `updated_at` v cloudu shoduje
 *   (tj. nikdo mezitím nezapsal). Když se neshoduje, vrátí `conflict` a nic nepřepíše —
 *   volající má stáhnout novější stav (cloud vyhrává) místo přepsání zastaralými daty.
 */
export async function syncToCloud(
  state: GameState,
  expectedUpdatedAt: string | null,
): Promise<SyncResult> {
  if (!state.linkedUserId) return { ok: true };
  const supabase = createClient();
  const blob = extractSyncableState(state);

  // První zápis (neznáme verzi / řádek nemusí existovat) → insert přes upsert.
  if (expectedUpdatedAt === null) {
    const { data, error } = await supabase
      .from("learning_accounts")
      .upsert({ id: state.linkedUserId, state: blob })
      .select("updated_at")
      .single();
    if (error) {
      console.warn("[cloud-sync] insert failed:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, updatedAt: data.updated_at as string };
  }

  // Optimistický zámek: přepiš jen pokud se cloud od našeho načtení nezměnil.
  const { data, error } = await supabase
    .from("learning_accounts")
    .update({ state: blob })
    .eq("id", state.linkedUserId)
    .eq("updated_at", expectedUpdatedAt)
    .select("updated_at");
  if (error) {
    console.warn("[cloud-sync] update failed:", error.message);
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) {
    // Jiné zařízení / záložka zapsalo novější stav — náš zápis je zastaralý.
    return { ok: false, conflict: true };
  }
  return { ok: true, updatedAt: data[0]!.updated_at as string };
}

export async function emitEvent(userId: string | null, event: LearningEvent): Promise<void> {
  if (!userId) return; // anonymous / PIN-only sezení neemituje
  const supabase = createClient();
  const { error } = await supabase.from("learning_events").insert({
    user_id: userId,
    event_type: event.event_type,
    task_id: event.task_id ?? null,
    metadata: event.metadata ?? null,
  });
  if (error) {
    console.warn("[cloud-sync] event failed:", error.message);
  }
}
