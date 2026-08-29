import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ChildPublic } from "@/lib/supabase/types";

export interface ChildSummary extends ChildPublic {
  hasPin: boolean;
  isLocked: boolean;
  lessonsCompleted: number;
}

/**
 * Profily dětí pro rodičovskou zónu.
 *
 * Stav PINu se dotahuje servisním klientem: sloupce `pin_hash`
 * a `pin_locked_until` jsou mimo klientský grant, takže se k nim běžný
 * dotaz nedostane. Ven jde jen ano/ne, nikdy hash.
 */
export async function getChildren(parentId: string): Promise<ChildSummary[]> {
  const supabase = await createClient();

  /* Explicitní výčet sloupců místo "*": hash PINu by se sem sice stejně
     nedostal (chybí grant), ale výčet drží veřejný tvar viditelný v kódu. */
  const { data: children } = await supabase
    .from("children")
    .select("id, parent_id, nick, birth_date, birth_year, avatar, archived_at, created_at, updated_at")
    .eq("parent_id", parentId)
    .is("archived_at", null)
    .order("created_at");

  if (!children?.length) return [];

  const ids = children.map((c) => c.id);
  const service = createServiceClient();

  const [{ data: pinRows }, { data: progressRows }] = await Promise.all([
    service.from("children").select("id, pin_hash, pin_locked_until").in("id", ids),
    service
      .from("progress")
      .select("child_id, status")
      .in("child_id", ids)
      .eq("status", "completed"),
  ]);

  const pinById = new Map(
    (pinRows ?? []).map((r) => [
      r.id,
      {
        hasPin: Boolean(r.pin_hash),
        isLocked: r.pin_locked_until
          ? Date.parse(r.pin_locked_until) > Date.now()
          : false,
      },
    ]),
  );

  const completedByChild = new Map<string, number>();
  for (const row of progressRows ?? []) {
    completedByChild.set(row.child_id, (completedByChild.get(row.child_id) ?? 0) + 1);
  }

  return children.map((child) => ({
    ...child,
    hasPin: pinById.get(child.id)?.hasPin ?? false,
    isLocked: pinById.get(child.id)?.isLocked ?? false,
    lessonsCompleted: completedByChild.get(child.id) ?? 0,
  }));
}

