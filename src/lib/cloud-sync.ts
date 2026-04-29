import { createClient } from "@/lib/supabase/client";
import type { GameState, LearningEvent, SyncableState } from "@/types";

export function extractSyncableState(state: GameState): SyncableState {
  return {
    account: state.account,
    tasks: state.tasks,
    sections: state.sections,
    circuits: state.circuits,
  };
}

export async function fetchCloudState(userId: string): Promise<SyncableState | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("learning_accounts")
    .select("state")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[cloud-sync] fetch failed:", error.message);
    return null;
  }
  return (data?.state as SyncableState | undefined) ?? null;
}

export async function syncToCloud(state: GameState): Promise<{ ok: boolean; error?: string }> {
  if (!state.linkedUserId) return { ok: true };
  const supabase = createClient();
  const blob = extractSyncableState(state);
  const { error } = await supabase
    .from("learning_accounts")
    .upsert({ id: state.linkedUserId, state: blob });
  if (error) {
    console.warn("[cloud-sync] upsert failed:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
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
