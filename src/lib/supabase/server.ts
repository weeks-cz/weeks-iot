import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./types";

/** Klient vázaný na session přihlášeného uživatele. Respektuje RLS. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            /* Voláno z Server Componenty, kde se cookies zapisovat nedají.
               Session obnovuje middleware, takže se tu dá bezpečně mlčet. */
          }
        },
      },
    },
  );
}

/**
 * Klient se servisní rolí — obchází RLS.
 *
 * Používat VÝHRADNĚ v Server Actions, route handlerech a cronech, a jen tam,
 * kde je oprávnění ověřené jinak. Nikdy v komponentě. Klíč se sem nesmí dostat
 * přes NEXT_PUBLIC_, jinak skončí v prohlížečovém bundlu.
 */
export function createServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Chybí SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY. " +
        "Servisní klient bez nich nemá jak fungovat.",
    );
  }

  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
