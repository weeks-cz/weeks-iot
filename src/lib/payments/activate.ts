import type { SupabaseClient } from "@supabase/supabase-js";
import { computeNewExpiry, type PlanPeriod } from "@/lib/payments/plans";

/** Aktivuje/prodlouží premium. Volat JEN service-role klientem (plan je client-read-only). */
export async function activatePremium(
  svc: SupabaseClient,
  userId: string,
  period: PlanPeriod,
  now: Date = new Date(),
): Promise<string> {
  const { data } = await svc
    .from("learning_accounts")
    .select("plan_expires_at")
    .eq("id", userId)
    .maybeSingle();
  const newExpiry = computeNewExpiry(data?.plan_expires_at ?? null, period, now);
  const { error } = await svc
    .from("learning_accounts")
    .upsert({ id: userId, plan: "student", plan_expires_at: newExpiry });
  if (error) throw new Error(`activatePremium failed: ${error.message}`);
  return newExpiry;
}
