import type { SyncableState } from "@/types";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Obranná validace JSONB stavu z cloudu před CLOUD_HYDRATE / CLOUD_RECONCILE.
 * `null` = stav je neopravitelný → volající hydrate přeskočí (lokální stav vyhrává).
 * Volitelná pole (circuits, codeDrafts) se při poškození nahradí `{}` místo zahození celku.
 */
export function sanitizeCloudState(raw: unknown): SyncableState | null {
  if (!isRecord(raw)) return null;
  const { account, tasks, sections, circuits, codeDrafts } = raw;
  if (!isRecord(account) || !isRecord(tasks) || !isRecord(sections)) return null;
  if (typeof account.stars !== "number" || typeof account.tokens !== "number") return null;
  if (typeof account.avatarId !== "string" || typeof account.currentTheme !== "string") return null;
  if (!Array.isArray(account.unlockedThemes) || !Array.isArray(account.unlockedAvatars)) return null;
  return {
    account: account as unknown as SyncableState["account"],
    tasks: tasks as unknown as SyncableState["tasks"],
    sections: sections as unknown as SyncableState["sections"],
    circuits: isRecord(circuits) ? (circuits as unknown as SyncableState["circuits"]) : {},
    codeDrafts: isRecord(codeDrafts) ? (codeDrafts as unknown as SyncableState["codeDrafts"]) : {},
  };
}
