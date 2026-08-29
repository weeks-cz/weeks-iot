"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Klient pro prohlížeč.
 *
 * Modulový singleton schválně: bez něj dostane každé volání createClient()
 * vlastní instanci a `onAuthStateChange` se mezi nimi nikdy nepropíše —
 * přihlášení pak v části stromu tiše nezareaguje. Převzato z legacy, kde
 * to bylo ověřené v praxi.
 */
let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}
