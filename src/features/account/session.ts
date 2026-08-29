import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AccountType, ParentRow } from "@/lib/supabase/types";

/**
 * Session a účet, načtené jednou za požadavek.
 *
 * ── Proč to existuje ───────────────────────────────────────────────────────
 * Layout rodičovské zóny i každá stránka pod ním potřebují totéž: kdo je
 * přihlášený a jaký má účet. Bez sdílení se `getUser()` volá dvakrát
 * a `parents` se čte dvakrát — tedy čtyři síťová volání navíc na každé
 * přepnutí záložky.
 *
 * `cache()` z Reactu drží výsledek po dobu JEDNOHO vykreslení. Druhé volání
 * ve stejném požadavku dostane hotovou hodnotu, ne nový dotaz. Napříč
 * požadavky se nic nesdílí, takže tu nevzniká riziko, že by jeden uživatel
 * viděl data druhého.
 *
 * Next.js tohle dělá automaticky pro `fetch`, ale klient Supabase přes něj
 * nechodí — u něj se to musí říct výslovně.
 */

export type AccountSummary = Pick<
  ParentRow,
  "id" | "email" | "region_code" | "onboarding_completed_at" | "plan"
> & { account_type: AccountType };

export interface SessionInfo {
  userId: string;
  email: string;
  account: AccountSummary | null;
}

/**
 * Přihlášený uživatel.
 *
 * `getUser()` schválně, ne `getSession()`: to druhé jen přečte cookie
 * a nezkontroluje podpis, takže by se dalo podvrhnout.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/** Uživatel i jeho účet jedním průchodem. */
export const getSession = cache(async (): Promise<SessionInfo | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: account } = await supabase
    .from("parents")
    .select("id, email, region_code, onboarding_completed_at, plan, account_type")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? account?.email ?? "",
    account: (account as AccountSummary | null) ?? null,
  };
});
